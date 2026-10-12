from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
import string
import random
from datetime import datetime

from app.db.session import get_db
from app.models.domain import User, Company, Execution
from app.api.auth import get_current_user
from app.schemas.tenant_admin import DeveloperCreate, DeveloperUpdate, DeveloperResponse, DeveloperCreatedResponse, SettingsUpdate
from app.core.security import get_password_hash

async def send_developer_invite_email(db: AsyncSession, to_email: str, company_name: str, developer_name: str, invite_token: str):
    from app.services.super_admin import get_or_create_platform_settings
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    settings = await get_or_create_platform_settings(db)
    if not settings.smtp_host or not settings.smtp_port or not settings.smtp_user or not settings.smtp_pass:
        print(f"[WARNING] SMTP not configured. Could not send invite to {to_email}")
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"You have been invited to join {company_name} on CodeAgent OS"
        msg["From"] = settings.from_email or "no-reply@codeagent.io"
        msg["To"] = to_email
        
        login_url = f"http://localhost:3002/?invite_token={invite_token}" # Developer Portal is on 3002
        
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <h2 style="color: #4f46e5; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">Welcome to CodeAgent OS</h2>
              <p>Hi {developer_name},</p>
              <p>You have been added as a developer to <b>{company_name}</b>.</p>
              <p>To get started, simply click the link below to accept your invitation and log in:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{login_url}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Accept Invitation &amp; Log in with GitHub
                </a>
              </div>
              <p>Our AI agents run securely in the cloud, meaning there are no local CLI tools to install or configure. By logging in with your GitHub account, your repositories will automatically connect to the platform, allowing you to execute AI coding tasks immediately.</p>
              <p>Welcome aboard!<br>The {company_name} Team</p>
            </div>
          </body>
        </html>
        """
        part = MIMEText(html, "html")
        msg.attach(part)
        
        if str(settings.smtp_port) == '465':
            server = smtplib.SMTP_SSL(settings.smtp_host, int(settings.smtp_port))
        else:
            server = smtplib.SMTP(settings.smtp_host, int(settings.smtp_port))
            server.starttls()
        server.login(settings.smtp_user, settings.smtp_pass)
        server.sendmail(msg["From"], to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send invite email to {to_email}: {str(e)}")
        return False

router = APIRouter()
def generate_strong_password(length=12):
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(random.choice(characters) for i in range(length))

@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    company = await db.get(Company, current_user.company_id)
    if not company:
        if current_user.email == "mock@example.com":
            company = Company(id=1, name="TechCorp Inc.", domain="techcorp.com", license_tier="Enterprise", status="ACTIVE", allocated_seats=20, concurrent_limit=5)
        else:
            raise HTTPException(status_code=404, detail="Company not found")

    developer_roles = ["Developer", "Senior Dev", "Staff Dev", "Lead / Principal", "DEVELOPER"]
    result = await db.execute(select(User).where(
        User.company_id == current_user.company_id,
        User.role.in_(developer_roles),
        User.status != "REVOKED"
    ))
    developers = result.scalars().all()
    
    total_developers = len(developers)
    active_developers = len([d for d in developers if d.status == "ACTIVE"])
    
    dev_ids = [d.id for d in developers] + [current_user.id]

    # Dynamic Agent Runs Count for Tenant
    runs_result = await db.execute(
        select(func.count(Execution.id)).where(
            (Execution.company_id == current_user.company_id) | (Execution.user_id.in_(dev_ids))
        )
    )
    agent_runs_used = runs_result.scalar() or 0

    # Dynamic Tokens Consumed for Tenant
    tokens_result = await db.execute(
        select(func.sum(Execution.token_usage)).where(
            (Execution.company_id == current_user.company_id) | (Execution.user_id.in_(dev_ids))
        )
    )
    tokens_consumed = tokens_result.scalar() or 0

    # Dynamic Active Running Agents Count
    active_runs_result = await db.execute(
        select(func.count(Execution.id)).where(
            ((Execution.company_id == current_user.company_id) | (Execution.user_id.in_(dev_ids)))
            & (Execution.status.in_(["RUNNING", "PENDING"]))
        )
    )
    active_agents = active_runs_result.scalar() or 0

    return {
        "metrics": {
            "total_developers": total_developers,
            "active_developers": active_developers,
            "license_limit": company.allocated_seats,
            "licenses_used": total_developers,
            "active_agents": active_agents,
            "concurrent_limit": company.concurrent_limit,
            "agent_runs_used": agent_runs_used,
            "agent_runs_max": company.run_cap or 15000,
            "tokens_consumed": tokens_consumed,
            "monthly_cost": 199,
            "next_billing_date": "Nov 1, 2026",
            "pending_invites": len([d for d in developers if d.status == "Invited"])
        },
        "company": {
            "id": company.id,
            "name": company.name,
            "domain": company.domain,
            "license_tier": company.license_tier,
            "status": company.status,
            "allocated_seats": company.allocated_seats,
            "run_cap": company.run_cap or 15000
        }
    }

@router.get("/recent-runs")
async def get_tenant_recent_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    dev_result = await db.execute(select(User.id).where(User.company_id == current_user.company_id))
    dev_ids = [r[0] for r in dev_result.all()] + [current_user.id]
    
    runs_res = await db.execute(
        select(Execution).where(
            (Execution.company_id == current_user.company_id) | (Execution.user_id.in_(dev_ids))
        ).order_by(Execution.created_at.desc()).limit(10)
    )
    runs = runs_res.scalars().all()
    return [
        {
            "id": r.id,
            "ticketKey": r.jira_ticket_id,
            "status": r.status,
            "tokenUsage": r.token_usage,
            "branch": r.branch_name,
            "prUrl": r.pull_request_url,
            "createdAt": r.created_at.strftime("%b %d, %H:%M") if r.created_at else None
        }
        for r in runs
    ]


@router.get("/developers", response_model=List[DeveloperResponse])
async def list_developers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    developer_roles = ["Developer", "Senior Dev", "Staff Dev", "Lead / Principal", "DEVELOPER"]
    result = await db.execute(select(User).where(
        User.company_id == current_user.company_id,
        User.role.in_(developer_roles),
        User.status != "REVOKED"
    ))
    developers = result.scalars().all()
    
    return developers

@router.post("/developers", response_model=DeveloperCreatedResponse)
async def create_developer(
    developer_in: DeveloperCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    # Check quota
    company = await db.get(Company, current_user.company_id)
    if not company:
        if current_user.email == "mock@example.com":
            company = Company(id=1, name="TechCorp Inc.", domain="techcorp.com", license_tier="Enterprise", status="ACTIVE", allocated_seats=20, concurrent_limit=5)
        else:
            raise HTTPException(status_code=404, detail="Company not found")

    developer_roles = ["Developer", "Senior Dev", "Staff Dev", "Lead / Principal", "DEVELOPER"]
    result = await db.execute(select(User).where(
        User.company_id == current_user.company_id,
        User.role.in_(developer_roles)
    ))
    current_devs = len(result.scalars().all())
    
    if current_devs >= company.allocated_seats:
        raise HTTPException(status_code=400, detail="License limit reached. Please upgrade your tier.")
        
    # Check if email exists
    result = await db.execute(select(User).where(User.email == developer_in.email))
    existing_user = result.scalars().first()
    
    if existing_user:
        if existing_user.company_id == current_user.company_id and existing_user.status == "REVOKED":
            try:
                # Reactivate the revoked developer
                temp_password = generate_strong_password()
                import secrets
                invite_token = secrets.token_urlsafe(32)
                
                existing_user.status = "Invited"
                existing_user.role = developer_in.role
                existing_user.name = developer_in.name
                existing_user.password_hash = get_password_hash(temp_password)
                existing_user.invite_token = invite_token
                
                await db.commit()
                await db.refresh(existing_user)
                
                # Send invite email (reusing the existing function)
                await send_developer_invite_email(db, existing_user.email, company.name, existing_user.name, invite_token)
                
                response_dict = {
                    "id": existing_user.id,
                    "name": existing_user.name,
                    "email": existing_user.email,
                    "role": existing_user.role,
                    "status": existing_user.status,
                    "created_at": existing_user.created_at,
                    "github_token": existing_user.github_token,
                    "jira_token": existing_user.jira_token,
                    "temporary_password": temp_password
                }
                from app.schemas.tenant_admin import DeveloperCreatedResponse
                return DeveloperCreatedResponse(**response_dict)
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print("REACTIVATE ERROR:", error_trace)
                raise HTTPException(status_code=500, detail=f"Reactivate error: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="User with this email already exists")

    temp_password = generate_strong_password()
    hashed_password = get_password_hash(temp_password)

    import secrets
    invite_token = secrets.token_urlsafe(32) # Safe for URLs

    new_user = User(
        company_id=current_user.company_id,
        name=developer_in.name,
        email=developer_in.email,
        password_hash=hashed_password,
        role=developer_in.role, # Role mapping may be needed depending on UI
        status="Invited",
        invite_token=invite_token
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Normally we would send an email here with temp_password
    # We now send the developer invite email (GitHub SSO) with the token
    await send_developer_invite_email(db, new_user.email, company.name, new_user.name, invite_token)
    
    # Return user details + temp_password
    response_dict = {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "status": new_user.status,
        "created_at": new_user.created_at,
        "temporary_password": temp_password
    }
    
    return response_dict

@router.put("/developers/{developer_id}", response_model=DeveloperResponse)
async def update_developer(
    developer_id: int,
    developer_in: DeveloperUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    developer = await db.get(User, developer_id)
    if not developer or developer.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Developer not found")
        
    if developer_in.role:
        developer.role = developer_in.role
    if developer_in.status:
        developer.status = developer_in.status
        
    await db.commit()
    await db.refresh(developer)
    return developer

@router.delete("/developers/{developer_id}")
async def revoke_developer(
    developer_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    developer = await db.get(User, developer_id)
    if not developer or developer.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Developer not found")
        
    developer.status = "REVOKED"
    await db.commit()
    return {"message": "Developer access revoked"}


@router.put("/settings")
async def update_settings(
    settings_in: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    if settings_in.name is not None:
        company.name = settings_in.name
        
    await db.commit()
    await db.refresh(company)
    return {"message": "Settings updated successfully"}
