"""MODUL 6: Exam Crowdsourcing & Memory Engine endpoint'lari."""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.schemas import ExamStatusIn, ExamStatusOut, ExamSubmissionOut, RawInputType, SubjectSchema
from app.services import exam_pipeline_service

router = APIRouter(prefix="/api/v1/exam-feedback", tags=["exam-feedback"])


@router.get("/status", response_model=ExamStatusOut)
async def get_exam_status(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Frontend/chat.py bu holatni o'qib, "Exam Today" bannerini yoki feedback so'rovini ko'rsatadi."""
    status = await exam_pipeline_service.get_exam_status(db, user_id)
    return ExamStatusOut(
        target_exam_date=status.target_exam_date,
        exam_completed=status.exam_completed,
        feedback_provided=status.feedback_provided,
    )


@router.post("/status", response_model=ExamStatusOut)
async def update_exam_status(
    payload: ExamStatusIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """O'quvchi "Bugun imtihonim bor" sanasini belgilaganda yoki "Imtihondan chiqdim" deganda chaqiriladi."""
    status = await exam_pipeline_service.update_exam_status(
        db, user_id, payload.target_exam_date, payload.exam_completed
    )
    return ExamStatusOut(
        target_exam_date=status.target_exam_date,
        exam_completed=status.exam_completed,
        feedback_provided=status.feedback_provided,
    )


@router.post("/submit", response_model=ExamSubmissionOut)
async def submit_exam_question(
    subject: SubjectSchema = Form(...),
    raw_input_type: RawInputType = Form(...),
    grade: int | None = Form(default=None),
    text_input: str | None = Form(default=None),
    audio_file: UploadFile | None = File(default=None),
    image_file: UploadFile | None = File(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    O'quvchi imtihondan eslab qolgan savolni yuboradi (matn/ovoz/rasm).
    AI savolni tiklaydi, mavzusi va qiyinchiligini aniqlaydi, yechim tayyorlaydi
    va vector bazaga saqlaydi — shu orqali AI'ning bilimi avtomatik oshadi.
    """
    audio_bytes = await audio_file.read() if audio_file else None
    image_bytes = await image_file.read() if image_file else None
    image_mime = image_file.content_type if image_file and image_file.content_type else "image/jpeg"

    try:
        question = await exam_pipeline_service.submit_exam_question(
            db,
            user_id,
            subject.value,
            grade,
            raw_input_type.value,
            text_input=text_input,
            audio_bytes=audio_bytes,
            image_bytes=image_bytes,
            image_mime=image_mime,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ExamSubmissionOut.model_validate(question)
