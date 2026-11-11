"""
Har bir o'quvchiga oylik AI byudjeti (dollarda).

Har bir AI chaqiruvining taxminiy narxi (ishlatilgan tokenlar bo'yicha) shu so'rovni yuborgan
o'quvchining oylik hisobiga yoziladi. Byudjet tugasa, o'sha oy oxirigacha pullik AI amallari
(suhbat, ovozli suhbat, rasm, ma'ruza, uyga vazifa) to'xtaydi — testlar va o'yinlar bankdan
ishlashda davom etadi. Administratorlar (ADMIN_PHONES) cheklanmaydi.

Kim to'layotgani `get_current_user_id` orqali kontekstga yoziladi (`bill_to`), shuning uchun
openai_service ichidagi har bir chaqiruv o'quvchi ID'sini alohida uzatmasdan hisoblanadi.
"""
import logging
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.redis_client import redis_client
from app.models.database import User

logger = logging.getLogger(__name__)
settings = get_settings()

KEY_TTL_SECONDS = 40 * 24 * 60 * 60

# $ / 1M token: (kirish, keshlangan kirish, chiqish). Model nomining boshlanishi bo'yicha.
OPENAI_PRICES: dict[str, tuple[float, float, float]] = {
    "gpt-4o-mini": (0.15, 0.075, 0.60),
    "gpt-4o": (2.50, 1.25, 10.00),
    "gpt-4.1-mini": (0.40, 0.10, 1.60),
    "gpt-4.1": (2.00, 0.50, 8.00),
}
DEFAULT_PRICE = (2.50, 1.25, 10.00)

_billed_user: ContextVar[uuid.UUID | None] = ContextVar("billed_user", default=None)


def bill_to(user_id: uuid.UUID) -> None:
    """Shu so'rov davomidagi AI xarajati shu foydalanuvchiga yoziladi."""
    _billed_user.set(user_id)


def price_for(model: str) -> tuple[float, float, float]:
    if model.startswith("gemini"):
        return (settings.gemini_price_input_per_m, settings.gemini_price_input_per_m / 4, settings.gemini_price_output_per_m)
    for prefix in sorted(OPENAI_PRICES, key=len, reverse=True):
        if model.startswith(prefix):
            return OPENAI_PRICES[prefix]
    return DEFAULT_PRICE


def cost_of(model: str, prompt_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    price_in, price_cached, price_out = price_for(model)
    fresh = max(0, prompt_tokens - cached_tokens)
    return (fresh * price_in + cached_tokens * price_cached + output_tokens * price_out) / 1_000_000


def usage_cost(model: str, usage, prompt_chars: int = 0, output_chars: int = 0) -> float:
    """OpenAI uslubidagi `usage` dan narx. Usage kelmasa — matn uzunligidan taxmin (~3 belgi = 1 token)."""
    if usage is None:
        return cost_of(model, prompt_chars // 3, output_chars // 3)
    prompt = getattr(usage, "prompt_tokens", 0) or 0
    total = getattr(usage, "total_tokens", 0) or 0
    completion = getattr(usage, "completion_tokens", 0) or 0
    # Gemini "o'ylash" tokenlari ham pullik: chiqish = jami - kirish (agar katta bo'lsa).
    output = max(completion, total - prompt)
    details = getattr(usage, "prompt_tokens_details", None)
    cached = (getattr(details, "cached_tokens", 0) or 0) if details is not None else 0
    return cost_of(model, prompt, output, cached)


def _month_key(user_id: uuid.UUID) -> str:
    return f"aicost:{user_id}:{datetime.now(timezone.utc):%Y-%m}"


async def charge(usd: float) -> None:
    """Joriy so'rov egasining oylik hisobiga xarajat qo'shadi (xato bo'lsa jim o'tadi)."""
    user_id = _billed_user.get()
    if user_id is None or usd <= 0:
        return
    try:
        key = _month_key(user_id)
        await redis_client.incrbyfloat(key, usd)
        await redis_client.expire(key, KEY_TTL_SECONDS)
    except Exception:  # noqa: BLE001 — hisob yozilmasa ham dars to'xtamasin
        logger.warning("AI xarajati yozilmadi", exc_info=True)


async def spent_this_month(user_id: uuid.UUID) -> float:
    try:
        return float(await redis_client.get(_month_key(user_id)) or 0)
    except Exception:  # noqa: BLE001
        return 0.0


async def is_admin(db: AsyncSession, user_id: uuid.UUID) -> bool:
    user = await db.get(User, user_id)
    return user is not None and user.phone in settings.admin_phone_set


BUDGET_MESSAGE = (
    "Bu oy uchun AI Ustoz bilan ishlash chegarasi tugadi — keyingi oyning 1-sanasida yangilanadi. "
    "Shu orada testlar va o'yinlarda mashq qilishda davom eting!"
)


async def ensure_budget(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Oylik byudjet tugagan bo'lsa 429 (administratorlar cheklanmaydi)."""
    budget = settings.ai_budget_per_user_per_month_usd
    if budget <= 0 or await spent_this_month(user_id) < budget:
        return
    if await is_admin(db, user_id):
        return
    raise HTTPException(status_code=429, detail=BUDGET_MESSAGE)
