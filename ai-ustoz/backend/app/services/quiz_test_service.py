"""
Testlar: DTM sinov testi, mavzu bo'yicha test va Milliy Sertifikat uslubidagi mashq.

Vaqt serverda nazorat qilinadi (`deadline_at`), javoblar har bosilganda saqlanadi
(sahifa yangilansa test davom etadi), baholash va javob kaliti faqat serverda.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import QuizAttempt, QuizQuestion, TestResult, User
from app.services import question_bank_service as bank
from app.services import xp_service
from app.services.quiz_catalog import (
    DTM_FIRST_SUBJECT_WEIGHT,
    DTM_QUESTIONS_PER_SUBJECT,
    DTM_SECOND_SUBJECT_WEIGHT,
    DTM_SECONDS_PER_QUESTION,
    MS_FORMAT,
    category_of,
    ms_level_for,
    topics_for,
)
from app.services.weakness_service import recalculate_radar

TEST_KINDS = ("dtm_mock", "topic", "milliy_sertifikat")
# Tarmoq kechikishi uchun: muddat tugagach ham shuncha soniya javob qabul qilinadi.
GRACE_SECONDS = 15
TOPIC_SECONDS_PER_QUESTION = 90
XP_PER_CORRECT = 2
COMPLETION_BONUS = {"topic": 10, "milliy_sertifikat": 20, "dtm_mock": 30}
# Bo'sh testni qayta-qayta topshirib bonus yig'ishning oldini olish.
MIN_ANSWERED_SHARE_FOR_BONUS = 0.5
RESULT_TEST_TYPE = {"dtm_mock": "dtm_mock", "topic": "oraliq", "milliy_sertifikat": "milliy_sertifikat"}


class TestRequestError(ValueError):
    pass


class AttemptClosedError(Exception):
    pass


@dataclass
class TestRequest:
    kind: str
    subject: str  # dtm_mock uchun "ikkalasi" ham bo'lishi mumkin
    topic: str | None = None
    question_count: int = 10
    first_subject: str | None = None  # DTM: qaysi fan 1-fan (3,1 ball)
    dtm_blocks: str = "both"  # DTM: "both" | "first" | "second"


def _other(subject: str) -> str:
    return "biologiya" if subject == "kimyo" else "kimyo"


async def create_test(db: AsyncSession, user: User, request: TestRequest, now: datetime) -> QuizAttempt:
    await _close_previous_tests(db, user, now)

    weights: dict[str, float] = {}
    if request.kind == "dtm_mock":
        first = request.first_subject or "biologiya"
        if first not in ("kimyo", "biologiya"):
            raise TestRequestError("1-fan noto'g'ri")
        blocks = {"both": [first, _other(first)], "first": [first], "second": [_other(first)]}.get(request.dtm_blocks)
        if blocks is None:
            raise TestRequestError("DTM bloklari noto'g'ri")
        questions: list[QuizQuestion] = []
        for subject in blocks:
            weights[subject] = DTM_FIRST_SUBJECT_WEIGHT if subject == first else DTM_SECOND_SUBJECT_WEIGHT
            slots = bank.spread_over_topics(topics_for(subject), DTM_QUESTIONS_PER_SUBJECT)
            questions += await bank.pick_questions(db, subject, "mcq", slots, user.id)
        attempt_subject = "ikkalasi" if len(blocks) == 2 else blocks[0]
        seconds_per_question = DTM_SECONDS_PER_QUESTION

    elif request.kind == "topic":
        category = category_of(request.subject, request.topic or "")
        if category is None:
            raise TestRequestError("Bunday mavzu yo'q")
        if request.question_count not in (10, 20):
            raise TestRequestError("Savollar soni 10 yoki 20 bo'lishi kerak")
        slot = bank.Slot(category, request.topic, None, request.question_count)
        questions = await bank.pick_questions(db, request.subject, "mcq", [slot], user.id)
        weights[request.subject] = 1.0
        attempt_subject = request.subject
        seconds_per_question = TOPIC_SECONDS_PER_QUESTION

    elif request.kind == "milliy_sertifikat":
        slots = bank.spread_over_topics(topics_for(request.subject), MS_FORMAT.question_count)
        questions = await bank.pick_questions(db, request.subject, "mcq", slots, user.id)
        weights[request.subject] = 1.0
        attempt_subject = request.subject
        seconds_per_question = MS_FORMAT.seconds_per_question

    else:
        raise TestRequestError("Noma'lum test turi")

    attempt = QuizAttempt(
        user_id=user.id,
        kind=request.kind,
        subject=attempt_subject,
        question_ids=[str(q.id) for q in questions],
        answers={},
        state={"weights": weights, "topic": request.topic},
        max_score=round(sum(weights[q.subject] for q in questions), 1),
        status="active",
        started_at=now,
        deadline_at=now + timedelta(seconds=seconds_per_question * len(questions)),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def _close_previous_tests(db: AsyncSession, user: User, now: datetime) -> None:
    """Bir vaqtda faqat bitta faol test: yangisi boshlansa, eskisi saqlangan javoblar bilan yakunlanadi."""
    stmt = select(QuizAttempt).where(
        QuizAttempt.user_id == user.id, QuizAttempt.status == "active", QuizAttempt.kind.in_(TEST_KINDS)
    )
    for attempt in (await db.execute(stmt)).scalars().all():
        await finish_test(db, user, attempt, now)


async def load_questions(db: AsyncSession, attempt: QuizAttempt) -> list[QuizQuestion]:
    return await bank.load_by_ids(db, attempt.question_ids)


def is_expired(attempt: QuizAttempt, now: datetime) -> bool:
    return attempt.deadline_at is not None and now > attempt.deadline_at + timedelta(seconds=GRACE_SECONDS)


async def save_answer(
    db: AsyncSession, attempt: QuizAttempt, question_id: str, choice: int | None, now: datetime
) -> None:
    if attempt.status != "active" or is_expired(attempt, now):
        raise AttemptClosedError
    if question_id not in attempt.question_ids:
        raise TestRequestError("Bu savol testda yo'q")
    if choice is not None and not 0 <= choice <= 3:
        raise TestRequestError("Variant noto'g'ri")
    answers = dict(attempt.answers or {})
    if choice is None:
        answers.pop(question_id, None)
    else:
        answers[question_id] = choice
    attempt.answers = answers  # JSONB: yangi obyekt berilmasa SQLAlchemy o'zgarishni sezmaydi
    await db.commit()


async def finish_test(db: AsyncSession, user: User, attempt: QuizAttempt, now: datetime) -> QuizAttempt:
    if attempt.status == "finished":
        return attempt

    questions = await load_questions(db, attempt)
    weights: dict[str, float] = attempt.state.get("weights", {})
    answers: dict = attempt.answers or {}

    score = 0.0
    correct_count = 0
    per_subject: dict[str, dict] = defaultdict(lambda: {"correct": 0, "total": 0, "score": 0.0, "max_score": 0.0})
    per_category: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {"correct": 0, "total": 0}))
    per_topic: dict[tuple[str, str, str], dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})

    for question in questions:
        weight = weights.get(question.subject, 1.0)
        is_correct = answers.get(str(question.id)) == question.correct_index
        subject_stats = per_subject[question.subject]
        subject_stats["total"] += 1
        subject_stats["max_score"] += weight
        per_category[question.subject][question.category]["total"] += 1
        per_topic[(question.subject, question.category, question.topic)]["total"] += 1
        if is_correct:
            correct_count += 1
            score += weight
            subject_stats["correct"] += 1
            subject_stats["score"] += weight
            per_category[question.subject][question.category]["correct"] += 1
            per_topic[(question.subject, question.category, question.topic)]["correct"] += 1

    answered_share = len(answers) / len(questions) if questions else 0
    xp = correct_count * XP_PER_CORRECT
    if answered_share >= MIN_ANSWERED_SHARE_FOR_BONUS:
        xp += COMPLETION_BONUS[attempt.kind]

    attempt.score = round(score, 1)
    attempt.status = "finished"
    attempt.finished_at = now
    attempt.state = {
        **attempt.state,
        "correct_count": correct_count,
        "per_subject": {s: {**v, "score": round(v["score"], 1), "max_score": round(v["max_score"], 1)} for s, v in per_subject.items()},
        "per_topic": [
            {"subject": s, "category": c, "topic": t, **stats} for (s, c, t), stats in per_topic.items()
        ],
    }
    xp_service.award(user, attempt, xp, now)

    for subject, stats in per_subject.items():
        db.add(
            TestResult(
                user_id=user.id,
                subject=subject,
                test_type=RESULT_TEST_TYPE[attempt.kind],
                score=round(stats["score"], 1),
                max_score=round(stats["max_score"], 1),
                details={"source": f"quiz:{attempt.kind}", "attempt_id": str(attempt.id), "topic_breakdown": per_category[subject]},
            )
        )
    await db.commit()

    for subject in per_subject:
        await recalculate_radar(db, user.id, subject)
    await db.refresh(attempt)
    return attempt


def ms_result_level(attempt: QuizAttempt) -> str | None:
    if attempt.kind != "milliy_sertifikat" or not attempt.max_score:
        return None
    return ms_level_for(attempt.score / attempt.max_score * 100)
