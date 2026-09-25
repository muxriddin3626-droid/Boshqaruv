"""
Darslik PDF faylini o'qib, matnni bo'laklarga (chunk) bo'lib, OpenAI orqali
embedding oladi va `knowledge_chunks` jadvaliga yozadi — bu jadval
`rag_service.py` tomonidan suhbat paytida qidiriladi (RAG bilim bazasi).

Ishlatish (docker compose bilan):
    docker compose exec backend python scripts/ingest_textbook.py \\
        --pdf /path/to/kimyo-9-sinf.pdf --subject kimyo --grade 9

    # Avval chunk'larni ko'rib chiqish uchun (OpenAI/DB'ga tegmaydi, bepul):
    docker compose exec backend python scripts/ingest_textbook.py \\
        --pdf /path/to/kimyo-9-sinf.pdf --subject kimyo --grade 9 --dry-run

    # Xuddi shu darslikni qayta yuklasangiz, eski chunk'larini o'chirib qayta yozish:
    docker compose exec backend python scripts/ingest_textbook.py \\
        --pdf /path/to/kimyo-9-sinf.pdf --subject kimyo --grade 9 --replace

Eslatma: PDF skanerlangan (matn qatlamisiz, faqat rasm) sahifalardan iborat
bo'lsa, `extract_pages` bo'sh natija qaytaradi — bunday fayllar uchun OCR
bosqichi kerak (bu skript OCR qilmaydi).
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

# `python scripts/ingest_textbook.py` ishga tushirilganda Python faqat
# `scripts/` papkasini sys.path'ga qo'shadi — `app` paketi esa bir daraja
# yuqorida (`backend/`). Shuning uchun uni qo'lda qo'shib qo'yamiz.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openai import AsyncOpenAI  # noqa: E402
from pypdf import PdfReader  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
EMBEDDING_BATCH_SIZE = 100

SUBJECT_LABELS = {"kimyo": "Kimyo", "biologiya": "Biologiya"}


def extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Har bir sahifadan matn chiqaradi, bo'sh (masalan, sof rasm) sahifalarni tashlab ketadi."""
    reader = PdfReader(str(pdf_path))
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ""
        cleaned = re.sub(r"[ \t]+", " ", raw).strip()
        if cleaned:
            pages.append((i, cleaned))
    return pages


def build_chunks(pages: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Har bir sahifa matnini (page_num, chunk_text) juftliklariga bo'ladi.

    Chunk chegaralari CHUNK_SIZE atrofida, imkon qadar gap oxirida (". ")
    kesiladi; ketma-ket chunk'lar CHUNK_OVERLAP belgi bilan ustma-ust
    tushadi (bo'lim chegarasida kontekst uzilib qolmasligi uchun).
    """
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


async def embed_batch(client: AsyncOpenAI, model: str, texts: list[str]) -> list[list[float]]:
    response = await client.embeddings.create(model=model, input=texts)
    return [item.embedding for item in response.data]


async def main(args: argparse.Namespace) -> None:
    settings = get_settings()
    pdf_path = Path(args.pdf).expanduser().resolve()
    if not pdf_path.exists():
        raise SystemExit(f"Fayl topilmadi: {pdf_path}")

    pages = extract_pages(pdf_path)
    if not pages:
        raise SystemExit(
            "PDF'dan matn chiqmadi — skanerlangan (faqat rasm) sahifalar bo'lishi mumkin, OCR kerak."
        )

    chunks = build_chunks(pages)
    print(f"{len(pages)} sahifa -> {len(chunks)} ta chunk ajratildi.")

    if args.dry_run:
        print("\n--dry-run: OpenAI/DB'ga yozilmaydi, faqat namuna ko'rsatiladi.\n")
        for page_num, chunk in chunks[:5]:
            preview = chunk[:300] + ("..." if len(chunk) > 300 else "")
            print(f"[{page_num}-bet] ({len(chunk)} belgi)\n{preview}\n")
        print(f"... jami {len(chunks)} ta chunk.")
        return

    subject_label = SUBJECT_LABELS[args.subject]
    source_title_prefix = args.source_title or f"{args.grade}-sinf {subject_label} darsligi"

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    async with AsyncSessionLocal() as db:
        if args.replace:
            result = await db.execute(
                text(
                    "DELETE FROM knowledge_chunks "
                    "WHERE subject = :subject AND grade = :grade AND source_title LIKE :prefix"
                ),
                {"subject": args.subject, "grade": args.grade, "prefix": f"{source_title_prefix}%"},
            )
            await db.commit()
            print(f"Eski chunk'lar o'chirildi: {result.rowcount}")

        inserted = 0
        for batch_start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
            batch = chunks[batch_start : batch_start + EMBEDDING_BATCH_SIZE]
            embeddings = await embed_batch(client, settings.openai_embedding_model, [c for _, c in batch])
            for (page_num, chunk_text_value), embedding in zip(batch, embeddings):
                await db.execute(
                    text(
                        "INSERT INTO knowledge_chunks (subject, grade, source_title, chunk_text, embedding) "
                        "VALUES (:subject, :grade, :source_title, :chunk_text, (:embedding)::vector)"
                    ),
                    {
                        "subject": args.subject,
                        "grade": args.grade,
                        "source_title": f"{source_title_prefix} — {page_num}-bet",
                        "chunk_text": chunk_text_value,
                        "embedding": str(embedding),
                    },
                )
                inserted += 1
            await db.commit()
            print(f"  {inserted}/{len(chunks)} chunk yozildi...")

    print(f"\nTayyor: {inserted} ta chunk `knowledge_chunks` jadvaliga yozildi.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pdf", required=True, help="Darslik PDF fayli yo'li")
    parser.add_argument("--subject", required=True, choices=["kimyo", "biologiya"])
    parser.add_argument("--grade", required=True, type=int, choices=range(5, 12))
    parser.add_argument(
        "--source-title",
        default=None,
        help="Manba nomi prefiksi (default: '<grade>-sinf <Fan> darsligi')",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Shu manba prefiksiga mos eski chunk'larni o'chirib, qayta yozish",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="OpenAI/DB'ga tegmasdan, faqat ajratilgan chunk namunalarini ko'rsatish",
    )
    asyncio.run(main(parser.parse_args()))
