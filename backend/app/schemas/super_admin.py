from pydantic import BaseModel
from datetime import datetime

class CompanyCreate(BaseModel):
    name: str
    domain: str
    admin_email: str
    admin_name: str = "Tenant Admin"
    tech_stack: str | None = None
    git_provider: str | None = None
    license_id: int | None = None
    license_tier: str | None = None
    allocated_seats: int = 20
    concurrent_limit: int = 5
    run_cap: int = 15000
    sso_enforced: bool = False
    mfa_enforced: bool = False
    circuit_breaker: bool = True
    jira_sync: bool = False

class CompanyUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    status: str | None = None
    admin_name: str | None = None
    admin_email: str | None = None
    tech_stack: str | None = None
    git_provider: str | None = None
    license_id: int | None = None
    license_tier: str | None = None
    allocated_seats: int | None = None
    concurrent_limit: int | None = None
    run_cap: int | None = None
    sso_enforced: bool | None = None
    mfa_enforced: bool | None = None
    circuit_breaker: bool | None = None
    jira_sync: bool | None = None

class CompanyResponse(BaseModel):
    id: int
    name: str
    domain: str
    status: str
    admin_name: str | None = None
    admin_email: str | None = None
    tech_stack: str | None = None
    git_provider: str | None = None
    license_id: int | None = None
    license_tier: str | None = None
    allocated_seats: int | None = None
    concurrent_limit: int | None = None
    run_cap: int | None = None
    sso_enforced: bool | None = None
    mfa_enforced: bool | None = None
    circuit_breaker: bool | None = None
    jira_sync: bool | None = None
    
    class Config:
        from_attributes = True

class LicenseCreate(BaseModel):
    name: str
    description: str | None = None
    badge: str | None = None
    developer_limit: int
    agent_concurrency: int = 5
    infrastructure_strategy: str = "shared"
    stripe_product_id: str | None = None
    monthly_price: float | None = None
    annual_price: float | None = None
    price: float | None = None
    billing_period: str | None = None

class LicenseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    badge: str | None = None
    developer_limit: int | None = None
    agent_concurrency: int | None = None
    infrastructure_strategy: str | None = None
    stripe_product_id: str | None = None
    monthly_price: float | None = None
    annual_price: float | None = None
    price: float | None = None
    billing_period: str | None = None
    status: str | None = None

class LicenseResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    badge: str | None = None
    developer_limit: int
    agent_concurrency: int
    infrastructure_strategy: str
    stripe_product_id: str | None = None
    monthly_price: float | None = None
    annual_price: float | None = None
    price: float | None = None
    billing_period: str | None = None
    status: str
    
    class Config:
        from_attributes = True

class PlatformUserCreate(BaseModel):
    name: str
    email: str
    role: str
    scope: str | None = None

class PlatformUserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    scope: str | None = None
    status: str | None = None

class PlatformSettingsUpdate(BaseModel):
    min_password_length: int | None = None
    require_special_chars: bool | None = None
    enforce_mfa: bool | None = None
    session_timeout: str | None = None
    auto_suspend_billing: bool | None = None
    circuit_breaker: bool | None = None
    quota_threshold: str | None = None
    smtp_host: str | None = None
    smtp_port: str | None = None
    smtp_user: str | None = None
    smtp_pass: str | None = None
    from_email: str | None = None

class PlatformSettingsResponse(BaseModel):
    id: int
    min_password_length: int
    require_special_chars: bool
    enforce_mfa: bool
    session_timeout: str
    auto_suspend_billing: bool
    circuit_breaker: bool
    quota_threshold: str
    smtp_host: str | None = None
    smtp_port: str | None = None
    smtp_user: str | None = None
    smtp_pass: str | None = None
    from_email: str | None = None
    
    class Config:
        from_attributes = True

class TestEmailRequest(BaseModel):
    # Optional: the API falls back to the signed-in super admin's address.
    email: str | None = None

class PlatformUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    scope: str | None = None
    status: str
    last_login_at: datetime | None = None
    
    class Config:
        from_attributes = True
