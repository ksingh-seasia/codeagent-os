from pydantic_settings import BaseSettings

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

    class Config:
        env_file = ".env"

settings = Settings()
