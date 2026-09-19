"""
MODUL 7: Autonomous AI Researcher & Pedagogical Innovator Engine.

Ikki mustaqil oqim:
1. **Research Agent** — BMBA/DTM yangiliklari, yangi darslik/metodik
   qo'llanmalarni davriy skanerlaydi (`run_research_scan`), xulosalarni
   `ai_research_logs`ga yozadi. Bu yerdan asosiy bilim bazasiga (RAG
   `knowledge_chunks`) "ko'tarilishi" alohida, ataylab qo'lda/nazoratli
   bosqich (`promote_research_log_to_knowledge_base`) — avtomatik ravishda
   tekshirilmagan veb-ma'lumot to'g'ridan-to'g'ri o'quv materialiga
   aralashtirilmasligi kerak.
2. **Innovation Generator** — Weakness Radar'dagi platforma bo'yicha eng
   zaif bo'limlarga qarata yangi tushuntirish usullari va "tuzoq masalalar"
   yaratadi (`run_innovation_scan`), `ai_generated_innovations`ga yozadi.
"""
import uuid

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.database import AiGeneratedInnovation, AiResearchLog, KnowledgeChunk, Lesson
from app.services import rag_service
from app.services.openai_service import generate_innovation, synthesize_research_insight

settings = get_settings()

# (fan, qidiruv so'rovi) juftliklari — davriy skanerlash uchun standart mavzular.
DEFAULT_RESEARCH_TOPICS: list[tuple[str, str]] = [
    ("kimyo", "O'zbekiston DTM BMBA kimyo fanidan so'nggi yangiliklar"),
    ("kimyo", "yangi nashr etilgan kimyo darsligi metodik qo'llanma O'zbekiston"),
    ("biologiya", "O'zbekiston Milliy Sertifikat biologiya fanidan yangiliklar"),
    ("biologiya", "yangi biologiya darsligi metodik tavsiyalar O'zbekiston"),
]


async def search_web(query: str) -> list[dict]:
    """
    Tavily/Serper uslubidagi web-qidiruv API'siga so'rov yuboradi.

    `WEB_SEARCH_API_URL`/`WEB_SEARCH_API_KEY` sozlanmagan bo'lsa, jim
    ravishda bo'sh ro'yxat qaytaradi (research skaneri xato tashlamaydi,
    shunchaki hech narsa topmaydi) — bu orqali API kaliti bo'lmagan dev
    muhitda ham backend muammosiz ishlayveradi.
    """
    if not settings.web_search_api_url or not settings.web_search_api_key:
        return []

    async with httpx.AsyncClient(timeout=15.0) as http_client:
        response = await http_client.post(
            settings.web_search_api_url,
            json={"api_key": settings.web_search_api_key, "query": query, "max_results": 5},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])


async def run_research_scan(db: AsyncSession, topics: list[tuple[str, str]] | None = None) -> list[AiResearchLog]:
    """Har bir mavzu bo'yicha internetni skanerlaydi va foydali xulosalarni `ai_research_logs`ga yozadi."""
    created_logs: list[AiResearchLog] = []

    for subject, topic in topics or DEFAULT_RESEARCH_TOPICS:
        results = await search_web(topic)
        if not results:
            continue

        snippets = "\n\n".join(
            f"[{item.get('title', '')}]({item.get('url', '')})\n{item.get('content', '')}" for item in results[:5]
        )
        synthesis = await synthesize_research_insight(topic, snippets)
        if not synthesis.get("is_relevant"):
            continue

        log = AiResearchLog(
            source_url=results[0].get("url"),
            topic=f"{subject}: {topic}",
            extracted_insight=synthesis.get("insight", ""),
            added_to_knowledge_base=False,
        )
        db.add(log)
        created_logs.append(log)

    if created_logs:
        await db.commit()
        for log in created_logs:
            await db.refresh(log)

    return created_logs


async def promote_research_log_to_knowledge_base(
    db: AsyncSession, log_id: uuid.UUID, subject: str, grade: int
) -> AiResearchLog:
    """
    Inson (yoki nazoratli jarayon) tomonidan tasdiqlangan research xulosasini
    RAG bilim bazasiga (`knowledge_chunks`) qo'shadi — shu bilan `chat.py`
    endi shu yangi ma'lumotdan ham foydalanadi.
    """
    log = await db.get(AiResearchLog, log_id)
    if log is None:
        raise ValueError(f"Research log topilmadi: {log_id}")

    embedding = await rag_service.embed_query(log.extracted_insight)
    chunk = KnowledgeChunk(
        subject=subject,
        grade=grade,
        source_title=f"AI Research: {log.topic or 'nomaʼlum mavzu'}",
        chunk_text=log.extracted_insight,
        embedding=embedding,
    )
    db.add(chunk)

    log.added_to_knowledge_base = True
    await db.commit()
    await db.refresh(log)
    return log


async def get_platform_weakest_categories(db: AsyncSession, subject: str, limit: int = 3) -> list[str]:
    """Barcha o'quvchilar kesimida eng past o'rtacha mastery%ga ega bo'limlarni topadi."""
    stmt = text(
        """
        SELECT category, AVG(mastery_percentage) AS avg_mastery
        FROM user_weakness_radar
        WHERE subject = :subject
        GROUP BY category
        ORDER BY avg_mastery ASC
        LIMIT :limit
        """
    )
    rows = (await db.execute(stmt, {"subject": subject, "limit": limit})).fetchall()
    return [row.category for row in rows]


def _auto_validate(content: str, explanation: str) -> float:
    """Oddiy avtomatik sifat bahosi (0-1) — ikkala maydon ham mazmunli to'ldirilganini tekshiradi."""
    if len(content.strip()) > 20 and len(explanation.strip()) > 20:
        return 0.6
    return 0.2


async def generate_and_save_innovation(
    db: AsyncSession, subject: str, category: str | None = None, innovation_type: str = "NEW_METHOD"
) -> AiGeneratedInnovation:
    """Bitta yangi innovatsiya (usul yoki tuzoq masala) yaratib, bazaga saqlaydi."""
    if category is None:
        weakest = await get_platform_weakest_categories(db, subject, limit=1)
        category = weakest[0] if weakest else "Umumiy"

    generated = await generate_innovation(subject, category, innovation_type)
    content = generated.get("content", "")
    explanation = generated.get("explanation", "")

    lesson_stmt = select(Lesson).where(Lesson.subject == subject, Lesson.category == category).limit(1)
    lesson = (await db.execute(lesson_stmt)).scalar_one_or_none()

    innovation = AiGeneratedInnovation(
        subject=subject,
        topic_id=lesson.id if lesson else None,
        innovation_type=innovation_type,
        content=content,
        explanation=explanation,
        validation_score=_auto_validate(content, explanation),
    )
    db.add(innovation)
    await db.commit()
    await db.refresh(innovation)
    return innovation


async def run_innovation_scan(db: AsyncSession, subjects: tuple[str, ...] = ("kimyo", "biologiya")) -> list[AiGeneratedInnovation]:
    """Har bir fan uchun eng zaif bo'limga qarata bitta NEW_METHOD va bitta TRICK_QUESTION yaratadi."""
    created: list[AiGeneratedInnovation] = []
    for subject in subjects:
        for innovation_type in ("NEW_METHOD", "TRICK_QUESTION"):
            created.append(await generate_and_save_innovation(db, subject, innovation_type=innovation_type))
    return created


async def get_relevant_innovation(
    db: AsyncSession, subject: str, weak_categories: list[str]
) -> AiGeneratedInnovation | None:
    """O'quvchining zaif bo'limlariga mos eng so'nggi innovatsiyani topadi (bo'lmasa, fandagi eng so'nggisini)."""
    if weak_categories:
        stmt = (
            select(AiGeneratedInnovation)
            .join(Lesson, AiGeneratedInnovation.topic_id == Lesson.id, isouter=True)
            .where(AiGeneratedInnovation.subject == subject, Lesson.category.in_(weak_categories))
            .order_by(AiGeneratedInnovation.created_at.desc())
            .limit(1)
        )
        matched = (await db.execute(stmt)).scalar_one_or_none()
        if matched:
            return matched

    fallback_stmt = (
        select(AiGeneratedInnovation)
        .where(AiGeneratedInnovation.subject == subject)
        .order_by(AiGeneratedInnovation.created_at.desc())
        .limit(1)
    )
    return (await db.execute(fallback_stmt)).scalar_one_or_none()
