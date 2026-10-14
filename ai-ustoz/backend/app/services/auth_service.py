"""Telefon raqam + parol bilan kirish, parolni taxmin qilishga (brute-force) qarshi himoya bilan."""
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.database import User
from app.services.rate_limit import ensure_below_limit, register_hit

settings = get_settings()

MAX_FAILED_ATTEMPTS_PER_PHONE = 5
LOCKOUT_SECONDS = 15 * 60

# Raqam topilmaganda ham xuddi shuncha vaqt sarflash uchun: aks holda javob
# tezligidan "bu raqam ro'yxatdan o'tganmi" ekanini bilib olish mumkin bo'lardi.
_DUMMY_HASH = hash_password("timing-equalizer")


def _phone_failures_key(phone: str) -> str:
    return f"login_fail:{phone}"


def _ip_failures_key(ip: str) -> str:
    return f"login_fail_ip:{ip}"


async def authenticate(db: AsyncSession, redis: Redis, phone: str, password: str, client_ip: str) -> User | None:
    """
    To'g'ri bo'lsa foydalanuvchini, aks holda None qaytaradi. Raqam yoki IP
    bo'yicha xato urinishlar chegaradan oshgan bo'lsa RateLimitExceededError beradi.
    Ikki cheklov bir-birini to'ldiradi: raqam bo'yicha — bitta akkauntga
    hujumni, IP bo'yicha — bitta manbadan ko'p raqamni navbatma-navbat sinashni to'xtatadi.
    """
    phone_key = _phone_failures_key(phone)
    ip_key = _ip_failures_key(client_ip)
    await ensure_below_limit(redis, ip_key, settings.login_max_failures_per_ip)
    await ensure_below_limit(redis, phone_key, MAX_FAILED_ATTEMPTS_PER_PHONE)

    user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    stored_hash = user.password_hash if user and user.password_hash else _DUMMY_HASH
    is_valid = verify_password(password, stored_hash) and user is not None and user.password_hash is not None

    if not is_valid:
        await register_hit(redis, phone_key, LOCKOUT_SECONDS)
        await register_hit(redis, ip_key, LOCKOUT_SECONDS)
        return None

    # IP hisoblagichi ataylab tozalanmaydi: aks holda hujumchi o'z akkauntiga
    # vaqti-vaqti bilan to'g'ri kirib, IP cheklovini nolga tushirib turardi.
    await redis.delete(phone_key)
    return user
