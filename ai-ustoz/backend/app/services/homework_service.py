"""
Uyga vazifa: dars oxirida beriladi, o'quvchi topshiradi, AI Ustoz tekshiradi.

Vazifa ikki qismdan iborat:
- test qismi — savollar bankidan shu mavzu bo'yicha 5 ta savol (avtomatik tekshiriladi);
- yozma masalalar — AI tuzadi, keyin javobni bilmagan holda alohida yechib
  tasdiqlaydi (javoblar mos kelmasa masala berilmaydi). O'quvchi yechimini
  matn bilan yozadi yoki daftar rasmini yuboradi; AI 4 bosqich bo'yicha
  (shart, formula, hisob, javob) baholaydi.

Masalalarning javobi va namunaviy yechimi tekshiruvdan oldin o'quvchiga
yuborilmaydi. Natija XP, weak_spots, radar va keyingi dars promptiga tushadi.
"""
import base64
import binascii
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Homework, QuizAttempt, TestResult, User, WeakSpot
from app.prompts.system_prompt import HomeworkFocus
from app.services import openai_service, xp_service
from app.services import question_bank_service as bank
from app.services import study_plan_service as plans
from app.services.quiz_catalog import category_of, topics_for
from app.services.weakness_service import recalculate_radar

logger = logging.getLogger(__name__)

TASHKENT = ZoneInfo("Asia/Tashkent")
MCQ_COUNT = 5
MCQ_POINTS = 2
PROBLEM_COUNT = 2
PROBLEMS_PER_REQUEST = 3
GENERATION_ROUNDS = 2
PROBLEM_MAX_SCORE = 10
ON_TIME_BONUS_XP = 10
WEAK_PROBLEM_SCORE = 5
NUMERIC_TOLERANCE = 0.02
RECENT_RESULT_DAYS = 2
MAX_PHOTO_BYTES = 3 * 1024 * 1024
MAX_STEPS = 6

PHOTO_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}


class HomeworkError(ValueError):
    """O'quvchi tomonidagi xato (noto'g'ri mavzu, allaqachon tekshirilgan, ...)."""


class HomeworkCheckFailedError(Exception):
    """AI tekshiruvi ishlamadi — vazifa ochiq qoladi, o'quvchi qayta yuboradi."""


@dataclass
class Solution:
    text: str
    photo_data_url: str | None = None


def due_for(now: datetime) -> datetime:
    """Muddat — ertangi kun oxirigacha (Toshkent vaqti)."""
    tomorrow = xp_service.tashkent_today(now) + timedelta(days=1)
    return datetime.combine(tomorrow, time(23, 59, 59), tzinfo=TASHKENT)


# --- Masalalar: tuzish va mustaqil tasdiqlash ----------------------------------------

_NUMBER = re.compile(r"-?\d+(?:[.,]\d+)?")


def _first_number(text: str) -> float | None:
    match = _NUMBER.search(text.replace(" ", ""))
    return float(match.group().replace(",", ".")) if match else None


def numeric_agreement(a: str, b: str) -> bool | None:
    """Ikkala javobda son bo'lsa — 2% aniqlikda solishtiradi; aks holda None (AI hakam hal qiladi)."""
    first, second = _first_number(a), _first_number(b)
    if first is None or second is None:
        return None
    scale = max(abs(first), abs(second), 1e-9)
    return abs(first - second) / scale <= NUMERIC_TOLERANCE


def normalize_problem(raw: dict) -> dict | None:
    if not isinstance(raw, dict):
        return None
    problem = str(raw.get("problem") or "").strip()
    answer = str(raw.get("answer") or "").strip()
    steps = raw.get("solution_steps")
    if not problem or not answer or len(problem) > 1500 or len(answer) > 200:
        return None
    if not isinstance(steps, list) or not steps:
        return None
    steps = [str(step).strip() for step in steps if str(step).strip()][:8]
    return {"problem": problem, "answer": answer, "solution_steps": steps} if steps else None


async def generate_verified_problems(subject: str, topic: str, grade: int) -> list[dict]:
    accepted: list[dict] = []
    for _ in range(GENERATION_ROUNDS):
        try:
            async with bank._ai_semaphore:
                raw = await openai_service.generate_homework_problems(subject, topic, grade, PROBLEMS_PER_REQUEST)
                items = [item for item in (normalize_problem(r) for r in raw) if item]
                if not items:
                    continue
                solved = await openai_service.solve_homework_problems(subject, [item["problem"] for item in items])
                undecided: list[dict] = []
                for index, item in enumerate(items):
                    answer = solved.get(index)
                    if not answer:
                        continue
                    agreement = numeric_agreement(item["answer"], answer)
                    if agreement:
                        accepted.append(item)
                    elif agreement is None:
                        undecided.append({**item, "_solver": answer})
                if undecided:
                    judged = await openai_service.judge_answers_equivalent(
                        subject, [(item["problem"], item["answer"], item["_solver"]) for item in undecided]
                    )
                    accepted += [
                        {key: value for key, value in item.items() if key != "_solver"}
                        for index, item in enumerate(undecided)
                        if judged.get(index)
                    ]
        except Exception:  # noqa: BLE001 — masala tuzilmasa ham test qismi bilan vazifa beriladi
            logger.exception("Uyga vazifa masalasi tuzilmadi: %s / %s", subject, topic)
            continue
        unique = {item["problem"]: item for item in accepted}
        accepted = list(unique.values())
        if len(accepted) >= PROBLEM_COUNT:
            break
    return accepted[:PROBLEM_COUNT]


# --- Berish ----------------------------------------------------------------------------

async def open_homework(db: AsyncSession, user_id: uuid.UUID, subject: str) -> Homework | None:
    stmt = select(Homework).where(Homework.user_id == user_id, Homework.subject == subject, Homework.status == "assigned")
    return (await db.execute(stmt)).scalar_one_or_none()


async def _default_topic(db: AsyncSession, user_id: uuid.UUID, subject: str) -> str:
    """Rejadagi shu fan bo'yicha joriy (o'tilmagan) mavzu; reja bo'lmasa — dasturning birinchi mavzusi."""
    plan = await plans.load_plan(db, user_id)
    if plan:
        completed = plan.completed or {}
        for topic in plan.plan["topics"]:
            if topic["subject"] == subject and plans.topic_key(subject, topic["topic"]) not in completed:
                return topic["topic"]
    return topics_for(subject)[0][1]


async def assign(db: AsyncSession, user: User, subject: str, topic: str | None, now: datetime) -> tuple[Homework, bool]:
    """(vazifa, yangimi). Shu fan bo'yicha ochiq vazifa bo'lsa — o'shani qaytaradi."""
    existing = await open_homework(db, user.id, subject)
    if existing:
        return existing, False
    topic = topic or await _default_topic(db, user.id, subject)
    category = category_of(subject, topic)
    if category is None:
        raise HomeworkError("Bunday mavzu topilmadi")

    questions = await bank.pick_questions(db, subject, "mcq", [bank.Slot(category, topic, None, MCQ_COUNT)], user.id)
    problems = await generate_verified_problems(subject, topic, user.current_grade)
    homework = Homework(
        user_id=user.id,
        subject=subject,
        category=category,
        topic=topic,
        question_ids=[str(q.id) for q in questions],
        problems=problems,
        assigned_at=now,
        due_at=due_for(now),
    )
    db.add(homework)
    try:
        await db.commit()
    except IntegrityError:  # parallel so'rov xuddi shu fanga vazifa yaratib ulgurdi
        await db.rollback()
        existing = await open_homework(db, user.id, subject)
        if existing is None:
            raise
        return existing, False
    await db.refresh(homework)
    return homework, True


# --- Topshirish va tekshirish ------------------------------------------------------------

def decode_photo(data_url: str) -> str:
    """`data:image/...;base64,...` ni tekshiradi (turi, hajmi, fayl imzosi) va qayta yig'ilgan data URL qaytaradi."""
    match = re.fullmatch(r"data:(image/[a-z]+);base64,([A-Za-z0-9+/=\s]+)", data_url.strip())
    if not match or match.group(1) not in PHOTO_SIGNATURES:
        raise HomeworkError("Rasm JPEG, PNG yoki WEBP formatida bo'lishi kerak")
    try:
        raw = base64.b64decode(match.group(2), validate=False)
    except (binascii.Error, ValueError) as exc:
        raise HomeworkError("Rasmni o'qib bo'lmadi") from exc
    if len(raw) > MAX_PHOTO_BYTES:
        raise HomeworkError("Rasm juda katta (3 MB dan oshmasin)")
    mime = match.group(1)
    if not raw.startswith(PHOTO_SIGNATURES[mime]) or (mime == "image/webp" and raw[8:12] != b"WEBP"):
        raise HomeworkError("Rasm fayli buzilgan yoki formati noto'g'ri")
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def normalize_grade(raw: dict) -> dict | None:
    if not isinstance(raw, dict) or not isinstance(raw.get("score"), (int, float)):
        return None
    steps = []
    for step in raw.get("steps") or []:
        if isinstance(step, dict) and str(step.get("step") or "").strip():
            steps.append(
                {"step": str(step["step"])[:80], "ok": bool(step.get("ok")), "comment": str(step.get("comment") or "")[:400]}
            )
    return {
        "score": max(0, min(PROBLEM_MAX_SCORE, int(round(raw["score"])))),
        "final_answer_correct": bool(raw.get("final_answer_correct")),
        "steps": steps[:MAX_STEPS],
        "mistake": str(raw.get("mistake") or "")[:300],
        "comment": str(raw.get("comment") or "")[:600],
    }


EMPTY_SOLUTION = {
    "score": 0,
    "final_answer_correct": False,
    "steps": [],
    "mistake": "",
    "comment": "Yechim yuborilmagan.",
}


async def check(
    db: AsyncSession, user: User, homework: Homework, mcq_answers: dict[str, int], solutions: list[Solution], now: datetime
) -> Homework:
    if homework.status != "assigned":
        raise HomeworkError("Bu vazifa allaqachon tekshirilgan")
    if len(solutions) != len(homework.problems):
        raise HomeworkError("Har bir masala uchun yechim maydoni yuborilishi kerak")

    questions = await bank.load_by_ids(db, homework.question_ids)
    mcq_review, mcq_correct = [], 0
    for question in questions:
        choice = mcq_answers.get(str(question.id))
        is_correct = choice == question.correct_index
        mcq_correct += is_correct
        mcq_review.append(
            {
                "question_id": str(question.id),
                "question": question.question,
                "options": question.options,
                "choice": choice,
                "correct_index": question.correct_index,
                "correct": is_correct,
                "explanation": question.explanation,
            }
        )

    to_grade = [index for index, solution in enumerate(solutions) if solution.text.strip() or solution.photo_data_url]
    graded: dict[int, dict] = {}
    if to_grade:
        items = [
            {
                **homework.problems[index],
                "student_text": solutions[index].text.strip(),
                "photo_data_url": solutions[index].photo_data_url,
            }
            for index in to_grade
        ]
        try:
            async with bank._ai_semaphore:
                raw_results = await openai_service.grade_homework_solutions(homework.subject, homework.topic, items)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Uyga vazifani tekshirib bo'lmadi: %s", homework.id)
            raise HomeworkCheckFailedError from exc
        for index, raw in zip(to_grade, raw_results):
            grade = normalize_grade(raw)
            if grade is None:
                raise HomeworkCheckFailedError
            graded[index] = grade

    problem_results = []
    for index, problem in enumerate(homework.problems):
        grade = graded.get(index, EMPTY_SOLUTION)
        problem_results.append({**problem, **grade, "max_score": PROBLEM_MAX_SCORE, "has_photo": bool(solutions[index].photo_data_url)})

    score = mcq_correct * MCQ_POINTS + sum(result["score"] for result in problem_results)
    max_score = len(questions) * MCQ_POINTS + len(homework.problems) * PROBLEM_MAX_SCORE
    attempted = bool(to_grade) or any(choice is not None for choice in mcq_answers.values())
    is_late = now > homework.due_at
    xp = score + (ON_TIME_BONUS_XP if attempted and not is_late else 0)

    homework.status = "checked"
    homework.answers = mcq_answers
    homework.submissions = [{"text": s.text.strip()[:4000], "has_photo": bool(s.photo_data_url)} for s in solutions]
    homework.result = {
        "percent": round(100 * score / max_score) if max_score else 0,
        "mcq": mcq_review,
        "problems": problem_results,
    }
    homework.score, homework.max_score = score, max_score
    homework.is_late = is_late
    homework.checked_at = now

    # XP haftalik reytingga tushishi uchun umumiy urinishlar jadvaliga yoziladi.
    attempt = QuizAttempt(
        user_id=user.id,
        kind="homework",
        subject=homework.subject,
        question_ids=homework.question_ids,
        answers=mcq_answers,
        state={"homework_id": str(homework.id)},
        score=score,
        max_score=max_score,
        status="finished",
        started_at=homework.assigned_at,
        deadline_at=homework.due_at,
        finished_at=now,
    )
    db.add(attempt)
    xp_service.award(user, attempt, xp, now)
    homework.xp_earned = attempt.xp_earned

    for result in problem_results:
        if result["score"] < WEAK_PROBLEM_SCORE and result["mistake"]:
            db.add(
                WeakSpot(
                    user_id=user.id,
                    subject=homework.subject,
                    topic=homework.topic,
                    category=homework.category,
                    mistake_description=f"Uyga vazifa: {result['mistake']}",
                    severity=3 if result["score"] < 3 else 2,
                )
            )
    if questions:
        db.add(
            TestResult(
                user_id=user.id,
                subject=homework.subject,
                test_type="oraliq",
                score=mcq_correct,
                max_score=len(questions),
                details={
                    "source": "homework",
                    "homework_id": str(homework.id),
                    "topic_breakdown": {homework.category: {"correct": mcq_correct, "total": len(questions)}},
                },
            )
        )
    await db.commit()
    await recalculate_radar(db, user.id, homework.subject)
    return homework


# --- Keyingi dars uchun ------------------------------------------------------------------

async def prompt_focus(db: AsyncSession, user_id: uuid.UUID, subject: str, now: datetime) -> HomeworkFocus:
    focus = HomeworkFocus()
    pending = await open_homework(db, user_id, subject)
    if pending:
        focus.pending_topic = pending.topic
        focus.pending_overdue = now > pending.due_at
    stmt = (
        select(Homework)
        .where(
            Homework.user_id == user_id,
            Homework.subject == subject,
            Homework.status == "checked",
            Homework.checked_at >= now - timedelta(days=RECENT_RESULT_DAYS),
        )
        .order_by(Homework.checked_at.desc())
        .limit(1)
    )
    last = (await db.execute(stmt)).scalar_one_or_none()
    if last and last.result:
        focus.last_topic = last.topic
        focus.last_percent = last.result.get("percent")
        focus.last_was_late = last.is_late
        focus.last_mistakes = tuple(p["mistake"] for p in last.result.get("problems", []) if p.get("mistake"))[:3]
    return focus
