"""
MODUL 8: Audio Lecture Engine — AI Ustoz javobini audio qilib shaxsiy kutubxonaga saqlash.

Oqim: matn -> OpenAI TTS (uzun matn bo'laklanadi) -> media_storage (Supabase yoki
lokal disk) -> `user_audio_lectures` yozuvi. `audio_url` ustunida saqlash ref'i
turadi; brauzerga `media_storage.playback_url` orqali beriladi.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import UserAudioLecture
from app.services import media_storage, tts_service


async def generate_and_store_lecture(
    db: AsyncSession,
    user_id: uuid.UUID,
    subject: str,
    grade: int | None,
    lecture_title: str,
    lecture_text: str,
    lecture_summary: str | None,
    voice: str = "onyx",
) -> UserAudioLecture:
    """To'liq oqim: matn -> TTS -> saqlash -> `user_audio_lectures` yozuvi."""
    audio_bytes, duration = await tts_service.synthesize(lecture_text, voice)
    duration_seconds = round(duration)
    audio_url = await media_storage.save_audio(f"answers/{user_id}/{uuid.uuid4()}.mp3", audio_bytes)

    lecture = UserAudioLecture(
        user_id=user_id,
        subject=subject,
        grade=grade,
        lecture_title=lecture_title,
        lecture_summary=lecture_summary,
        audio_url=audio_url,
        duration_seconds=duration_seconds,
        is_saved=True,
    )
    db.add(lecture)
    await db.commit()
    await db.refresh(lecture)
    return lecture


async def list_user_lectures(db: AsyncSession, user_id: uuid.UUID, subject: str | None = None) -> list[UserAudioLecture]:
    stmt = select(UserAudioLecture).where(UserAudioLecture.user_id == user_id)
    if subject:
        stmt = stmt.where(UserAudioLecture.subject == subject)
    stmt = stmt.order_by(UserAudioLecture.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


async def set_lecture_saved(db: AsyncSession, user_id: uuid.UUID, lecture_id: uuid.UUID, is_saved: bool) -> UserAudioLecture:
    lecture = await db.get(UserAudioLecture, lecture_id)
    if lecture is None or lecture.user_id != user_id:
        raise ValueError("Audio ma'ruza topilmadi")

    lecture.is_saved = is_saved
    await db.commit()
    await db.refresh(lecture)
    return lecture


async def delete_lecture(db: AsyncSession, user_id: uuid.UUID, lecture_id: uuid.UUID) -> None:
    lecture = await db.get(UserAudioLecture, lecture_id)
    if lecture is None or lecture.user_id != user_id:
        raise ValueError("Audio ma'ruza topilmadi")

    await db.delete(lecture)
    await db.commit()
    await media_storage.delete_audio(lecture.audio_url)
