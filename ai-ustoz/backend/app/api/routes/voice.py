"""
Ovoz:

1. Ovozli xabarlar (standart): o'quvchi chatga ovozli savol yuboradi (brauzer matnga aylantiradi yoki
   `/transcribe`), ustoz odatdagidek yozma javob beradi (chizmalar bilan), `/speak` javobni ovozga
   aylantiradi — qisqa xulosa avtomatik, to'liq javob tugma bilan.
2. Jonli (Premium) ovoz: OpenAI Realtime — `/session`. Qimmat, shuning uchun ilovada ko'rsatilmaydi;
   faqat administrator yoki REALTIME_VOICE_FOR_STUDENTS=true bo'lsa ruxsat.
"""
import base64
import logging
import re
import uuid
from datetime import date

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.schemas import VoiceMode, VoiceSessionIn, VoiceSessionOut, VoiceSpeakIn, VoiceSpeakOut, VoiceTranscriptOut
from app.prompts.debate_prompt import build_debate_system_prompt
from app.prompts.exam_feedback_prompt import build_exam_feedback_addendum
from app.prompts.system_prompt import build_system_prompt
from app.prompts.voice_persona import SET_EMOTION_TOOL, VOICE_ADDENDUM
from app.services import ai_budget, exam_pipeline_service, openai_service, progress_service
from app.services.openai_service import DEFAULT_VOICE_INSTRUCTIONS, RealtimeSessionError, create_realtime_voice_session
from app.services.usage_limits import use_daily, voice_limit, voice_reply_limit

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])
logger = logging.getLogger(__name__)
settings = get_settings()

# Avtomatik o'qiladigan qisqa xulosa va "To'liq eshitish" chegarasi (TTS narxi belgilar soniga bog'liq).
SUMMARY_MAX_CHARS = 350
FULL_MAX_CHARS = 1500
MAX_UPLOAD_BYTES = 3 * 1024 * 1024
EMOTION_TAG = re.compile(r"^\s*\[[a-z]{3,10}\]\s*")


async def _instructions(db: AsyncSession, user_id: uuid.UUID, subject: str, mode: VoiceMode) -> str:
    student_ctx = await progress_service.get_student_context(db, user_id, subject)
    if mode == VoiceMode.DEBATE:
        return build_debate_system_prompt(student_ctx)
    exam_status = await exam_pipeline_service.get_exam_status(db, user_id)
    is_exam_today = exam_status.target_exam_date == date.today()
    exam_addendum = build_exam_feedback_addendum(exam_status.exam_completed, exam_status.feedback_provided, is_exam_today)
    return (build_system_prompt(student_ctx, for_voice=True) or DEFAULT_VOICE_INSTRUCTIONS) + exam_addendum


def to_spoken(text: str, max_chars: int = SUMMARY_MAX_CHARS) -> str:
    """Ovozga aytiladigan toza matn: kayfiyat tegi, chizma bloklari, LaTeX, markdown olib tashlanadi; gap oxirida qisqaradi."""
    text = EMOTION_TAG.sub("", text)
    text = re.sub(r"```.*?(```|$)", " ", text, flags=re.S)
    text = re.sub(r"\$+([^$]*)\$+", r"\1", text)
    text = re.sub(r"\\ce\{([^}]*)\}", r"\1", text)
    text = text.replace("<=>", " qaytar reaksiyada ").replace("->", " dan hosil bo'ladi ")
    text = re.sub(r"[*_#`>|\\]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_chars:
        cut = text[: max_chars + 1]
        end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "), cut.rfind(".\n"))
        text = cut[: end + 1] if end > max_chars // 3 else cut[:max_chars].rstrip() + "..."
    return text


@router.post("/speak", response_model=VoiceSpeakOut)
async def speak(
    payload: VoiceSpeakIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Ustoz javobini ovozga aylantiradi: `full=false` — 2-3 gaplik boshi (avtomatik), `full=true` — to'liq."""
    spoken = to_spoken(payload.text, FULL_MAX_CHARS if payload.full else SUMMARY_MAX_CHARS)
    if not spoken:
        raise HTTPException(status_code=422, detail="Bu javobda o'qiladigan matn yo'q (faqat chizma).")
    await use_daily(redis, db, user_id, voice_reply_limit())
    try:
        audio = await openai_service.text_to_speech(spoken, voice=settings.tts_voice_name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Javob ovozga aylanmadi", exc_info=True)
        raise HTTPException(status_code=502, detail=openai_service.describe_error_for_student(exc)) from exc
    return VoiceSpeakOut(audio_base64=base64.b64encode(audio).decode("ascii"), spoken_text=spoken)


@router.post("/transcribe", response_model=VoiceTranscriptOut)
async def voice_transcribe(
    audio: UploadFile = File(...),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Brauzer nutqni o'zi taniy olmasa (masalan, ba'zi iPhone'lar): yozib olingan gap -> matn (Whisper)."""
    await ai_budget.ensure_budget(db, user_id)
    data = await audio.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Ovoz yozuvi juda uzun — qisqaroq gapiring.")
    try:
        text = await openai_service.transcribe_audio(data, audio.filename or "audio.webm")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Ovoz matnga aylanmadi", exc_info=True)
        raise HTTPException(status_code=502, detail="Ovozni tushunib bo'lmadi — qaytadan gapirib ko'ring.") from exc
    # Whisper ~0,6 sent/daqiqa; yozuv uzunligi noma'lum — 30 soniyalik taxmin.
    await ai_budget.charge(0.003)
    return VoiceTranscriptOut(text=text.strip())


@router.post("/session", response_model=VoiceSessionOut)
async def create_voice_session(
    payload: VoiceSessionIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    Jonli (Premium) rejim: frontend WebRTC ulanishni boshlashdan oldin shu endpointni chaqiradi.
    Qaytgan client_secret to'g'ridan-to'g'ri OpenAI Realtime API bilan SDP almashinuvi uchun
    ishlatiladi (backend orqali audio oqmaydi).

    `mode`: "tutor" — oddiy repetitorlik (Exam Feedback qo'shimchasi bilan); "debate" — MUNOZARA
    rejimi: AI atayin noto'g'ri gipoteza aytadi, o'quvchi uni ovozli rad etishi kerak.
    """
    if not settings.realtime_voice_for_students and not await ai_budget.is_admin(db, user_id):
        raise HTTPException(status_code=403, detail="Jonli (Premium) ovoz hozircha yoqilmagan — tejamkor ovozli rejimdan foydalaning.")
    await use_daily(redis, db, user_id, voice_limit())
    instructions = await _instructions(db, user_id, payload.subject.value, payload.mode)

    try:
        session = await create_realtime_voice_session(
            instructions=instructions + VOICE_ADDENDUM, tools=[SET_EMOTION_TOOL]
        )
    except RealtimeSessionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="OpenAI bilan aloqa bo'lmadi — birozdan keyin qayta urinib ko'ring.") from exc

    return VoiceSessionOut(
        client_secret=session["client_secret"],
        expires_at=session["expires_at"],
        model=session["model"],
        mode=payload.mode,
    )
