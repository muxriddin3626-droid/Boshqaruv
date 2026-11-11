"""
MODUL 6: Exam Crowdsourcing & Memory Engine.

Pipeline: Input (matn/ovoz/rasm) -> LLM orqali savolni tiklash (xatolarni
tuzatish, mavzu/qiyinchilik aniqlash, yechim tayyorlash) -> embedding ->
`real_exam_submitted_questions` jadvaliga saqlash. Shu bilan AI'ning
"xotira bazasi" har bir imtihondan keyin avtomatik boyib boradi.
"""
import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import RealExamSubmittedQuestion, StudentExamStatus
from app.services import rag_service
from app.services.openai_service import ocr_image_to_text, reconstruct_exam_question, transcribe_audio


async def get_exam_status(db: AsyncSession, user_id: uuid.UUID) -> StudentExamStatus:
    """O'quvchining imtihon holatini qaytaradi; mavjud bo'lmasa, standart qiymatlar bilan yaratadi."""
    status = await db.get(StudentExamStatus, user_id)
    if status is None:
        status = StudentExamStatus(user_id=user_id)
        db.add(status)
        await db.commit()
        await db.refresh(status)
    return status


async def update_exam_status(
    db: AsyncSession,
    user_id: uuid.UUID,
    target_exam_date: date | None = None,
    exam_completed: bool | None = None,
) -> StudentExamStatus:
    """
    O'quvchi "Bugun imtihonim bor" deb sanani belgilaganda yoki "Imtihondan
    chiqdim" deganda chaqiriladi. `exam_completed=True` qilib belgilash
    `feedback_provided`ni qayta `False`ga tushiradi — chunki yangi imtihon
    haqida hali fikr-mulohaza olinmagan.
    """
    status = await get_exam_status(db, user_id)

    if target_exam_date is not None:
        status.target_exam_date = target_exam_date
    if exam_completed is not None:
        status.exam_completed = exam_completed
        if exam_completed:
            status.feedback_provided = False

    await db.commit()
    await db.refresh(status)
    return status


async def _resolve_raw_text(
    raw_input_type: str,
    text_input: str | None,
    audio_bytes: bytes | None,
    image_bytes: bytes | None,
    image_mime: str,
) -> str:
    if raw_input_type == "voice":
        if not audio_bytes:
            raise ValueError("Ovozli xabar fayli yuborilmadi")
        return await transcribe_audio(audio_bytes)
    if raw_input_type == "image":
        if not image_bytes:
            raise ValueError("Rasm fayli yuborilmadi")
        return await ocr_image_to_text(image_bytes, image_mime)
    if not text_input:
        raise ValueError("Matn kiritilmadi")
    return text_input


async def submit_exam_question(
    db: AsyncSession,
    user_id: uuid.UUID,
    subject: str,
    grade: int | None,
    raw_input_type: str,
    text_input: str | None = None,
    audio_bytes: bytes | None = None,
    image_bytes: bytes | None = None,
    image_mime: str = "image/jpeg",
) -> RealExamSubmittedQuestion:
    """
    To'liq pipeline: xom kirishni matnga keltiradi -> AI orqali savolni
    tiklaydi (mavzu, qiyinchilik, yechim) -> embedding qilib bazaga saqlaydi.
    """
    raw_text = await _resolve_raw_text(raw_input_type, text_input, audio_bytes, image_bytes, image_mime)

    reconstructed = await reconstruct_exam_question(subject, grade, raw_text)
    reconstructed_question = reconstructed.get("reconstructed_question", raw_text)

    embedding = await rag_service.embed_query(reconstructed_question)

    question = RealExamSubmittedQuestion(
        user_id=user_id,
        subject=subject,
        raw_input_type=raw_input_type,
        topic=reconstructed.get("topic"),
        grade=grade,
        cert_level=reconstructed.get("cert_level"),
        difficulty_level=reconstructed.get("difficulty_level"),
        reconstructed_question=reconstructed_question,
        verified_solution=reconstructed.get("verified_solution"),
        vector_embedding=embedding,
    )
    db.add(question)

    # O'quvchi shu bilan fikr-mulohaza bergan hisoblanadi
    status = await get_exam_status(db, user_id)
    status.feedback_provided = True

    await db.commit()
    await db.refresh(question)
    return question


async def find_similar_exam_questions(db: AsyncSession, subject: str, query: str, top_k: int = 3) -> list[dict]:
    """O'xshash haqiqiy imtihon savollarini vector qidiruv orqali topadi (masalan, AI'ning 'xotira bazasi')."""
    embedding = await rag_service.embed_query(query)
    stmt = text(
        """
        SELECT topic, reconstructed_question, verified_solution, difficulty_level
        FROM real_exam_submitted_questions
        WHERE subject = :subject AND vector_embedding IS NOT NULL
        ORDER BY vector_embedding <=> (:embedding)::vector
        LIMIT :top_k
        """
    )
    rows = (
        await db.execute(stmt, {"subject": subject, "embedding": str(embedding), "top_k": top_k})
    ).fetchall()
    return [dict(row._mapping) for row in rows]
