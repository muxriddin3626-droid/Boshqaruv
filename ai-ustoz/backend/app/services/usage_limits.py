"""
Kunlik foydalanish chegaralari — OpenAI xarajatini nazorat qilish uchun.

Har bir o'quvchiga va butun platformaga kunlik (Toshkent sanasi bo'yicha) chegara.
Administratorlar (ADMIN_PHONES) cheklanmaydi — ilovani sinab ko'rishlari uchun.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.database import User
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit
from app.services.xp_service import tashkent_today

settings = get_settings()

# Kalit sanaga bog'langan; muddat bir kundan biroz uzun — yarim tunda hisob yangidan boshlanadi.
KEY_TTL_SECONDS = 26 * 60 * 60


@dataclass(frozen=True)
class DailyLimit:
    kind: str
    per_user: int
    global_limit: int
    user_message: str
    global_message: str


def chat_limit() -> DailyLimit:
    return DailyLimit(
        "chat",
        settings.chat_messages_per_user_per_day,
        settings.chat_messages_global_per_day,
        f"Bugungi savollar chegarasi tugadi (kuniga {settings.chat_messages_per_user_per_day} ta). "
        "Ertaga davom etamiz! Shu orada testlar va o'yinlarda mashq qiling.",
        "AI Ustoz bugun juda ko'p dars o'tdi — ertaga davom etamiz. Shu orada testlarda mashq qiling.",
    )


def voice_limit() -> DailyLimit:
    return DailyLimit(
        "voice",
        settings.voice_sessions_per_user_per_day,
        settings.voice_sessions_global_per_day,
        f"Bugungi ovozli suhbatlar chegarasi tugadi (kuniga {settings.voice_sessions_per_user_per_day} ta). "
        "Matnli suhbatda davom eting.",
        "Bugun ovozli suhbatlar chegarasi tugadi — matnli suhbatda davom eting.",
    )


async def is_admin(db: AsyncSession, user_id: uuid.UUID) -> bool:
    user = await db.get(User, user_id)
    return user is not None and user.phone in settings.admin_phone_set


async def use_daily(redis: Redis, db: AsyncSession, user_id: uuid.UUID, limit: DailyLimit) -> None:
    """Chegaradan oshgan bo'lsa 429, aks holda bitta foydalanishni hisoblaydi."""
    if await is_admin(db, user_id):
        return
    day = tashkent_today(datetime.now(timezone.utc)).isoformat()
    user_key = f"daily:{limit.kind}:{user_id}:{day}"
    global_key = f"daily:{limit.kind}:all:{day}"
    try:
        await ensure_below_limit(redis, user_key, limit.per_user)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail=limit.user_message) from exc
    try:
        await ensure_below_limit(redis, global_key, limit.global_limit)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail=limit.global_message) from exc
    await register_hit(redis, user_key, KEY_TTL_SECONDS)
    await register_hit(redis, global_key, KEY_TTL_SECONDS)
