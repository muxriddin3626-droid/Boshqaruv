"""Real-time ovozli suhbat uchun ephemeral session endpoint."""
from fastapi import APIRouter, HTTPException

from app.models.schemas import VoiceSessionOut
from app.services.openai_service import create_realtime_voice_session

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])


@router.post("/session", response_model=VoiceSessionOut)
async def create_voice_session():
    """
    Frontend WebRTC ulanishni boshlashdan oldin shu endpointni chaqiradi.
    Qaytgan client_secret to'g'ridan-to'g'ri OpenAI Realtime API bilan
    SDP almashinuvi uchun ishlatiladi (backend orqali audio oqmaydi).
    """
    try:
        session = await create_realtime_voice_session()
    except Exception as exc:  # noqa: BLE001 — tashqi API xatosini frontendga tarjima qilamiz
        raise HTTPException(status_code=502, detail=f"Realtime sessiya yaratib bo'lmadi: {exc}") from exc

    client_secret = session["client_secret"]
    return VoiceSessionOut(
        client_secret=client_secret["value"],
        expires_at=client_secret["expires_at"],
        model=session["model"],
    )
