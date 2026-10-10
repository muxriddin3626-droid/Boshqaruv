"""Kirish (login): telefon raqam + parol -> JWT token."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.schemas import LoginIn, LoginOut
from app.services import auth_service
from app.services.rate_limit import RateLimitExceededError, get_client_ip

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
async def login(
    payload: LoginIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    try:
        user = await auth_service.authenticate(db, redis, payload.phone, payload.password, get_client_ip(request))
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring.",
        ) from exc

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telefon raqam yoki parol noto'g'ri")

    return LoginOut(access_token=create_access_token(user.id), full_name=user.full_name, subjects=user.subjects)
