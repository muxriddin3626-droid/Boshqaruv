"""Internetdagi haqiqiy rasmlar: AI Ustoz javobidagi ```foto``` bloki uchun Wikimedia Commons'dan rasm (kesh bilan)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import Photo
from app.models.schemas import PhotoOut, PhotoRequestIn
from app.services import media_storage, photo_service
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit

router = APIRouter(prefix="/api/v1/photos", tags=["photos"])
settings = get_settings()

DAY_SECONDS = 24 * 60 * 60


def _out(photo: Photo) -> PhotoOut:
    if photo.status == "ready" and photo.image_ref:
        return PhotoOut(
            id=photo.id,
            status="ready",
            image_url=media_storage.playback_url(photo.image_ref),
            title=photo.title,
            author=photo.author,
            license=photo.license,
            license_url=photo.license_url,
            source_url=photo.source_url,
        )
    status = "searching" if photo.status == "ready" else photo.status
    return PhotoOut(id=photo.id, status=status, image_url=None)


@router.post("", response_model=PhotoOut)
async def request_photo(
    payload: PhotoRequestIn,
    response: Response,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Keshda bo'lsa — darhol (200); yangi bo'lsa fonda qidiriladi (202), frontend GET bilan so'rab turadi."""
    cached = await photo_service.find(db, payload.subject.value, payload.query)
    if cached and photo_service.is_settled(cached, datetime.now(timezone.utc)):
        if cached.status == "searching":
            response.status_code = 202
        return _out(cached)

    user_key = f"photos_user:{user_id}"
    global_key = f"photos_global:{datetime.now(timezone.utc):%Y%m%d}"
    try:
        await ensure_below_limit(redis, user_key, settings.photos_per_user_per_day)
        await ensure_below_limit(redis, global_key, settings.photos_global_per_day)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bugun internetdan rasm qidirish limiti tugadi. Chizmalar bilan davom etamiz.") from exc

    photo, started = await photo_service.request(db, payload.subject.value, payload.query, datetime.now(timezone.utc))
    if started:
        await register_hit(redis, user_key, DAY_SECONDS)
        await register_hit(redis, global_key, DAY_SECONDS)
    if photo.status == "searching":
        response.status_code = 202
    return _out(photo)


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo(photo_id: uuid.UUID, _: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    photo = await db.get(Photo, photo_id, populate_existing=True)
    if photo is None:
        raise HTTPException(status_code=404, detail="Rasm topilmadi")
    return _out(photo)
