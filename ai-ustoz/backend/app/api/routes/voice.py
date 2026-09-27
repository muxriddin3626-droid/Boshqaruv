"""Real-time ovozli suhbat uchun ephemeral session endpoint (tutor va debate rejimlari)."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.schemas import VoiceMode, VoiceSessionIn, VoiceSessionOut
from app.prompts.debate_prompt import build_debate_system_prompt
from app.prompts.exam_feedback_prompt import build_exam_feedback_addendum
from app.prompts.system_prompt import build_system_prompt
from app.services import exam_pipeline_service, progress_service
from app.services.openai_service import DEFAULT_VOICE_INSTRUCTIONS, create_realtime_voice_session

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


@router.post("/session", response_model=VoiceSessionOut)
async def create_voice_session(
    payload: VoiceSessionIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Frontend WebRTC ulanishni boshlashdan oldin shu endpointni chaqiradi.
    Qaytgan client_secret to'g'ridan-to'g'ri OpenAI Realtime API bilan
    SDP almashinuvi uchun ishlatiladi (backend orqali audio oqmaydi).

    `mode`:
    - "tutor"  — oddiy AI Ustoz repetitorlik rejimi (system_prompt.py), shu
      jumladan Exam Feedback (Modul 6) qo'shimchasi bilan — imtihondan
      chiqqan o'quvchi shu yerda ham ovozli fikr-mulohaza bera oladi.
    - "debate" — MUNOZARA rejimi (2-modul): AI atayin noto'g'ri gipoteza \
      aytadi, o'quvchi uni ovozli ravishda rad etishi kerak (debate_prompt.py).
    """
    student_ctx = await progress_service.get_student_context(db, user_id, payload.subject.value)

    if payload.mode == VoiceMode.DEBATE:
        instructions = build_debate_system_prompt(student_ctx)
    else:
        exam_status = await exam_pipeline_service.get_exam_status(db, user_id)
        is_exam_today = exam_status.target_exam_date == date.today()
        exam_addendum = build_exam_feedback_addendum(
            exam_status.exam_completed, exam_status.feedback_provided, is_exam_today
        )
        instructions = (build_system_prompt(student_ctx) or DEFAULT_VOICE_INSTRUCTIONS) + exam_addendum

    try:
        session = await create_realtime_voice_session(instructions=instructions)
    except Exception as exc:  # noqa: BLE001 — tashqi API xatosini frontendga tarjima qilamiz
        raise HTTPException(status_code=502, detail=f"Realtime sessiya yaratib bo'lmadi: {exc}") from exc

    client_secret = session["client_secret"]
    return VoiceSessionOut(
        client_secret=client_secret["value"],
        expires_at=client_secret["expires_at"],
        model=session["model"],
        mode=payload.mode,
    )
