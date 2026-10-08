"""
Admin uchun: o'quvchi parolini unutganda yangi parol o'rnatadi.

Ishlatish (docker compose bilan):
    docker compose exec backend python scripts/reset_password.py --phone 901234567 --password yangiParol123
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password, normalize_uz_phone  # noqa: E402
from app.db.redis_client import redis_client  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.database import User  # noqa: E402
from app.services.auth_service import _failures_key  # noqa: E402


async def main(phone: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
        if user is None:
            raise SystemExit(f"Bu raqam bilan foydalanuvchi topilmadi: {phone}")
        user.password_hash = hash_password(password)
        await db.commit()
    await redis_client.delete(_failures_key(phone))
    print(f"Parol yangilandi: {user.full_name} ({phone}). Bloklash ham olib tashlandi.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--phone", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    if len(args.password) < 6:
        raise SystemExit("Parol kamida 6 ta belgidan iborat bo'lishi kerak")
    asyncio.run(main(normalize_uz_phone(args.phone), args.password))
