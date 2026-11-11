"""Reyting va o'quvchining XP/streak ko'rsatkichlari."""
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.database import User
from app.models.schemas import LeaderboardOut, LeaderboardRowOut, MyStatsOut
from app.services import xp_service

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


@router.get("", response_model=LeaderboardOut)
async def get_leaderboard(
    period: Literal["week", "all"] = "week",
    scope: Literal["all", "grade"] = "all",
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """`scope=grade` — faqat o'quvchining o'z sinfidagilar (sinfdoshlar bilan raqobat)."""
    user = await _get_user(db, user_id)
    now = datetime.now(timezone.utc)
    grade = user.current_grade if scope == "grade" else None
    rows = await xp_service.leaderboard(db, period, now, grade)
    my_rank, my_xp = await xp_service.user_rank(db, user, period, now, grade)
    return LeaderboardOut(
        period=period,
        scope=scope,
        rows=[
            LeaderboardRowOut(
                rank=row.rank, name=row.name, grade=row.grade, xp=row.xp, streak=row.streak, is_me=row.user_id == user_id
            )
            for row in rows
        ],
        my_rank=my_rank,
        my_xp=my_xp,
    )


@router.get("/me", response_model=MyStatsOut)
async def get_my_stats(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await _get_user(db, user_id)
    now = datetime.now(timezone.utc)
    return MyStatsOut(
        xp_total=user.xp_total or 0,
        week_xp=await xp_service.user_week_xp(db, user_id, now),
        streak=xp_service.effective_streak(user, now),
        longest_streak=user.longest_streak or 0,
    )
