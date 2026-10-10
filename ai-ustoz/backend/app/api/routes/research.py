"""
MODUL 7: Autonomous AI Researcher & Pedagogical Innovator Engine endpoint'lari.

Bu endpoint'lar odatda avtomatik scheduler (`services/scheduler.py`) orqali
fonda ishlaydi; bu yerdagi marshrutlar qo'lda ishga tushirish (masalan,
admin panel yoki test uchun) va natijalarni ko'rish uchun.

Eslatma: productionda bu endpoint'lar admin-only rolga cheklanishi kerak —
hozircha oddiy autentifikatsiya (`get_current_user_id`) bilan himoyalangan.
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.database import AiGeneratedInnovation, AiResearchLog
from app.models.schemas import InnovationOut, InnovationTriggerIn, ResearchLogOut, ResearchScanTriggerIn, SubjectSchema
from app.services import research_service

router = APIRouter(prefix="/api/v1/research", tags=["research"])


@router.post("/scan", response_model=list[ResearchLogOut])
async def trigger_research_scan(
    payload: ResearchScanTriggerIn,
    _user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Web-research skanerini qo'lda ishga tushiradi (odatda scheduler avtomatik chaqiradi)."""
    topics = [("kimyo", t) for t in payload.topics] if payload.topics else None
    logs = await research_service.run_research_scan(db, topics)
    return [ResearchLogOut.model_validate(log) for log in logs]


@router.get("/logs", response_model=list[ResearchLogOut])
async def list_research_logs(
    limit: int = 20,
    _user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AiResearchLog).order_by(AiResearchLog.timestamp.desc()).limit(limit)
    logs = (await db.execute(stmt)).scalars().all()
    return [ResearchLogOut.model_validate(log) for log in logs]


@router.post("/innovations/generate", response_model=InnovationOut)
async def trigger_innovation_generation(
    payload: InnovationTriggerIn,
    _user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Berilgan (yoki eng zaif) bo'lim uchun bitta yangi innovatsiya generatsiya qiladi."""
    innovation = await research_service.generate_and_save_innovation(
        db, payload.subject.value, payload.category, payload.innovation_type.value
    )
    return InnovationOut.model_validate(innovation)


@router.get("/innovations", response_model=list[InnovationOut])
async def list_innovations(
    subject: SubjectSchema,
    limit: int = 20,
    _user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AiGeneratedInnovation)
        .where(AiGeneratedInnovation.subject == subject.value)
        .order_by(AiGeneratedInnovation.created_at.desc())
        .limit(limit)
    )
    innovations = (await db.execute(stmt)).scalars().all()
    return [InnovationOut.model_validate(innovation) for innovation in innovations]
