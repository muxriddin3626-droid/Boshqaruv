"""MODUL 4: Auto-PDF Konspekt Generator endpoint'i."""
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.schemas import ConspectRequestIn
from app.services.pdf_service import generate_lesson_conspect_pdf

router = APIRouter(prefix="/api/v1/conspect", tags=["conspect"])


@router.post("/generate")
async def generate_conspect_pdf(
    payload: ConspectRequestIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Suhbat tarixi va weak_spots asosida PDF konspekt yaratib, to'g'ridan-to'g'ri fayl sifatida qaytaradi."""
    pdf_bytes = await generate_lesson_conspect_pdf(db, user_id, payload.subject.value, payload.lesson_title)

    filename = f"ai-ustoz-konspekt-{payload.subject.value}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
