"""Lokal saqlangan media fayllarni (audio, rasm) imzoli havola orqali berish. Range qo'llab-quvvatlanadi (audioni surish)."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services import media_storage

router = APIRouter(prefix="/api/v1/media", tags=["media"])

MEDIA_TYPES = {".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


@router.get("/files/{relative_path:path}")
async def get_file(relative_path: str, exp: int, sig: str):
    if not media_storage.verify_signature(relative_path, exp, sig):
        raise HTTPException(status_code=403, detail="Havola eskirgan yoki noto'g'ri")
    try:
        path = media_storage.local_path(relative_path)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Fayl topilmadi") from exc
    media_type = MEDIA_TYPES.get(path.suffix.lower())
    if media_type is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})
