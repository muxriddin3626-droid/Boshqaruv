"""
Baza jadvallarini yaratish/yangilash: `schema.sql` va `seed.sql` ni bajaradi.
Ikkalasi ham qayta bajarilsa zarar qilmaydi (`if not exists`, `on conflict do nothing`),
shuning uchun server har ishga tushganda chaqiriladi (Render: Dockerfile CMD).

    python scripts/apply_schema.py            # DATABASE_URL dan
    SCHEMA_DIR=/path/to/database python scripts/apply_schema.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncpg  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.url import asyncpg_dsn  # noqa: E402


def schema_dir() -> Path:
    env = os.environ.get("SCHEMA_DIR")
    if env:
        return Path(env)
    repo = Path(__file__).resolve().parents[2] / "database"  # lokal: ai-ustoz/database
    return repo if repo.exists() else Path("/app/database")  # Docker obrazida


async def main() -> None:
    dsn, kwargs = asyncpg_dsn(get_settings().database_url)
    directory = schema_dir()
    for attempt in range(1, 11):
        try:
            connection = await asyncpg.connect(dsn, timeout=15, **kwargs)
            break
        except (OSError, asyncpg.PostgresError) as exc:
            # Bepul Neon bazasi uxlab qolgan bo'lsa birinchi ulanish sekin — bir necha marta urinamiz.
            if attempt == 10:
                raise
            print(f"Bazaga ulanib bo'lmadi ({exc.__class__.__name__}), {attempt}-urinish, 3 s kutamiz...", flush=True)
            await asyncio.sleep(3)
    try:
        for name in ("schema.sql", "seed.sql"):
            path = directory / name
            if path.exists():
                await connection.execute(path.read_text(encoding="utf-8"))  # oddiy so'rov protokoli: ko'p buyruqli skript
                print(f"{name} bajarildi", flush=True)
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
