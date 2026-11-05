from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+asyncpg://",
        1
    )

if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql+psycopg://",
        "postgresql+asyncpg://",
        1
    )

DATABASE_URL = DATABASE_URL.replace(
    "sslmode=require",
    "ssl=require"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True
)