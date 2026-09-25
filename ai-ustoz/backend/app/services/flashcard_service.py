"""
MODUL 1: AI Smart Flashcards & Spaced Repetition (Anki/Ebbinghaus metodi).

Ebbinghaus unutish egri chizig'iga asoslangan qat'iy interval jadvali ishlatiladi
(SM-2 kabi moslashuvchan ease-factor emas — talab aniq 1/3/7/30 kunlik bosqichlar):

    stage 0 -> 1 kundan keyin
    stage 1 -> 3 kundan keyin
    stage 2 -> 7 kundan keyin
    stage 3 -> 30 kundan keyin -> shu bosqichda ham eslasa -> "mastered"

O'quvchi "Eslayolmadim" desa, bosqich boshiga (stage=0) qaytariladi — bu
Ebbinghaus egri chizig'ining asosiy g'oyasi: unutilgan narsa qayta-qayta,
tez-tez takrorlanishi kerak.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    SPACED_REPETITION_INTERVALS_DAYS,
    Flashcard,
    SpacedRepetitionQueue,
)
from app.services.openai_service import generate_flashcards


async def generate_and_save_flashcards(
    db: AsyncSession,
    user_id: uuid.UUID,
    subject: str,
    lesson_title: str,
    lesson_content: str,
    lesson_id: uuid.UUID | None = None,
    card_count: int = 5,
) -> list[Flashcard]:
    """Dars/suhbat oxirida chaqiriladi: AI orqali kartalar generatsiya qilib, bazaga yozadi."""
    raw_cards = await generate_flashcards(subject, lesson_title, lesson_content, card_count)

    created: list[Flashcard] = []
    for card in raw_cards:
        front = card.get("front", "").strip()
        back = card.get("back", "").strip()
        if not front or not back:
            continue

        flashcard = Flashcard(
            user_id=user_id, subject=subject, lesson_id=lesson_id, front_text=front, back_text=back
        )
        db.add(flashcard)
        await db.flush()  # flashcard.id ni olish uchun

        queue_entry = SpacedRepetitionQueue(
            user_id=user_id,
            flashcard_id=flashcard.id,
            stage=0,
            next_review_at=datetime.now(timezone.utc) + timedelta(days=SPACED_REPETITION_INTERVALS_DAYS[0]),
        )
        db.add(queue_entry)
        created.append(flashcard)

    await db.commit()
    return created


async def get_due_flashcards(db: AsyncSession, user_id: uuid.UUID, subject: str, limit: int = 20) -> list[dict]:
    """Bugun (yoki undan oldin) takrorlanishi kerak bo'lgan kartalarni qaytaradi."""
    stmt = (
        select(Flashcard, SpacedRepetitionQueue)
        .join(SpacedRepetitionQueue, SpacedRepetitionQueue.flashcard_id == Flashcard.id)
        .where(
            Flashcard.user_id == user_id,
            Flashcard.subject == subject,
            SpacedRepetitionQueue.status == "active",
            SpacedRepetitionQueue.next_review_at <= datetime.now(timezone.utc),
        )
        .order_by(SpacedRepetitionQueue.next_review_at.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": flashcard.id,
            "subject": flashcard.subject,
            "front_text": flashcard.front_text,
            "back_text": flashcard.back_text,
            "next_review_at": queue.next_review_at,
        }
        for flashcard, queue in rows
    ]


async def record_review(
    db: AsyncSession,
    user_id: uuid.UUID,
    flashcard_id: uuid.UUID,
    remembered: bool,
    reviewed_at: datetime | None = None,
) -> SpacedRepetitionQueue:
    """
    "Esladim/Eslayolmadim" bosilganda navbatni yangilaydi:
    - Esladim -> keyingi bosqichga o'tadi (interval kattalashadi).
    - Eslayolmadim -> stage=0 ga qaytadi (ertaga qayta ko'rsatiladi).
    - Oxirgi bosqichda (30 kun) ham esladi -> "mastered" (navbatdan chiqadi).
    """
    stmt = select(SpacedRepetitionQueue).where(
        SpacedRepetitionQueue.flashcard_id == flashcard_id, SpacedRepetitionQueue.user_id == user_id
    )
    queue_entry = (await db.execute(stmt)).scalar_one_or_none()
    if queue_entry is None:
        raise ValueError("Ushbu flashcard uchun takrorlash navbati topilmadi")

    now = reviewed_at or datetime.now(timezone.utc)
    max_stage = len(SPACED_REPETITION_INTERVALS_DAYS) - 1

    if remembered:
        queue_entry.remembered_streak += 1
        if queue_entry.stage >= max_stage:
            queue_entry.status = "mastered"
        else:
            queue_entry.stage += 1
            queue_entry.next_review_at = now + timedelta(days=SPACED_REPETITION_INTERVALS_DAYS[queue_entry.stage])
    else:
        queue_entry.remembered_streak = 0
        queue_entry.stage = 0
        queue_entry.next_review_at = now + timedelta(days=SPACED_REPETITION_INTERVALS_DAYS[0])

    queue_entry.last_reviewed_at = now
    queue_entry.last_result = "remembered" if remembered else "forgot"

    await db.commit()
    await db.refresh(queue_entry)
    return queue_entry
