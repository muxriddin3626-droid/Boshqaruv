"""
O'yinlar: Millioner, Tezkor blits, Juftlash.

Har bir javob serverda tekshiriladi; o'yin holati `quiz_attempts.state`da.
Javob berish so'rovlari urinish qatorini qulflaydi (`FOR UPDATE`): blitsda
o'quvchi tez bosganda parallel so'rovlar bir-birining natijasini o'chirmasin.
"""
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import QuizAttempt, QuizQuestion, User
from app.services import question_bank_service as bank
from app.services import xp_service
from app.services.quiz_catalog import topics_for

GAME_KINDS = ("millioner", "blitz", "matching")

# --- Millioner ---------------------------------------------------------------
PRIZE_LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000]
SAFE_LEVELS = (5, 10)  # shuncha savolga to'g'ri javob berilgach yutuq kafolatlanadi
QUESTIONS_PER_DIFFICULTY = 3
MILLIONER_XP_PER_LEVEL = 5
MILLIONER_WIN_BONUS = 50

# --- Blits -------------------------------------------------------------------
BLITZ_SECONDS = 60
BLITZ_GRACE_SECONDS = 2
BLITZ_STATEMENTS = 40
BLITZ_BASE_POINTS = 10
BLITZ_MAX_XP = 60

# --- Juftlash ----------------------------------------------------------------
MATCHING_SECONDS = 180
MATCHING_XP_PER_PAIR = 3
MATCHING_PERFECT_BONUS = 10
MATCHING_FAST_BONUS = 10
MATCHING_FAST_SECONDS = 30


class GameError(ValueError):
    pass


class GameOverError(Exception):
    pass


async def lock_attempt(db: AsyncSession, attempt_id: uuid.UUID, user_id: uuid.UUID, kind: str) -> QuizAttempt | None:
    attempt = await db.get(QuizAttempt, attempt_id, with_for_update=True, populate_existing=True)
    if attempt is None or attempt.user_id != user_id or attempt.kind != kind:
        return None
    return attempt


async def get_question(db: AsyncSession, question_id: str) -> QuizQuestion:
    question = await db.get(QuizQuestion, uuid.UUID(question_id))
    if question is None:
        raise GameError("Savol topilmadi")
    return question


def _finish(user: User, attempt: QuizAttempt, score: float, xp: int, now: datetime, state: dict) -> None:
    attempt.state = state
    attempt.score = score
    attempt.status = "finished"
    attempt.finished_at = now
    xp_service.award(user, attempt, xp, now)


# ============================================================================ Millioner


async def start_millioner(db: AsyncSession, user: User, subject: str, now: datetime) -> QuizAttempt:
    slots: list[bank.Slot] = []
    for difficulty in range(1, 6):
        slots += bank.spread_over_topics(topics_for(subject), QUESTIONS_PER_DIFFICULTY, difficulty)
    questions = await bank.pick_questions(db, subject, "mcq", slots, user.id)
    attempt = QuizAttempt(
        user_id=user.id,
        kind="millioner",
        subject=subject,
        question_ids=[str(q.id) for q in questions],
        state={"level": 0, "lifelines": {"fifty": True, "hint": True}, "removed": {}},
        max_score=PRIZE_LADDER[-1],
        started_at=now,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


def millioner_guaranteed_prize(level: int) -> int:
    reached = [safe for safe in SAFE_LEVELS if level >= safe]
    return PRIZE_LADDER[reached[-1] - 1] if reached else 0


def millioner_current_question_id(attempt: QuizAttempt) -> str:
    return attempt.question_ids[attempt.state["level"]]


async def millioner_answer(db: AsyncSession, user: User, attempt: QuizAttempt, choice: int, now: datetime) -> dict:
    if attempt.status != "active":
        raise GameOverError
    state = dict(attempt.state)
    question = await get_question(db, millioner_current_question_id(attempt))
    is_correct = choice == question.correct_index
    result = {"correct": is_correct, "correct_index": question.correct_index, "explanation": question.explanation}

    if is_correct:
        state["level"] += 1
        if state["level"] == len(attempt.question_ids):
            xp = state["level"] * MILLIONER_XP_PER_LEVEL + MILLIONER_WIN_BONUS
            _finish(user, attempt, PRIZE_LADDER[-1], xp, now, {**state, "won": True})
        else:
            attempt.state = state
    else:
        prize = millioner_guaranteed_prize(state["level"])
        _finish(user, attempt, prize, state["level"] * MILLIONER_XP_PER_LEVEL, now, {**state, "won": False})

    await db.commit()
    return result


async def millioner_walk_away(db: AsyncSession, user: User, attempt: QuizAttempt, now: datetime) -> None:
    if attempt.status != "active":
        raise GameOverError
    level = attempt.state["level"]
    prize = PRIZE_LADDER[level - 1] if level > 0 else 0
    _finish(user, attempt, prize, level * MILLIONER_XP_PER_LEVEL, now, {**attempt.state, "won": False, "walked_away": True})
    await db.commit()


async def millioner_fifty(db: AsyncSession, attempt: QuizAttempt) -> list[int]:
    """Ikkita noto'g'ri variantni olib tashlaydi."""
    if attempt.status != "active":
        raise GameOverError
    state = dict(attempt.state)
    if not state["lifelines"].get("fifty"):
        raise GameError("50/50 allaqachon ishlatilgan")
    question_id = millioner_current_question_id(attempt)
    question = await get_question(db, question_id)
    wrong = [i for i in range(len(question.options)) if i != question.correct_index]
    removed = sorted(random.sample(wrong, 2))
    state["lifelines"] = {**state["lifelines"], "fifty": False}
    state["removed"] = {**state.get("removed", {}), question_id: removed}
    attempt.state = state
    await db.commit()
    return removed


async def millioner_hint(db: AsyncSession, attempt: QuizAttempt) -> str:
    if attempt.status != "active":
        raise GameOverError
    state = dict(attempt.state)
    if not state["lifelines"].get("hint"):
        raise GameError("Ustoz maslahati allaqachon ishlatilgan")
    question = await get_question(db, millioner_current_question_id(attempt))
    if not question.hint:
        # Maslahat yo'q bo'lsa yordam sarflanmaydi.
        raise GameError("Bu savol uchun maslahat yo'q — yordam saqlanib qoldi")
    state["lifelines"] = {**state["lifelines"], "hint": False}
    attempt.state = state
    await db.commit()
    return question.hint


# ============================================================================ Blits


def blitz_multiplier(combo: int) -> int:
    if combo >= 6:
        return 3
    if combo >= 3:
        return 2
    return 1


async def start_blitz(db: AsyncSession, user: User, subject: str, now: datetime) -> QuizAttempt:
    slots = bank.spread_over_topics(topics_for(subject), BLITZ_STATEMENTS)
    questions = await bank.pick_questions(db, subject, "true_false", slots, user.id)
    random.shuffle(questions)
    attempt = QuizAttempt(
        user_id=user.id,
        kind="blitz",
        subject=subject,
        question_ids=[str(q.id) for q in questions],
        state={"combo": 0, "best_combo": 0, "correct": 0, "wrong": 0},
        started_at=now,
        deadline_at=now + timedelta(seconds=BLITZ_SECONDS),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


def blitz_time_is_up(attempt: QuizAttempt, now: datetime) -> bool:
    return now > attempt.deadline_at + timedelta(seconds=BLITZ_GRACE_SECONDS)


async def finish_blitz(db: AsyncSession, user: User, attempt: QuizAttempt, now: datetime) -> None:
    if attempt.status != "active":
        return
    xp = min(BLITZ_MAX_XP, int(attempt.score) // 10)
    _finish(user, attempt, attempt.score, xp, now, dict(attempt.state))
    await db.commit()


async def blitz_answer(
    db: AsyncSession, user: User, attempt: QuizAttempt, question_id: str, is_true: bool, now: datetime
) -> dict:
    if attempt.status != "active":
        raise GameOverError
    if blitz_time_is_up(attempt, now):
        await finish_blitz(db, user, attempt, now)
        raise GameOverError
    if question_id not in attempt.question_ids:
        raise GameError("Bu savol o'yinda yo'q")
    answers = dict(attempt.answers or {})
    if question_id in answers:
        raise GameError("Bu savolga javob berilgan")

    question = await get_question(db, question_id)
    statement_is_true = question.correct_index == 0
    is_correct = is_true == statement_is_true
    state = dict(attempt.state)
    points = 0
    if is_correct:
        state["combo"] += 1
        state["correct"] += 1
        state["best_combo"] = max(state["best_combo"], state["combo"])
        points = BLITZ_BASE_POINTS * blitz_multiplier(state["combo"])
    else:
        state["combo"] = 0
        state["wrong"] += 1

    answers[question_id] = 0 if is_true else 1
    attempt.answers = answers
    attempt.state = state
    attempt.score = attempt.score + points
    if len(answers) == len(attempt.question_ids):
        await finish_blitz(db, user, attempt, now)
    else:
        await db.commit()
    return {
        "correct": is_correct,
        "statement_is_true": statement_is_true,
        "points": points,
        "combo": state["combo"],
        "multiplier": blitz_multiplier(state["combo"]),
        "score": attempt.score,
    }


# ============================================================================ Juftlash


async def start_matching(db: AsyncSession, user: User, subject: str, now: datetime) -> tuple[QuizAttempt, QuizQuestion]:
    category, topic = random.choice(topics_for(subject))
    [question] = await bank.pick_questions(db, subject, "matching", [bank.Slot(category, topic, None, 1)], user.id)
    right_order = random.sample(range(len(question.options)), len(question.options))
    attempt = QuizAttempt(
        user_id=user.id,
        kind="matching",
        subject=subject,
        question_ids=[str(question.id)],
        state={"right_order": right_order, "matched": [], "mistakes": 0},
        max_score=len(question.options),
        started_at=now,
        deadline_at=now + timedelta(seconds=MATCHING_SECONDS),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt, question


def matching_columns(question: QuizQuestion, right_order: list[int]) -> tuple[list[str], list[str]]:
    left = [pair["left"] for pair in question.options]
    right = [question.options[i]["right"] for i in right_order]
    return left, right


async def matching_match(
    db: AsyncSession, user: User, attempt: QuizAttempt, left: int, right: int, now: datetime
) -> dict:
    if attempt.status != "active":
        raise GameOverError
    state = dict(attempt.state)
    pair_count = len(state["right_order"])
    if not (0 <= left < pair_count and 0 <= right < pair_count):
        raise GameError("Element noto'g'ri")
    matched_lefts = {pair[0] for pair in state["matched"]}
    matched_rights = {pair[1] for pair in state["matched"]}
    if left in matched_lefts or right in matched_rights:
        raise GameError("Bu element allaqachon juftlangan")

    time_is_up = attempt.deadline_at is not None and now > attempt.deadline_at
    is_correct = not time_is_up and state["right_order"][right] == left
    if is_correct:
        state["matched"] = [*state["matched"], [left, right]]
    elif not time_is_up:
        state["mistakes"] += 1

    finished = time_is_up or len(state["matched"]) == pair_count
    xp = 0
    if finished:
        seconds = (now - attempt.started_at).total_seconds()
        matched = len(state["matched"])
        xp = matched * MATCHING_XP_PER_PAIR
        if matched == pair_count and state["mistakes"] == 0:
            xp += MATCHING_PERFECT_BONUS
        if matched == pair_count and seconds <= MATCHING_FAST_SECONDS:
            xp += MATCHING_FAST_BONUS
        _finish(user, attempt, matched, xp, now, {**state, "seconds": round(seconds, 1)})
    else:
        attempt.state = state
    await db.commit()
    return {
        "correct": is_correct,
        "matched": state["matched"],
        "mistakes": state["mistakes"],
        "finished": finished,
        "time_is_up": time_is_up,
        "xp_earned": attempt.xp_earned if finished else 0,
    }

