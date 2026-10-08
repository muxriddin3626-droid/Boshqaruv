"""
Mavzu ma'ruzalari: AI ssenariy yozadi -> har bo'lim ovozga aylantiriladi ->
bitta MP3 bo'lib saqlanadi, bo'limlarning boshlanish vaqti yoziladi.

Ma'ruza (fan, mavzu, sinf guruhi) bo'yicha BIR MARTA tayyorlanadi va shu
guruhdagi hamma o'quvchiga beriladi — narx va kutish vaqti kamayadi.
Tayyorlash fonda ketadi (1-2 daqiqa); frontend holatni so'rab turadi.
Bir vaqtda ikki so'rov kelsa, faqat bittasi tayyorlashni boshlaydi (qator qulfi).

O'quvchining qayerda to'xtagani `lecture_progress`da — qayta ochganda davom etadi.
Oxirigacha tinglaganga bir marta XP beriladi (oldinga surib "tugatish" — hisob emas).
"""
import asyncio
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.database import LectureProgress, QuizAttempt, TopicLecture, User
from app.services import media_storage, openai_service, tts_service, xp_service
from app.services import question_bank_service as bank
from app.services.curriculum import CURRICULUM
from app.services.quiz_catalog import category_of

logger = logging.getLogger(__name__)

STALE_GENERATION = timedelta(minutes=15)
COMPLETION_SHARE = 0.9
MAX_PLAYBACK_SPEED = 2.0
COMPLETION_XP = 15
MIN_SECTIONS, MAX_SECTIONS = 3, 10
DEFAULT_VOICE = "onyx"

_NARRATION_JUNK = re.compile(r"[$\\`*#|_]+")
_background_tasks: set[asyncio.Task] = set()


class LectureError(ValueError):
    pass


def grade_band(user: User) -> int:
    """1 — 8-sinfgacha (sodda), 2 — 9-10-sinf, 3 — 11-sinf va bitiruvchilar."""
    if user.is_graduate or user.current_grade >= 11:
        return 3
    return 2 if user.current_grade >= 9 else 1


def normalize_script(raw: dict) -> tuple[str, list[dict]] | None:
    if not isinstance(raw, dict) or not isinstance(raw.get("sections"), list):
        return None
    sections = []
    for section in raw["sections"]:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title") or "").strip()[:120]
        markdown = str(section.get("markdown") or "").strip()
        # Ovozda belgi o'qilib qolmasin: model LaTeX/markdown qoldirsa ham tozalanadi.
        narration = _NARRATION_JUNK.sub(" ", str(section.get("narration") or "")).strip()
        narration = re.sub(r"[ \t]{2,}", " ", narration)
        if title and markdown and narration:
            sections.append({"title": title, "markdown": markdown, "narration": narration})
    if not MIN_SECTIONS <= len(sections) <= MAX_SECTIONS:
        return None
    title = str(raw.get("title") or "").strip()[:255]
    return title, sections


async def _find(db: AsyncSession, subject: str, topic: str, band: int, lock: bool = False) -> TopicLecture | None:
    stmt = select(TopicLecture).where(TopicLecture.subject == subject, TopicLecture.topic == topic, TopicLecture.grade_band == band)
    if lock:
        stmt = stmt.with_for_update()
    return (await db.execute(stmt.execution_options(populate_existing=True))).scalar_one_or_none()


async def request_lecture(db: AsyncSession, user: User, subject: str, topic: str, now: datetime) -> tuple[TopicLecture, bool]:
    """(ma'ruza, tayyorlash shu so'rovda boshlandimi). Tayyor bo'lsa — darhol qaytadi."""
    category = category_of(subject, topic)
    if category is None:
        raise LectureError("Bunday mavzu topilmadi")
    band = grade_band(user)

    lecture = await _find(db, subject, topic, band, lock=True)
    if lecture is None:
        lecture = TopicLecture(
            subject=subject, category=category, topic=topic, grade_band=band, status="generating",
            voice=DEFAULT_VOICE, created_at=now, updated_at=now,
        )
        db.add(lecture)
        try:
            await db.commit()
        except IntegrityError:  # parallel so'rov ulgurdi — o'shaniki tayyorlanmoqda
            await db.rollback()
            existing = await _find(db, subject, topic, band)
            if existing is None:
                raise
            return existing, False
    elif lecture.status == "ready" or (lecture.status == "generating" and now - lecture.updated_at < STALE_GENERATION):
        await db.commit()  # qulfni bo'shatish
        return lecture, False
    else:  # avval muvaffaqiyatsiz bo'lgan yoki tayyorlash to'xtab qolgan (server qayta ishga tushgan)
        lecture.status = "generating"
        lecture.updated_at = now
        await db.commit()

    task = asyncio.create_task(build_lecture(lecture.id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return lecture, True


async def build_lecture(lecture_id: uuid.UUID) -> None:
    """Fonda: ssenariy -> bo'limlar ovozi -> bitta MP3 -> saqlash."""
    async with AsyncSessionLocal() as db:
        lecture = await db.get(TopicLecture, lecture_id)
        if lecture is None:
            return
        try:
            async with bank._ai_semaphore:
                raw = await openai_service.generate_lecture_script(lecture.subject, lecture.category, lecture.topic, lecture.grade_band)
            script = normalize_script(raw)
            if script is None:
                raise ValueError("AI ma'ruza ssenariysi yaroqsiz")
            title, sections = script

            audio_parts: list[bytes] = []
            offset = 0.0
            stored_sections = []
            for section in sections:
                audio, duration = await tts_service.synthesize(section["narration"], lecture.voice)
                stored_sections.append({"title": section["title"], "markdown": section["markdown"], "start_seconds": round(offset, 1)})
                audio_parts.append(audio)
                offset += duration

            ref = await media_storage.save_audio(f"lectures/{lecture.subject}/{lecture.id}.mp3", b"".join(audio_parts))
            lecture.title = title or lecture.topic
            lecture.sections = stored_sections
            lecture.audio_ref = ref
            lecture.duration_seconds = round(offset)
            lecture.status = "ready"
        except Exception:  # noqa: BLE001 — holat "failed" bo'ladi, keyingi so'rov qayta urinadi
            logger.exception("Ma'ruza tayyorlanmadi: %s", lecture_id)
            lecture.status = "failed"
        lecture.updated_at = datetime.now(timezone.utc)
        await db.commit()


async def catalog(db: AsyncSession, user: User, subject: str) -> list[tuple[str, str, TopicLecture | None, LectureProgress | None]]:
    """Dastur tartibidagi mavzular + o'quvchi guruhi uchun ma'ruza (bo'lsa) + tinglash holati."""
    band = grade_band(user)
    lectures = {
        lecture.topic: lecture
        for lecture in (
            await db.execute(select(TopicLecture).where(TopicLecture.subject == subject, TopicLecture.grade_band == band))
        ).scalars()
    }
    ids = [lecture.id for lecture in lectures.values()]
    progress = {}
    if ids:
        rows = await db.execute(select(LectureProgress).where(LectureProgress.user_id == user.id, LectureProgress.lecture_id.in_(ids)))
        progress = {row.lecture_id: row for row in rows.scalars()}
    return [
        (item.category, item.topic, lectures.get(item.topic), progress.get(lectures[item.topic].id) if item.topic in lectures else None)
        for item in CURRICULUM[subject]
    ]


async def get_progress(db: AsyncSession, user_id: uuid.UUID, lecture_id: uuid.UUID) -> LectureProgress | None:
    return await db.get(LectureProgress, (user_id, lecture_id))


async def save_progress(
    db: AsyncSession, user: User, lecture: TopicLecture, position: float, ended: bool, now: datetime
) -> tuple[LectureProgress, int]:
    """(holat, shu so'rovda berilgan XP)."""
    if lecture.status != "ready":
        raise LectureError("Ma'ruza hali tayyor emas")
    await db.execute(
        pg_insert(LectureProgress)
        .values(user_id=user.id, lecture_id=lecture.id, first_played_at=now, updated_at=now, listen_count=0)
        .on_conflict_do_nothing()
    )
    progress = (
        await db.execute(
            select(LectureProgress)
            .where(LectureProgress.user_id == user.id, LectureProgress.lecture_id == lecture.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one()

    duration = max(1, lecture.duration_seconds)
    position = max(0.0, min(float(position), float(duration)))
    progress.position_seconds = int(position)
    progress.updated_at = now

    xp = 0
    reached_end = ended or position >= duration * COMPLETION_SHARE
    # Eng tez (2x) tinglaganda ham shuncha vaqt o'tishi kerak — oxiriga surib XP olib bo'lmaydi.
    listened_long_enough = (now - progress.first_played_at).total_seconds() >= duration * COMPLETION_SHARE / MAX_PLAYBACK_SPEED
    if reached_end and not progress.completed and listened_long_enough:
        progress.completed = True
        progress.completed_at = now
        attempt = QuizAttempt(
            user_id=user.id, kind="lecture", subject=lecture.subject, question_ids=[], answers={},
            state={"lecture_id": str(lecture.id)}, score=1, max_score=1, status="finished",
            started_at=progress.first_played_at, finished_at=now,
        )
        db.add(attempt)
        xp_service.award(user, attempt, COMPLETION_XP, now)
        xp = COMPLETION_XP
    if ended:
        progress.position_seconds = 0  # keyingi safar boshidan
        progress.listen_count += 1
    await db.commit()
    return progress, xp


async def topic_status(db: AsyncSession, user: User, subject: str, topic: str) -> str | None:
    """AI Ustoz uchun: 'completed' | 'started' | None (tinglamagan yoki ma'ruza yo'q)."""
    lecture = await _find(db, subject, topic, grade_band(user))
    if lecture is None or lecture.status != "ready":
        return None
    progress = await get_progress(db, user.id, lecture.id)
    if progress is None:
        return None
    return "completed" if progress.completed else "started"
