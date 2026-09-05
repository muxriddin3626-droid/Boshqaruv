"""API request/response uchun Pydantic sxemalar."""
import uuid
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


class VoiceMode(str, Enum):
    TUTOR = "tutor"
    DEBATE = "debate"


class VoiceSessionIn(BaseModel):
    mode: VoiceMode = VoiceMode.TUTOR
    subject: SubjectSchema = SubjectSchema.KIMYO


class VoiceSessionOut(BaseModel):
    """OpenAI Realtime API uchun ephemeral (bir martalik) client_secret."""

    client_secret: str
    expires_at: int
    model: str
    mode: VoiceMode


# =============================================================================
# MODUL 1: AI SMART FLASHCARDS & SPACED REPETITION
# =============================================================================


class FlashcardGenerateIn(BaseModel):
    subject: SubjectSchema
    lesson_title: str = Field(min_length=1, max_length=255)
    lesson_content: str = Field(min_length=1, max_length=8000)
    card_count: int = Field(default=5, ge=1, le=10)


class FlashcardOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    front_text: str
    back_text: str
    next_review_at: datetime

    class Config:
        from_attributes = True


class FlashcardReviewIn(BaseModel):
    flashcard_id: uuid.UUID
    remembered: bool
    # Offline sinxronizatsiya paytida takroriy qo'llanishning oldini olish uchun
    # frontend tomonidan generatsiya qilinadigan bir martalik id (ixtiyoriy).
    client_action_id: uuid.UUID | None = None
    reviewed_at: datetime | None = None


class FlashcardReviewOut(BaseModel):
    flashcard_id: uuid.UUID
    stage: int
    status: str
    next_review_at: datetime


# =============================================================================
# MODUL 3: WEAKNESS RADAR & TARGETED DRILL
# =============================================================================


class RadarPointOut(BaseModel):
    category: str
    mastery_percentage: float
    sample_size: int


class DrillRequestIn(BaseModel):
    subject: SubjectSchema
    question_count: int = Field(default=10, ge=3, le=20)


class DrillQuestionOut(BaseModel):
    category: str
    question: str
    options: list[str]
    correct_index: int
    explanation: str


class DrillOut(BaseModel):
    subject: SubjectSchema
    target_categories: list[str]
    questions: list[DrillQuestionOut]


# =============================================================================
# MODUL 4: AUTO-PDF KONSPEKT GENERATOR
# =============================================================================


class ConspectRequestIn(BaseModel):
    subject: SubjectSchema
    lesson_title: str | None = None


# =============================================================================
# MODUL 5: OFFLINE SYNC
# =============================================================================


class FlashcardReviewSyncItem(BaseModel):
    client_action_id: uuid.UUID
    flashcard_id: uuid.UUID
    remembered: bool
    reviewed_at: datetime


class TestResultSyncItem(BaseModel):
    client_action_id: uuid.UUID
    subject: SubjectSchema
    test_type: str
    score: float
    max_score: float
    details: dict = Field(default_factory=dict)
    taken_at: datetime


class SyncPushIn(BaseModel):
    flashcard_reviews: list[FlashcardReviewSyncItem] = Field(default_factory=list)
    test_results: list[TestResultSyncItem] = Field(default_factory=list)


class SyncPushOut(BaseModel):
    applied: int
    skipped_duplicate: int
    failed: int
