"""Redis mijozi — qisqa muddatli suhbat holatini (conversation state) saqlash uchun."""
from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()

redis_client: Redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> Redis:
    return redis_client
