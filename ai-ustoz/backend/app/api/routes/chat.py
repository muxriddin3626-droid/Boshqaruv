"""Chat endpoint — matnli suhbat, streaming javob bilan."""
import uuid
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import ChatMessage
from app.models.schemas import ChatMessageIn, SubjectSchema
from app.prompts.exam_feedback_prompt import build_exam_feedback_addendum
from app.prompts.innovation_prompt import build_innovation_addendum
from app.prompts.system_prompt import build_system_prompt
from app.services import exam_pipeline_service, progress_service, rag_service, research_service, weakness_service
from app.services.openai_service import stream_chat_response
from app.services.session_service import SessionService

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

# Bir xil innovatsiya bir o'quvchiga qayta-qayta ko'rsatilmasligi uchun (Redis'da "ko'rsatildi" belgisi)
INNOVATION_SHOWN_TTL_SECONDS = 60 * 60 * 24


async def _build_prompt_addendums(
    db: AsyncSession, redis: Redis, user_id: uuid.UUID, subject: str
) -> str:
    """Exam Feedback (Modul 6) va Innovative Teacher (Modul 7) qo'shimchalarini yig'ib qaytaradi."""
    addendum = ""

    exam_status = await exam_pipeline_service.get_exam_status(db, user_id)
    is_exam_today = exam_status.target_exam_date == date.today()
    addendum += build_exam_feedback_addendum(
        exam_status.exam_completed, exam_status.feedback_provided, is_exam_today
    )

    weak_categories = await weakness_service.get_weakest_categories(db, user_id, subject, limit=2)
    innovation = await research_service.get_relevant_innovation(db, subject, weak_categories)
    if innovation is not None:
        shown_key = f"innovation:shown:{user_id}:{innovation.id}"
        already_shown = await redis.get(shown_key)
        if not already_shown:
            addendum += build_innovation_addendum(innovation)
            await redis.set(shown_key, "1", ex=INNOVATION_SHOWN_TTL_SECONDS)

    return addendum


@router.post("")
async def send_chat_message(
    payload: ChatMessageIn,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """
    O'quvchi xabarini qabul qiladi va AI Ustoz javobini SSE (text/event-stream)
    orqali token-token qaytaradi. Frontend shu oqimni o'qib, chatga jonli chiqaradi.
    """
    session_service = SessionService(redis)
    subject = payload.subject.value

    student_ctx = await progress_service.get_student_context(db, user_id, subject)
    system_prompt = build_system_prompt(student_ctx) + await _build_prompt_addendums(db, redis, user_id, subject)

    history = await session_service.get_history(user_id, subject)
    rag_context = await rag_service.retrieve_relevant_context(
        db, subject, student_ctx.current_grade, payload.message
    )

    async def event_stream():
        full_response = ""
        async for delta in stream_chat_response(system_prompt, history, payload.message, rag_context):
            full_response += delta
            yield f"data: {delta}\n\n"

        # Suhbat tugagach: qisqa muddatli Redis tarixini yangilaymiz
        await session_service.append_message(user_id, subject, "user", payload.message)
        await session_service.append_message(user_id, subject, "assistant", full_response)

        # Uzoq muddatli arxiv (analitika uchun)
        db.add(ChatMessage(user_id=user_id, subject=subject, role="user", content=payload.message))
        db.add(ChatMessage(user_id=user_id, subject=subject, role="assistant", content=full_response))
        await db.commit()

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.delete("/{subject}/history")
async def clear_chat_history(
    subject: SubjectSchema,
    user_id: uuid.UUID = Depends(get_current_user_id),
    redis: Redis = Depends(get_redis),
):
    """O'quvchi 'suhbatni tozalash' tugmasini bosganda qisqa muddatli xotirani tozalaydi."""
    session_service = SessionService(redis)
    await session_service.clear_history(user_id, subject.value)
    return {"status": "cleared"}
