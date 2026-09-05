"""
OpenAI integratsiyasi:
1. Matnli chat javoblari — streaming (SSE) orqali.
2. Realtime Speech-to-Speech ovozli suhbat uchun ephemeral session token —
   frontend shu tokendan foydalanib OpenAI Realtime API bilan to'g'ridan-to'g'ri
   WebRTC ulanish o'rnatadi (backend faqat token beradi, audio backend orqali
   oqmaydi — bu kechikishni minimal qiladi).
3. Strukturaviy (JSON) generatsiya: flashcard'lar, maqsadli test savollari va
   PDF konspekt uchun qisqacha xulosalar.
"""
import json
from collections.abc import AsyncGenerator
from typing import Any

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


DEFAULT_VOICE_INSTRUCTIONS = (
    "Sen AI Ustoz — qattiqqo'l, lekin g'amxo'r o'zbek repetitori. "
    "O'zbek tilida gapir, qisqa va aniq javob ber, o'quvchini "
    "mustaqil fikrlashga undab savol ber."
)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def create_realtime_voice_session(instructions: str = DEFAULT_VOICE_INSTRUCTIONS, voice: str = "alloy") -> dict:
    """
    OpenAI Realtime API uchun bir martalik (ephemeral) client_secret yaratadi.

    Frontend shu client_secret bilan RTCPeerConnection orqali to'g'ridan-to'g'ri
    OpenAI serveriga ulanadi (WebRTC SDP offer/answer almashinuvi).

    `instructions` — rejimga qarab almashadi: oddiy repetitorlik yoki
    Live Voice Debate (`debate_prompt.build_debate_system_prompt`).
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
                "instructions": instructions,
            },
        )
        response.raise_for_status()
        return response.json()


async def _generate_json(system_instruction: str, user_content: str) -> dict[str, Any]:
    """OpenAI'dan qat'iy JSON formatdagi javob so'raydigan umumiy yordamchi funksiya."""
    response = await client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content},
        ],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def generate_flashcards(subject: str, lesson_title: str, lesson_content: str, card_count: int) -> list[dict]:
    """
    Dars matni asosida qisqa, aniq savol-javob flashcard'lar generatsiya qiladi
    (Anki uslubi: old taraf — atama/savol, orqa taraf — qisqa tushuntirish).
    """
    system_instruction = (
        "Sen o'quv materialidan Anki uslubidagi flashcard yaratuvchi yordamchisan. "
        "Faqat quyidagi JSON formatda javob ber: "
        '{"cards": [{"front": "...", "back": "..."}]}. '
        "Har bir 'front' — qisqa savol yoki atama, 'back' — 1-2 jumlali aniq javob "
        "(kerak bo'lsa KaTeX formatida formula bilan, masalan $C_6H_6$). "
        "O'zbek tilida yoz."
    )
    user_content = (
        f"Fan: {subject}\nMavzu: {lesson_title}\nDars matni:\n{lesson_content}\n\n"
        f"Shu matndan {card_count} ta eng muhim flashcard yarat."
    )
    result = await _generate_json(system_instruction, user_content)
    return result.get("cards", [])[:card_count]


async def generate_targeted_quiz(subject: str, categories: list[str], question_count: int) -> list[dict]:
    """
    Faqat berilgan zaif bo'limlardan (categories) DTM uslubidagi ko'p tanlovli
    savollar generatsiya qiladi — "Zaif Nuqtalarni Ishlash" moduli uchun.
    """
    system_instruction = (
        "Sen DTM (BMBA) uslubidagi test savollari tuzuvchi ekspertsan. "
        "Faqat quyidagi JSON formatda javob ber: "
        '{"questions": [{"category": "...", "question": "...", '
        '"options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}]}. '
        "Har bir savolda aniq 4 ta variant bo'lsin, faqat bittasi to'g'ri. "
        "Formulalarni KaTeX formatida yoz ($...$). O'zbek tilida yoz."
    )
    user_content = (
        f"Fan: {subject}\nO'quvchi aynan shu bo'limlarda qiynalmoqda: {', '.join(categories)}.\n"
        f"Shu bo'limlardan {question_count} ta savol tuz (bo'limlar orasida taxminan teng taqsimlab)."
    )
    result = await _generate_json(system_instruction, user_content)
    return result.get("questions", [])[:question_count]


async def summarize_for_conspect(subject: str, conversation_text: str, weak_spots_text: str) -> dict:
    """
    Suhbat tarixidan konspekt uchun eng muhim formula/qoida/xatolarni ajratib
    beradi (PDF konspekt generatoriga xom material sifatida ishlatiladi).
    """
    system_instruction = (
        "Sen o'quv suhbatidan qisqa konspekt tuzuvchi yordamchisan. "
        "Faqat quyidagi JSON formatda javob ber: "
        '{"formulas": ["..."], "rules": ["..."], "mistakes": ["..."]}. '
        "Har bir ro'yxat elementi qisqa va aniq bo'lsin (1 jumla). O'zbek tilida yoz."
    )
    user_content = (
        f"Fan: {subject}\n\nSuhbat matni:\n{conversation_text}\n\n"
        f"O'quvchining bilingan zaif nuqtalari:\n{weak_spots_text}"
    )
    return await _generate_json(system_instruction, user_content)
