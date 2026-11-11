"""
Redis asosidagi oddiy hisoblagichlar: kalit bo'yicha urinishlarni sanash va
chegaradan oshganini tekshirish (login brute-force va ommaviy ro'yxatdan
o'tishga qarshi).
"""
from fastapi import Request
from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()


class RateLimitExceededError(Exception):
    pass


def get_client_ip(request: Request) -> str:
    """
    Haqiqiy mijoz IP'si. `trusted_proxy_count` = N bo'lsa, X-Forwarded-For'dagi
    o'ngdan N-chi yozuv olinadi: har bir ishonchli proksi o'ziga ulangan
    manzilni oxiriga qo'shadi, undan chapdagilarni esa mijoz soxtalashtira oladi.
    """
    direct_ip = request.client.host if request.client else "unknown"
    proxy_count = settings.trusted_proxy_count
    if proxy_count <= 0:
        return direct_ip

    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    if len(forwarded) < proxy_count:
        return direct_ip
    return forwarded[-proxy_count]


async def ensure_below_limit(redis: Redis, key: str, limit: int) -> None:
    if int(await redis.get(key) or 0) >= limit:
        raise RateLimitExceededError


async def register_hit(redis: Redis, key: str, window_seconds: int) -> None:
    """
    Qat'iy oyna: muddat faqat birinchi urinishda qo'yiladi. Har urinishda
    yangilansa, umumiy IP'dan doimiy oqim kelganda hisoblagich hech qachon
    tushmay, butun tarmoq abadiy bloklanib qolardi.
    """
    pipe = redis.pipeline()
    pipe.set(key, 0, ex=window_seconds, nx=True)
    pipe.incr(key)
    await pipe.execute()
