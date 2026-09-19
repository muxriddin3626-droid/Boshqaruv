"""
FAQAT LOKAL SINOV UCHUN — productionda ishlatilmasin.

Supabase Auth hali ulanmagan frontend uchun tezkor "kirish" yo'li: bitta
test foydalanuvchi yaratadi (yoki mavjudini topadi) va unga mos, backend
o'zi tekshira oladigan JWT token generatsiya qiladi.

Ishlatish (docker compose bilan):
    docker compose exec backend python scripts/seed_test_user.py

Natijada chiqadigan buyruqni brauzer konsoliga (F12 -> Console) joylashtiring.
"""
import asyncio
import sys
from pathlib import Path

# `python scripts/seed_test_user.py` ishga tushirilganda Python faqat
# `scripts/` papkasini sys.path'ga qo'shadi — `app` paketi esa bir daraja
# yuqorida (`backend/`). Shuning uchun uni qo'lda qo'shib qo'yamiz, aks holda
# "ModuleNotFoundError: No module named 'app'" chiqadi.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from jose import jwt  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.database import User  # noqa: E402

TEST_EMAIL = "test@ai-ustoz.local"


async def main() -> None:
    settings = get_settings()

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(User).where(User.email == TEST_EMAIL))).scalar_one_or_none()
        if existing:
            user = existing
            print(f"Mavjud test foydalanuvchi topildi: {user.id}")
        else:
            user = User(full_name="Sinov Talabasi", email=TEST_EMAIL, current_grade=9, target_score=189)
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"Yangi test foydalanuvchi yaratildi: {user.id}")

    token = jwt.encode({"sub": str(user.id)}, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    print("\n=== Brauzer konsolida (F12 -> Console) shuni ishga tushiring ===\n")
    print(f"localStorage.setItem('ai_ustoz_token', '{token}'); location.reload();")
    print("\n==================================================================\n")


if __name__ == "__main__":
    asyncio.run(main())
