"""Darsliklarni bilim bazasiga yuklash (faqat admin): PDF yuklash, holatini kuzatish, qayta urinish, o'chirish."""
import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.database import Textbook, User
from app.models.schemas import SubjectSchema, TextbookAccessOut, TextbookImportOut, TextbookOut
from app.services import textbook_service

router = APIRouter(prefix="/api/v1/textbooks", tags=["textbooks"])
settings = get_settings()

READ_CHUNK = 1024 * 1024


async def _is_admin(db: AsyncSession, user_id: uuid.UUID) -> bool:
    user = await db.get(User, user_id)
    return user is not None and textbook_service.is_admin_phone(user.phone)


async def require_admin(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)) -> uuid.UUID:
    if not await _is_admin(db, user_id):
        raise HTTPException(status_code=403, detail="Darslik yuklash faqat administratorlarga ruxsat etilgan")
    return user_id


def _out(textbook: Textbook) -> TextbookOut:
    return TextbookOut.model_validate(textbook, from_attributes=True)


@router.get("/access", response_model=TextbookAccessOut)
async def access(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    is_admin = await _is_admin(db, user_id)
    pending = [book["title"] for book in await textbook_service.pending_bundled()] if is_admin else []
    return TextbookAccessOut(is_admin=is_admin, max_mb=settings.textbook_max_mb, ocr_max_pages=settings.textbook_ocr_max_pages, ocr_free=textbook_service.uses_free_ocr(), bundled_pending=pending)


@router.post("/import-bundled", response_model=TextbookImportOut, status_code=202)
async def import_bundled(use_ocr: bool = True, _: uuid.UUID = Depends(require_admin)):
    """Ilova ichidagi (repodagi) hali qo'shilmagan darsliklarni navbatga qo'yadi — bittadan qayta ishlanadi."""
    queued = []
    for book in await textbook_service.pending_bundled():
        textbook_service.schedule(await textbook_service.register_bundled(book, use_ocr=use_ocr))
        queued.append(book["title"])
    return TextbookImportOut(queued=queued)


@router.get("", response_model=list[TextbookOut])
async def list_textbooks(_: uuid.UUID = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Textbook).order_by(Textbook.created_at.desc()).execution_options(populate_existing=True))).scalars()
    return [_out(row) for row in rows]


@router.post("", response_model=TextbookOut, status_code=202)
async def upload_textbook(
    file: UploadFile = File(...),
    subject: SubjectSchema = Form(...),
    grade: int = Form(..., ge=5, le=11),
    title: str = Form("", max_length=200),
    use_ocr: bool = Form(True),
    user_id: uuid.UUID = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """PDF diskka oqim bilan yoziladi (xotiraga to'liq yuklanmaydi), keyin fonda qayta ishlanadi."""
    textbook_id = uuid.uuid4()
    directory = textbook_service.textbooks_dir()
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{textbook_id}.pdf"
    limit = settings.textbook_max_mb * 1024 * 1024
    size = 0
    try:
        with target.open("wb") as out:
            while chunk := await file.read(READ_CHUNK):
                if size == 0 and not chunk.startswith(b"%PDF-"):
                    raise HTTPException(status_code=400, detail="Bu PDF fayl emas")
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f"Fayl {settings.textbook_max_mb} MB dan katta")
                out.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="Fayl bo'sh")
        try:
            pages = len((await asyncio.to_thread(PdfReader, str(target))).pages)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="PDF ochilmadi — fayl buzilgan bo'lishi mumkin") from exc
        filename = (file.filename or "darslik.pdf")[:255]
        duplicate = (
            await db.execute(
                select(Textbook).where(Textbook.subject == subject.value, Textbook.grade == grade, Textbook.filename == filename, Textbook.size_bytes == size)
            )
        ).scalar_one_or_none()
        if duplicate:
            raise HTTPException(status_code=409, detail=f"Bu darslik allaqachon yuklangan: {duplicate.title}")
    except HTTPException:
        target.unlink(missing_ok=True)
        raise

    clean_title = title.strip() or filename.rsplit(".", 1)[0].replace("_", " ")
    now = datetime.now(timezone.utc)
    textbook = Textbook(
        id=textbook_id,
        subject=subject.value,
        grade=grade,
        title=clean_title[:200],
        filename=filename,
        file_path=str(target),
        size_bytes=size,
        use_ocr=use_ocr,
        status="queued",
        pages_total=pages,
        uploaded_by=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(textbook)
    await db.commit()
    textbook_service.schedule(textbook_id)
    return _out(textbook)


@router.post("/{textbook_id}/retry", response_model=TextbookOut, status_code=202)
async def retry(textbook_id: uuid.UUID, _: uuid.UUID = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    textbook = await db.get(Textbook, textbook_id, populate_existing=True)
    if textbook is None:
        raise HTTPException(status_code=404, detail="Darslik topilmadi")
    if textbook.status in ("queued", "processing"):
        raise HTTPException(status_code=409, detail="Darslik hozir qayta ishlanmoqda")
    textbook.status = "queued"
    textbook.error = None
    textbook.restarts = 0
    textbook.updated_at = datetime.now(timezone.utc)
    await db.commit()
    textbook_service.schedule(textbook_id)
    return _out(textbook)


@router.delete("/{textbook_id}", status_code=204)
async def remove(textbook_id: uuid.UUID, _: uuid.UUID = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    textbook = await db.get(Textbook, textbook_id)
    if textbook is None:
        raise HTTPException(status_code=404, detail="Darslik topilmadi")
    if textbook.status == "processing":
        raise HTTPException(status_code=409, detail="Qayta ishlash tugashini kuting")
    await textbook_service.remove(textbook)
    return Response(status_code=204)
