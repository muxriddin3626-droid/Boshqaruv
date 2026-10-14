"""
Qisqa muddatli suhbat holati (Session State) — Redis orqali.

Nega Redis: bitta suhbat davomida modelga yuboriladigan xabarlar tarixini
tez o'qish/yozish kerak. Uzoq muddatli progress (qaysi darsda to'xtagani,
weak_spots) esa Postgres'da saqlanadi — buni progress_service boshqaradi.
"""
import json
import uuid

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()


def _history_key(user_id: uuid.UUID, subject: str) -> str:
    return f"chat:history:{user_id}:{subject}"


class SessionService:
    def __init__(self, redis: Redis):
        self._redis = redis

    async def get_history(self, user_id: uuid.UUID, subject: str) -> list[dict]:
        """Redisda saqlangan oxirgi xabarlar ro'yxatini qaytaradi (eskidan yangiga)."""
        key = _history_key(user_id, subject)
        raw_messages = await self._redis.lrange(key, 0, -1)
        return [json.loads(m) for m in raw_messages]

    async def append_message(self, user_id: uuid.UUID, subject: str, role: str, content: str) -> None:
        """Yangi xabarni tarixga qo'shadi, limitdan oshsa eskisini kesib tashlaydi, TTL yangilaydi."""
        key = _history_key(user_id, subject)
        payload = json.dumps({"role": role, "content": content})

        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.rpush(key, payload)
            pipe.ltrim(key, -settings.conversation_history_max_messages, -1)
            pipe.expire(key, settings.conversation_history_ttl_seconds)
            await pipe.execute()

    async def clear_history(self, user_id: uuid.UUID, subject: str) -> None:
        await self._redis.delete(_history_key(user_id, subject))
