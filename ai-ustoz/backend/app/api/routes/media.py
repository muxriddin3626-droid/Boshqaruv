"""Lokal saqlangan audio fayllarni imzoli havola orqali berish (Range qo'llab-quvvatlanadi — oldinga/orqaga surish)."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services import media_storage

router = APIRouter(prefix="/api/v1/media", tags=["media"])


@router.get("/audio/{relative_path:path}")
async def get_audio(relative_path: str, exp: int, sig: str):
    if not media_storage.verify_signature(relative_path, exp, sig):
        raise HTTPException(status_code=403, detail="Havola eskirgan yoki noto'g'ri")
    try:
        path = media_storage.local_path(relative_path)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Fayl topilmadi") from exc
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    return FileResponse(path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})
