"""Mavzu bo'yicha audio ma'ruzalar: ro'yxat, tayyorlash, tinglash va qayerda to'xtaganini saqlash."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import LectureProgress, TopicLecture, User
from app.models.schemas import (
    LectureCatalogItemOut,
    LectureCatalogOut,
    LectureOut,
    LectureProgressIn,
    LectureProgressOut,
    LectureProgressResultOut,
    LectureRequestIn,
    LectureSectionOut,
    SubjectSchema,
)
from app.services import lecture_service, media_storage
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit

router = APIRouter(prefix="/api/v1/lectures", tags=["lectures"])

# Yangi ma'ruza tayyorlash (AI ssenariy + TTS) qimmat; tayyorini ochish cheklanmaydi.
GENERATIONS_PER_HOUR = 8


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


def _progress_out(progress: LectureProgress | None) -> LectureProgressOut | None:
    if progress is None:
        return None
    return LectureProgressOut(position_seconds=progress.position_seconds, completed=progress.completed, listen_count=progress.listen_count)


def _lecture_out(lecture: TopicLecture, progress: LectureProgress | None) -> LectureOut:
    is_ready = lecture.status == "ready" and lecture.audio_ref
    return LectureOut(
        id=lecture.id,
        subject=lecture.subject,
        category=lecture.category,
        topic=lecture.topic,
        title=lecture.title,
        status=lecture.status,
        sections=[LectureSectionOut(**section) for section in lecture.sections] if is_ready else [],
        audio_url=media_storage.playback_url(lecture.audio_ref) if is_ready else None,
        duration_seconds=lecture.duration_seconds,
        progress=_progress_out(progress),
    )


@router.get("", response_model=LectureCatalogOut)
async def list_lectures(subject: SubjectSchema, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await _get_user(db, user_id)
    rows = await lecture_service.catalog(db, user, subject.value)
    return LectureCatalogOut(
        subject=subject,
        grade_band=lecture_service.grade_band(user),
        items=[
            LectureCatalogItemOut(
                category=category,
                topic=topic,
                lecture_id=lecture.id if lecture else None,
                status=lecture.status if lecture else "none",
                duration_seconds=lecture.duration_seconds if lecture else 0,
                progress=_progress_out(progress),
            )
            for category, topic, lecture, progress in rows
        ],
    )


@router.post("", response_model=LectureOut)
async def request_lecture(
    payload: LectureRequestIn,
    response: Response,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Tayyor bo'lsa — 200 va audio havola; tayyorlanayotgan bo'lsa — 202, frontend GET bilan so'rab turadi."""
    user = await _get_user(db, user_id)
    key = f"lecture_generate:{user_id}"
    try:
        await ensure_below_limit(redis, key, GENERATIONS_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bir soatda juda ko'p yangi ma'ruza so'raldi. Tayyorlarini tinglang.") from exc
    try:
        lecture, started = await lecture_service.request_lecture(db, user, payload.subject.value, payload.topic, _now())
    except lecture_service.LectureError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if started:
        await register_hit(redis, key, 60 * 60)
    if lecture.status != "ready":
        response.status_code = 202
    return _lecture_out(lecture, await lecture_service.get_progress(db, user_id, lecture.id))


@router.get("/{lecture_id}", response_model=LectureOut)
async def get_lecture(lecture_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    lecture = await db.get(TopicLecture, lecture_id, populate_existing=True)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Ma'ruza topilmadi")
    return _lecture_out(lecture, await lecture_service.get_progress(db, user_id, lecture_id))


@router.put("/{lecture_id}/progress", response_model=LectureProgressResultOut)
async def save_progress(
    lecture_id: uuid.UUID,
    payload: LectureProgressIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    lecture = await db.get(TopicLecture, lecture_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Ma'ruza topilmadi")
    try:
        progress, xp = await lecture_service.save_progress(db, await _get_user(db, user_id), lecture, payload.position_seconds, payload.ended, _now())
    except lecture_service.LectureError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return LectureProgressResultOut(progress=_progress_out(progress), xp_awarded=xp)
