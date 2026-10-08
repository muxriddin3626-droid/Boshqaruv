"""Telefon raqam + parol bilan kirish, parolni taxmin qilishga (brute-force) qarshi himoya bilan."""
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.database import User

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60

# Raqam topilmaganda ham xuddi shuncha vaqt sarflash uchun: aks holda javob
# tezligidan "bu raqam ro'yxatdan o'tganmi" ekanini bilib olish mumkin bo'lardi.
_DUMMY_HASH = hash_password("timing-equalizer")


class TooManyAttemptsError(Exception):
    pass


def _failures_key(phone: str) -> str:
    return f"login_fail:{phone}"


async def authenticate(db: AsyncSession, redis: Redis, phone: str, password: str) -> User | None:
    """To'g'ri bo'lsa foydalanuvchini, aks holda None qaytaradi. Juda ko'p xato urinishda istisno beradi."""
    key = _failures_key(phone)
    failures = int(await redis.get(key) or 0)
    if failures >= MAX_FAILED_ATTEMPTS:
        raise TooManyAttemptsError

    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    stored_hash = user.password_hash if user and user.password_hash else _DUMMY_HASH
    is_valid = verify_password(password, stored_hash) and user is not None and user.password_hash is not None

    if not is_valid:
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_SECONDS)
        await pipe.execute()
        return None

    await redis.delete(key)
    return user
