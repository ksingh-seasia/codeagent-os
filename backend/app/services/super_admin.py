from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status
import secrets
import string

from app.services.email import send_email, transport_name
from app.models.domain import Company, User, License, PlatformSettings
from app.schemas.super_admin import CompanyCreate, CompanyUpdate, LicenseCreate, LicenseUpdate, PlatformUserCreate, PlatformUserUpdate, PlatformSettingsUpdate
from app.core.security import get_password_hash

async def send_credentials_email(db: AsyncSession, to_email: str, password: str, company_name: str):
    settings = await get_or_create_platform_settings(db)

    html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <h2 style="color: #4f46e5; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">CodeAgent OS Platform</h2>
              <p>Welcome to CodeAgent OS for <b>{company_name}</b>,</p>
              <p>Your tenant administrator account has been provisioned successfully. You can log in using the following credentials:</p>
              <div style="background-color: #f8f9ff; padding: 15px; border-left: 4px solid #3525cd; margin: 20px 0;">
                <strong>Email:</strong> {to_email}<br>
                <strong>Password:</strong> {password}
              </div>
              <p>Please log in and change your password immediately.</p>
            </div>
          </body>
        </html>
    """

    ok, _detail = await send_email(
        to_email,
        f"Welcome to CodeAgent OS - {company_name} Credentials",
        html,
        platform_settings=settings,
    )
    return ok


async def get_dashboard_metrics(db: AsyncSession):
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    
    active_companies = [c for c in companies if c.status == "ACTIVE"]
    suspended_companies = [c for c in companies if c.status == "SUSPENDED"]
    
    return {
        "metrics": {
            "total_companies": len(companies),
            "active_companies": len(active_companies),
            "suspended_companies": len(suspended_companies),
            "total_developers": 0, # To be aggregated
            "active_licenses": 0,
            "licenses_used": 0
        }
    }

async def get_all_companies(db: AsyncSession):
    result = await db.execute(select(Company))
    companies = result.scalars().all()
    
    user_result = await db.execute(select(User).where(User.role == "TENANT_ADMIN"))
    admins = user_result.scalars().all()
    admin_map = {admin.company_id: admin for admin in admins}
    
    for company in companies:
        admin = admin_map.get(company.id)
        if admin:
            setattr(company, "admin_name", admin.name)
            setattr(company, "admin_email", admin.email)
            
    return companies

async def get_company_by_id(db: AsyncSession, company_id: int):
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalars().first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        
    user_result = await db.execute(select(User).where(User.company_id == company.id, User.role == "TENANT_ADMIN"))
    admin = user_result.scalars().first()
    if admin:
        setattr(company, "admin_name", admin.name)
        setattr(company, "admin_email", admin.email)
        
    return company

async def create_company_service(db: AsyncSession, data: CompanyCreate):
    result = await db.execute(select(Company).where(Company.domain == data.domain))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domain already registered")
        
    new_company = Company(
        name=data.name,
        domain=data.domain,
        status="ACTIVE",
        tech_stack=data.tech_stack,
        git_provider=data.git_provider,
        license_id=data.license_id,
        license_tier=data.license_tier,
        allocated_seats=data.allocated_seats,
        concurrent_limit=data.concurrent_limit,
        run_cap=data.run_cap,
        sso_enforced=data.sso_enforced,
        mfa_enforced=data.mfa_enforced,
        circuit_breaker=data.circuit_breaker,
        jira_sync=data.jira_sync
    )
    db.add(new_company)
    await db.commit()
    await db.refresh(new_company)
    
    p_settings = await get_or_create_platform_settings(db)
    pwd_len = max(12, p_settings.min_password_length) if p_settings.min_password_length else 12
    alphabet = string.ascii_letters + string.digits
    if p_settings.require_special_chars:
        alphabet += "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for i in range(pwd_len - 2))
    if p_settings.require_special_chars:
        password += secrets.choice("!@#$%^&*") + secrets.choice(string.digits)
    else:
        password += ''.join(secrets.choice(alphabet) for i in range(2))
    
    tenant_admin = User(
        company_id=new_company.id,
        name=data.admin_name,
        email=data.admin_email,
        password_hash=get_password_hash(password),
        role="TENANT_ADMIN",
        status="ACTIVE"
    )
    db.add(tenant_admin)
    await db.commit()
    
    if data.license_id:
        from app.models.domain import CompanyLicense
        from datetime import datetime, timedelta
        
        company_license = CompanyLicense(
            company_id=new_company.id,
            license_id=data.license_id,
            total_licenses=data.allocated_seats,
            used_licenses=1, # tenant admin takes 1 seat
            expires_at=datetime.utcnow() + timedelta(days=30),
            status="ACTIVE"
        )
        db.add(company_license)
        await db.commit()

    print(f"[MOCK EMAIL] Generated credentials for {data.admin_email} | password: {password}")
    await send_credentials_email(db, data.admin_email, password, data.name)
    
    setattr(new_company, "admin_name", data.admin_name)
    setattr(new_company, "admin_email", data.admin_email)
    
    return new_company

async def update_company_service(db: AsyncSession, company_id: int, data: CompanyUpdate):
    company = await get_company_by_id(db, company_id)
        
    if data.name is not None:
        company.name = data.name
    if data.domain is not None:
        company.domain = data.domain
    if data.status is not None:
        company.status = data.status
        
    if data.admin_name is not None or data.admin_email is not None:
        user_result = await db.execute(select(User).where(User.company_id == company_id, User.role == "TENANT_ADMIN"))
        admin = user_result.scalars().first()
        if admin:
            if data.admin_name is not None:
                admin.name = data.admin_name
            if data.admin_email is not None:
                admin.email = data.admin_email
                
    if data.tech_stack is not None:
        company.tech_stack = data.tech_stack
    if data.git_provider is not None:
        company.git_provider = data.git_provider
    if data.license_id is not None:
        company.license_id = data.license_id
        
        # Update CompanyLicense if exists or create new
        from app.models.domain import CompanyLicense
        from datetime import datetime, timedelta
        
        result = await db.execute(select(CompanyLicense).where(CompanyLicense.company_id == company_id))
        company_license = result.scalars().first()
        
        if company_license:
            company_license.license_id = data.license_id
            if data.allocated_seats is not None:
                company_license.total_licenses = data.allocated_seats
        else:
            company_license = CompanyLicense(
                company_id=company_id,
                license_id=data.license_id,
                total_licenses=data.allocated_seats or 20,
                used_licenses=1,
                expires_at=datetime.utcnow() + timedelta(days=30),
                status="ACTIVE"
            )
            db.add(company_license)
        
    if data.license_tier is not None:
        company.license_tier = data.license_tier
    if data.allocated_seats is not None:
        company.allocated_seats = data.allocated_seats
    if data.concurrent_limit is not None:
        company.concurrent_limit = data.concurrent_limit
    if data.run_cap is not None:
        company.run_cap = data.run_cap
    if data.sso_enforced is not None:
        company.sso_enforced = data.sso_enforced
    if data.mfa_enforced is not None:
        company.mfa_enforced = data.mfa_enforced
    if data.circuit_breaker is not None:
        company.circuit_breaker = data.circuit_breaker
    if data.jira_sync is not None:
        company.jira_sync = data.jira_sync
        
    await db.commit()
    await db.refresh(company)
    
    if data.admin_name is not None or data.admin_email is not None:
        user_result = await db.execute(select(User).where(User.company_id == company_id, User.role == "TENANT_ADMIN"))
        admin = user_result.scalars().first()
        if admin:
            setattr(company, "admin_name", admin.name)
            setattr(company, "admin_email", admin.email)
            
    return company

async def delete_company_service(db: AsyncSession, company_id: int):
    company = await get_company_by_id(db, company_id)
    await db.delete(company)
    await db.commit()
    return {"message": "Company deleted"}

async def get_all_licenses(db: AsyncSession):
    result = await db.execute(select(License))
    return result.scalars().all()

async def get_license_by_id(db: AsyncSession, license_id: int):
    result = await db.execute(select(License).where(License.id == license_id))
    license_obj = result.scalars().first()
    if not license_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    return license_obj

async def create_license_service(db: AsyncSession, data: LicenseCreate):
    result = await db.execute(select(License).where(License.name == data.name))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="License with this name already exists")
    
    new_license = License(
        name=data.name,
        description=data.description,
        badge=data.badge,
        developer_limit=data.developer_limit,
        agent_concurrency=data.agent_concurrency,
        infrastructure_strategy=data.infrastructure_strategy,
        stripe_product_id=data.stripe_product_id,
        monthly_price=data.monthly_price,
        annual_price=data.annual_price,
        price=data.price,
        billing_period=data.billing_period,
        status="ACTIVE"
    )
    db.add(new_license)
    await db.commit()
    await db.refresh(new_license)
    return new_license

async def update_license_service(db: AsyncSession, license_id: int, data: LicenseUpdate):
    license_obj = await get_license_by_id(db, license_id)
    
    if data.name is not None:
        license_obj.name = data.name
    if data.description is not None:
        license_obj.description = data.description
    if data.badge is not None:
        license_obj.badge = data.badge
    if data.developer_limit is not None:
        license_obj.developer_limit = data.developer_limit
    if data.agent_concurrency is not None:
        license_obj.agent_concurrency = data.agent_concurrency
    if data.infrastructure_strategy is not None:
        license_obj.infrastructure_strategy = data.infrastructure_strategy
    if data.stripe_product_id is not None:
        license_obj.stripe_product_id = data.stripe_product_id
    if data.monthly_price is not None:
        license_obj.monthly_price = data.monthly_price
    if data.annual_price is not None:
        license_obj.annual_price = data.annual_price
    if data.price is not None:
        license_obj.price = data.price
    if data.billing_period is not None:
        license_obj.billing_period = data.billing_period
    if data.status is not None:
        license_obj.status = data.status
        
    await db.commit()
    await db.refresh(license_obj)
    return license_obj

async def delete_license_service(db: AsyncSession, license_id: int):
    license_obj = await get_license_by_id(db, license_id)
    # Check if companies are using this license before deleting could be a good idea,
    # but for simplicity we'll just delete.
    await db.delete(license_obj)
    await db.commit()
    return {"message": "License deleted"}

async def get_platform_users(db: AsyncSession):
    result = await db.execute(
        select(User).where(User.role.in_(["SUPER_ADMIN", "CUSTOM_ADMIN"]))
    )
    return result.scalars().all()

async def get_platform_user_by_id(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(User).where(User.id == user_id, User.role.in_(["SUPER_ADMIN", "CUSTOM_ADMIN"]))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Platform user not found")
    return user

async def create_platform_user_service(db: AsyncSession, data: PlatformUserCreate):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        
    alphabet = string.ascii_letters + string.digits
    password = ''.join(secrets.choice(alphabet) for i in range(12))
    
    new_user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(password),
        role=data.role,
        scope=data.scope,
        status="ACTIVE"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    print(f"[MOCK EMAIL] Sent credentials to {data.email} | password: {password}")
    return new_user

async def update_platform_user_service(db: AsyncSession, user_id: int, data: PlatformUserUpdate):
    user = await get_platform_user_by_id(db, user_id)
    
    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.scope is not None:
        user.scope = data.scope
    if data.status is not None:
        user.status = data.status
        
    await db.commit()
    await db.refresh(user)
    return user

async def delete_platform_user_service(db: AsyncSession, user_id: int):
    user = await get_platform_user_by_id(db, user_id)
    await db.delete(user)
    await db.commit()
    return {"message": "Platform user deleted"}

async def get_or_create_platform_settings(db: AsyncSession):
    result = await db.execute(select(PlatformSettings))
    settings = result.scalars().first()
    if not settings:
        settings = PlatformSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings

async def update_platform_settings(db: AsyncSession, data: PlatformSettingsUpdate):
    settings = await get_or_create_platform_settings(db)
    for key, value in data.dict(exclude_unset=True).items():
        setattr(settings, key, value)
    await db.commit()
    await db.refresh(settings)
    return settings

async def send_test_email(db: AsyncSession, to_email: str):
    settings = await get_or_create_platform_settings(db)
    transport = transport_name()

    html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <h2 style="color: #4f46e5; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">CodeAgent OS Platform</h2>
              <p>Hello Admin,</p>
              <p>This is an automated test email confirming that your mail dispatch configuration is working correctly.</p>
              <div style="background-color: #f8f9ff; padding: 15px; border-left: 4px solid #3525cd; margin: 20px 0;">
                <strong>Status:</strong> <span style="color: #059669;">Verified</span><br>
                <strong>Transport:</strong> {transport}
              </div>
              <p>If you received this message, no further action is required.</p>
              <br>
              <p style="font-size: 12px; color: #888;">
                This message was dispatched from your CodeAgent OS Super Admin console.<br>
                Please do not reply directly to this email.
              </p>
            </div>
          </body>
        </html>
    """

    ok, detail = await send_email(
        to_email,
        "Platform Configuration - Test Email",
        html,
        platform_settings=settings,
    )
    if not ok:
        raise HTTPException(status_code=502, detail=detail)
    return {"status": "success", "message": f"Test email sent successfully ({detail})"}

