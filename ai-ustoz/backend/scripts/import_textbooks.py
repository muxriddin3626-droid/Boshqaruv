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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.database import Textbook  # noqa: E402
from app.services import textbook_service  # noqa: E402

# GPT-4o vision: bitta skaner sahifa (~1600 px) taxminan shuncha dollar.
OCR_COST_PER_PAGE = 0.009


async def main(args: argparse.Namespace) -> None:
    directory = Path(args.dir) if args.dir else textbook_service.bundled_dir()
    books = textbook_service.scan_bundled(directory, args.only)
    if not books:
        raise SystemExit(f"PDF topilmadi: {directory}/<kimyo|biologiya>/*.pdf")

    total_ocr = 0
    print(f"Papka: {directory}\n")
    for book in books:
        if book["grade"] is None:
            print(f"  ! {book['path'].name}: fayl nomidan sinf aniqlanmadi — nomiga sinfni qo'shing (masalan kimyo_9_uzb.pdf). O'tkazib yuborildi.")
            continue
        total, with_text, empty = await asyncio.to_thread(textbook_service.read_text_pages, book["path"])
        ocr = 0 if args.no_ocr else min(len(empty), textbook_service.settings.textbook_ocr_max_pages)
        total_ocr += ocr
        kind = "skaner" if not with_text else ("aralash" if empty else "matnli")
        print(f"  {book['title']:<38} {book['subject']:<9} {book['grade']:>2}-sinf  {total:>3} bet  {kind:<7}  OCR: {ocr} bet")
    cost = "bepul (Tesseract)" if textbook_service.uses_free_ocr() else f"≈ ${total_ocr * OCR_COST_PER_PAGE:.2f} (taxminan)"
    print(f"\nOCR jami: {total_ocr} bet, {cost}. Embedding narxi juda kichik (sentlar).")
    if args.dry_run:
        print("\n--dry-run: hech narsa yozilmadi.")
        return

    for book in books:
        if book["grade"] is None:
            continue
        path: Path = book["path"]
        async with AsyncSessionLocal() as db:
            existing = (
                await db.execute(
                    select(Textbook).where(Textbook.subject == book["subject"], Textbook.filename == path.name, Textbook.size_bytes == path.stat().st_size)
                )
            ).scalar_one_or_none()
        if existing and existing.status == "ready":
            print(f"\n= {book['title']}: allaqachon tayyor ({existing.chunks_count} bo'lak) — o'tkazib yuborildi.")
            continue
        textbook_id = await textbook_service.register_bundled(book, use_ocr=not args.no_ocr)
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
