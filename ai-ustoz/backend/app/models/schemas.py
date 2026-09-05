"""API request/response uchun Pydantic sxemalar."""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SubjectSchema(str, Enum):
    KIMYO = "kimyo"
    BIOLOGIYA = "biologiya"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessageIn(BaseModel):
    subject: SubjectSchema
    message: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(BaseModel):
    role: ChatRole
    content: str
    created_at: datetime


class WeakSpotOut(BaseModel):
    topic: str
    mistake_description: str
    severity: int
    resolved: bool

    class Config:
        from_attributes = True


class ProgressOut(BaseModel):
    subject: SubjectSchema
    current_lesson_title: str | None
    current_step: str | None
    average_score: float | None
    weak_spots: list[WeakSpotOut]
    updated_at: datetime | None


class TestResultIn(BaseModel):
    subject: SubjectSchema
    test_type: str
    score: float
    max_score: float
    details: dict = Field(default_factory=dict)


class VoiceSessionOut(BaseModel):
    """OpenAI Realtime API uchun ephemeral (bir martalik) client_secret."""

    client_secret: str
    expires_at: int
    model: str
