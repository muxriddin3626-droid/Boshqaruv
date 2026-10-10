"""
MODUL 3: Weakness Radar & Targeted Drill.

`user_weakness_radar` jadvali — test natijalari va weak_spots asosida qayta
hisoblanadigan kesh (materialized cache). Har bir fan bo'limi (category,
masalan "Genetika", "Organik kimyo") uchun 0-100% oralig'ida mastery
foizini saqlaydi.

Hisoblash mantig'i:
1. So'nggi test natijalaridagi `details.topic_breakdown` (category -> {correct,
   total}) yig'iladi -> mastery = correct/total * 100.
2. Hal qilinmagan (resolved=false) weak_spots bo'lsa, shu bo'lim uchun
   mastery qiymati severity darajasiga qarab "shift" qilinadi (jiddiyroq
   xato — pastroq shift), test natijasi hali bo'lmasa ham bo'lim past
   ko'rsatiladi.
"""
import uuid
from collections import defaultdict

from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Lesson, TestResult, UserWeaknessRadar, WeakSpot
from app.services.openai_service import generate_targeted_quiz

DEFAULT_MASTERY = 50.0
RECENT_TEST_LIMIT = 20


async def _get_subject_categories(db: AsyncSession, subject: str) -> list[str]:
    stmt = select(distinct(Lesson.category)).where(Lesson.subject == subject, Lesson.category.is_not(None))
    return [row for row in (await db.execute(stmt)).scalars().all() if row]


async def recalculate_radar(db: AsyncSession, user_id: uuid.UUID, subject: str) -> list[UserWeaknessRadar]:
    """`test_results` va `weak_spots` asosida har bir bo'lim uchun mastery %ni qayta hisoblab, keshga yozadi."""
    test_stmt = (
        select(TestResult)
        .where(TestResult.user_id == user_id, TestResult.subject == subject)
        .order_by(TestResult.taken_at.desc())
        .limit(RECENT_TEST_LIMIT)
    )
    test_results = (await db.execute(test_stmt)).scalars().all()

    correct_by_category: dict[str, int] = defaultdict(int)
    total_by_category: dict[str, int] = defaultdict(int)
    for result in test_results:
        breakdown = (result.details or {}).get("topic_breakdown", {})
        for category, stats in breakdown.items():
            correct_by_category[category] += int(stats.get("correct", 0))
            total_by_category[category] += int(stats.get("total", 0))

    weak_spot_stmt = select(WeakSpot).where(
        WeakSpot.user_id == user_id, WeakSpot.subject == subject, WeakSpot.resolved.is_(False)
    )
    weak_spots = (await db.execute(weak_spot_stmt)).scalars().all()

    # Har bir bo'lim uchun weak_spot severity'ga asoslangan yuqori chegara (cap)
    severity_cap_by_category: dict[str, float] = {}
    for weak_spot in weak_spots:
        if not weak_spot.category:
            continue
        cap = max(10.0, 100.0 - weak_spot.severity * 15)
        severity_cap_by_category[weak_spot.category] = min(
            severity_cap_by_category.get(weak_spot.category, 100.0), cap
        )

    categories = set(await _get_subject_categories(db, subject))
    categories.update(total_by_category.keys())
    categories.update(severity_cap_by_category.keys())
    if not categories:
        categories = {"Umumiy"}

    updated_rows: list[UserWeaknessRadar] = []
    for category in categories:
        total = total_by_category.get(category, 0)
        mastery = (correct_by_category[category] / total * 100) if total > 0 else DEFAULT_MASTERY

        cap = severity_cap_by_category.get(category)
        if cap is not None:
            mastery = min(mastery, cap)
        mastery = max(0.0, min(100.0, mastery))

        existing_stmt = select(UserWeaknessRadar).where(
            UserWeaknessRadar.user_id == user_id,
            UserWeaknessRadar.subject == subject,
            UserWeaknessRadar.category == category,
        )
        radar_row = (await db.execute(existing_stmt)).scalar_one_or_none()
        if radar_row is None:
            radar_row = UserWeaknessRadar(user_id=user_id, subject=subject, category=category)
            db.add(radar_row)

        radar_row.mastery_percentage = round(mastery, 1)
        radar_row.sample_size = total
        updated_rows.append(radar_row)

    await db.commit()
    for row in updated_rows:
        await db.refresh(row)
    return updated_rows


async def get_radar(db: AsyncSession, user_id: uuid.UUID, subject: str) -> list[UserWeaknessRadar]:
    """Keshlangan radar nuqtalarini qaytaradi; agar hali hisoblanmagan bo'lsa, birinchi marta hisoblaydi."""
    stmt = (
        select(UserWeaknessRadar)
        .where(UserWeaknessRadar.user_id == user_id, UserWeaknessRadar.subject == subject)
        .order_by(UserWeaknessRadar.mastery_percentage.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        rows = await recalculate_radar(db, user_id, subject)
        rows = sorted(rows, key=lambda r: r.mastery_percentage)
    return rows


async def get_weakest_categories(db: AsyncSession, user_id: uuid.UUID, subject: str, limit: int = 2) -> list[str]:
    rows = await get_radar(db, user_id, subject)
    return [row.category for row in sorted(rows, key=lambda r: r.mastery_percentage)[:limit]]


async def generate_targeted_drill(
    db: AsyncSession, user_id: uuid.UUID, subject: str, question_count: int
) -> tuple[list[str], list[dict]]:
    """"Zaif Nuqtalarni Ishlash" tugmasi: eng past mastery'li bo'limlardan DTM uslubidagi test tuzadi."""
    weakest_categories = await get_weakest_categories(db, user_id, subject, limit=3)
    if not weakest_categories:
        weakest_categories = await _get_subject_categories(db, subject) or ["Umumiy"]

    questions = await generate_targeted_quiz(subject, weakest_categories, question_count)
    return weakest_categories, questions
