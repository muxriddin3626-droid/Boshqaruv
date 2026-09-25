"""API request/response uchun Pydantic sxemalar."""
import uuid
from datetime import date, datetime
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


# =============================================================================
# MODUL 6: EXAM CROWDSOURCING & MEMORY ENGINE
# =============================================================================


class RawInputType(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    IMAGE = "image"


class ExamStatusOut(BaseModel):
    target_exam_date: date | None
    exam_completed: bool
    feedback_provided: bool


class ExamStatusIn(BaseModel):
    """O'quvchi "Bugun imtihonim bor" yoki "Imtihondan chiqdim" deb belgilaganda yuboriladi."""

    target_exam_date: date | None = None
    exam_completed: bool | None = None


class ExamSubmissionOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    raw_input_type: RawInputType
    topic: str | None
    difficulty_level: str | None
    cert_level: str | None
    reconstructed_question: str
    verified_solution: str | None
    submission_date: datetime

    class Config:
        from_attributes = True


# =============================================================================
# MODUL 7: AUTONOMOUS AI RESEARCHER & PEDAGOGICAL INNOVATOR ENGINE
# =============================================================================


class InnovationTypeSchema(str, Enum):
    NEW_METHOD = "NEW_METHOD"
    TRICK_QUESTION = "TRICK_QUESTION"


class InnovationOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    topic_id: uuid.UUID | None
    innovation_type: InnovationTypeSchema
    content: str
    explanation: str
    validation_score: float
    created_at: datetime

    class Config:
        from_attributes = True


class InnovationTriggerIn(BaseModel):
    subject: SubjectSchema
    category: str | None = None  # None bo'lsa, eng zaif bo'lim avtomatik tanlanadi
    innovation_type: InnovationTypeSchema = InnovationTypeSchema.NEW_METHOD


class ResearchLogOut(BaseModel):
    id: uuid.UUID
    source_url: str | None
    topic: str | None
    extracted_insight: str
    added_to_knowledge_base: bool
    timestamp: datetime

    class Config:
        from_attributes = True


class ResearchScanTriggerIn(BaseModel):
    topics: list[str] = Field(default_factory=list)  # bo'sh bo'lsa, standart mavzular ishlatiladi


# =============================================================================
# MODUL 8: AUDIO LECTURE ENGINE
# =============================================================================


class AudioLectureGenerateIn(BaseModel):
    subject: SubjectSchema
    grade: int | None = Field(default=None, ge=5, le=11)
    lecture_title: str = Field(min_length=1, max_length=255)
    lecture_text: str = Field(min_length=1, max_length=8000)
    lecture_summary: str | None = None
    voice: str = "onyx"  # OpenAI TTS ovozi: alloy/echo/fable/onyx/nova/shimmer


class AudioLectureOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    grade: int | None
    lecture_title: str
    lecture_summary: str | None
    audio_url: str
    duration_seconds: int
    is_saved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AudioLectureUpdateIn(BaseModel):
    is_saved: bool
