"""
Supabase Auth JWT tekshiruvi.

Frontend Supabase orqali login qiladi va har bir requestda
`Authorization: Bearer <supabase_jwt>` header yuboradi. Bu yerda token
imzosi tekshirilib, ichidagi `sub` (user_id) ajratib olinadi.
"""
import uuid

from fastapi import Header, HTTPException
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


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
