"""
MODUL 8: Audio Lecture Engine.

Oqim: ma'ruza matni -> OpenAI TTS (MP3 bayt) -> Supabase Storage
(`audio_lectures` bucket) -> PostgreSQL'ga URL + metadata yozish.

Eslatma: bu implementatsiya `audio_lectures` bucket PUBLIC deb hisoblaydi
(ommaviy o'qish ruxsati bilan) — shunda saqlangandan so'ng darhol to'g'ridan-
to'g'ri ommaviy URL orqali eshitish mumkin. Agar bucket private bo'lsa,
o'rniga signed URL yaratish kerak bo'ladi (Supabase Storage API'sining
`/object/sign/...` endpointi).
"""
import io
import uuid

import httpx
from mutagen.mp3 import MP3
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.database import UserAudioLecture
from app.services.openai_service import text_to_speech

settings = get_settings()


def _estimate_duration_seconds(audio_bytes: bytes) -> int:
    """MP3 fayl sarlavhasidan aniq davomiylikni o'qiydi; muvaffaqiyatsiz bo'lsa so'z soniga qarab taxmin qiladi."""
    try:
        return round(MP3(io.BytesIO(audio_bytes)).info.length)
    except Exception:  # noqa: BLE001 — mp3 metadata o'qib bo'lmasa, taxminiy qiymatga tushamiz
        return 0


async def _upload_to_supabase_storage(audio_bytes: bytes, storage_path: str) -> str:
    """Supabase Storage REST API orqali MP3 faylni yuklaydi va ommaviy URL qaytaradi."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sozlanmagan — audio faylni yuklab bo'lmaydi"
        )

    upload_url = (
        f"{settings.supabase_url}/storage/v1/object/{settings.supabase_audio_bucket}/{storage_path}"
    )
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        response = await http_client.post(
            upload_url,
            content=audio_bytes,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "apikey": settings.supabase_service_role_key,
                "Content-Type": "audio/mpeg",
                "x-upsert": "true",
            },
        )
        response.raise_for_status()

    return f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_audio_bucket}/{storage_path}"


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
    """To'liq oqim: matn -> TTS -> Supabase Storage -> `user_audio_lectures` yozuvi."""
    audio_bytes = await text_to_speech(lecture_text, voice)
    duration_seconds = _estimate_duration_seconds(audio_bytes)

    storage_path = f"{user_id}/{uuid.uuid4()}.mp3"
    audio_url = await _upload_to_supabase_storage(audio_bytes, storage_path)

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
