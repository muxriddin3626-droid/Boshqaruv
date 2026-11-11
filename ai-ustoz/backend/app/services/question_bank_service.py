"""
Savollar banki: testlar va o'yinlar savollarni shu yerdan oladi.

Tartib: avval bazadagi tekshirilgan savollardan (o'quvchi yaqinda ko'rmaganlari)
olinadi; yetmasa — AI yangi savol tuzadi, boshqa chaqiruvda javob kalitisiz
mustaqil yechadi va faqat ikkala javob mos kelgan savollar bankka qo'shiladi.
"""
import asyncio
import hashlib
import json
import logging
import random
import uuid
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import QuizAttempt, QuizQuestion
from app.services import openai_service

logger = logging.getLogger(__name__)

TRUE_FALSE_OPTIONS = ["To'g'ri", "Noto'g'ri"]
MATCHING_PAIRS = 6
# Tekshiruvda tashlanadigan savollar o'rnini to'ldirish uchun ortiqcha so'raladi (kamida +2).
GENERATION_OVERHEAD = 1.4
MIN_EXTRA_ITEMS = 2
MAX_ITEMS_PER_CALL = 10
# Bo'sh bankda katta test (masalan, DTM) bir vaqtda o'nlab chaqiruv qilmasligi uchun: yangi OpenAI
# hisoblarida daqiqalik token chegarasi kichik, ko'p parallel so'rov "429" bilan qaytadi.
_ai_semaphore = asyncio.Semaphore(3)
# Vaqtinchalik xatoda (daqiqalik chegara, internet) shuncha soniya kutib qayta uriniladi.
RETRY_DELAYS_SECONDS = (5, 15)
RECENT_ATTEMPTS_TO_AVOID = 20

FAILURE_MESSAGES = {
    "quota": "Savollar tayyorlanmadi: OpenAI hisobida mablag' tugagan. Administratorga xabar bering.",
    "auth": "Savollar tayyorlanmadi: OpenAI kaliti noto'g'ri. Administratorga xabar bering.",
    "rate_limit": "AI hozir juda band (daqiqalik chegara) — 1-2 daqiqadan keyin qayta urinib ko'ring.",
    "connection": "AI xizmatiga ulanib bo'lmadi — birozdan keyin qayta urinib ko'ring.",
}
DEFAULT_FAILURE_MESSAGE = "Savollar hozircha tayyorlanmadi (AI xizmati javob bermayapti). Birozdan keyin urinib ko'ring."


class QuestionBankUnavailableError(Exception):
    """Bankda yetarli savol yo'q va AI ham tuza olmadi (masalan, OpenAI kaliti yo'q)."""

    def __init__(self, message: str, reason: str | None = None):
        super().__init__(message)
        self.reason = reason

    @property
    def user_message(self) -> str:
        return FAILURE_MESSAGES.get(self.reason or "", DEFAULT_FAILURE_MESSAGE)


def classify_failure(exc: BaseException) -> str:
    """AI xatosi turi: quota | auth | rate_limit | connection | other."""
    import openai

    if isinstance(exc, openai.RateLimitError):
        return "quota" if "insufficient_quota" in str(exc) else "rate_limit"
    if isinstance(exc, openai.AuthenticationError):
        return "auth"
    if isinstance(exc, (openai.APIConnectionError, openai.APITimeoutError)):
        return "connection"
    return "other"


@dataclass(frozen=True)
class Slot:
    """Bitta mavzudan kerakli savollar: (bo'lim, mavzu, qiyinlik, soni)."""

    category: str
    topic: str
    difficulty: int | None
    count: int


def _content_hash(subject: str, qtype: str, question: str, options: list) -> str:
    payload = json.dumps([subject, qtype, question.strip().lower(), options], ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def normalize_item(qtype: str, raw: dict) -> dict | None:
    """AI javobini tekshiradi va saqlanadigan ko'rinishga keltiradi; yaroqsiz bo'lsa None."""
    if not isinstance(raw, dict):
        return None
    explanation = str(raw.get("explanation") or "").strip()

    if qtype == "mcq":
        question = str(raw.get("question") or "").strip()
        options = raw.get("options")
        correct = raw.get("correct_index")
        if not question or not isinstance(options, list) or len(options) != 4 or not isinstance(correct, int):
            return None
        options = [str(option).strip() for option in options]
        if not all(options) or len(set(options)) != 4 or not 0 <= correct < 4:
            return None
        # AI to'g'ri javobni ko'pincha birinchi qo'yadi — variantlar aralashtiriladi.
        order = random.sample(range(4), 4)
        return {
            "question": question,
            "options": [options[i] for i in order],
            "correct_index": order.index(correct),
            "explanation": explanation,
            "hint": str(raw.get("hint") or "").strip() or None,
        }

    if qtype == "true_false":
        statement = str(raw.get("statement") or "").strip()
        is_true = raw.get("is_true")
        if not statement or not isinstance(is_true, bool):
            return None
        return {
            "question": statement,
            "options": TRUE_FALSE_OPTIONS,
            "correct_index": 0 if is_true else 1,
            "explanation": explanation,
            "hint": None,
        }

    if qtype == "matching":
        title = str(raw.get("title") or "").strip()
        pairs = raw.get("pairs")
        if not title or not isinstance(pairs, list) or len(pairs) != MATCHING_PAIRS:
            return None
        cleaned = []
        for pair in pairs:
            if not isinstance(pair, dict):
                return None
            left, right = str(pair.get("left") or "").strip(), str(pair.get("right") or "").strip()
            if not left or not right:
                return None
            cleaned.append({"left": left, "right": right})
        if len({p["left"] for p in cleaned}) != MATCHING_PAIRS or len({p["right"] for p in cleaned}) != MATCHING_PAIRS:
            return None
        return {"question": title, "options": cleaned, "correct_index": None, "explanation": explanation, "hint": None}

    return None


def _solver_view(qtype: str, items: list[dict]) -> tuple[list[dict], list[list[int]]]:
    """Yechuvchiga javob kalitisiz ko'rinish; matching uchun o'ng ustun aralashtiriladi."""
    view: list[dict] = []
    right_orders: list[list[int]] = []
    for n, item in enumerate(items):
        if qtype == "matching":
            order = random.sample(range(MATCHING_PAIRS), MATCHING_PAIRS)
            right_orders.append(order)
            view.append(
                {
                    "n": n,
                    "title": item["question"],
                    "left": [pair["left"] for pair in item["options"]],
                    "right": [item["options"][i]["right"] for i in order],
                }
            )
        elif qtype == "true_false":
            view.append({"n": n, "statement": item["question"]})
        else:
            view.append({"n": n, "question": item["question"], "options": item["options"]})
    return view, right_orders


def _agrees(qtype: str, item: dict, answer, right_order: list[int] | None) -> bool:
    if qtype == "mcq":
        return answer == item["correct_index"]
    if qtype == "true_false":
        return isinstance(answer, bool) and answer == (item["correct_index"] == 0)
    if qtype == "matching":
        # i-chap elementning to'g'ri o'ng elementi aralashtirilgan ro'yxatda right_order.index(i) o'rnida.
        expected = [right_order.index(i) for i in range(MATCHING_PAIRS)]
        return isinstance(answer, list) and answer == expected
    return False


async def generate_verified_items(
    subject: str, slot: Slot, qtype: str, needed: int, failures: list[str] | None = None
) -> list[dict]:
    """AI tuzadi -> tekshiradi -> mos kelganlarini qaytaradi (bazaga yozmaydi).
    Vaqtinchalik xatoda qayta urinadi; xato turi `failures` ro'yxatiga yoziladi."""
    difficulty = slot.difficulty or 3
    to_request = min(MAX_ITEMS_PER_CALL, max(needed + MIN_EXTRA_ITEMS, int(needed * GENERATION_OVERHEAD + 0.999)))
    for attempt in range(len(RETRY_DELAYS_SECONDS) + 1):
        try:
            async with _ai_semaphore:
                raw_items = await openai_service.generate_quiz_items(subject, slot.topic, qtype, to_request, difficulty)
                items = [item for item in (normalize_item(qtype, raw) for raw in raw_items) if item]
                if not items:
                    return []
                view, right_orders = _solver_view(qtype, items)
                solved = await openai_service.solve_quiz_items(subject, qtype, view)
            break
        except Exception as exc:  # noqa: BLE001 — AI xatosi testni buzmasin, bank mavjudi bilan ishlaydi
            kind = classify_failure(exc)
            if kind in ("rate_limit", "connection") and attempt < len(RETRY_DELAYS_SECONDS):
                logger.warning("Savol generatsiyasi: %s, %s s dan keyin qayta urinish (%s)", kind, RETRY_DELAYS_SECONDS[attempt], slot.topic)
                await asyncio.sleep(RETRY_DELAYS_SECONDS[attempt])
                continue
            logger.exception("Savol generatsiyasi muvaffaqiyatsiz (%s): %s / %s / %s", kind, subject, slot.topic, qtype)
            if failures is not None:
                failures.append(kind)
            return []

    verified = []
    for n, item in enumerate(items):
        if n in solved and _agrees(qtype, item, solved[n], right_orders[n] if qtype == "matching" else None):
            verified.append({**item, "category": slot.category, "topic": slot.topic, "difficulty": difficulty})
        else:
            logger.info("Tekshiruvdan o'tmagan savol tashlandi: %s", item["question"][:80])
    return verified


async def store_items(db: AsyncSession, subject: str, qtype: str, items: list[dict]) -> list[QuizQuestion]:
    if not items:
        return []
    rows = [
        {
            "subject": subject,
            "qtype": qtype,
            "category": item["category"],
            "topic": item["topic"],
            "difficulty": item["difficulty"],
            "question": item["question"],
            "options": item["options"],
            "correct_index": item["correct_index"],
            "explanation": item["explanation"],
            "hint": item["hint"],
            "content_hash": _content_hash(subject, qtype, item["question"], item["options"]),
        }
        for item in items
    ]
    stmt = pg_insert(QuizQuestion).values(rows).on_conflict_do_nothing(index_elements=["content_hash"])
    inserted_ids = (await db.execute(stmt.returning(QuizQuestion.id))).scalars().all()
    await db.commit()
    if not inserted_ids:
        return []
    return list((await db.execute(select(QuizQuestion).where(QuizQuestion.id.in_(inserted_ids)))).scalars().all())


async def recently_seen_ids(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    stmt = (
        select(QuizAttempt.question_ids)
        .where(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.started_at.desc())
        .limit(RECENT_ATTEMPTS_TO_AVOID)
    )
    seen: set[str] = set()
    for question_ids in (await db.execute(stmt)).scalars().all():
        seen.update(str(qid) for qid in question_ids or [])
    return seen


async def _from_bank(
    db: AsyncSession, subject: str, qtype: str, slot: Slot, limit: int, exclude: set[str]
) -> list[QuizQuestion]:
    stmt = select(QuizQuestion).where(
        QuizQuestion.subject == subject, QuizQuestion.qtype == qtype, QuizQuestion.topic == slot.topic
    )
    if slot.difficulty is not None:
        stmt = stmt.where(QuizQuestion.difficulty == slot.difficulty)
    if exclude:
        stmt = stmt.where(QuizQuestion.id.notin_([uuid.UUID(qid) for qid in exclude]))
    return list((await db.execute(stmt.order_by(func.random()).limit(limit))).scalars().all())


async def pick_questions(
    db: AsyncSession, subject: str, qtype: str, slots: list[Slot], user_id: uuid.UUID | None = None
) -> list[QuizQuestion]:
    """
    Har bir slot uchun savollarni bankdan oladi, yetishmaganini AI bilan to'ldiradi.
    Natija slotlar tartibida. Umuman yetmasa QuestionBankUnavailableError.
    """
    exclude = await recently_seen_ids(db, user_id) if user_id else set()
    picked: list[list[QuizQuestion]] = []
    for slot in slots:
        rows = await _from_bank(db, subject, qtype, slot, slot.count, exclude)
        exclude.update(str(row.id) for row in rows)
        picked.append(rows)

    failures: list[str] = []
    # Ikki marta: tekshiruvda tashlangan savollar o'rni ikkinchi urinishda to'ldiriladi.
    for _round in range(2):
        shortages = [(i, slot, slot.count - len(picked[i])) for i, slot in enumerate(slots) if len(picked[i]) < slot.count]
        if not shortages or any(kind in ("quota", "auth") for kind in failures):
            break
        generated = await asyncio.gather(
            *(generate_verified_items(subject, slot, qtype, missing, failures) for _, slot, missing in shortages)
        )
        for (i, _slot, missing), items in zip(shortages, generated):
            stored = await store_items(db, subject, qtype, items)
            exclude.update(str(row.id) for row in stored[:missing])
            picked[i].extend(stored[:missing])

    # Hali ham yetmasa — shu fanning boshqa mavzularidagi tayyor savollar bilan to'ldiriladi.
    for i, slot in enumerate(slots):
        missing = slot.count - len(picked[i])
        if missing <= 0:
            continue
        stmt = select(QuizQuestion).where(QuizQuestion.subject == subject, QuizQuestion.qtype == qtype)
        if exclude:
            stmt = stmt.where(QuizQuestion.id.notin_([uuid.UUID(qid) for qid in exclude]))
        extra = list((await db.execute(stmt.order_by(func.random()).limit(missing))).scalars().all())
        exclude.update(str(row.id) for row in extra)
        picked[i].extend(extra)

    total_needed = sum(slot.count for slot in slots)
    result = [row for rows in picked for row in rows]
    if len(result) < total_needed:
        reason = next((kind for kind in ("quota", "auth", "rate_limit", "connection") if kind in failures), None)
        raise QuestionBankUnavailableError(f"{len(result)}/{total_needed} savol tayyorlandi", reason)
    return result


def spread_over_topics(topics: list[tuple[str, str]], count: int, difficulty: int | None = None) -> list[Slot]:
    """`count` ta savolni mavzular bo'yicha imkon qadar teng taqsimlaydi (tasodifiy tartibda)."""
    shuffled = random.sample(topics, len(topics))
    per_topic = Counter(shuffled[i % len(shuffled)] for i in range(count))
    return [Slot(category, topic, difficulty, n) for (category, topic), n in per_topic.items()]


async def load_by_ids(db: AsyncSession, question_ids: list[str]) -> list[QuizQuestion]:
    """Savollarni berilgan tartibda bitta so'rov bilan yuklaydi."""
    ids = [uuid.UUID(qid) for qid in question_ids]
    by_id = {q.id: q for q in (await db.execute(select(QuizQuestion).where(QuizQuestion.id.in_(ids)))).scalars().all()}
    return [by_id[qid] for qid in ids if qid in by_id]
