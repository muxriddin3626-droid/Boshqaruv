"""O'quvchi progressi: 'qayerda to'xtagan', weak_spots va test natijalari."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.session import get_db
from app.models.database import TestResult
from app.models.schemas import ProgressOut, SubjectSchema, TestResultIn, WeakSpotOut
from app.services import progress_service

router = APIRouter(prefix="/api/v1/progress", tags=["progress"])


@router.get("/{subject}", response_model=ProgressOut)
async def get_progress(
    subject: SubjectSchema,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Frontend o'quvchi tizimga kirganda shu endpointni chaqirib, bosh sahifada
    "Kecha shu mavzuda to'xtagandik, davom etamiz" bannerini ko'rsatadi.
    """
    ctx = await progress_service.get_student_context(db, user_id, subject.value)
    return ProgressOut(
        subject=subject,
        current_lesson_title=ctx.last_lesson_title,
        current_step=ctx.last_lesson_step,
        average_score=ctx.average_score,
        weak_spots=[
            WeakSpotOut(topic=ws.topic, mistake_description=ws.mistake_description, severity=ws.severity, resolved=False)
            for ws in ctx.weak_spots
        ],
        updated_at=None,
    )


@router.post("/test-results")
async def submit_test_result(
    payload: TestResultIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """O'quvchi mock-test yoki oraliq test topshirganda natijani saqlaydi."""
    result = TestResult(
        user_id=user_id,
        subject=payload.subject.value,
        test_type=payload.test_type,
        score=payload.score,
        max_score=payload.max_score,
        details=payload.details,
    )
    db.add(result)
    await db.commit()
    return {"status": "saved", "result_id": str(result.id)}
