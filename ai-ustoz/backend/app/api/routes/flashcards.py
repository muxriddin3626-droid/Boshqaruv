"""MODUL 1: Flashcards & Spaced Repetition endpoint'lari."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.schemas import (
    FlashcardGenerateIn,
    FlashcardOut,
    FlashcardReviewIn,
    FlashcardReviewOut,
    SubjectSchema,
)
from app.services import flashcard_service

router = APIRouter(prefix="/api/v1/flashcards", tags=["flashcards"])


@router.post("/generate", response_model=list[FlashcardOut])
async def generate_flashcards_endpoint(
    payload: FlashcardGenerateIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Dars/suhbat yakunida chaqiriladi: AI mavzu matnidan flashcard'lar yaratadi va navbatga qo'shadi."""
    flashcards = await flashcard_service.generate_and_save_flashcards(
        db,
        user_id=user_id,
        subject=payload.subject.value,
        lesson_title=payload.lesson_title,
        lesson_content=payload.lesson_content,
        card_count=payload.card_count,
    )
    return [
        FlashcardOut(
            id=card.id,
            subject=card.subject,
            front_text=card.front_text,
            back_text=card.back_text,
            next_review_at=card.queue_entry.next_review_at if card.queue_entry else card.created_at,
        )
        for card in flashcards
    ]


@router.get("/due", response_model=list[FlashcardOut])
async def get_due_flashcards_endpoint(
    subject: SubjectSchema,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """O'quvchi ochganda: bugun takrorlanishi kerak bo'lgan kartalar ro'yxati (Ebbinghaus jadvali bo'yicha)."""
    due_cards = await flashcard_service.get_due_flashcards(db, user_id, subject.value)
    return [FlashcardOut(**card) for card in due_cards]


@router.post("/review", response_model=FlashcardReviewOut)
async def review_flashcard_endpoint(
    payload: FlashcardReviewIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """"Esladim" / "Eslayolmadim" tugmasi bosilganda chaqiriladi."""
    try:
        queue_entry = await flashcard_service.record_review(
            db, user_id, payload.flashcard_id, payload.remembered, payload.reviewed_at
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return FlashcardReviewOut(
        flashcard_id=queue_entry.flashcard_id,
        stage=queue_entry.stage,
        status=queue_entry.status,
        next_review_at=queue_entry.next_review_at,
    )
