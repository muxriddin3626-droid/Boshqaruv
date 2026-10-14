"""
Savollar bankini oldindan to'ldiradi: har bir mavzu va qiyinlik uchun bankda
kamida `--per-topic` ta tekshirilgan savol bo'lguncha AI bilan tuzadi.

Ishga tushirishdan oldin bir marta yurgizing — aks holda birinchi o'quvchilar
testni boshlaganda savollar tuzilishini (20-60 soniya) kutib qoladi.

Ishlatish (docker compose bilan):
    docker compose exec backend python scripts/fill_question_bank.py --subject kimyo --per-topic 30
    docker compose exec backend python scripts/fill_question_bank.py --subject biologiya --qtype true_false --per-topic 20
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.database import QuizQuestion  # noqa: E402
from app.services import question_bank_service as bank  # noqa: E402
from app.services.quiz_catalog import topics_for  # noqa: E402

QTYPES = ["mcq", "true_false", "matching"]
MAX_ROUNDS_PER_SLOT = 5


async def count_in_bank(subject: str, qtype: str, topic: str, difficulty: int) -> int:
    async with AsyncSessionLocal() as db:
        stmt = select(func.count()).where(
            QuizQuestion.subject == subject,
            QuizQuestion.qtype == qtype,
            QuizQuestion.topic == topic,
            QuizQuestion.difficulty == difficulty,
        )
        return int((await db.execute(stmt)).scalar_one())


async def fill_slot(subject: str, qtype: str, category: str, topic: str, difficulty: int, target: int) -> int:
    added = 0
    for _ in range(MAX_ROUNDS_PER_SLOT):
        have = await count_in_bank(subject, qtype, topic, difficulty)
        if have >= target:
            break
        slot = bank.Slot(category, topic, difficulty, min(target - have, bank.MAX_ITEMS_PER_CALL))
        items = await bank.generate_verified_items(subject, slot, qtype, slot.count)
        if not items:
            break
        async with AsyncSessionLocal() as db:
            added += len(await bank.store_items(db, subject, qtype, items))
    return added


async def main(args: argparse.Namespace) -> None:
    qtypes = QTYPES if args.qtype == "all" else [args.qtype]
    difficulties = [1, 2, 3, 4, 5] if args.difficulty == 0 else [args.difficulty]
    total = 0
    for qtype in qtypes:
        # Juftlash to'plami 6 juftdan iborat — mavzu boshiga kamroq kerak.
        target = max(1, args.per_topic // 5) if qtype == "matching" else args.per_topic
        for category, topic in topics_for(args.subject):
            results = await asyncio.gather(
                *(fill_slot(args.subject, qtype, category, topic, d, target // len(difficulties) or 1) for d in difficulties)
            )
            total += sum(results)
            print(f"[{qtype}] {topic}: +{sum(results)}")
    print(f"\nTayyor: bankka {total} ta yangi tekshirilgan savol qo'shildi.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--subject", required=True, choices=["kimyo", "biologiya"])
    parser.add_argument("--qtype", default="all", choices=["all", *QTYPES])
    parser.add_argument("--per-topic", type=int, default=30, help="Har bir mavzu uchun maqsad (qiyinliklar bo'yicha bo'linadi)")
    parser.add_argument("--difficulty", type=int, default=0, choices=[0, 1, 2, 3, 4, 5], help="0 — barcha qiyinliklar")
    asyncio.run(main(parser.parse_args()))
