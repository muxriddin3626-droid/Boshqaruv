"""
O'quvchi progressini boshqarish: joriy dars/bosqich, weak_spots, test natijalari.

Bu servis Postgres'dagi uzoq muddatli holatni o'qiydi/yozadi va uni
`StudentContext`ga aylantirib, system promptga uzatadi — shu orqali
"Kecha shu joyda to'xtagandik" xotirasi ishlaydi.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Lesson, Progress, User, WeakSpot
from app.prompts.system_prompt import StudentContext
from app.prompts.system_prompt import WeakSpot as WeakSpotDTO


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
