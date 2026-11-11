"""
Do'st bilan duel: taklif kodi -> qo'shilish -> bir xil savollar -> g'olib.

Natija "dangasa" hisoblanadi: ikkala o'yinchi tugatganda yoki vaqt tugaganda,
duelni birinchi bo'lib ochgan so'rov uni yakunlaydi. Duel qatori qulflanadi
(`FOR UPDATE`), shuning uchun XP ikki marta berilmaydi.
"""
import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Duel, QuizAttempt, User
from app.services import question_bank_service as bank
from app.services import xp_service
from app.services.quiz_catalog import topics_for

DUEL_QUESTIONS = 10
SECONDS_PER_QUESTION = 20
WAITING_EXPIRES_SECONDS = 10 * 60
# O'xshash belgilar (O/0, I/1) yo'q — kodni telefonda aytish/yozish oson bo'lsin.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
XP_WIN = 30
XP_DRAW = 15
XP_LOSS = 5
XP_PER_CORRECT = 2


class DuelError(ValueError):
    pass


def _new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


async def create_duel(db: AsyncSession, host: User, subject: str, now: datetime) -> Duel:
    slots = bank.spread_over_topics(topics_for(subject), DUEL_QUESTIONS)
    questions = await bank.pick_questions(db, subject, "mcq", slots, host.id)
    for _ in range(5):
        duel = Duel(
            code=_new_code(),
            subject=subject,
            host_id=host.id,
            question_ids=[str(q.id) for q in questions],
            status="waiting",
            created_at=now,
        )
        db.add(duel)
        try:
            await db.commit()
        except IntegrityError:  # kod tasodifan ochiq duel kodiga to'g'ri keldi
            await db.rollback()
            continue
        await db.refresh(duel)
        return duel
    raise DuelError("Kod yaratib bo'lmadi, qayta urinib ko'ring")


async def join_duel(db: AsyncSession, guest: User, code: str, now: datetime) -> Duel:
    stmt = select(Duel).where(Duel.code == code.upper(), Duel.status == "waiting").with_for_update()
    duel = (await db.execute(stmt)).scalar_one_or_none()
    if duel is None or _waiting_expired(duel, now):
        raise DuelError("Bunday kod topilmadi yoki duel allaqachon boshlangan")
    if duel.host_id == guest.id:
        raise DuelError("O'zingiz yaratgan duelga qo'shila olmaysiz — kodni do'stingizga yuboring")

    duel.guest_id = guest.id
    duel.status = "active"
    duel.started_at = now
    duel.deadline_at = now + timedelta(seconds=SECONDS_PER_QUESTION * len(duel.question_ids))
    for player_id in (duel.host_id, guest.id):
        db.add(
            QuizAttempt(
                user_id=player_id,
                kind="duel",
                subject=duel.subject,
                question_ids=duel.question_ids,
                answers={},
                state={"duel_id": str(duel.id), "correct": 0},
                max_score=len(duel.question_ids),
                started_at=now,
                deadline_at=duel.deadline_at,
            )
        )
    await db.commit()
    await db.refresh(duel)
    return duel


def _waiting_expired(duel: Duel, now: datetime) -> bool:
    return duel.status == "waiting" and now > duel.created_at + timedelta(seconds=WAITING_EXPIRES_SECONDS)


async def player_attempts(db: AsyncSession, duel: Duel, for_update: bool = False) -> dict[uuid.UUID, QuizAttempt]:
    stmt = select(QuizAttempt).where(QuizAttempt.kind == "duel", QuizAttempt.state["duel_id"].astext == str(duel.id))
    if for_update:
        stmt = stmt.with_for_update()
    return {attempt.user_id: attempt for attempt in (await db.execute(stmt)).scalars().all()}


async def load_duel(db: AsyncSession, duel_id: uuid.UUID, user_id: uuid.UUID, lock: bool = False) -> Duel | None:
    duel = await db.get(Duel, duel_id, with_for_update=lock, populate_existing=lock)
    if duel is None or user_id not in (duel.host_id, duel.guest_id):
        return None
    return duel


async def refresh_status(db: AsyncSession, duel: Duel, now: datetime) -> None:
    """Muddati o'tgan kutish holatini va tugagan duelni yakunlaydi (chaqiruvchi duelni qulflagan bo'lishi kerak)."""
    if _waiting_expired(duel, now):
        duel.status = "expired"
        await db.commit()
        return
    if duel.status != "active":
        return
    attempts = await player_attempts(db, duel, for_update=True)
    everyone_done = len(attempts) == 2 and all(a.status == "finished" for a in attempts.values())
    if everyone_done or now > duel.deadline_at:
        await _finalize(db, duel, attempts, now)


def _elapsed(attempt: QuizAttempt) -> float:
    end = attempt.finished_at or attempt.deadline_at
    return (end - attempt.started_at).total_seconds()


async def _finalize(db: AsyncSession, duel: Duel, attempts: dict[uuid.UUID, QuizAttempt], now: datetime) -> None:
    for attempt in attempts.values():
        if attempt.status != "finished":
            attempt.status = "finished"
            attempt.finished_at = min(now, attempt.deadline_at)

    host, guest = attempts[duel.host_id], attempts[duel.guest_id]
    host_key = (host.score, -_elapsed(host))
    guest_key = (guest.score, -_elapsed(guest))
    if host_key > guest_key:
        duel.winner_id = duel.host_id
    elif guest_key > host_key:
        duel.winner_id = duel.guest_id

    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(list(attempts))))).scalars().all()}
    for user_id, attempt in attempts.items():
        if duel.winner_id is None:
            bonus = XP_DRAW
        else:
            bonus = XP_WIN if duel.winner_id == user_id else XP_LOSS
        attempt.state = {**attempt.state, "result": "draw" if duel.winner_id is None else ("win" if duel.winner_id == user_id else "loss")}
        xp_service.award(users[user_id], attempt, int(attempt.score) * XP_PER_CORRECT + bonus, now)

    duel.status = "finished"
    duel.finished_at = now
    await db.commit()


async def answer(
    db: AsyncSession, duel: Duel, user_id: uuid.UUID, question_id: str, choice: int, now: datetime
) -> tuple[bool, int, str]:
    if duel.status != "active" or now > duel.deadline_at:
        raise DuelError("Duel tugagan")
    attempts = await player_attempts(db, duel, for_update=True)
    attempt = attempts.get(user_id)
    if attempt is None or attempt.status != "active":
        raise DuelError("Siz barcha savollarga javob bergansiz")
    if question_id not in attempt.question_ids:
        raise DuelError("Bu savol duelda yo'q")
    answers = dict(attempt.answers or {})
    if question_id in answers:
        raise DuelError("Bu savolga javob berilgan")

    question = (await bank.load_by_ids(db, [question_id]))[0]
    is_correct = choice == question.correct_index
    answers[question_id] = choice
    attempt.answers = answers
    if is_correct:
        attempt.score = attempt.score + 1
        attempt.state = {**attempt.state, "correct": attempt.state.get("correct", 0) + 1}
    if len(answers) == len(attempt.question_ids):
        attempt.status = "finished"
        attempt.finished_at = now
    await db.commit()
    return is_correct, question.correct_index, question.explanation


async def cancel(db: AsyncSession, duel: Duel, user_id: uuid.UUID) -> None:
    if duel.status != "waiting" or duel.host_id != user_id:
        raise DuelError("Faqat boshlanmagan duelni yaratuvchisi bekor qila oladi")
    duel.status = "cancelled"
    await db.commit()
