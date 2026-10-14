"""
Media fayllarni (ma'ruza audiosi, dars rasmlari) saqlash: Supabase Storage sozlangan bo'lsa — o'sha yerga (ommaviy
URL), aks holda serverning o'z diskiga (`MEDIA_DIR`).

Lokal fayllar ochiq emas: ular vaqtinchalik imzoli havola
(`/api/v1/media/files/<yo'l>?exp=...&sig=...`) orqali beriladi — `<audio>` tegi
Authorization sarlavhasini yubora olmaydi, shuning uchun ruxsat havolaning
o'zida (HMAC) bo'ladi. Havola nisbiy: frontend uni API manziliga qo'shadi.

Saqlangan joy bazada "ref" sifatida yoziladi: `https://...` (Supabase) yoki
`local:<nisbiy yo'l>`.
"""
import hashlib
import hmac
import time
from pathlib import Path
from urllib.parse import quote

import httpx

from app.core.config import get_settings

settings = get_settings()

LOCAL_PREFIX = "local:"
SIGNED_URL_TTL_SECONDS = 6 * 60 * 60
MEDIA_ROUTE = "/api/v1/media/files/"


def media_root() -> Path:
    return Path(settings.media_dir).resolve()


def _uses_supabase() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


async def save_audio(relative_path: str, data: bytes) -> str:
    """MP3'ni saqlaydi va bazaga yoziladigan ref qaytaradi."""
    return await save_file(relative_path, data, "audio/mpeg")


async def save_file(relative_path: str, data: bytes, content_type: str) -> str:
    """Faylni saqlaydi va bazaga yoziladigan ref qaytaradi."""
    if _uses_supabase():
        upload_url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_audio_bucket}/{relative_path}"
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                upload_url,
                content=data,
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    "apikey": settings.supabase_service_role_key,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
            response.raise_for_status()
        return f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_audio_bucket}/{relative_path}"

    target = local_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".part")
    temporary.write_bytes(data)
    temporary.replace(target)  # yarim yozilgan fayl hech qachon berilmasin
    return LOCAL_PREFIX + relative_path


def local_path(relative_path: str) -> Path:
    """Nisbiy yo'lni MEDIA_DIR ichida qoladigan absolyut yo'lga aylantiradi (`..` bilan chiqib bo'lmaydi)."""
    root = media_root()
    target = (root / relative_path).resolve()
    if root not in target.parents:
        raise ValueError("Noto'g'ri fayl yo'li")
    return target


def _signature(relative_path: str, expires: int) -> str:
    message = f"{relative_path}:{expires}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()


def verify_signature(relative_path: str, expires: int, signature: str, now: float | None = None) -> bool:
    if expires < (now if now is not None else time.time()):
        return False
    return hmac.compare_digest(_signature(relative_path, expires), signature)


def playback_url(ref: str, now: float | None = None) -> str:
    """Brauzer ochadigan havola: Supabase URL o'zi, lokal fayl uchun imzoli nisbiy havola."""
    if not ref.startswith(LOCAL_PREFIX):
        return ref
    relative_path = ref[len(LOCAL_PREFIX):]
    # Bir soat ichida bir xil havola — brauzer keshi ishlasin.
    expires = int(((now if now is not None else time.time()) // 3600) * 3600 + SIGNED_URL_TTL_SECONDS)
    return f"{MEDIA_ROUTE}{quote(relative_path)}?exp={expires}&sig={_signature(relative_path, expires)}"


async def delete_audio(ref: str) -> None:
    if ref.startswith(LOCAL_PREFIX):
        try:
            local_path(ref[len(LOCAL_PREFIX):]).unlink(missing_ok=True)
        except ValueError:
            pass
        return
    if _uses_supabase() and ref.startswith(settings.supabase_url):
        object_path = ref.split(f"/public/{settings.supabase_audio_bucket}/", 1)[-1]
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            await http_client.delete(
                f"{settings.supabase_url}/storage/v1/object/{settings.supabase_audio_bucket}/{object_path}",
                headers={"Authorization": f"Bearer {settings.supabase_service_role_key}", "apikey": settings.supabase_service_role_key},
            )
