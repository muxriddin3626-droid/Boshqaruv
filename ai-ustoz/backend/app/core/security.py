"""
Autentifikatsiya: JWT tokenlar, parol xeshlash va telefon raqamni normallashtirish.

Har bir himoyalangan requestda `Authorization: Bearer <jwt>` header keladi;
token imzosi va muddati tekshirilib, ichidagi `sub` (user_id) ajratib olinadi.
"""
import base64
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# scrypt parametrlari: n=2^14, r=8 -> ~16 MB xotira, bitta tekshiruv ~50 ms.
# Brute-force'ni qimmatlashtiradi, lekin oddiy login uchun sezilmaydi.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64


def create_access_token(user_id: uuid.UUID) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    return jwt.encode({"sub": str(user_id), "exp": expires_at}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_SCRYPT_DKLEN
    )
    return "$".join(
        [
            "scrypt",
            str(_SCRYPT_N),
            str(_SCRYPT_R),
            str(_SCRYPT_P),
            base64.b64encode(salt).decode(),
            base64.b64encode(digest).decode(),
        ]
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored_hash.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode(),
            salt=base64.b64decode(salt_b64),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def normalize_uz_phone(raw: str) -> str:
    """'90 123-45-67', '+998901234567', '998901234567' -> '+998901234567'."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("998"):
        digits = digits[3:]
    if len(digits) != 9:
        raise ValueError("Telefon raqam noto'g'ri: +998 dan keyin 9 ta raqam bo'lishi kerak")
    return f"+998{digits}"


async def get_current_user_id(authorization: str = Header(...)) -> uuid.UUID:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header noto'g'ri formatda")

    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], options={"verify_aud": False}
        )
        return uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Token yaroqsiz yoki muddati o'tgan") from exc
