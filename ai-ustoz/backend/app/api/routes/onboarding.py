"""Kirish so'rovnomasi: yangi o'quvchi profilini yaratish va kirish testi."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.db.session import get_db
from app.models.schemas import OnboardingIn, OnboardingOut, PlacementQuestionOut, PlacementResultOut
from app.services import onboarding_service

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.get("/placement-test", response_model=list[PlacementQuestionOut])
async def get_placement_test(subjects: Literal["kimyo", "biologiya", "ikkalasi"] = "ikkalasi"):
    return onboarding_service.get_placement_questions(onboarding_service.expand_subjects(subjects))


@router.post("", response_model=OnboardingOut, status_code=status.HTTP_201_CREATED)
async def complete_onboarding(payload: OnboardingIn, db: AsyncSession = Depends(get_db)):
    """So'rovnoma javoblaridan akkaunt yaratadi va kirish tokenini qaytaradi."""
    try:
        user, summary = await onboarding_service.complete_onboarding(db, payload)
    except onboarding_service.PhoneAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu telefon raqam bilan akkaunt allaqachon bor. 'Kirish' orqali kiring.",
        ) from exc
    return OnboardingOut(
        access_token=create_access_token(user.id),
        user_id=user.id,
        placement=[PlacementResultOut(**item) for item in summary],
    )
