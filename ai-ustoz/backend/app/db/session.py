"""Async SQLAlchemy engine va session factory (Supabase Postgres uchun)."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.url import normalize_database_url

settings = get_settings()

_database_url, _connect_args = normalize_database_url(settings.database_url)
engine = create_async_engine(_database_url, connect_args=_connect_args, pool_pre_ping=True, echo=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: har bir request uchun alohida DB session ochadi."""
    async with AsyncSessionLocal() as session:
        yield session
