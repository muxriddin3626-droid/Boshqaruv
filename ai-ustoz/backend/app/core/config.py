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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
