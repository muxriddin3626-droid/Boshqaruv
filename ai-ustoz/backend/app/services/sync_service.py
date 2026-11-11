"""
MODUL 5: Offline Sync.

Internet uzilganda frontend flashcard review va test natijalarini
IndexedDB'da to'playdi; internet tiklanganda ularni shu servis orqali
serverga ko'chiradi (`POST /api/v1/sync/push`).

Idempotentlik: har bir offline harakat frontend tomonidan generatsiya
qilingan `client_action_id` (UUID) bilan birga yuboriladi. Backend Redis'da
`sync:applied:{client_action_id}` kalitini SETNX (`set(..., nx=True)`) orqali
belgilaydi — agar kalit allaqachon mavjud bo'lsa (masalan, tarmoq uzilib,
frontend so'rovni ikkinchi marta yuborgan bo'lsa), harakat qayta
qo'llanilmaydi. Shu bilan bir xil review/test natijasi ikki marta
qo'shilib, statistikani buzib yubormaydi.
"""
import uuid

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import TestResult
from app.models.schemas import FlashcardReviewSyncItem, TestResultSyncItem
from app.services import flashcard_service, weakness_service

SYNC_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 kun — shu muddatdan keyin dedup kaliti o'chadi


async def _mark_applied_if_new(redis: Redis, client_action_id: uuid.UUID) -> bool:
    """True — bu harakat ilk marta qo'llanilyapti. False — allaqachon qo'llanilgan, o'tkazib yuboriladi."""
    key = f"sync:applied:{client_action_id}"
    was_set = await redis.set(key, "1", nx=True, ex=SYNC_DEDUP_TTL_SECONDS)
    return bool(was_set)


async def apply_flashcard_reviews(
    db: AsyncSession, redis: Redis, user_id: uuid.UUID, reviews: list[FlashcardReviewSyncItem]
) -> tuple[int, int, int]:
    """Offline yig'ilgan "Esladim/Eslayolmadim" natijalarini navbatma-navbat qo'llaydi. (applied, skipped, failed)"""
    applied = skipped = failed = 0
    for review in reviews:
        if not await _mark_applied_if_new(redis, review.client_action_id):
            skipped += 1
            continue
        try:
            await flashcard_service.record_review(
                db, user_id, review.flashcard_id, review.remembered, review.reviewed_at
            )
            applied += 1
        except ValueError:
            failed += 1
    return applied, skipped, failed


async def apply_test_results(
    db: AsyncSession, redis: Redis, user_id: uuid.UUID, results: list[TestResultSyncItem]
) -> tuple[int, int, int]:
    """Offline yechilgan testlarni saqlaydi va ta'sirlangan fanlar uchun Weakness Radar'ni qayta hisoblaydi."""
    applied = skipped = failed = 0
    affected_subjects: set[str] = set()

    for result in results:
        if not await _mark_applied_if_new(redis, result.client_action_id):
            skipped += 1
            continue
        try:
            async with db.begin_nested():
                db.add(
                    TestResult(
                        user_id=user_id,
                        subject=result.subject.value,
                        test_type=result.test_type,
                        score=result.score,
                        max_score=result.max_score,
                        details=result.details,
                        taken_at=result.taken_at,
                    )
                )
            applied += 1
            affected_subjects.add(result.subject.value)
        except Exception:  # noqa: BLE001 — bitta yaroqsiz yozuv butun sync'ni buzmasligi kerak
            failed += 1

    if applied:
        await db.commit()
        for subject in affected_subjects:
            await weakness_service.recalculate_radar(db, user_id, subject)

    return applied, skipped, failed
