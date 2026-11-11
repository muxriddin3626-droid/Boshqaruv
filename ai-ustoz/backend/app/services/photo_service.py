"""
Internetdagi haqiqiy rasmlar: AI Ustoz javobida ```foto``` bloki bo'lsa, frontend
shu inglizcha so'rov bo'yicha rasm so'raydi. Server Wikimedia Commons'dan bepul
litsenziyali rasmni topadi, bolalarga yaroqliligini tekshiradi (OpenAI moderatsiyasi),
o'zida saqlaydi va muallif/litsenziya bilan beradi.

So'rov (fan + matn) bo'yicha BIR MARTA qidiriladi, keyin hammaga keshdan beriladi.
Qidirish fonda (bir necha soniya), frontend so'rab turadi — xuddi AI rasmlaridagi kabi.
"""
import asyncio
import hashlib
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.database import Photo
from app.services import commons_service, media_storage, openai_service

logger = logging.getLogger(__name__)

STALE_SEARCH = timedelta(minutes=3)
# "Topilmadi" va xato natijalar abadiy emas: Commons'ga yangi rasmlar qo'shiladi, tarmoq tiklanadi.
RETRY_NOT_FOUND = timedelta(days=7)
RETRY_FAILED = timedelta(hours=1)
MAX_QUERY_LENGTH = 200
MAX_CANDIDATES_TRIED = 5
_background_tasks: set[asyncio.Task] = set()


def normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", query).strip()[:MAX_QUERY_LENGTH]


def query_hash(subject: str, query: str) -> str:
    return hashlib.sha256(f"{subject}|{normalize_query(query).lower()}".encode()).hexdigest()


async def find(db: AsyncSession, subject: str, query: str) -> Photo | None:
    stmt = select(Photo).where(Photo.query_hash == query_hash(subject, query))
    return (await db.execute(stmt.execution_options(populate_existing=True))).scalar_one_or_none()


def is_settled(photo: Photo, now: datetime) -> bool:
    """Qayta qidirish kerak emas: tayyor, hali qidirilyapti yoki yaqinda topilmagan."""
    age = now - photo.updated_at
    return (
        photo.status == "ready"
        or (photo.status == "searching" and age < STALE_SEARCH)
        or (photo.status == "not_found" and age < RETRY_NOT_FOUND)
        or (photo.status == "failed" and age < RETRY_FAILED)
    )


async def request(db: AsyncSession, subject: str, query: str, now: datetime) -> tuple[Photo, bool]:
    """(rasm yozuvi, qidiruv shu so'rovda boshlandimi). Chaqiruvchi limitni `started` bo'lsa hisoblaydi."""
    query = normalize_query(query)
    key = query_hash(subject, query)
    stmt = select(Photo).where(Photo.query_hash == key).with_for_update()
    photo = (await db.execute(stmt.execution_options(populate_existing=True))).scalar_one_or_none()
    if photo is None:
        photo = Photo(query_hash=key, subject=subject, query=query, status="searching", created_at=now, updated_at=now)
        db.add(photo)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            existing = await find(db, subject, query)
            if existing is None:
                raise
            return existing, False
    elif is_settled(photo, now):
        await db.commit()
        return photo, False
    else:
        photo.status = "searching"
        photo.updated_at = now
        await db.commit()

    task = asyncio.create_task(build(photo.id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return photo, True


async def _first_safe(candidates: list[commons_service.Candidate]) -> tuple[commons_service.Candidate, bytes, str] | None:
    for candidate in candidates[:MAX_CANDIDATES_TRIED]:
        try:
            image, mime = await commons_service.download(candidate)
        except Exception:  # noqa: BLE001 — bitta fayl ochilmasa, keyingisi sinaladi
            logger.warning("Commons rasmi yuklanmadi: %s", candidate.thumb_url, exc_info=True)
            continue
        # Moderatsiya ishlamasa xato yuqoriga chiqadi: tekshirilmagan rasm bolalarga ko'rsatilmaydi.
        if await openai_service.is_image_unsafe_for_kids(image, mime):
            logger.info("Commons rasmi moderatsiyadan o'tmadi: %s", candidate.description_url)
            continue
        return candidate, image, mime
    return None


async def build(photo_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        photo = await db.get(Photo, photo_id)
        if photo is None:
            return
        try:
            found = await _first_safe(await commons_service.search(photo.query))
            if found is None:
                photo.status = "not_found"
            else:
                candidate, image, mime = found
                extension = commons_service.STORED_TYPES[mime]
                photo.image_ref = await media_storage.save_file(f"photos/{photo.subject}/{photo.id}.{extension}", image, mime)
                photo.title = candidate.title
                photo.author = candidate.author
                photo.license = candidate.license
                photo.license_url = candidate.license_url or None
                photo.source_url = candidate.description_url or None
                photo.status = "ready"
        except Exception:  # noqa: BLE001 — Commons yoki moderatsiya ishlamadi
            logger.exception("Internet rasmi olinmadi: %s", photo_id)
            photo.status = "failed"
        photo.updated_at = datetime.now(timezone.utc)
        await db.commit()
