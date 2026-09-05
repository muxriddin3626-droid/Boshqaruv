"""Chat endpoint — matnli suhbat, streaming javob bilan."""
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user_id
from app.db.redis_client import get_redis
from app.db.session import get_db
from app.models.database import ChatMessage
from app.models.schemas import ChatMessageIn, SubjectSchema
from app.prompts.system_prompt import build_system_prompt
from app.services import progress_service, rag_service
from app.services.openai_service import stream_chat_response
from app.services.session_service import SessionService

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


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
    system_prompt = build_system_prompt(student_ctx)

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
