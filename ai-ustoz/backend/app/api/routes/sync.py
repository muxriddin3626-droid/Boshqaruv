"""MODUL 5: Offline Sync endpoint'i (PWA & IndexedDB bilan ishlaydi)."""
import uuid

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.schemas import SyncPushIn, SyncPushOut
from app.services import sync_service

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushOut)
async def push_offline_changes(
    payload: SyncPushIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    Internet tiklangach, frontend IndexedDB'da to'plangan barcha offline
    harakatlarni (flashcard review'lar, test natijalari) shu endpointga
    bitta so'rovda yuboradi. Har bir element `client_action_id` orqali
    idempotent qo'llaniladi — qayta yuborilsa ham ikki marta qo'shilmaydi.
    """
    reviews_applied, reviews_skipped, reviews_failed = await sync_service.apply_flashcard_reviews(
        db, redis, user_id, payload.flashcard_reviews
    )
    results_applied, results_skipped, results_failed = await sync_service.apply_test_results(
        db, redis, user_id, payload.test_results
    )

    return SyncPushOut(
        applied=reviews_applied + results_applied,
        skipped_duplicate=reviews_skipped + results_skipped,
        failed=reviews_failed + results_failed,
    )
