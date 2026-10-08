"""Kirish so'rovnomasi: yangi o'quvchi profilini yaratish va kirish testi."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.schemas import OnboardingIn, OnboardingOut, PlacementQuestionOut, PlacementResultOut
from app.services import onboarding_service
from app.services.rate_limit import RateLimitExceededError, ensure_below_limit, get_client_ip, register_hit

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])
settings = get_settings()

REGISTRATION_WINDOW_SECONDS = 60 * 60


@router.get("/placement-test", response_model=list[PlacementQuestionOut])
async def get_placement_test(subjects: Literal["kimyo", "biologiya", "ikkalasi"] = "ikkalasi"):
    return onboarding_service.get_placement_questions(onboarding_service.expand_subjects(subjects))


@router.post("", response_model=OnboardingOut, status_code=status.HTTP_201_CREATED)
async def complete_onboarding(
    payload: OnboardingIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """So'rovnoma javoblaridan akkaunt yaratadi va kirish tokenini qaytaradi."""
    ip_key = f"register_ip:{get_client_ip(request)}"
    try:
        await ensure_below_limit(redis, ip_key, settings.registrations_per_ip_per_hour)
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Bu tarmoqdan juda ko'p akkaunt ochildi. Bir soatdan keyin qayta urinib ko'ring.",
        ) from exc

    try:
        user, summary, plan = await onboarding_service.complete_onboarding(db, payload)
    except onboarding_service.PhoneAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu telefon raqam bilan akkaunt allaqachon bor. 'Kirish' orqali kiring.",
        ) from exc

    await register_hit(redis, ip_key, REGISTRATION_WINDOW_SECONDS)
    return OnboardingOut(
        access_token=create_access_token(user.id),
        user_id=user.id,
        placement=[PlacementResultOut(**item) for item in summary],
        plan_weeks=plan.plan["total_weeks"],
        first_topic=next((t["topic"] for t in plan.plan["topics"] if t["first_week"] is not None), None),
    )
