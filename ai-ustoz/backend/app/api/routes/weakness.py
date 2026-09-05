"""MODUL 3: Weakness Radar & Targeted Drill endpoint'lari."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.schemas import DrillOut, DrillQuestionOut, DrillRequestIn, RadarPointOut, SubjectSchema
from app.services import weakness_service

router = APIRouter(prefix="/api/v1/weakness", tags=["weakness"])


@router.get("/radar", response_model=list[RadarPointOut])
async def get_weakness_radar(
    subject: SubjectSchema,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Recharts Radar Chart uchun har bir bo'lim (category) bo'yicha mastery %."""
    rows = await weakness_service.get_radar(db, user_id, subject.value)
    return [
        RadarPointOut(category=row.category, mastery_percentage=row.mastery_percentage, sample_size=row.sample_size)
        for row in rows
    ]


@router.post("/radar/recalculate", response_model=list[RadarPointOut])
async def recalculate_weakness_radar(
    subject: SubjectSchema,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Yangi test natijasi/weak_spot qo'shilgandan so'ng radar'ni qo'lda qayta hisoblash."""
    rows = await weakness_service.recalculate_radar(db, user_id, subject.value)
    return [
        RadarPointOut(category=row.category, mastery_percentage=row.mastery_percentage, sample_size=row.sample_size)
        for row in rows
    ]


@router.post("/drill", response_model=DrillOut)
async def create_targeted_drill(
    payload: DrillRequestIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """"Zaif Nuqtalarni Ishlash" tugmasi: faqat eng past mastery'li bo'limlardan test generatsiya qiladi."""
    target_categories, questions = await weakness_service.generate_targeted_drill(
        db, user_id, payload.subject.value, payload.question_count
    )
    return DrillOut(
        subject=payload.subject,
        target_categories=target_categories,
        questions=[DrillQuestionOut(**q) for q in questions],
    )
