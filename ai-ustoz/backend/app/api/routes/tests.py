"""Testlar: DTM sinovi, mavzu testi, Milliy Sertifikat uslubidagi mashq."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import QuizAttempt, User
from app.models.schemas import (
    CatalogTopicOut,
    ReviewItemOut,
    SubjectScoreOut,
    TestAnswerIn,
    TestCatalogOut,
    TestCreateIn,
    TestQuestionOut,
    TestResultOut,
    TestSessionOut,
    TopicScoreOut,
)
from app.services import quiz_test_service as tests
from app.services.question_bank_service import QuestionBankUnavailableError
from app.services.quiz_catalog import (
    DTM_FIRST_SUBJECT_WEIGHT,
    DTM_QUESTIONS_PER_SUBJECT,
    DTM_SECOND_SUBJECT_WEIGHT,
    DTM_SECONDS_PER_QUESTION,
    MS_FORMAT,
    SUBJECT_TOPICS,
)
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, register_hit

router = APIRouter(prefix="/api/v1/tests", tags=["tests"])

# Har yangi test AI chaqiruvini keltirib chiqarishi mumkin (pullik) — soatlik chegara.
TESTS_PER_HOUR = 15

BANK_UNAVAILABLE_DETAIL = "Savollar hozircha tayyorlanmadi (AI xizmati javob bermayapti). Birozdan keyin urinib ko'ring."


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    return user


async def _get_attempt(db: AsyncSession, attempt_id: uuid.UUID, user_id: uuid.UUID) -> QuizAttempt:
    attempt = await db.get(QuizAttempt, attempt_id)
    if attempt is None or attempt.user_id != user_id or attempt.kind not in tests.TEST_KINDS:
        raise HTTPException(status_code=404, detail="Test topilmadi")
    return attempt


async def _session_out(db: AsyncSession, attempt: QuizAttempt) -> TestSessionOut:
    questions = await tests.load_questions(db, attempt)
    return TestSessionOut(
        attempt_id=attempt.id,
        kind=attempt.kind,
        subject=attempt.subject,
        topic=attempt.state.get("topic"),
        status="active",
        questions=[
            TestQuestionOut(id=str(q.id), subject=q.subject, topic=q.topic, question=q.question, options=q.options)
            for q in questions
        ],
        answers=attempt.answers or {},
        deadline_at=attempt.deadline_at,
        server_now=_now(),
        max_score=attempt.max_score,
    )


async def _result_out(db: AsyncSession, attempt: QuizAttempt) -> TestResultOut:
    questions = await tests.load_questions(db, attempt)
    answers = attempt.answers or {}
    state = attempt.state
    per_topic = sorted(state.get("per_topic", []), key=lambda t: (t["correct"] / t["total"] if t["total"] else 1, t["topic"]))
    return TestResultOut(
        attempt_id=attempt.id,
        kind=attempt.kind,
        subject=attempt.subject,
        status="finished",
        score=attempt.score,
        max_score=attempt.max_score,
        percent=round(attempt.score / attempt.max_score * 100, 1) if attempt.max_score else 0.0,
        correct_count=state.get("correct_count", 0),
        total=len(questions),
        xp_earned=attempt.xp_earned,
        duration_seconds=int((attempt.finished_at - attempt.started_at).total_seconds()),
        per_subject=[SubjectScoreOut(subject=s, **v) for s, v in state.get("per_subject", {}).items()],
        per_topic=[TopicScoreOut(**t) for t in per_topic],
        review=[
            ReviewItemOut(
                question_id=str(q.id),
                subject=q.subject,
                topic=q.topic,
                question=q.question,
                options=q.options,
                chosen=answers.get(str(q.id)),
                correct_index=q.correct_index,
                explanation=q.explanation,
            )
            for q in questions
        ],
        ms_level=tests.ms_result_level(attempt),
        ms_is_official=MS_FORMAT.is_official,
    )


@router.get("/catalog", response_model=TestCatalogOut)
async def get_catalog():
    return TestCatalogOut(
        topics={
            subject: [CatalogTopicOut(category=c, topic=t) for c, t in topics] for subject, topics in SUBJECT_TOPICS.items()
        },
        dtm_questions_per_subject=DTM_QUESTIONS_PER_SUBJECT,
        dtm_first_weight=DTM_FIRST_SUBJECT_WEIGHT,
        dtm_second_weight=DTM_SECOND_SUBJECT_WEIGHT,
        dtm_seconds_per_question=DTM_SECONDS_PER_QUESTION,
        ms_question_count=MS_FORMAT.question_count,
        ms_seconds_per_question=MS_FORMAT.seconds_per_question,
        ms_is_official=MS_FORMAT.is_official,
    )


@router.post("", response_model=TestSessionOut, status_code=status.HTTP_201_CREATED)
async def create_test(
    payload: TestCreateIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    user = await _get_user(db, user_id)
    limit_key = f"tests_created:{user_id}"
    try:
        await ensure_below_limit(redis, limit_key, TESTS_PER_HOUR)
    except RateLimitExceededError as exc:
        raise HTTPException(status_code=429, detail="Bir soatda juda ko'p test boshlandi. Birozdan keyin urinib ko'ring.") from exc

    request = tests.TestRequest(
        kind=payload.kind,
        subject=payload.subject.value,
        topic=payload.topic,
        question_count=payload.question_count,
        first_subject=payload.first_subject.value if payload.first_subject else None,
        dtm_blocks=payload.dtm_blocks,
    )
    try:
        attempt = await tests.create_test(db, user, request, _now())
    except tests.TestRequestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except QuestionBankUnavailableError as exc:
        raise HTTPException(status_code=503, detail=BANK_UNAVAILABLE_DETAIL) from exc

    await register_hit(redis, limit_key, 60 * 60)
    return await _session_out(db, attempt)


@router.get("/active", response_model=TestSessionOut | None)
async def get_active_test(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Sahifa yangilansa yoki telefon o'chib qolsa — boshlangan testga qaytish."""
    stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user_id, QuizAttempt.status == "active", QuizAttempt.kind.in_(tests.TEST_KINDS))
        .order_by(QuizAttempt.started_at.desc())
        .limit(1)
    )
    attempt = (await db.execute(stmt)).scalar_one_or_none()
    if attempt is None:
        return None
    if tests.is_expired(attempt, _now()):
        await tests.finish_test(db, await _get_user(db, user_id), attempt, _now())
        return None
    return await _session_out(db, attempt)


@router.get("/{attempt_id}", response_model=TestSessionOut | TestResultOut)
async def get_test(
    attempt_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    attempt = await _get_attempt(db, attempt_id, user_id)
    if attempt.status == "active" and tests.is_expired(attempt, _now()):
        attempt = await tests.finish_test(db, await _get_user(db, user_id), attempt, _now())
    if attempt.status == "finished":
        return await _result_out(db, attempt)
    return await _session_out(db, attempt)


@router.put("/{attempt_id}/answers")
async def save_answer(
    attempt_id: uuid.UUID,
    payload: TestAnswerIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _get_attempt(db, attempt_id, user_id)
    try:
        await tests.save_answer(db, attempt, payload.question_id, payload.choice, _now())
    except tests.AttemptClosedError as exc:
        raise HTTPException(status_code=409, detail="Test vaqti tugagan yoki test yakunlangan") from exc
    except tests.TestRequestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/{attempt_id}/finish", response_model=TestResultOut)
async def finish_test(
    attempt_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
):
    attempt = await _get_attempt(db, attempt_id, user_id)
    attempt = await tests.finish_test(db, await _get_user(db, user_id), attempt, _now())
    return await _result_out(db, attempt)
