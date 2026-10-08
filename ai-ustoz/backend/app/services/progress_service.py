"""
O'quvchi progressini boshqarish: joriy dars/bosqich, weak_spots, test natijalari.

Bu servis Postgres'dagi uzoq muddatli holatni o'qiydi/yozadi va uni
`StudentContext`ga aylantirib, system promptga uzatadi — shu orqali
"Kecha shu joyda to'xtagandik" xotirasi ishlaydi.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Lesson, Progress, User, WeakSpot
from app.prompts.system_prompt import PlanFocus, StudentContext
from app.prompts.system_prompt import WeakSpot as WeakSpotDTO
from app.services import homework_service, lecture_service
from app.services import study_plan_service as plans
from app.services.xp_service import tashkent_today


async def get_plan_focus(db: AsyncSession, user_id: uuid.UUID, subject: str) -> PlanFocus | None:
    """O'quv rejadan shu fan bo'yicha bugungi mavzu va dars tuzilishi."""
    plan = await plans.load_plan(db, user_id)
    if plan is None:
        return None
    subject_topics = [t for t in plan.plan["topics"] if t["subject"] == subject]
    if not subject_topics:
        return None
    today = tashkent_today(datetime.now(timezone.utc))
    completed = plan.completed or {}
    status = plans.plan_status({**plan.plan, "topics": subject_topics}, completed, plan.start_date, today)
    remaining = [t for t in subject_topics if plans.topic_key(subject, t["topic"]) not in completed]
    current = remaining[0] if remaining else None
    return PlanFocus(
        current_week=status["current_week"],
        total_weeks=plan.plan["total_weeks"],
        days_per_week=plan.plan["days_per_week"],
        daily_minutes=plan.plan["daily_minutes"],
        status=status["status"],
        behind_weeks=status["behind_weeks"],
        completed_count=status["completed_count"],
        topic_count=len(subject_topics),
        lesson_outline=plans.lesson_outline(plan.plan["daily_minutes"]),
        topic=current["topic"] if current else None,
        category=current["category"] if current else None,
        topic_grade=current["grade"] if current else None,
        topic_is_new=bool(current and current["is_new"]),
        next_topic=remaining[1]["topic"] if len(remaining) > 1 else None,
        lecture_status=await _lecture_status(db, user_id, subject, current["topic"]) if current else None,
    )


async def _lecture_status(db: AsyncSession, user_id: uuid.UUID, subject: str, topic: str) -> str | None:
    user = await db.get(User, user_id)
    return await lecture_service.topic_status(db, user, subject, topic) if user else None


async def get_student_context(db: AsyncSession, user_id: uuid.UUID, subject: str) -> StudentContext:
    user = await db.get(User, user_id)
    if user is None:
        raise ValueError(f"Foydalanuvchi topilmadi: {user_id}")

    progress_stmt = select(Progress).where(Progress.user_id == user_id, Progress.subject == subject)
    progress = (await db.execute(progress_stmt)).scalar_one_or_none()

    last_lesson_title = None
    if progress and progress.current_lesson_id:
        lesson = await db.get(Lesson, progress.current_lesson_id)
        last_lesson_title = lesson.title if lesson else None

    weak_spots_stmt = (
        select(WeakSpot)
        .where(WeakSpot.user_id == user_id, WeakSpot.subject == subject, WeakSpot.resolved.is_(False))
        .order_by(WeakSpot.severity.desc())
        .limit(5)
    )
    weak_spots = (await db.execute(weak_spots_stmt)).scalars().all()

    return StudentContext(
        full_name=user.full_name,
        subject=subject,
        current_grade=user.current_grade,
        last_lesson_title=last_lesson_title,
        last_lesson_step=progress.current_step if progress else None,
        weak_spots=[
            WeakSpotDTO(topic=ws.topic, mistake_description=ws.mistake_description, severity=ws.severity)
            for ws in weak_spots
        ],
        average_score=progress.average_score if progress else None,
        target_score=user.target_score,
        is_graduate=user.is_graduate,
        target_exam=user.target_exam,
        target_cert_level=user.target_cert_level,
        target_university=user.target_university,
        self_level=user.self_level,
        exam_month=user.exam_month,
        daily_study_minutes=user.daily_study_minutes,
        plan=await get_plan_focus(db, user_id, subject),
        homework=await homework_service.prompt_focus(db, user_id, subject, datetime.now(timezone.utc)),
    )


async def update_current_step(
    db: AsyncSession, user_id: uuid.UUID, subject: str, lesson_id: uuid.UUID | None, step: str
) -> None:
    """O'quvchi darsning qaysi bosqichida to'xtaganini yozib qo'yadi (keyingi safar davom etish uchun)."""
    stmt = select(Progress).where(Progress.user_id == user_id, Progress.subject == subject)
    progress = (await db.execute(stmt)).scalar_one_or_none()

    if progress is None:
        progress = Progress(user_id=user_id, subject=subject)
        db.add(progress)

    if lesson_id is not None:
        progress.current_lesson_id = lesson_id
    progress.current_step = step
    await db.commit()


async def record_weak_spot(
    db: AsyncSession, user_id: uuid.UUID, subject: str, topic: str, mistake_description: str, severity: int = 2
) -> None:
    """Model suhbat davomida o'quvchining takroriy xatosini aniqlasa, shu yerga yozadi."""
    weak_spot = WeakSpot(
        user_id=user_id,
        subject=subject,
        topic=topic,
        mistake_description=mistake_description,
        severity=max(1, min(severity, 5)),
    )
    db.add(weak_spot)
    await db.commit()
