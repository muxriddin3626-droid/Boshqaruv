"""XP, kunlik ketma-ketlik (streak) va reyting."""
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import QuizAttempt, User

TASHKENT = ZoneInfo("Asia/Tashkent")


def tashkent_today(now: datetime) -> date:
    return now.astimezone(TASHKENT).date()


def week_start(now: datetime) -> datetime:
    """Joriy haftaning boshi (Toshkent vaqti bilan dushanba 00:00)."""
    local = now.astimezone(TASHKENT)
    monday = (local - timedelta(days=local.weekday())).date()
    return datetime(monday.year, monday.month, monday.day, tzinfo=TASHKENT)


def next_streak(last_active_on: date | None, current_streak: int, today: date) -> int:
    if last_active_on == today:
        return max(current_streak, 1)
    if last_active_on == today - timedelta(days=1):
        return current_streak + 1
    return 1


def award(user: User, attempt: QuizAttempt, xp: int, now: datetime) -> None:
    """Yakunlangan urinish uchun XP beradi va streakni yangilaydi (commit chaqiruvchida)."""
    xp = max(0, int(xp))
    attempt.xp_earned = xp
    user.xp_total = (user.xp_total or 0) + xp
    today = tashkent_today(now)
    user.current_streak = next_streak(user.last_active_on, user.current_streak or 0, today)
    user.longest_streak = max(user.longest_streak or 0, user.current_streak)
    user.last_active_on = today


def display_name(full_name: str) -> str:
    """Reytingda bolalarning to'liq ismi emas: 'Dilnoza Karimova' -> 'Dilnoza K.'"""
    parts = full_name.split()
    if len(parts) < 2:
        return parts[0] if parts else "O'quvchi"
    return f"{parts[0]} {parts[1][0]}."


@dataclass
class LeaderboardRow:
    rank: int
    user_id: uuid.UUID
    name: str
    grade: int
    xp: int
    streak: int


async def leaderboard(
    db: AsyncSession, period: str, now: datetime, grade: int | None = None, limit: int = 50
) -> list[LeaderboardRow]:
    """period: 'week' — shu haftada to'plangan XP; 'all' — umumiy XP."""
    if period == "week":
        xp_column = func.coalesce(func.sum(QuizAttempt.xp_earned), 0).label("xp")
        stmt = (
            select(User, xp_column)
            .join(QuizAttempt, QuizAttempt.user_id == User.id)
            .where(QuizAttempt.status == "finished", QuizAttempt.finished_at >= week_start(now))
            .group_by(User.id)
        )
    else:
        xp_column = User.xp_total.label("xp")
        stmt = select(User, xp_column).where(User.xp_total > 0)

    if grade is not None:
        stmt = stmt.where(User.current_grade == grade)
    stmt = stmt.order_by(xp_column.desc(), User.created_at).limit(limit)

    result: list[LeaderboardRow] = []
    for i, (user, xp) in enumerate((await db.execute(stmt)).all()):
        # Teng XP — teng o'rin (1, 1, 3), `user_rank` bilan bir xil hisob.
        rank = result[-1].rank if result and result[-1].xp == int(xp) else i + 1
        result.append(
            LeaderboardRow(
                rank=rank,
                user_id=user.id,
                name=display_name(user.full_name),
                grade=user.current_grade,
                xp=int(xp),
                streak=effective_streak(user, now),
            )
        )
    return result


def effective_streak(user: User, now: datetime) -> int:
    """Kecha ham, bugun ham faol bo'lmagan bo'lsa, streak allaqachon uzilgan."""
    if user.last_active_on is None:
        return 0
    if user.last_active_on < tashkent_today(now) - timedelta(days=1):
        return 0
    return user.current_streak or 0


async def user_week_xp(db: AsyncSession, user_id: uuid.UUID, now: datetime) -> int:
    stmt = select(func.coalesce(func.sum(QuizAttempt.xp_earned), 0)).where(
        QuizAttempt.user_id == user_id, QuizAttempt.status == "finished", QuizAttempt.finished_at >= week_start(now)
    )
    return int((await db.execute(stmt)).scalar_one())



async def user_rank(db: AsyncSession, user: User, period: str, now: datetime, grade: int | None) -> tuple[int, int]:
    """(o'rin, XP) — o'quvchi top ro'yxatga kirmasa ham o'z o'rnini ko'rsatish uchun."""
    if period == "week":
        my_xp = await user_week_xp(db, user.id, now)
        per_user = (
            select(QuizAttempt.user_id, func.sum(QuizAttempt.xp_earned).label("xp"))
            .join(User, User.id == QuizAttempt.user_id)
            .where(QuizAttempt.status == "finished", QuizAttempt.finished_at >= week_start(now))
            .group_by(QuizAttempt.user_id)
        )
        if grade is not None:
            per_user = per_user.where(User.current_grade == grade)
        subquery = per_user.subquery()
        ahead = select(func.count()).select_from(subquery).where(subquery.c.xp > my_xp)
    else:
        my_xp = user.xp_total or 0
        ahead = select(func.count()).select_from(User).where(User.xp_total > my_xp)
        if grade is not None:
            ahead = ahead.where(User.current_grade == grade)
    return int((await db.execute(ahead)).scalar_one()) + 1, my_xp
