"""
RAG (Retrieval-Augmented Generation) — 5-11 sinf DTM darsliklaridagi matn va
rasm/sxema havolalarini javobga in'ektsiya qilish.

Ishlash tartibi:
1. Darslik matnlari oldindan bo'laklarga (chunk) bo'linib, embedding olinadi
   va `knowledge_chunks` jadvaliga yoziladi (ingestion pipeline alohida
   skript — bu servis faqat retrieval qismiga javobgar).
2. Foydalanuvchi savoli embedding'ga aylantiriladi.
3. pgvector cosine distance (`<=>`) orqali eng yaqin bo'laklar tortib olinadi.
"""
from openai import AsyncOpenAI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings

settings = get_settings()
client = AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_query(query: str) -> list[float]:
    response = await client.embeddings.create(model=settings.openai_embedding_model, input=query)
    return response.data[0].embedding


async def retrieve_relevant_context(
    db: AsyncSession, subject: str, grade: int, query: str, top_k: int = 3
) -> str:
    """Savolga eng mos darslik bo'laklarini topib, promptga qo'shiladigan matn qaytaradi."""
    embedding = await embed_query(query)

    # pgvector: `<=>` cosine distance operatori (kichikroq qiymat = ko'proq o'xshash)
    stmt = text(
        """
        SELECT source_title, chunk_text, image_url
        FROM knowledge_chunks
        WHERE subject = :subject AND grade = :grade
        ORDER BY embedding <=> (:embedding)::vector
        LIMIT :top_k
        """
    )
    rows = (
        await db.execute(
            stmt,
            {"subject": subject, "grade": grade, "embedding": str(embedding), "top_k": top_k},
        )
    ).fetchall()

    if not rows:
        return ""

    blocks = []
    for row in rows:
        block = f'[Manba: "{row.source_title}"]\n{row.chunk_text}'
        if row.image_url:
            block += f"\n(Sxema/rasm havolasi: {row.image_url} — javobda shu rasmga ishora qil)"
        blocks.append(block)

    return "\n\n".join(blocks)
