"""
Dars rasmlari: AI Ustoz javobida ```rasm``` bloki bo'lsa, frontend shu tavsif
bo'yicha rasm so'raydi. Rasm (fan + tavsif xeshi) bo'yicha BIR MARTA chiziladi
va keyin hammaga keshdan beriladi. Chizish fonda (10-30 s), frontend so'rab turadi.

Narx nazorati: bitta o'quvchiga va butun platformaga kunlik chegara (yangi
rasm chizilgandagina hisoblanadi; keshdagi rasm bepul).
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
from app.models.database import Illustration
from app.services import media_storage, openai_service

logger = logging.getLogger(__name__)

STALE_GENERATION = timedelta(minutes=5)
MAX_PROMPT_LENGTH = 400
_background_tasks: set[asyncio.Task] = set()


def normalize_prompt(prompt: str) -> str:
    return re.sub(r"\s+", " ", prompt).strip()[:MAX_PROMPT_LENGTH]


def prompt_hash(subject: str, prompt: str) -> str:
    return hashlib.sha256(f"{subject}|{normalize_prompt(prompt).lower()}".encode()).hexdigest()


async def find(db: AsyncSession, subject: str, prompt: str) -> Illustration | None:
    stmt = select(Illustration).where(Illustration.prompt_hash == prompt_hash(subject, prompt))
    return (await db.execute(stmt.execution_options(populate_existing=True))).scalar_one_or_none()


async def request(db: AsyncSession, subject: str, prompt: str, now: datetime) -> tuple[Illustration, bool]:
    """(rasm, chizish shu so'rovda boshlandimi). Chaqiruvchi limitni `started` bo'lsa hisoblaydi."""
    prompt = normalize_prompt(prompt)
    key = prompt_hash(subject, prompt)
    stmt = select(Illustration).where(Illustration.prompt_hash == key).with_for_update()
    illustration = (await db.execute(stmt.execution_options(populate_existing=True))).scalar_one_or_none()
    if illustration is None:
        illustration = Illustration(prompt_hash=key, subject=subject, prompt=prompt, status="generating", created_at=now, updated_at=now)
        db.add(illustration)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            existing = await find(db, subject, prompt)
            if existing is None:
                raise
            return existing, False
    elif illustration.status == "ready" or (illustration.status == "generating" and now - illustration.updated_at < STALE_GENERATION):
        await db.commit()
        return illustration, False
    else:
        illustration.status = "generating"
        illustration.updated_at = now
        await db.commit()

    task = asyncio.create_task(build(illustration.id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return illustration, True


async def build(illustration_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        illustration = await db.get(Illustration, illustration_id)
        if illustration is None:
            return
        try:
            image = await openai_service.generate_illustration(illustration.subject, illustration.prompt)
            illustration.image_ref = await media_storage.save_file(
                f"illustrations/{illustration.subject}/{illustration.id}.jpg", image, "image/jpeg"
            )
            illustration.status = "ready"
        except Exception:  # noqa: BLE001 — masalan, moderatsiya rad etdi yoki API ishlamadi
            logger.exception("Rasm chizilmadi: %s", illustration_id)
            illustration.status = "failed"
        illustration.updated_at = datetime.now(timezone.utc)
        await db.commit()
