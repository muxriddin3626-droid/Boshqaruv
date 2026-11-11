"""Uyga vazifa: olish, ko'rish, topshirish (AI tekshiradi)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import Homework, User
from app.models.schemas import (
    HomeworkCreateIn,
    HomeworkOut,
    HomeworkQuestionOut,
    HomeworkResultOut,
    HomeworkSubmitIn,
    HomeworkSummaryOut,
)
from app.services import homework_service as hw
from app.services.question_bank_service import QuestionBankUnavailableError, load_by_ids
from app.services import ai_budget
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit

router = APIRouter(prefix="/api/v1/homework", tags=["homework"])

# AI chaqiruvlari qimmat: vazifa tuzish ~3, tekshirish ~1 chaqiruv.
ASSIGNS_PER_HOUR = 6
SUBMITS_PER_HOUR = 10
CHECK_LOCK_SECONDS = 180
HISTORY_LIMIT = 20


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


async def _get_homework(db: AsyncSession, homework_id: uuid.UUID, user_id: uuid.UUID) -> Homework:
    homework = await db.get(Homework, homework_id, populate_existing=True)
    if homework is None or homework.user_id != user_id:
        raise HTTPException(status_code=404, detail="Vazifa topilmadi")
    return homework


async def _homework_out(db: AsyncSession, homework: Homework) -> HomeworkOut:
    now = _now()
    questions = await load_by_ids(db, homework.question_ids)
    return HomeworkOut(
        id=homework.id,
        subject=homework.subject,
        category=homework.category,
        topic=homework.topic,
        status=homework.status,
        assigned_at=homework.assigned_at,
        due_at=homework.due_at,
        is_overdue=homework.status == "assigned" and now > homework.due_at,
        questions=[HomeworkQuestionOut(id=str(q.id), question=q.question, options=q.options) for q in questions],
        problems=[problem["problem"] for problem in homework.problems],
        submissions=homework.submissions,
        result=HomeworkResultOut(**homework.result) if homework.result else None,
        score=homework.score,
        max_score=homework.max_score,
        xp_earned=homework.xp_earned,
        is_late=homework.is_late,
        checked_at=homework.checked_at,
        server_now=now,
    )


@router.get("", response_model=list[HomeworkSummaryOut])
async def list_homework(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Ochiq vazifalar birinchi, keyin tekshirilganlar (yangisidan)."""
    now = _now()
    stmt = (
        select(Homework)
        .where(Homework.user_id == user_id)
        .order_by((Homework.status == "assigned").desc(), Homework.assigned_at.desc())
        .limit(HISTORY_LIMIT)
    )
    return [
        HomeworkSummaryOut(
            id=item.id,
            subject=item.subject,
            topic=item.topic,
            status=item.status,
            assigned_at=item.assigned_at,
            due_at=item.due_at,
            is_overdue=item.status == "assigned" and now > item.due_at,
            percent=item.result.get("percent") if item.result else None,
            xp_earned=item.xp_earned,
        )
        for item in (await db.execute(stmt)).scalars()
    ]


@router.post("", response_model=HomeworkOut, status_code=201)
async def assign_homework(
    payload: HomeworkCreateIn,
    response: Response,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Shu fan bo'yicha ochiq vazifa bo'lsa — o'shani qaytaradi (200), aks holda yangisini tuzadi (201)."""
    user = await _get_user(db, user_id)
    existing = await hw.open_homework(db, user_id, payload.subject.value)
    if existing:
        response.status_code = 200
        return await _homework_out(db, existing)

    key = f"homework_assign:{user_id}"
    await ai_budget.ensure_budget(db, user_id)
    try:
        await ensure_below_limit(redis, key, ASSIGNS_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bir soatda juda ko'p vazifa so'raldi. Avval borini bajaring.") from exc
    try:
        homework, is_new = await hw.assign(db, user, payload.subject.value, payload.topic, _now())
    except hw.HomeworkError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except QuestionBankUnavailableError as exc:
        raise HTTPException(status_code=503, detail="Vazifa hozircha tayyorlanmadi. Birozdan keyin urinib ko'ring.") from exc
    if is_new:
        await register_hit(redis, key, 60 * 60)
    else:
        response.status_code = 200
    return await _homework_out(db, homework)


@router.get("/{homework_id}", response_model=HomeworkOut)
async def get_homework(homework_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return await _homework_out(db, await _get_homework(db, homework_id, user_id))


@router.post("/{homework_id}/submit", response_model=HomeworkOut)
async def submit_homework(
    homework_id: uuid.UUID,
    payload: HomeworkSubmitIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    homework = await _get_homework(db, homework_id, user_id)
    if homework.status != "assigned":
        raise HTTPException(status_code=409, detail="Bu vazifa allaqachon tekshirilgan")
    try:
        solutions = [hw.Solution(text=s.text, photo_data_url=hw.decode_photo(s.photo) if s.photo else None) for s in payload.solutions]
    except hw.HomeworkError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    rate_key = f"homework_submit:{user_id}"
    await ai_budget.ensure_budget(db, user_id)
    try:
        await ensure_below_limit(redis, rate_key, SUBMITS_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Juda ko'p urinish. Birozdan keyin qayta yuboring.") from exc

    # Ikki marta bosilsa AI ikki marta chaqirilmasin va XP ikki marta berilmasin.
    lock_key = f"homework_check:{homework_id}"
    if not await redis.set(lock_key, "1", nx=True, ex=CHECK_LOCK_SECONDS):
        raise HTTPException(status_code=409, detail="Vazifa hozir tekshirilmoqda, biroz kuting")
    try:
        await register_hit(redis, rate_key, 60 * 60)
        homework = await _get_homework(db, homework_id, user_id)  # qulf olingach — eng so'nggi holat
        user = await _get_user(db, user_id)
        try:
            homework = await hw.check(db, user, homework, payload.mcq_answers, solutions, _now())
        except hw.HomeworkError as exc:
            raise HTTPException(status_code=409 if homework.status != "assigned" else 422, detail=str(exc)) from exc
        except hw.HomeworkCheckFailedError as exc:
            await db.rollback()
            raise HTTPException(
                status_code=503, detail="AI Ustoz hozir tekshira olmadi. Yechimlaringiz saqlanib turibdi — qayta yuboring."
            ) from exc
    finally:
        await redis.delete(lock_key)
    return await _homework_out(db, homework)
