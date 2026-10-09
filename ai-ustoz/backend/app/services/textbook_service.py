"""
Darsliklarni bilim bazasiga (RAG) yuklash: admin ilova orqali PDF yuklaydi, server
fonda uni qayta ishlaydi va `knowledge_chunks` jadvaliga yozadi — AI Ustoz darsda
shu bo'laklardan foydalanadi (`rag_service`).

Bosqichlar:
1. Matn: har bir sahifadan matn qatlami olinadi (pypdf).
2. OCR: matni yo'q (skanerlangan) sahifalardagi rasm GPT-4o vision bilan o'qiladi
   (pullik — `use_ocr` va `textbook_ocr_max_pages` bilan cheklanadi).
3. Bo'laklash va embedding: matn ~1000 belgilik bo'laklarga bo'linadi, embedding
   olinadi va darslikka bog'lab yoziladi (darslik o'chirilsa — bo'laklar ham o'chadi).

Bir vaqtda bitta darslik qayta ishlanadi (OCR xarajati va API limitlari uchun),
qolganlari navbatda ("queued") turadi.
"""
import asyncio
import io
import logging
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from openai import AsyncOpenAI
from pypdf import PdfReader
from sqlalchemy import delete, select, text, update

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.database import Textbook
from app.services import media_storage, openai_service

logger = logging.getLogger(__name__)
settings = get_settings()

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
EMBEDDING_BATCH_SIZE = 100
# Shundan kam belgili sahifa "matnsiz" (skaner) hisoblanadi: ko'pincha faqat sahifa raqami chiqadi.
MIN_TEXT_CHARS = 40
OCR_CONCURRENCY = 4
OCR_MAX_SIDE = 1600

_lock = asyncio.Lock()
_background_tasks: set[asyncio.Task] = set()


def textbooks_dir() -> Path:
    # Media ichida, lekin media route PDF bermaydi (MEDIA_TYPES da yo'q) — darsliklar ochiq havolada chiqmaydi.
    return media_storage.local_path("private/textbooks")


def is_admin_phone(phone: str | None) -> bool:
    return bool(phone) and phone in settings.admin_phone_set


# --- Matn va bo'laklar ----------------------------------------------------------------


def read_text_pages(pdf_path: Path) -> tuple[int, list[tuple[int, str]], list[int]]:
    """(sahifalar soni, [(sahifa, matn)], matnsiz sahifalar raqamlari)."""
    reader = PdfReader(str(pdf_path))
    with_text: list[tuple[int, str]] = []
    empty: list[int] = []
    for number, page in enumerate(reader.pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception:  # noqa: BLE001 — buzuq sahifa butun kitobni to'xtatmasin
            raw = ""
        cleaned = re.sub(r"[ \t]+", " ", raw).strip()
        if len(cleaned) >= MIN_TEXT_CHARS:
            with_text.append((number, cleaned))
        else:
            empty.append(number)
    return len(reader.pages), with_text, empty


def build_chunks(pages: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Sahifa matnlarini (sahifa, bo'lak) juftliklariga bo'ladi: ~CHUNK_SIZE, imkon qadar gap oxirida,
    ketma-ket bo'laklar CHUNK_OVERLAP belgi bilan ustma-ust (bo'lim chegarasida kontekst uzilmasin)."""
    chunks: list[tuple[int, str]] = []
    for page_num, page_text in pages:
        start = 0
        length = len(page_text)
        while start < length:
            end = min(start + CHUNK_SIZE, length)
            if end < length:
                boundary = page_text.rfind(". ", start, end)
                if boundary != -1 and boundary > start + CHUNK_SIZE // 2:
                    end = boundary + 1
            chunk = page_text[start:end].strip()
            if chunk:
                chunks.append((page_num, chunk))
            if end >= length:
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def page_image(pdf_path: Path, page_number: int) -> tuple[bytes, str] | None:
    """Skaner sahifadagi eng katta rasm — JPEG ko'rinishida, uzun tomoni OCR_MAX_SIDE dan oshmaydi."""
    from PIL import Image

    reader = PdfReader(str(pdf_path))
    images = reader.pages[page_number - 1].images
    if not images:
        return None
    largest = max(images, key=lambda image: len(image.data))
    picture = Image.open(io.BytesIO(largest.data))
    picture.thumbnail((OCR_MAX_SIDE, OCR_MAX_SIDE))
    if picture.mode not in ("RGB", "L"):
        picture = picture.convert("RGB")
    out = io.BytesIO()
    picture.save(out, format="JPEG", quality=85)
    return out.getvalue(), "image/jpeg"


# --- Fon jarayoni ----------------------------------------------------------------------


async def _set(textbook_id: uuid.UUID, **values) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(update(Textbook).where(Textbook.id == textbook_id).values(updated_at=datetime.now(timezone.utc), **values))
        await db.commit()


async def _ocr_pages(textbook_id: uuid.UUID, pdf_path: Path, numbers: list[int]) -> list[tuple[int, str]]:
    semaphore = asyncio.Semaphore(OCR_CONCURRENCY)
    done = 0

    async def one(number: int) -> tuple[int, str]:
        async with semaphore:
            try:
                found = await asyncio.to_thread(page_image, pdf_path, number)
                if found is None:
                    return number, ""
                return number, await openai_service.ocr_textbook_page(*found)
            except Exception:  # noqa: BLE001 — bitta sahifa o'qilmasa, qolganlari davom etadi
                logger.warning("OCR: %s-sahifa o'qilmadi (%s)", number, textbook_id, exc_info=True)
                return number, ""

    results: list[tuple[int, str]] = []
    for finished in asyncio.as_completed([one(number) for number in numbers]):
        number, page_text = await finished
        cleaned = re.sub(r"[ \t]+", " ", page_text).strip()
        if len(cleaned) >= MIN_TEXT_CHARS:
            results.append((number, cleaned))
        done += 1
        if done % 5 == 0 or done == len(numbers):
            await _set(textbook_id, progress_done=done)
    return sorted(results)


async def process(textbook_id: uuid.UUID) -> None:
    async with _lock:
        async with AsyncSessionLocal() as db:
            textbook = await db.get(Textbook, textbook_id)
            if textbook is None:
                return
            subject, grade, title, pdf_path, use_ocr = textbook.subject, textbook.grade, textbook.title, Path(textbook.file_path), textbook.use_ocr
        try:
            await _set(textbook_id, status="processing", stage="matn", progress_done=0, progress_total=0, error=None)
            total, pages, empty = await asyncio.to_thread(read_text_pages, pdf_path)
            await _set(textbook_id, pages_total=total, pages_text=len(pages))

            ocr_targets = empty[: settings.textbook_ocr_max_pages] if use_ocr else []
            skipped = len(empty) - len(ocr_targets)
            if ocr_targets:
                await _set(textbook_id, stage="ocr", progress_done=0, progress_total=len(ocr_targets))
                ocr_pages = await _ocr_pages(textbook_id, pdf_path, ocr_targets)
                skipped += len(ocr_targets) - len(ocr_pages)
                pages = sorted(pages + ocr_pages)
                await _set(textbook_id, pages_ocr=len(ocr_pages))
            await _set(textbook_id, pages_skipped=skipped)

            if not pages:
                reason = "skaner sahifalar uchun OCR o'chirilgan" if empty and not use_ocr else "sahifalardan matn chiqmadi"
                raise ValueError(f"Darslikdan matn olinmadi ({reason}).")

            chunks = build_chunks(pages)
            await _set(textbook_id, stage="embedding", progress_done=0, progress_total=len(chunks))
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            async with AsyncSessionLocal() as db:
                await db.execute(text("DELETE FROM knowledge_chunks WHERE textbook_id = :id"), {"id": textbook_id})
                await db.commit()
                for start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
                    batch = chunks[start : start + EMBEDDING_BATCH_SIZE]
                    response = await client.embeddings.create(model=settings.openai_embedding_model, input=[c for _, c in batch])
                    rows = [
                        {
                            "subject": subject,
                            "grade": grade,
                            "source_title": f"{title} — {page_num}-bet"[:255],
                            "chunk_text": chunk,
                            "embedding": str(item.embedding),
                            "textbook_id": textbook_id,
                        }
                        for (page_num, chunk), item in zip(batch, response.data)
                    ]
                    await db.execute(
                        text(
                            "INSERT INTO knowledge_chunks (subject, grade, source_title, chunk_text, embedding, textbook_id) "
                            "VALUES (:subject, :grade, :source_title, :chunk_text, (:embedding)::vector, :textbook_id)"
                        ),
                        rows,
                    )
                    await db.commit()
                    await _set(textbook_id, progress_done=start + len(batch))
            await _set(textbook_id, status="ready", stage=None, chunks_count=len(chunks))
            logger.info("Darslik tayyor: %s (%s bo'lak)", title, len(chunks))
        except Exception as exc:  # noqa: BLE001 — sabab admin sahifasida ko'rsatiladi
            logger.exception("Darslik qayta ishlanmadi: %s", textbook_id)
            async with AsyncSessionLocal() as db:
                await db.execute(text("DELETE FROM knowledge_chunks WHERE textbook_id = :id"), {"id": textbook_id})
                await db.commit()
            message = str(exc) if isinstance(exc, ValueError) else explain_error(exc)
            await _set(textbook_id, status="failed", stage=None, chunks_count=0, error=message[:500])


def explain_error(exc: Exception) -> str:
    """OpenAI xatolarini admin tushunadigan o'zbekcha matnga aylantiradi."""
    import openai

    if isinstance(exc, openai.AuthenticationError):
        return "OpenAI kaliti noto'g'ri yoki o'chirilgan — Render'da OPENAI_API_KEY ni tekshiring."
    if isinstance(exc, openai.RateLimitError):
        if "insufficient_quota" in str(exc):
            return "OpenAI hisobida mablag' tugagan — platform.openai.com -> Billing bo'limida hisobni to'ldiring."
        return "OpenAI so'rovlar chegarasiga yetildi — birozdan keyin \"Qayta urinish\" ni bosing."
    if isinstance(exc, openai.APIConnectionError):
        return "OpenAI'ga ulanib bo'lmadi (internet) — keyinroq \"Qayta urinish\" ni bosing."
    return f"Qayta ishlashda xato: {type(exc).__name__}"


def schedule(textbook_id: uuid.UUID) -> None:
    task = asyncio.create_task(process(textbook_id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def recover_interrupted() -> None:
    """Server qayta ishga tushganda yarim qolgan darsliklar — "xato" (admin "Qayta urinish" bosadi)."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Textbook)
            .where(Textbook.status.in_(["queued", "processing"]))
            .values(status="failed", stage=None, error="Server qayta ishga tushdi — \"Qayta urinish\" tugmasini bosing.")
        )
        await db.commit()


async def remove(textbook: Textbook) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Textbook).where(Textbook.id == textbook.id))
        await db.commit()
    Path(textbook.file_path).unlink(missing_ok=True)


# --- Ilova ichidagi (repodagi) darsliklar ---------------------------------------------------

SUBJECTS = ("kimyo", "biologiya")
# Fayl nomi boshi -> chiroyli nom (topilmasa, nomdan avtomatik yasaladi).
BUNDLED_TITLES = {
    "5-sinf": "Biologiya 5-sinf",
    "botanika_6": "Botanika 6-sinf",
    "zoologiya_7": "Zoologiya 7-sinf",
    "odam_va_uning_salomatligi_8": "Odam va uning salomatligi 8-sinf",
    "biologiya_9": "Biologiya 9-sinf",
    "biologiya_10": "Biologiya 10-sinf",
    "biologiya_11": "Biologiya 11-sinf",
    "kimyo_7": "Kimyo 7-sinf",
    "kimyo_8": "Kimyo 8-sinf",
    "kimyo_9": "Kimyo 9-sinf",
    "organik_kimyo_10": "Organik kimyo 10-sinf",
    "umumiy_kimyo_11": "Umumiy kimyo 11-sinf",
}


def bundled_dir() -> Path:
    env = os.environ.get("TEXTBOOKS_DIR")
    if env:
        return Path(env)
    repo = Path(__file__).resolve().parents[3] / "data" / "textbooks"  # lokal: ai-ustoz/data/textbooks
    return repo if repo.exists() else Path("/data/textbooks")  # Docker (Render) obrazida


def grade_from_name(name: str) -> int | None:
    """`_8_`, `-10-`, `5-sinf` kabi alohida turgan 5..11 son; `11zon` kabi so'z ichidagi raqam hisoblanmaydi."""
    for match in re.finditer(r"(?:^|[_\-\s])(\d{1,2})(?=$|[_\-\s.(]|-?sinf)", name):
        value = int(match.group(1))
        if 5 <= value <= 11:
            return value
    return None


def title_for(stem: str, subject: str, grade: int) -> str:
    for key, title in BUNDLED_TITLES.items():
        if stem.startswith(key):
            return title
    words = re.sub(r"_(uzb|11zon|compressed)\b", "", stem)
    words = re.sub(r"[_\-]+|\(\d+\)", " ", words).strip()
    return f"{words[:1].upper()}{words[1:]} ({grade}-sinf)" if words else f"{subject.capitalize()} {grade}-sinf"


def scan_bundled(directory: Path | None = None, only: str | None = None) -> list[dict]:
    """`<papka>/<fan>/*.pdf` — fan, sinf (fayl nomidan) va nom bilan. Sinf aniqlanmasa grade=None."""
    directory = directory or bundled_dir()
    books = []
    for path in sorted(directory.glob("*/*.pdf")):
        subject = path.parent.name
        if subject not in SUBJECTS or (only and only.lower() not in path.name.lower()):
            continue
        grade = grade_from_name(path.stem)
        books.append({"path": path, "subject": subject, "grade": grade, "title": title_for(path.stem, subject, grade) if grade else None})
    return books


async def pending_bundled() -> list[dict]:
    """Hali bilim bazasiga qo'shilmagan (yoki xato bo'lgan) ilova ichidagi darsliklar."""
    books = [book for book in scan_bundled() if book["grade"]]
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Textbook.filename, Textbook.size_bytes, Textbook.status))).all()
    done = {(name, size) for name, size, status in rows if status in ("ready", "queued", "processing")}
    return [book for book in books if (book["path"].name, book["path"].stat().st_size) not in done]


async def register_bundled(book: dict, use_ocr: bool) -> uuid.UUID:
    """Darslikni yopiq papkaga nusxalab, yozuv yaratadi (yoki xato bo'lganini qayta navbatga qo'yadi)."""
    path: Path = book["path"]
    size = path.stat().st_size
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(Textbook).where(Textbook.subject == book["subject"], Textbook.filename == path.name, Textbook.size_bytes == size))
        ).scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if existing:
            existing.use_ocr = use_ocr
            existing.status = "queued"
            existing.error = None
            existing.updated_at = now
            await db.commit()
            return existing.id
        textbook_id = uuid.uuid4()
        target_dir = textbooks_dir()
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{textbook_id}.pdf"
        await asyncio.to_thread(shutil.copyfile, path, target)
        pages = len((await asyncio.to_thread(PdfReader, str(target))).pages)
        db.add(
            Textbook(
                id=textbook_id,
                subject=book["subject"],
                grade=book["grade"],
                title=book["title"],
                filename=path.name,
                file_path=str(target),
                size_bytes=size,
                use_ocr=use_ocr,
                status="queued",
                pages_total=pages,
                created_at=now,
                updated_at=now,
            )
        )
        await db.commit()
        return textbook_id
