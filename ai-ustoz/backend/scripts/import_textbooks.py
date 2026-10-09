"""
Repodagi hamma darsliklarni (`data/textbooks/<fan>/*.pdf`) bitta buyruq bilan bilim
bazasiga yuklaydi — ilovadagi "Darsliklar" bo'limi bilan bir xil jarayon: matn,
skaner sahifalar uchun OCR, bo'laklash, embedding. Yuklangan kitoblar "Darsliklar"
bo'limida ko'rinadi (u yerdan o'chirish/qayta urinish mumkin).

Sinf fayl nomidan olinadi (`biologiya_10_uzb.pdf` -> 10, `5-sinf.pdf` -> 5), fan — papkadan.
Allaqachon tayyor bo'lgan kitob qayta yuklanmaydi.

Ishlatish (docker compose bilan):
    # Avval nima yuklanishini va OCR narxini ko'rish (bepul, hech narsa yozilmaydi):
    docker compose exec backend python scripts/import_textbooks.py --dry-run

    # Hammasini yuklash:
    docker compose exec backend python scripts/import_textbooks.py

    # Faqat bittasini:
    docker compose exec backend python scripts/import_textbooks.py --only kimyo_8

    # Skaner kitoblarni OCR qilmasdan (bepul, lekin ular o'tkazib yuboriladi):
    docker compose exec backend python scripts/import_textbooks.py --no-ocr
"""
import argparse
import asyncio
import os
import re
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pypdf import PdfReader  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.database import Textbook  # noqa: E402
from app.services import textbook_service  # noqa: E402

SUBJECTS = {"kimyo", "biologiya"}
# GPT-4o vision: bitta skaner sahifa (~1600 px) taxminan shuncha dollar.
OCR_COST_PER_PAGE = 0.009

# Fayl nomi -> chiroyli nom (topilmasa, nomdan avtomatik yasaladi).
TITLES = {
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


def default_dir() -> Path:
    env = os.environ.get("TEXTBOOKS_DIR")
    if env:
        return Path(env)
    repo = Path(__file__).resolve().parents[2] / "data" / "textbooks"  # lokal: ai-ustoz/data/textbooks
    return repo if repo.exists() else Path("/data/textbooks")  # docker compose: ./data -> /data


def grade_from_name(name: str) -> int | None:
    """`_8_`, `-10-`, `5-sinf` kabi alohida turgan 5..11 son; `11zon` kabi so'z ichidagi raqam hisoblanmaydi."""
    for match in re.finditer(r"(?:^|[_\-\s])(\d{1,2})(?=$|[_\-\s.(]|-?sinf)", name):
        value = int(match.group(1))
        if 5 <= value <= 11:
            return value
    return None


def title_for(stem: str, subject: str, grade: int) -> str:
    for key, title in TITLES.items():
        if stem.startswith(key):
            return title
    words = re.sub(r"_(uzb|11zon|compressed)\b", "", stem)
    words = re.sub(r"[_\-]+|\(\d+\)", " ", words).strip()
    return f"{words[:1].upper()}{words[1:]} ({grade}-sinf)" if words else f"{subject.capitalize()} {grade}-sinf"


def scan(directory: Path, only: str | None) -> list[dict]:
    books = []
    for path in sorted(directory.glob("*/*.pdf")):
        subject = path.parent.name
        if subject not in SUBJECTS or (only and only.lower() not in path.name.lower()):
            continue
        grade = grade_from_name(path.stem)
        books.append({"path": path, "subject": subject, "grade": grade, "title": title_for(path.stem, subject, grade or 0) if grade else None})
    return books


async def main(args: argparse.Namespace) -> None:
    directory = Path(args.dir) if args.dir else default_dir()
    books = scan(directory, args.only)
    if not books:
        raise SystemExit(f"PDF topilmadi: {directory}/<kimyo|biologiya>/*.pdf")

    total_ocr = 0
    print(f"Papka: {directory}\n")
    for book in books:
        if book["grade"] is None:
            print(f"  ! {book['path'].name}: fayl nomidan sinf aniqlanmadi — nomiga sinfni qo'shing (masalan kimyo_9_uzb.pdf). O'tkazib yuborildi.")
            continue
        total, with_text, empty = await asyncio.to_thread(textbook_service.read_text_pages, book["path"])
        book.update(pages=total, empty=len(empty))
        ocr = 0 if args.no_ocr else min(len(empty), textbook_service.settings.textbook_ocr_max_pages)
        total_ocr += ocr
        kind = "skaner" if len(with_text) == 0 else ("aralash" if empty else "matnli")
        print(f"  {book['title']:<38} {book['subject']:<9} {book['grade']:>2}-sinf  {total:>3} bet  {kind:<7}  OCR: {ocr} bet")
    print(f"\nOCR jami: {total_ocr} bet ≈ ${total_ocr * OCR_COST_PER_PAGE:.2f} (taxminan). Embedding narxi juda kichik (sentlar).")
    if args.dry_run:
        print("\n--dry-run: hech narsa yozilmadi.")
        return

    for book in books:
        if book["grade"] is None:
            continue
        path: Path = book["path"]
        size = path.stat().st_size
        async with AsyncSessionLocal() as db:
            existing = (
                await db.execute(
                    select(Textbook).where(Textbook.subject == book["subject"], Textbook.filename == path.name, Textbook.size_bytes == size)
                )
            ).scalar_one_or_none()
            if existing and existing.status == "ready":
                print(f"\n= {book['title']}: allaqachon tayyor ({existing.chunks_count} bo'lak) — o'tkazib yuborildi.")
                continue
            if existing:
                textbook_id = existing.id
                existing.use_ocr = not args.no_ocr
                await db.commit()
            else:
                textbook_id = uuid.uuid4()
                target_dir = textbook_service.textbooks_dir()
                target_dir.mkdir(parents=True, exist_ok=True)
                target = target_dir / f"{textbook_id}.pdf"
                await asyncio.to_thread(shutil.copyfile, path, target)
                now = datetime.now(timezone.utc)
                db.add(
                    Textbook(
                        id=textbook_id,
                        subject=book["subject"],
                        grade=book["grade"],
                        title=book["title"],
                        filename=path.name,
                        file_path=str(target),
                        size_bytes=size,
                        use_ocr=not args.no_ocr,
                        status="queued",
                        pages_total=book["pages"],
                        created_at=now,
                        updated_at=now,
                    )
                )
                await db.commit()
        print(f"\n> {book['title']}: qayta ishlanmoqda...", flush=True)
        await textbook_service.process(textbook_id)
        async with AsyncSessionLocal() as db:
            done = await db.get(Textbook, textbook_id)
            if done.status == "ready":
                print(f"  ✓ tayyor: {done.chunks_count} bo'lak (matn {done.pages_text} bet, OCR {done.pages_ocr} bet, o'tkazildi {done.pages_skipped} bet)")
            else:
                print(f"  ✗ xato: {done.error}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", default=None, help="Darsliklar papkasi (ichida kimyo/ va biologiya/)")
    parser.add_argument("--only", default=None, help="Faqat nomida shu matn bor fayllar")
    parser.add_argument("--no-ocr", action="store_true", help="Skaner sahifalarni OCR qilmaslik (bepul)")
    parser.add_argument("--dry-run", action="store_true", help="Faqat ro'yxat va narxni ko'rsatish")
    asyncio.run(main(parser.parse_args()))
