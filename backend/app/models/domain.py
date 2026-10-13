from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, Float, Text, JSON
from sqlalchemy.sql import func
from app.models.base import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    domain = Column(String, unique=True, index=True)
    status = Column(String, default="ACTIVE")
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=True)
    license_tier = Column(String, nullable=True) # Kept for backward compatibility
    allocated_seats = Column(Integer, default=20)
    concurrent_limit = Column(Integer, default=5)
    run_cap = Column(Integer, default=15000)
    sso_enforced = Column(Boolean, default=False)
    mfa_enforced = Column(Boolean, default=False)
    circuit_breaker = Column(Boolean, default=True)
    tech_stack = Column(String, nullable=True)
    git_provider = Column(String, nullable=True)
    jira_sync = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    role = Column(String) # SUPER_ADMIN, CUSTOM_ADMIN, TENANT_ADMIN, DEVELOPER
    scope = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")
    github_token = Column(String, nullable=True)
    jira_token = Column(String, nullable=True)
    jira_domain = Column(String, nullable=True)
    jira_email = Column(String, nullable=True)
    anthropic_api_key = Column(String, nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    invite_token = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class CompanyUser(Base):
    __tablename__ = "company_users"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class License(Base):
    __tablename__ = "licenses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String, nullable=True)
    badge = Column(String, nullable=True)
    developer_limit = Column(Integer)
    agent_concurrency = Column(Integer, default=5)
    infrastructure_strategy = Column(String, default="shared")
    stripe_product_id = Column(String, nullable=True)
    price = Column(Float, nullable=True) # Legacy
    billing_period = Column(String, nullable=True) # Legacy
    monthly_price = Column(Float, nullable=True)
    annual_price = Column(Float, nullable=True)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class CompanyLicense(Base):
    __tablename__ = "company_licenses"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    license_id = Column(Integer, ForeignKey("licenses.id"))
    total_licenses = Column(Integer)
    used_licenses = Column(Integer, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Execution(Base):
    __tablename__ = "executions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    jira_ticket_id = Column(String, index=True)
    github_repository = Column(String, index=True)
    status = Column(String, default="PENDING")
    branch_name = Column(String, nullable=True)
    commit_sha = Column(String, nullable=True)
    pull_request_url = Column(String, nullable=True)
    plan = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    token_usage = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ExecutionStep(Base):
    __tablename__ = "execution_steps"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id"))
    name = Column(String)
    latency = Column(String) # E.g., "1.12s"
    tokens = Column(String) # E.g., "3.2k tokens"
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ExecutionFile(Base):
    __tablename__ = "execution_files"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id"))
    name = Column(String)
    added_lines = Column(Integer, default=0)
    deleted_lines = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ExecutionEvent(Base):
    __tablename__ = "execution_events"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id"))
    event_type = Column(String)
    message = Column(Text)
    metadata_info = Column("metadata", JSON, nullable=True) # avoiding reserved keyword
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PullRequest(Base):
    __tablename__ = "pull_requests"
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id"))
    pr_url = Column(String)
    pr_number = Column(Integer)
    status = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    action = Column(String)
    resource = Column(String)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True))
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    provider = Column(String)
    provider_user_id = Column(String)
    access_token = Column(String)
    refresh_token = Column(String, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class PlatformSettings(Base):
    __tablename__ = "platform_settings"
    id = Column(Integer, primary_key=True, index=True)
    min_password_length = Column(Integer, default=12)
    require_special_chars = Column(Boolean, default=True)
    enforce_mfa = Column(Boolean, default=True)
    session_timeout = Column(String, default="1h")
    auto_suspend_billing = Column(Boolean, default=True)
    circuit_breaker = Column(Boolean, default=True)
    quota_threshold = Column(String, default="80%")
    smtp_host = Column(String, nullable=True)
    smtp_port = Column(String, nullable=True)
    smtp_user = Column(String, nullable=True)
    smtp_pass = Column(String, nullable=True)
    from_email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String)
    title = Column(String)
    message = Column(Text)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
