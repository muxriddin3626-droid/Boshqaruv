"""Ilova sozlamalari — barcha environment o'zgaruvchilar shu yerda markazlashtirilgan."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenAI
    openai_api_key: str
    openai_chat_model: str = "gpt-4o"
    openai_realtime_model: str = "gpt-4o-realtime-preview"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_vision_model: str = "gpt-4o"  # rasmdan savol OCR/tiklash uchun (Modul 6)
    openai_whisper_model: str = "whisper-1"  # ovozdan matnga (Modul 6)
    openai_tts_model: str = "tts-1"  # ma'ruzani audio(TTS)ga aylantirish (Modul 8)

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str
    jwt_algorithm: str = "HS256"

    # App
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    # Session state
    conversation_history_ttl_seconds: int = 86400
    conversation_history_max_messages: int = 30

    # Supabase Storage (Modul 8: Audio Lecture Engine)
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_audio_bucket: str = "audio_lectures"

    # Web-search provider (Modul 7: Autonomous Researcher) — Tavily/Serper uslubidagi
    # JSON API: POST {query} -> {results: [{title, url, content}]}. Sozlanmasa,
    # research_service so'rovlarni jim o'tkazib yuboradi (xato tashlamaydi).
    web_search_api_url: str = ""
    web_search_api_key: str = ""

    # Autonomous scheduler (Modul 7)
    research_scan_enabled: bool = False
    research_scan_interval_hours: int = 24
    innovation_scan_interval_hours: int = 24

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
