"""
OpenAI integratsiyasi:
1. Matnli chat javoblari — streaming (SSE) orqali.
2. Realtime Speech-to-Speech ovozli suhbat uchun ephemeral session token —
   frontend shu tokendan foydalanib OpenAI Realtime API bilan to'g'ridan-to'g'ri
   WebRTC ulanish o'rnatadi (backend faqat token beradi, audio backend orqali
   oqmaydi — bu kechikishni minimal qiladi).
3. Strukturaviy (JSON) generatsiya: flashcard'lar, maqsadli test savollari va
   PDF konspekt uchun qisqacha xulosalar.
4. Whisper (ovoz->matn), Vision OCR (rasm->matn) va TTS (matn->ovoz) —
   Exam Crowdsourcing (Modul 6) va Audio Lecture Engine (Modul 8) uchun.
"""
import base64
import io
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


# =============================================================================
# MODUL 6: EXAM CROWDSOURCING & MEMORY ENGINE — Whisper (ovoz) + Vision (OCR)
# =============================================================================


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Ovozli xabarni Whisper orqali matnga aylantiradi (o'quvchi imtihon savolini aytib beradi)."""
    response = await client.audio.transcriptions.create(
        model=settings.openai_whisper_model,
        file=(filename, io.BytesIO(audio_bytes)),
    )
    return response.text


async def ocr_image_to_text(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Rasmga tushirilgan imtihon savolini (GPT-4o vision) so'zma-so'z matnga o'giradi."""
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{encoded_image}"

    response = await client.chat.completions.create(
        model=settings.openai_vision_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Sen rasmdagi imtihon savolini so'zma-so'z, hech narsa o'zgartirmasdan "
                    "matnga o'giruvchi OCR yordamchisan. Faqat savol matnini qaytar, boshqa "
                    "izoh yozma."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Ushbu rasmdagi imtihon savolini matnga o'gir:"},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        temperature=0.0,
    )
    return response.choices[0].message.content or ""


async def reconstruct_exam_question(subject: str, grade: int | None, raw_text: str) -> dict:
    """
    Xom (imlo xatoli/tugallanmagan) savol matnini to'liq, ilmiy jihatdan to'g'ri savolga
    tiklaydi, mavzusi va qiyinchilik darajasini (A/A+) aniqlaydi, mukammal yechim tayyorlaydi.
    """
    system_instruction = (
        "Sen O'zbekiston DTM/BMBA va Milliy Sertifikat imtihonlaridan chiqqan savollarni "
        "qayta tiklovchi ekspertsan. O'quvchi yozgan/aytgan xom matn imlo xatoli yoki "
        "tugallanmagan bo'lishi mumkin — sen uni aniq va to'liq ilmiy savol shakliga "
        "keltirasan, so'ng mukammal, tekshirilgan yechim tayyorlaysan. "
        "Faqat quyidagi JSON formatda javob ber: "
        '{"reconstructed_question": "...", "topic": "...", "difficulty_level": "A yoki A+", '
        '"cert_level": "...", "verified_solution": "..."}. '
        "'topic' — aniq mavzu nomi (masalan 'Alkanlar izomeriyasi'), 'cert_level' — imtihon "
        "turi (masalan 'Milliy Sertifikat' yoki 'DTM/BMBA'; noaniq bo'lsa 'DTM/BMBA' deb yoz). "
        "Formulalarni KaTeX formatida yoz ($...$). O'zbek tilida yoz."
    )
    user_content = f"Fan: {subject}\nSinf: {grade or 'nomaʼlum'}\n\nXom matn:\n{raw_text}"
    return await _generate_json(system_instruction, user_content)


# =============================================================================
# MODUL 7: AUTONOMOUS AI RESEARCHER & PEDAGOGICAL INNOVATOR ENGINE
# =============================================================================


async def generate_innovation(subject: str, category: str, innovation_type: str) -> dict:
    """Zaif bo'lim uchun yangi tushuntirish usuli yoki hech qachon uchramagan 'tuzoq masala' yaratadi."""
    if innovation_type == "TRICK_QUESTION":
        focus = (
            "Avval hech qachon uchramagan, gibrid (bir necha tushunchani birlashtirgan) "
            "'tuzoq masala' (trick question) yarat — o'quvchini odatiy xatoga yo'ldiruvchi, "
            "lekin to'g'ri yechimi mavjud va aniq."
        )
    else:
        focus = (
            "Ushbu mavzuni tushuntirish uchun sodda, hayotiy analogiyaga asoslangan YANGI "
            "tushuntirish usulini (formula-klyuch) yarat — darslikdagi standart usuldan farqli, "
            "lekin ilmiy jihatdan to'g'ri va yodda qolarli."
        )
    system_instruction = (
        f"Sen pedagogik innovatsiyalar generatsiya qiluvchi ekspert metodistsan. {focus} "
        "Faqat quyidagi JSON formatda javob ber: "
        '{"content": "...", "explanation": "..."}. '
        "'content' — usul/masalaning o'zi, 'explanation' — nega samarali ekanligi yoki "
        "(tuzoq masala bo'lsa) to'liq yechim tushuntirishi. KaTeX formatidan foydalan. "
        "O'zbek tilida yoz."
    )
    user_content = f"Fan: {subject}\nO'quvchilar ko'p qiynaladigan bo'lim: {category}"
    return await _generate_json(system_instruction, user_content)


async def synthesize_research_insight(topic: str, raw_snippets: str) -> dict:
    """Web-qidiruv natijalaridan o'qituvchi uchun foydali bitta xulosani ajratib oladi."""
    system_instruction = (
        "Sen DTM/BMBA va Milliy Sertifikat metodikasi bo'yicha tadqiqotchi yordamchisan. "
        "Quyida internetdan topilgan qisqa parchalar berilgan. Ular orasidan o'qituvchi "
        "uchun haqiqatan foydali, yangi va aniq bo'lgan bitta xulosani ajratib ol. Agar "
        "hech qanday foydali/ishonchli ma'lumot topilmasa, is_relevant=false qil. "
        'Faqat quyidagi JSON formatda javob ber: {"insight": "...", "is_relevant": true/false}. '
        "O'zbek tilida yoz."
    )
    user_content = f"Mavzu: {topic}\n\nTopilgan parchalar:\n{raw_snippets}"
    return await _generate_json(system_instruction, user_content)


# =============================================================================
# MODUL 8: AUDIO LECTURE ENGINE — matndan ovozga (TTS)
# =============================================================================


async def text_to_speech(text: str, voice: str = "onyx") -> bytes:
    """Ma'ruza matnini MP3 audio baytlariga aylantiradi."""
    response = await client.audio.speech.create(
        model=settings.openai_tts_model,
        voice=voice,
        input=text,
    )
    return response.read()
