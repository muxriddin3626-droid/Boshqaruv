"""Dars rasmlari: AI Ustoz javobidagi ```rasm``` bloki uchun rasm chizish (kesh bilan)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import Illustration
from app.models.schemas import IllustrationOut, IllustrationRequestIn
from app.services import illustration_service, media_storage
from app.services import ai_budget
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit

router = APIRouter(prefix="/api/v1/illustrations", tags=["illustrations"])
settings = get_settings()

DAY_SECONDS = 24 * 60 * 60


def _out(illustration: Illustration) -> IllustrationOut:
    is_ready = illustration.status == "ready" and illustration.image_ref
    return IllustrationOut(
        id=illustration.id,
        status=illustration.status,
        image_url=media_storage.playback_url(illustration.image_ref) if is_ready else None,
    )


@router.post("", response_model=IllustrationOut)
async def request_illustration(
    payload: IllustrationRequestIn,
    response: Response,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Keshda bo'lsa — darhol (200); yangi bo'lsa fonda chiziladi (202), frontend GET bilan so'rab turadi."""
    cached = await illustration_service.find(db, payload.subject.value, payload.prompt)
    if cached and cached.status == "ready":
        return _out(cached)

    user_key = f"illustrations_user:{user_id}"
    global_key = f"illustrations_global:{datetime.now(timezone.utc):%Y%m%d}"
    await ai_budget.ensure_budget(db, user_id)
    try:
        await ensure_below_limit(redis, user_key, settings.illustrations_per_user_per_day)
        await ensure_below_limit(redis, global_key, settings.illustrations_global_per_day)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bugungi rasmlar limiti tugadi. Chizmalar va matn bilan davom etamiz.") from exc

    illustration, started = await illustration_service.request(db, payload.subject.value, payload.prompt, datetime.now(timezone.utc))
    if started:
        await register_hit(redis, user_key, DAY_SECONDS)
        await register_hit(redis, global_key, DAY_SECONDS)
    if illustration.status != "ready":
        response.status_code = 202
    return _out(illustration)


@router.get("/{illustration_id}", response_model=IllustrationOut)
async def get_illustration(
    illustration_id: uuid.UUID, _: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    illustration = await db.get(Illustration, illustration_id, populate_existing=True)
    if illustration is None:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")
    return _out(illustration)
