"""
Uzun matnni ovozga aylantirish. OpenAI TTS bitta so'rovda 4096 belgigacha
qabul qiladi — matn gap chegaralari bo'yicha bo'linadi, bo'laklar parallel
o'giriladi va MP3'lar ketma-ket ulanadi (MP3 freymlari ulanganda ijro uzluksiz).
"""
import asyncio
import io
import re

from mutagen.mp3 import MP3

from app.services import openai_service

TTS_CHUNK_LIMIT = 3800
TTS_CONCURRENCY = 3
WORDS_PER_SECOND = 2.3  # MP3 sarlavhasi o'qilmasa taxmin uchun

_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")


def split_for_tts(text: str, limit: int = TTS_CHUNK_LIMIT) -> list[str]:
    """Avval paragraf, keyin gap, oxirida so'z chegarasida bo'ladi; har bo'lak `limit`dan oshmaydi."""
    chunks: list[str] = []
    current = ""

    def push(piece: str) -> None:
        nonlocal current
        candidate = f"{current} {piece}".strip() if current else piece
        if len(candidate) <= limit:
            current = candidate
            return
        if current:
            chunks.append(current)
        current = piece

    for paragraph in (p.strip() for p in text.split("\n")):
        if not paragraph:
            continue
        for sentence in _SENTENCE_END.split(paragraph):
            while len(sentence) > limit:  # juda uzun gap — so'z chegarasida bo'linadi
                cut = sentence.rfind(" ", 0, limit)
                cut = cut if cut > 0 else limit
                push(sentence[:cut].strip())
                sentence = sentence[cut:].strip()
            if sentence:
                push(sentence)
    if current:
        chunks.append(current)
    return chunks


def mp3_duration(data: bytes, text: str = "") -> float:
    try:
        return float(MP3(io.BytesIO(data)).info.length)
    except Exception:  # noqa: BLE001 — sarlavha o'qilmasa so'z soniga qarab taxmin
        return len(text.split()) / WORDS_PER_SECOND


async def synthesize(text: str, voice: str = "onyx") -> tuple[bytes, float]:
    """(mp3 baytlar, davomiylik soniyada)."""
    chunks = split_for_tts(text)
    if not chunks:
        raise ValueError("Ovozga aylantiriladigan matn bo'sh")
    semaphore = asyncio.Semaphore(TTS_CONCURRENCY)

    async def one(chunk: str) -> bytes:
        async with semaphore:
            return await openai_service.text_to_speech(chunk, voice)

    parts = await asyncio.gather(*(one(chunk) for chunk in chunks))
    duration = sum(mp3_duration(part, chunk) for part, chunk in zip(parts, chunks))
    return b"".join(parts), duration
