"""
Ovozli suhbat (tutor va debate rejimlari), ikki xil:

1. Tejamkor (standart): brauzer o'quvchi nutqini matnga aylantiradi -> `/turn` matnli AI (Gemini yoki
   OpenAI) javob yozadi -> TTS bilan MP3 qaytadi. Kuniga ~30 daqiqa ham oyiga bir necha dollar.
2. Jonli (Premium): OpenAI Realtime — `/session` ephemeral client_secret beradi, audio brauzer va
   OpenAI orasida to'g'ridan-to'g'ri oqadi. Tabiiyroq, lekin bir necha barobar qimmat — o'quvchilarga
   faqat REALTIME_VOICE_FOR_STUDENTS=true bo'lsa ochiq (administrator har doim ishlata oladi).
"""
import base64
import json
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
from app.models.schemas import (
    VoiceMode,
    VoiceOptionsOut,
    VoiceSessionIn,
    VoiceSessionOut,
    VoiceTranscriptOut,
    VoiceTurnIn,
    VoiceTurnOut,
)
from app.prompts.debate_prompt import build_debate_system_prompt
from app.prompts.exam_feedback_prompt import build_exam_feedback_addendum
from app.prompts.system_prompt import build_system_prompt
from app.prompts.voice_persona import ECONOMY_VOICE_ADDENDUM, SET_EMOTION_TOOL, VOICE_ADDENDUM, VOICE_EMOTIONS
from app.services import ai_budget, exam_pipeline_service, openai_service, progress_service
from app.services.openai_service import DEFAULT_VOICE_INSTRUCTIONS, RealtimeSessionError, create_realtime_voice_session
from app.services.usage_limits import use_daily, voice_limit, voice_turn_limit

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])
logger = logging.getLogger(__name__)
settings = get_settings()

HISTORY_MAX_MESSAGES = 16
HISTORY_TTL_SECONDS = 2 * 60 * 60
SPOKEN_MAX_CHARS = 600
MAX_UPLOAD_BYTES = 3 * 1024 * 1024
START_MESSAGE = "(Ovozli dars boshlandi. Salomlash va darhol bitta savol ber.)"


async def _instructions(db: AsyncSession, user_id: uuid.UUID, subject: str, mode: VoiceMode) -> str:
    student_ctx = await progress_service.get_student_context(db, user_id, subject)
    if mode == VoiceMode.DEBATE:
        return build_debate_system_prompt(student_ctx)
    exam_status = await exam_pipeline_service.get_exam_status(db, user_id)
    is_exam_today = exam_status.target_exam_date == date.today()
    exam_addendum = build_exam_feedback_addendum(exam_status.exam_completed, exam_status.feedback_provided, is_exam_today)
    return (build_system_prompt(student_ctx, for_voice=True) or DEFAULT_VOICE_INSTRUCTIONS) + exam_addendum


def split_emotion(reply: str) -> tuple[str, str]:
    """"[happy] Barakalla!" -> ("happy", "Barakalla!"). Teg bo'lmasa — neutral."""
    match = re.match(r"\s*\[([a-z]+)\]\s*", reply)
    if match and match.group(1) in VOICE_EMOTIONS:
        return match.group(1), reply[match.end():]
    return "neutral", re.sub(r"^\s*\[[^\]]{1,20}\]\s*", "", reply)


def to_spoken(text: str) -> str:
    """Ovozga aytiladigan toza matn: chizma bloklari, LaTeX, markdown belgilari olib tashlanadi; uzun bo'lsa qisqaradi."""
    text = re.sub(r"```.*?(```|$)", " ", text, flags=re.S)
    text = re.sub(r"\$+([^$]*)\$+", r"\1", text)
    text = re.sub(r"\\ce\{([^}]*)\}", r"\1", text)
    text = text.replace("<=>", " qaytar reaksiyada ").replace("->", " dan hosil bo'ladi ")
    text = re.sub(r"[*_#`>|\\]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > SPOKEN_MAX_CHARS:
        cut = text[:SPOKEN_MAX_CHARS]
        end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
        text = cut[: end + 1] if end > SPOKEN_MAX_CHARS // 2 else cut.rstrip() + "..."
    return text


def _history_key(user_id: uuid.UUID, subject: str, mode: VoiceMode) -> str:
    return f"voice_hist:{user_id}:{subject}:{mode.value}"


@router.get("/options", response_model=VoiceOptionsOut)
async def voice_options(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    premium = settings.realtime_voice_for_students or await ai_budget.is_admin(db, user_id)
    return VoiceOptionsOut(premium_allowed=premium, turns_per_day=settings.voice_turns_per_user_per_day)


@router.post("/turn", response_model=VoiceTurnOut)
async def voice_turn(
    payload: VoiceTurnIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Tejamkor ovozli rejimning bitta navbati: o'quvchi gapi -> ustoz javobi (matn + kayfiyat + MP3)."""
    await use_daily(redis, db, user_id, voice_turn_limit())
    subject = payload.subject.value
    key = _history_key(user_id, subject, payload.mode)
    if payload.reset:
        await redis.delete(key)
    history = [json.loads(item) for item in await redis.lrange(key, 0, -1)]

    instructions = await _instructions(db, user_id, subject, payload.mode) + ECONOMY_VOICE_ADDENDUM
    user_text = payload.text.strip() or START_MESSAGE
    messages = [{"role": "system", "content": instructions}, *history, {"role": "user", "content": user_text}]
    try:
        response = await openai_service._text_completion(messages, temperature=0.7)
    except Exception as exc:  # noqa: BLE001 — sababini o'quvchiga tushunarli qilib aytamiz
        logger.warning("Ovozli javob yozilmadi", exc_info=True)
        raise HTTPException(status_code=502, detail=openai_service.describe_error_for_student(exc)) from exc

    emotion, reply = split_emotion(response.choices[0].message.content or "")
    spoken = to_spoken(reply) or "Kechirasiz, qaytadan aytib bera olasizmi?"

    async with redis.pipeline(transaction=True) as pipe:
        pipe.rpush(key, json.dumps({"role": "user", "content": user_text}), json.dumps({"role": "assistant", "content": spoken}))
        pipe.ltrim(key, -HISTORY_MAX_MESSAGES, -1)
        pipe.expire(key, HISTORY_TTL_SECONDS)
        await pipe.execute()

    audio_base64 = None
    try:
        audio = await openai_service.text_to_speech(spoken, voice=settings.economy_voice_name)
        audio_base64 = base64.b64encode(audio).decode("ascii")
    except Exception:  # noqa: BLE001 — ovoz bo'lmasa ham subtitr ko'rinadi
        logger.warning("Ovozli javob TTS bo'lmadi", exc_info=True)
    return VoiceTurnOut(text=spoken, emotion=emotion, audio_base64=audio_base64)


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
