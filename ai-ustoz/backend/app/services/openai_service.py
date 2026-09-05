"""
OpenAI integratsiyasi:
1. Matnli chat javoblari — streaming (SSE) orqali.
2. Realtime Speech-to-Speech ovozli suhbat uchun ephemeral session token —
   frontend shu tokendan foydalanib OpenAI Realtime API bilan to'g'ridan-to'g'ri
   WebRTC ulanish o'rnatadi (backend faqat token beradi, audio backend orqali
   oqmaydi — bu kechikishni minimal qiladi).
"""
from collections.abc import AsyncGenerator

import httpx
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key)

OPENAI_REALTIME_SESSIONS_URL = "https://api.openai.com/v1/realtime/sessions"


def _build_messages(system_prompt: str, history: list[dict], user_message: str, rag_context: str) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)

    user_content = user_message
    if rag_context:
        user_content = (
            f"{user_message}\n\n"
            f"--- Darslikdan olingan qo'shimcha manba (kerak bo'lsa foydalan, "
            f"lekin javobni o'zingcha qayta tushuntirib ber) ---\n{rag_context}"
        )
    messages.append({"role": "user", "content": user_content})
    return messages


async def stream_chat_response(
    system_prompt: str, history: list[dict], user_message: str, rag_context: str = ""
) -> AsyncGenerator[str, None]:
    """Modeldan token-token (delta) javob oqimini qaytaradi — SSE endpoint uchun."""
    messages = _build_messages(system_prompt, history, user_message, rag_context)

    stream = await client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=messages,
        temperature=0.6,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def create_realtime_voice_session(voice: str = "alloy") -> dict:
    """
    OpenAI Realtime API uchun bir martalik (ephemeral) client_secret yaratadi.

    Frontend shu client_secret bilan RTCPeerConnection orqali to'g'ridan-to'g'ri
    OpenAI serveriga ulanadi (WebRTC SDP offer/answer almashinuvi).
    """
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        response = await http_client.post(
            OPENAI_REALTIME_SESSIONS_URL,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openai_realtime_model,
                "voice": voice,
                "modalities": ["audio", "text"],
                "instructions": (
                    "Sen AI Ustoz — qattiqqo'l, lekin g'amxo'r o'zbek repetitori. "
                    "O'zbek tilida gapir, qisqa va aniq javob ber, o'quvchini "
                    "mustaqil fikrlashga undab savol ber."
                ),
            },
        )
        response.raise_for_status()
        return response.json()
