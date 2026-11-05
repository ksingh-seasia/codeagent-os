from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

# Use asyncpg for asynchronous PostgreSQL connections
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+asyncpg://",
        1
    )

# Convert SSL parameter for asyncpg
DATABASE_URL = DATABASE_URL.replace(
    "sslmode=require",
    "ssl=require"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.DEBUG if hasattr(settings, "DEBUG") else False,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
