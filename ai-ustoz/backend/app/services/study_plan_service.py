"""
Shaxsiy o'quv reja: kirish so'rovnomasi javoblaridan (sinf, necha oy, haftada
necha kun, kuniga necha daqiqa, o'z darajasi) va kirish testi natijasidan
haftalik reja tuziladi.

- Mavzular maktab dasturi tartibida (poydevordan murakkabga), ikki fan bo'lsa
  navbatma-navbat.
- Har bir mavzuga vaqt: dastur soati x o'z darajasi x "maktabda hali
  o'tilmagan" x radar natijasi. Jami vaqt sig'masa, mavzular siqiladi va
  kunlik vaqtni oshirish tavsiya qilinadi; ortib qolsa — har bir mavzuga
  ko'proq masala (ko'pi bilan 1.5 barobar), qolgan haftalar takrorlashga.
- Oxirgi ~15% hafta — umumiy takrorlash va sinov testlari.
- Mavzu testidan 70% va undan yuqori natija olinsa, mavzu "o'tildi" bo'ladi
  va dars keyingi mavzuga o'tadi.
"""
import math
import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import QuizAttempt, StudyPlan, User, UserWeaknessRadar
from app.services.curriculum import CURRICULUM, CurriculumTopic

WEEKS_PER_MONTH = 52 / 12
REVISION_SHARE = 0.15
MIN_WEEKS_FOR_REVISION = 4
MAX_STRETCH = 1.5
SMALL_REMAINDER_SHARE = 0.1
MIN_DAILY_MINUTES = 15
MAX_SUGGESTED_DAILY_MINUTES = 300
PASS_PERCENT = 70
MIN_QUESTIONS_TO_PASS = 5

DEFAULT_STUDY_MONTHS = 6
DEFAULT_DAYS_PER_WEEK = 5
DEFAULT_DAILY_MINUTES = 60

LEVEL_FACTOR = {"boshlangich": 1.3, "orta": 1.0, "yuqori": 0.75}
NEW_TOPIC_FACTOR = 1.3


@dataclass(frozen=True)
class PlanSettings:
    subjects: tuple[str, ...]
    grade: int
    is_graduate: bool
    self_level: str | None
    study_months: int
    days_per_week: int
    daily_minutes: int
    exam_month: date | None = None


def topic_key(subject: str, topic: str) -> str:
    return f"{subject}|{topic}"


def months_until(exam_month: date, today: date) -> int:
    return (exam_month.year - today.year) * 12 + (exam_month.month - today.month)


def effective_months(settings: PlanSettings, today: date) -> int:
    """Imtihon tanlangan muddatdan oldin bo'lsa, reja imtihongacha qisqaradi."""
    if settings.exam_month:
        left = months_until(settings.exam_month, today)
        if 1 <= left < settings.study_months:
            return left
    return settings.study_months


def mastery_factor(percent: float | None) -> float:
    if percent is None:
        return 1.0
    if percent < 40:
        return 1.3
    if percent < 60:
        return 1.15
    if percent >= 80:
        return 0.8
    return 1.0


def is_new_for(settings: PlanSettings, topic: CurriculumTopic) -> bool:
    """Maktabda hali o'tilmagan mavzu — noldan, sekinroq tushuntiriladi."""
    return not settings.is_graduate and topic.grade > settings.grade


def ordered_topics(subjects: tuple[str, ...]) -> list[CurriculumTopic]:
    lists = [CURRICULUM[subject] for subject in subjects]
    ordered: list[CurriculumTopic] = []
    for index in range(max(len(items) for items in lists)):
        ordered.extend(items[index] for items in lists if index < len(items))
    return ordered


def build_plan(
    settings: PlanSettings, mastery: dict[tuple[str, str], float], completed: set[str], start: date
) -> dict:
    months = effective_months(settings, start)
    total_weeks = max(1, round(months * WEEKS_PER_MONTH))
    revision_weeks = max(1, round(total_weeks * REVISION_SHARE)) if total_weeks >= MIN_WEEKS_FOR_REVISION else 0
    study_weeks = total_weeks - revision_weeks
    daily_minutes = max(MIN_DAILY_MINUTES, settings.daily_minutes)
    weekly_minutes = daily_minutes * settings.days_per_week

    # O'tilgan mavzular ham ro'yxatda qoladi (vaqt ajratilmaydi) — progress va hisob uchun.
    topics: list[dict] = []
    needs: dict[int, float] = {}
    for topic in ordered_topics(settings.subjects):
        is_new = is_new_for(settings, topic)
        topics.append(
            {
                "subject": topic.subject,
                "category": topic.category,
                "topic": topic.topic,
                "grade": topic.grade,
                "is_new": is_new,
                "minutes": 0,
                "first_week": None,
                "last_week": None,
            }
        )
        if topic_key(topic.subject, topic.topic) in completed:
            continue
        needs[len(topics) - 1] = (
            topic.hours
            * 60
            * LEVEL_FACTOR.get(settings.self_level or "orta", 1.0)
            * (NEW_TOPIC_FACTOR if is_new else 1.0)
            * mastery_factor(mastery.get((topic.subject, topic.category)))
        )

    required = sum(needs.values())
    capacity = study_weeks * weekly_minutes
    scale = min(MAX_STRETCH, capacity / required) if required else 1.0
    suggested_daily = None
    if scale < 1:
        per_day = required / (study_weeks * settings.days_per_week)
        suggested_daily = min(MAX_SUGGESTED_DAILY_MINUTES, math.ceil(per_day / 15) * 15)

    weeks: list[dict] = [{"week": number, "kind": "study", "items": []} for number in range(1, total_weeks + 1)]
    week_index, room = 0, float(weekly_minutes)
    for index, minutes in needs.items():
        entry = topics[index]
        remaining = minutes * scale
        entry["minutes"] = round(remaining)
        entry["first_week"] = entry["last_week"] = min(week_index, study_weeks - 1) + 1
        while remaining > 0.5:
            if week_index >= study_weeks:  # yaxlitlash qoldig'i — oxirgi o'quv haftasiga
                week_index, room = study_weeks - 1, remaining
            # Mavzuning kichik qoldig'ini keyingi haftaga o'tkazmaymiz — shu haftaga biroz ortiqcha qo'shiladi.
            take = remaining if remaining - room < weekly_minutes * SMALL_REMAINDER_SHARE else min(remaining, room)
            weeks[week_index]["items"].append(
                {"subject": entry["subject"], "category": entry["category"], "topic": entry["topic"], "minutes": round(take)}
            )
            entry["last_week"] = week_index + 1
            remaining -= take
            room -= take
            if room <= 0.5:
                week_index, room = week_index + 1, float(weekly_minutes)

    for week in weeks:
        if not week["items"]:
            week["kind"] = "revision"

    return {
        "months": months,
        "total_weeks": total_weeks,
        "study_weeks": study_weeks,
        "weekly_minutes": weekly_minutes,
        "daily_minutes": daily_minutes,
        "days_per_week": settings.days_per_week,
        "required_minutes": round(required),
        "is_tight": scale < 1,
        "suggested_daily_minutes": suggested_daily,
        "topics": topics,
        "weeks": weeks,
    }


def current_week(start: date, today: date) -> int:
    return max(1, (today - start).days // 7 + 1)


def plan_status(plan: dict, completed: dict, start: date, today: date) -> dict:
    """Bugun qaysi mavzu, rejadan orqada/oldindami — har so'rovda qayta hisoblanadi."""
    week = current_week(start, today)
    remaining = [t for t in plan["topics"] if topic_key(t["subject"], t["topic"]) not in completed]
    current = remaining[0] if remaining else None
    status, behind_weeks = "done", 0
    if current:
        if week > current["last_week"]:
            status, behind_weeks = "behind", week - current["last_week"]
        elif week < current["first_week"]:
            status = "ahead"
        else:
            status = "on_track"
    by_subject: dict[str, dict] = {}
    for topic in remaining:
        by_subject.setdefault(topic["subject"], topic)
    return {
        "current_week": week,
        "status": status,
        "behind_weeks": behind_weeks,
        "current": current,
        "current_by_subject": by_subject,
        "completed_count": sum(1 for t in plan["topics"] if topic_key(t["subject"], t["topic"]) in completed),
    }


def lesson_outline(daily_minutes: int) -> list[tuple[str, int]]:
    """Bir kunlik dars tuzilishi: takrorlash, yangi mavzu, masala, mini-test."""
    daily = max(MIN_DAILY_MINUTES, daily_minutes)
    if daily < 20:  # juda qisqa dars: takrorlash va alohida masala bo'limi sig'maydi
        return [("Yangi mavzu va masala", daily - 5), ("Mini-test", 5)]
    parts = [("Oldingi mavzuni takrorlash", 0.1), ("Yangi mavzu", 0.4), ("Masala va mashq", 0.35), ("Mini-test", 0.15)]
    outline = [(label, max(5, round(daily * share / 5) * 5)) for label, share in parts]
    new_label, new_minutes = outline[1]
    outline[1] = (new_label, max(5, new_minutes + daily - sum(minutes for _, minutes in outline)))
    return outline


def expand_subjects(choice: str | None) -> tuple[str, ...]:
    if choice in ("kimyo", "biologiya"):
        return (choice,)
    return ("kimyo", "biologiya")


def settings_for(user: User) -> PlanSettings:
    return PlanSettings(
        subjects=expand_subjects(user.subjects),
        grade=user.current_grade,
        is_graduate=bool(user.is_graduate),
        self_level=user.self_level,
        study_months=user.study_months or DEFAULT_STUDY_MONTHS,
        days_per_week=user.study_days_per_week or DEFAULT_DAYS_PER_WEEK,
        daily_minutes=user.daily_study_minutes or DEFAULT_DAILY_MINUTES,
        exam_month=user.exam_month,
    )


async def mastery_map(db: AsyncSession, user_id: uuid.UUID) -> dict[tuple[str, str], float]:
    rows = (
        await db.execute(select(UserWeaknessRadar).where(UserWeaknessRadar.user_id == user_id, UserWeaknessRadar.sample_size > 0))
    ).scalars()
    return {(row.subject, row.category): row.mastery_percentage for row in rows}


async def load_plan(db: AsyncSession, user_id: uuid.UUID, lock: bool = False) -> StudyPlan | None:
    return await db.get(StudyPlan, user_id, with_for_update=lock, populate_existing=lock)


async def rebuild_plan(db: AsyncSession, user: User, today: date) -> StudyPlan:
    """Rejani foydalanuvchining joriy sozlamalaridan qayta tuzadi; o'tilgan mavzular saqlanadi."""
    existing = await load_plan(db, user.id, lock=True)
    completed = dict(existing.completed or {}) if existing else {}
    settings = settings_for(user)
    plan = build_plan(settings, await mastery_map(db, user.id), set(completed), today)
    snapshot = {
        "study_months": settings.study_months,
        "days_per_week": settings.days_per_week,
        "daily_minutes": settings.daily_minutes,
        "subjects": list(settings.subjects),
        "grade": settings.grade,
    }
    if existing is None:
        existing = StudyPlan(user_id=user.id, start_date=today, settings=snapshot, plan=plan, completed=completed)
        db.add(existing)
    else:
        existing.start_date, existing.settings, existing.plan = today, snapshot, plan
    await db.commit()
    return existing


def passed_topics(attempt: QuizAttempt) -> list[tuple[str, str, int]]:
    """Testdagi mavzular orasidan 70%+ bilan o'tilganlari (kamida 5 ta savol bo'lsa)."""
    passed = []
    for entry in (attempt.state or {}).get("per_topic", []):
        total = entry.get("total", 0)
        if total < MIN_QUESTIONS_TO_PASS:
            continue
        percent = round(100 * entry.get("correct", 0) / total)
        if percent >= PASS_PERCENT:
            passed.append((entry["subject"], entry["topic"], percent))
    return passed


async def record_test_result(db: AsyncSession, user_id: uuid.UUID, attempt: QuizAttempt, now: datetime) -> None:
    """Test yakunlanganda chaqiriladi (commit chaqiruvchida)."""
    passed = passed_topics(attempt)
    if not passed:
        return
    plan = await load_plan(db, user_id, lock=True)
    if plan is None:
        return
    planned = {topic_key(t["subject"], t["topic"]) for t in plan.plan["topics"]}
    completed = dict(plan.completed or {})
    for subject, topic, percent in passed:
        key = topic_key(subject, topic)
        if key in planned and key not in completed:
            completed[key] = {"percent": percent, "at": now.isoformat()}
    plan.completed = completed
