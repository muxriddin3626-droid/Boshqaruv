"""MODUL 8: Audio Lecture Engine endpoint'lari."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.schemas import AudioLectureGenerateIn, AudioLectureOut, AudioLectureUpdateIn, SubjectSchema
from app.services import audio_service

router = APIRouter(prefix="/api/v1/audio-lectures", tags=["audio-lectures"])


@router.post("/generate", response_model=AudioLectureOut)
async def generate_audio_lecture(
    payload: AudioLectureGenerateIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Ma'ruza matnini (masalan, AI Ustozning chatdagi javobini) audio(MP3)ga aylantirib, shaxsiy kutubxonaga saqlaydi."""
    try:
        lecture = await audio_service.generate_and_store_lecture(
            db,
            user_id,
            payload.subject.value,
            payload.grade,
            payload.lecture_title,
            payload.lecture_text,
            payload.lecture_summary,
            payload.voice,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AudioLectureOut.model_validate(lecture)


@router.get("", response_model=list[AudioLectureOut])
async def list_audio_lectures(
    subject: SubjectSchema | None = None,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Shaxsiy audio kutubxona — barcha (yoki bitta fan bo'yicha) saqlangan ma'ruzalar."""
    lectures = await audio_service.list_user_lectures(db, user_id, subject.value if subject else None)
    return [AudioLectureOut.model_validate(lecture) for lecture in lectures]


@router.patch("/{lecture_id}", response_model=AudioLectureOut)
async def update_audio_lecture(
    lecture_id: uuid.UUID,
    payload: AudioLectureUpdateIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Ma'ruzani kutubxonada "saqlangan" yoki "saqlanmagan" deb belgilaydi."""
    try:
        lecture = await audio_service.set_lecture_saved(db, user_id, lecture_id, payload.is_saved)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return AudioLectureOut.model_validate(lecture)


@router.delete("/{lecture_id}")
async def delete_audio_lecture(
    lecture_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await audio_service.delete_lecture(db, user_id, lecture_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {"status": "deleted"}
