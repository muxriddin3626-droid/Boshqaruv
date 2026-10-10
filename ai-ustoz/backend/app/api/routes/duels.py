"""Do'st bilan duel: kod bilan taklif, bir xil savollar, jonli hisob (frontend har soniyada so'raydi)."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import Duel, QuizAttempt, User
from app.models.schemas import (
    DuelAnswerIn,
    DuelAnswerOut,
    DuelCreateIn,
    DuelJoinIn,
    DuelOut,
    DuelPlayerOut,
    DuelQuestionOut,
)
from app.services import duel_service as duels
from app.services.question_bank_service import QuestionBankUnavailableError, load_by_ids
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit
from app.services.xp_service import display_name

router = APIRouter(prefix="/api/v1/duels", tags=["duels"])

DUELS_PER_HOUR = 20
# Noto'g'ri kod bilan qo'shilish urinishlari: begona duel kodini terib topishning oldini olish.
JOIN_FAILURES_PER_HOUR = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


async def _locked_duel(db: AsyncSession, duel_id: uuid.UUID, user_id: uuid.UUID) -> Duel:
    duel = await duels.load_duel(db, duel_id, user_id, lock=True)
    if duel is None:
        raise HTTPException(status_code=404, detail="Duel topilmadi")
    await duels.refresh_status(db, duel, _now())
    return duel


def _player(user: User | None, attempt: QuizAttempt | None) -> DuelPlayerOut:
    if attempt is None:
        return DuelPlayerOut(name=display_name(user.full_name) if user else "...", answered=0, correct=0, finished=False, seconds=None)
    seconds = (attempt.finished_at - attempt.started_at).total_seconds() if attempt.finished_at else None
    return DuelPlayerOut(
        name=display_name(user.full_name) if user else "...",
        answered=len(attempt.answers or {}),
        correct=int(attempt.score),
        finished=attempt.status == "finished",
        seconds=round(seconds, 1) if seconds is not None else None,
    )


async def _duel_out(db: AsyncSession, duel: Duel, user_id: uuid.UUID) -> DuelOut:
    attempts = await duels.player_attempts(db, duel)
    opponent_id = duel.guest_id if duel.host_id == user_id else duel.host_id
    me_user = await db.get(User, user_id)
    opponent_user = await db.get(User, opponent_id) if opponent_id else None
    my_attempt = attempts.get(user_id)

    questions: list[DuelQuestionOut] = []
    if duel.status in ("active", "finished"):
        reveal = duel.status == "finished"
        questions = [
            DuelQuestionOut(
                id=str(q.id),
                topic=q.topic,
                question=q.question,
                options=q.options,
                correct_index=q.correct_index if reveal else None,
            )
            for q in await load_by_ids(db, duel.question_ids)
        ]

    return DuelOut(
        id=duel.id,
        code=duel.code,
        subject=duel.subject,
        status=duel.status,
        is_host=duel.host_id == user_id,
        me=_player(me_user, my_attempt),
        opponent=_player(opponent_user, attempts.get(opponent_id)) if opponent_id else None,
        questions=questions,
        my_answers=(my_attempt.answers or {}) if my_attempt else {},
        deadline_at=duel.deadline_at,
        server_now=_now(),
        result=my_attempt.state.get("result") if my_attempt else None,
        xp_earned=my_attempt.xp_earned if my_attempt else 0,
    )


@router.post("", response_model=DuelOut, status_code=201)
async def create_duel(
    payload: DuelCreateIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    key = f"duels_created:{user_id}"
    try:
        await ensure_below_limit(redis, key, DUELS_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bir soatda juda ko'p duel yaratildi. Birozdan keyin urinib ko'ring.") from exc
    try:
        duel = await duels.create_duel(db, await _get_user(db, user_id), payload.subject.value, _now())
    except QuestionBankUnavailableError as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except duels.DuelError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await register_hit(redis, key, 60 * 60)
    return await _duel_out(db, duel, user_id)


@router.post("/join", response_model=DuelOut)
async def join_duel(
    payload: DuelJoinIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    key = f"duel_join_fail:{user_id}"
    try:
        await ensure_below_limit(redis, key, JOIN_FAILURES_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Juda ko'p noto'g'ri kod kiritildi. Birozdan keyin urinib ko'ring.") from exc
    try:
        duel = await duels.join_duel(db, await _get_user(db, user_id), payload.code, _now())
    except duels.DuelError as exc:
        await db.rollback()
        await register_hit(redis, key, 60 * 60)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _duel_out(db, duel, user_id)


@router.get("/{duel_id}", response_model=DuelOut)
async def get_duel(duel_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    duel = await _locked_duel(db, duel_id, user_id)
    out = await _duel_out(db, duel, user_id)
    await db.commit()  # qulfni bo'shatish
    return out


@router.post("/{duel_id}/answer", response_model=DuelAnswerOut)
async def answer_duel(
    duel_id: uuid.UUID,
    payload: DuelAnswerIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    duel = await _locked_duel(db, duel_id, user_id)
    try:
        is_correct, correct_index, explanation = await duels.answer(db, duel, user_id, payload.question_id, payload.choice, _now())
    except duels.DuelError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    duel = await _locked_duel(db, duel_id, user_id)  # ikkala o'yinchi tugatgan bo'lsa — natija hisoblanadi
    out = await _duel_out(db, duel, user_id)
    await db.commit()
    return DuelAnswerOut(correct=is_correct, correct_index=correct_index, explanation=explanation, duel=out)


@router.post("/{duel_id}/cancel", response_model=DuelOut)
async def cancel_duel(duel_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    duel = await _locked_duel(db, duel_id, user_id)
    try:
        await duels.cancel(db, duel, user_id)
    except duels.DuelError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return await _duel_out(db, duel, user_id)
