from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.domain import User
from app.api.auth import get_current_user
from app.schemas.super_admin import CompanyCreate, CompanyUpdate, CompanyResponse, LicenseCreate, LicenseUpdate, LicenseResponse
from app.services.super_admin import (
    get_dashboard_metrics,
    get_all_companies,
    create_company_service,
    get_company_by_id,
    update_company_service,
    delete_company_service,
    get_all_licenses,
    create_license_service,
    get_license_by_id,
    update_license_service,
    delete_license_service,
    get_platform_users,
    create_platform_user_service,
    get_platform_user_by_id,
    update_platform_user_service,
    delete_platform_user_service,
    get_or_create_platform_settings,
    update_platform_settings,
    send_test_email
)
from app.schemas.super_admin import PlatformUserCreate, PlatformUserUpdate, PlatformUserResponse, PlatformSettingsResponse, PlatformSettingsUpdate, TestEmailRequest

router = APIRouter()

def require_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return current_user

@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_dashboard_metrics(db)

@router.get("/companies", response_model=List[CompanyResponse])
async def list_companies(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_all_companies(db)

@router.post("/companies", response_model=CompanyResponse)
async def create_company(
    data: CompanyCreate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await create_company_service(db, data)

@router.get("/companies/{id}", response_model=CompanyResponse)
async def get_company(
    id: int,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_company_by_id(db, id)

@router.put("/companies/{id}", response_model=CompanyResponse)
async def update_company(
    id: int,
    data: CompanyUpdate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await update_company_service(db, id, data)

@router.delete("/companies/{id}")
async def delete_company(
    id: int,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await delete_company_service(db, id)

@router.get("/licenses", response_model=List[LicenseResponse])
async def list_licenses(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_all_licenses(db)

@router.post("/licenses", response_model=LicenseResponse)
async def create_license(
    data: LicenseCreate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await create_license_service(db, data)

@router.get("/licenses/{id}", response_model=LicenseResponse)
async def get_license(
    id: int,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_license_by_id(db, id)

@router.put("/licenses/{id}", response_model=LicenseResponse)
async def update_license(
    id: int,
    data: LicenseUpdate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await update_license_service(db, id, data)

@router.delete("/licenses/{id}")
async def delete_license(
    id: int,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await delete_license_service(db, id)

@router.get("/users", response_model=List[PlatformUserResponse])
async def list_users(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_platform_users(db)

@router.post("/users", response_model=PlatformUserResponse)
async def create_user(
    data: PlatformUserCreate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await create_platform_user_service(db, data)

@router.get("/users/{id}", response_model=PlatformUserResponse)
async def get_user(
    id: int,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_platform_user_by_id(db, id)

@router.put("/users/{id}", response_model=PlatformUserResponse)
async def update_user(
    id: int,
    data: PlatformUserUpdate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await update_platform_user_service(db, id, data)

@router.delete("/users/{id}")
async def delete_user(
    id: int,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await delete_platform_user_service(db, id)

@router.get("/settings", response_model=PlatformSettingsResponse)
async def get_settings(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_or_create_platform_settings(db)

@router.put("/settings", response_model=PlatformSettingsResponse)
async def update_settings(
    data: PlatformSettingsUpdate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    return await update_platform_settings(db, data)

@router.get("/settings/email-status")
async def get_email_status(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Real mail transport status for the Settings console."""
    from app.services.email import transport_status
    from app.services.super_admin import get_or_create_platform_settings

    settings_row = await get_or_create_platform_settings(db)
    return transport_status(settings_row)

@router.post("/settings/test-email")
async def send_test_email_endpoint(
    data: TestEmailRequest,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    # Default to the signed-in admin so the test lands in an inbox they own.
    target = (data.email or "").strip() or current_user.email
    return await send_test_email(db, target)
