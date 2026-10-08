"""O'yinlar: Millioner, Tezkor blits, Juftlash."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import QuizAttempt, User
from app.models.schemas import (
    BlitzAnswerIn,
    BlitzAnswerOut,
    BlitzResultOut,
    BlitzStartOut,
    BlitzStatementOut,
    GameStartIn,
    MatchingMatchIn,
    MatchingMatchOut,
    MatchingStartOut,
    MillionerAnswerIn,
    MillionerAnswerOut,
    MillionerQuestionOut,
    MillionerStateOut,
)
from app.services import game_service as games
from app.services.question_bank_service import QuestionBankUnavailableError, load_by_ids
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit

router = APIRouter(prefix="/api/v1/games", tags=["games"])

GAMES_PER_HOUR = 40
BANK_UNAVAILABLE_DETAIL = "Savollar hozircha tayyorlanmadi (AI xizmati javob bermayapti). Birozdan keyin urinib ko'ring."
GAME_OVER_DETAIL = "O'yin tugagan"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


async def _start_guard(redis: Redis, user_id: uuid.UUID) -> str:
    key = f"games_started:{user_id}"
    try:
        await ensure_below_limit(redis, key, GAMES_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bir soatda juda ko'p o'yin boshlandi. Birozdan keyin urinib ko'ring.") from exc
    return key


async def _locked(db: AsyncSession, attempt_id: uuid.UUID, user_id: uuid.UUID, kind: str) -> QuizAttempt:
    attempt = await games.lock_attempt(db, attempt_id, user_id, kind)
    if attempt is None:
        raise HTTPException(status_code=404, detail="O'yin topilmadi")
    return attempt


# ============================================================================ Millioner


async def _millioner_state(db: AsyncSession, attempt: QuizAttempt) -> MillionerStateOut:
    state = attempt.state
    question = None
    if attempt.status == "active":
        question_id = games.millioner_current_question_id(attempt)
        row = await games.get_question(db, question_id)
        question = MillionerQuestionOut(
            id=question_id,
            topic=row.topic,
            question=row.question,
            options=row.options,
            removed=state.get("removed", {}).get(question_id, []),
        )
    level = state["level"]
    prize = int(attempt.score) if attempt.status == "finished" else (games.PRIZE_LADDER[level - 1] if level else 0)
    return MillionerStateOut(
        attempt_id=attempt.id,
        status=attempt.status,
        level=level,
        prize_ladder=games.PRIZE_LADDER,
        safe_levels=list(games.SAFE_LEVELS),
        lifelines=state["lifelines"],
        question=question,
        prize=prize,
        won=bool(state.get("won")),
        xp_earned=attempt.xp_earned,
    )


@router.post("/millioner", response_model=MillionerStateOut, status_code=201)
async def start_millioner(
    payload: GameStartIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    limit_key = await _start_guard(redis, user_id)
    try:
        attempt = await games.start_millioner(db, await _get_user(db, user_id), payload.subject.value, _now())
    except QuestionBankUnavailableError as exc:
        raise HTTPException(status_code=503, detail=BANK_UNAVAILABLE_DETAIL) from exc
    await register_hit(redis, limit_key, 60 * 60)
    return await _millioner_state(db, attempt)


@router.post("/millioner/{attempt_id}/answer", response_model=MillionerAnswerOut)
async def millioner_answer(
    attempt_id: uuid.UUID,
    payload: MillionerAnswerIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _locked(db, attempt_id, user_id, "millioner")
    try:
        result = await games.millioner_answer(db, await _get_user(db, user_id), attempt, payload.choice, _now())
    except games.GameOverError as exc:
        raise HTTPException(status_code=409, detail=GAME_OVER_DETAIL) from exc
    return MillionerAnswerOut(**result, game=await _millioner_state(db, attempt))


@router.post("/millioner/{attempt_id}/fifty", response_model=MillionerStateOut)
async def millioner_fifty(
    attempt_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    attempt = await _locked(db, attempt_id, user_id, "millioner")
    try:
        await games.millioner_fifty(db, attempt)
    except games.GameOverError as exc:
        raise HTTPException(status_code=409, detail=GAME_OVER_DETAIL) from exc
    except games.GameError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _millioner_state(db, attempt)


@router.post("/millioner/{attempt_id}/hint")
async def millioner_hint(
    attempt_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    attempt = await _locked(db, attempt_id, user_id, "millioner")
    try:
        hint = await games.millioner_hint(db, attempt)
    except games.GameOverError as exc:
        raise HTTPException(status_code=409, detail=GAME_OVER_DETAIL) from exc
    except games.GameError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"hint": hint}


@router.post("/millioner/{attempt_id}/walk-away", response_model=MillionerStateOut)
async def millioner_walk_away(
    attempt_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    attempt = await _locked(db, attempt_id, user_id, "millioner")
    try:
        await games.millioner_walk_away(db, await _get_user(db, user_id), attempt, _now())
    except games.GameOverError as exc:
        raise HTTPException(status_code=409, detail=GAME_OVER_DETAIL) from exc
    return await _millioner_state(db, attempt)


# ============================================================================ Blits


@router.post("/blitz", response_model=BlitzStartOut, status_code=201)
async def start_blitz(
    payload: GameStartIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    limit_key = await _start_guard(redis, user_id)
    try:
        attempt = await games.start_blitz(db, await _get_user(db, user_id), payload.subject.value, _now())
    except QuestionBankUnavailableError as exc:
        raise HTTPException(status_code=503, detail=BANK_UNAVAILABLE_DETAIL) from exc
    await register_hit(redis, limit_key, 60 * 60)
    statements = [
        BlitzStatementOut(id=str(q.id), topic=q.topic, text=q.question)
        for q in await load_by_ids(db, attempt.question_ids)
    ]
    return BlitzStartOut(attempt_id=attempt.id, statements=statements, deadline_at=attempt.deadline_at, server_now=_now())


@router.post("/blitz/{attempt_id}/answer", response_model=BlitzAnswerOut)
async def blitz_answer(
    attempt_id: uuid.UUID,
    payload: BlitzAnswerIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _locked(db, attempt_id, user_id, "blitz")
    try:
        result = await games.blitz_answer(db, await _get_user(db, user_id), attempt, payload.question_id, payload.is_true, _now())
    except games.GameOverError as exc:
        raise HTTPException(status_code=409, detail="Vaqt tugadi") from exc
    except games.GameError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return BlitzAnswerOut(**result)


@router.post("/blitz/{attempt_id}/finish", response_model=BlitzResultOut)
async def blitz_finish(
    attempt_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    attempt = await _locked(db, attempt_id, user_id, "blitz")
    await games.finish_blitz(db, await _get_user(db, user_id), attempt, _now())
    state = attempt.state
    return BlitzResultOut(
        score=attempt.score,
        correct=state["correct"],
        wrong=state["wrong"],
        best_combo=state["best_combo"],
        xp_earned=attempt.xp_earned,
    )


# ============================================================================ Juftlash


@router.post("/matching", response_model=MatchingStartOut, status_code=201)
async def start_matching(
    payload: GameStartIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    limit_key = await _start_guard(redis, user_id)
    try:
        attempt, question = await games.start_matching(db, await _get_user(db, user_id), payload.subject.value, _now())
    except QuestionBankUnavailableError as exc:
        raise HTTPException(status_code=503, detail=BANK_UNAVAILABLE_DETAIL) from exc
    await register_hit(redis, limit_key, 60 * 60)
    left, right = games.matching_columns(question, attempt.state["right_order"])
    return MatchingStartOut(
        attempt_id=attempt.id,
        title=question.question,
        topic=question.topic,
        left=left,
        right=right,
        deadline_at=attempt.deadline_at,
        server_now=_now(),
    )


@router.post("/matching/{attempt_id}/match", response_model=MatchingMatchOut)
async def matching_match(
    attempt_id: uuid.UUID,
    payload: MatchingMatchIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _locked(db, attempt_id, user_id, "matching")
    try:
        result = await games.matching_match(db, await _get_user(db, user_id), attempt, payload.left, payload.right, _now())
    except games.GameOverError as exc:
        raise HTTPException(status_code=409, detail=GAME_OVER_DETAIL) from exc
    except games.GameError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    explanation = None
    if result["finished"]:
        explanation = (await games.get_question(db, attempt.question_ids[0])).explanation
    return MatchingMatchOut(**result, explanation=explanation)
