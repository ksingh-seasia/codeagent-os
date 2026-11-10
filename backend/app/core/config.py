from pydantic import field_validator
from pydantic_settings import BaseSettings


def clean_redis_url(raw_url: str | None) -> str:
    """Normalize a REDIS_URL copied from a provider dashboard.

    Mirrors clean_redis_url() in the multi-agent-mesh worker so the API and the
    worker accept exactly the same value. Handles surrounding quotes, values
    pasted as a full `redis-cli ... -u <url>` command, bare host:port values,
    and Upstash hosts (which require TLS, i.e. the rediss:// scheme).
    """
    if not raw_url:
        return ""

    url = raw_url.strip().strip('"').strip("'")

    if " -u " in url:
        url = url.split(" -u ")[-1].strip()
    elif url.startswith("redis-cli"):
        for part in url.split():
            if part.startswith(("redis://", "rediss://")):
                url = part
                break

    # A bare "host:6379" has no scheme, which redis-py rejects outright.
    if url and "://" not in url:
        url = f"redis://{url}"

    if "upstash.io" in url and url.startswith("redis://"):
        url = url.replace("redis://", "rediss://", 1)

    return url


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Code Agent Platform"
    API_V1_STR: str = "/api/v1"
    
    # DB / Redis / Security -- values come from backend/.env (no defaults)
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8

    # Email Integration (Nodemailer style, but using FastAPI-Mail)
    MAIL_USERNAME: str = "your_email@example.com"
    MAIL_PASSWORD: str = "your_app_password"
    MAIL_FROM: str = "your_email@example.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.example.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # Public URLs (override in deployment, e.g. on Render)
    BACKEND_URL: str = "http://localhost:8000"
    DEVELOPER_PORTAL_URL: str = "http://localhost:3002"

    @field_validator("REDIS_URL")
    @classmethod
    def _clean_redis_url(cls, v: str) -> str:
        return clean_redis_url(v)

    class Config:
        env_file = ".env"

settings = Settings()
