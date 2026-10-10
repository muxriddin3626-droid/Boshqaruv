"""Shaxsiy o'quv reja: ko'rish va sozlamalarni (necha oy, haftada necha kun, kunlik vaqt) o'zgartirish."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.database import StudyPlan, User
from app.models.schemas import LessonPartOut, PlanOut, PlanSettingsIn, PlanTopicOut, PlanWeekItemOut, PlanWeekOut
from app.services import study_plan_service as plans
from app.services.xp_service import tashkent_today

router = APIRouter(prefix="/api/v1/plan", tags=["plan"])


def _topic_out(topic: dict, completed: dict) -> PlanTopicOut:
    done = completed.get(plans.topic_key(topic["subject"], topic["topic"]))
    return PlanTopicOut(**topic, completed=done is not None, percent=done["percent"] if done else None)


def plan_out(user: User, plan: StudyPlan, today) -> PlanOut:
    data, completed = plan.plan, plan.completed or {}
    status = plans.plan_status(data, completed, plan.start_date, today)
    return PlanOut(
        study_months=user.study_months or plans.DEFAULT_STUDY_MONTHS,
        effective_months=data["months"],
        days_per_week=data["days_per_week"],
        daily_minutes=data["daily_minutes"],
        weekly_minutes=data["weekly_minutes"],
        start_date=plan.start_date,
        exam_month=user.exam_month,
        total_weeks=data["total_weeks"],
        current_week=status["current_week"],
        status=status["status"],
        behind_weeks=status["behind_weeks"],
        is_tight=data["is_tight"],
        suggested_daily_minutes=data["suggested_daily_minutes"],
        completed_count=status["completed_count"],
        topic_count=len(data["topics"]),
        current=_topic_out(status["current"], completed) if status["current"] else None,
        lesson_outline=[LessonPartOut(label=label, minutes=minutes) for label, minutes in plans.lesson_outline(data["daily_minutes"])],
        topics=[_topic_out(topic, completed) for topic in data["topics"]],
        weeks=[
            PlanWeekOut(
                week=week["week"],
                kind=week["kind"],
                items=[
                    PlanWeekItemOut(
                        subject=item["subject"],
                        topic=item["topic"],
                        minutes=item["minutes"],
                        completed=plans.topic_key(item["subject"], item["topic"]) in completed,
                    )
                    for item in week["items"]
                ],
            )
            for week in data["weeks"]
        ],
    )


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


@router.get("", response_model=PlanOut)
async def get_plan(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """404 — reja hali tuzilmagan (so'rovnoma reja savollarisiz o'tilgan): frontend sozlamalarni so'raydi."""
    user = await _get_user(db, user_id)
    today = tashkent_today(datetime.now(timezone.utc))
    plan = await plans.load_current_plan(db, user_id, today)
    if plan is None:
        raise HTTPException(status_code=404, detail="O'quv reja hali tuzilmagan")
    return plan_out(user, plan, today)


@router.put("", response_model=PlanOut)
async def update_plan(
    payload: PlanSettingsIn, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    """Sozlamalarni saqlab, rejani bugundan qayta tuzadi. O'tilgan mavzular saqlanib qoladi."""
    user = await _get_user(db, user_id)
    user.study_months = payload.study_months
    user.study_days_per_week = payload.study_days_per_week
    user.daily_study_minutes = payload.daily_study_minutes
    today = tashkent_today(datetime.now(timezone.utc))
    plan = await plans.rebuild_plan(db, user, today)
    return plan_out(user, plan, today)
