"""API request/response uchun Pydantic sxemalar."""
import uuid
from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.security import normalize_uz_phone


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


class PlacementQuestionOut(BaseModel):
    id: str
    subject: SubjectSchema
    category: str
    question: str
    options: list[str]


class OnboardingIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(max_length=30)
    password: str = Field(min_length=6, max_length=128)
    current_grade: int = Field(ge=5, le=11)
    is_graduate: bool = False
    subjects: Literal["kimyo", "biologiya", "ikkalasi"]
    target_exam: Literal["dtm", "milliy_sertifikat", "ikkalasi"]
    target_score: int | None = Field(default=None, ge=0, le=189)
    target_cert_level: Literal["A+", "A", "B+", "B", "C+", "C"] | None = None
    target_university: str | None = Field(default=None, max_length=255)
    self_level: Literal["boshlangich", "orta", "yuqori"]
    exam_month: date | None = None
    daily_study_minutes: int = Field(ge=0, le=1440)
    study_months: int = Field(default=6, ge=1, le=24)
    study_days_per_week: int = Field(default=5, ge=1, le=7)
    placement_answers: dict[str, int] = Field(default_factory=dict, max_length=50)

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_uz_phone(value)


class PlacementResultOut(BaseModel):
    subject: SubjectSchema
    correct: int
    total: int


class OnboardingOut(BaseModel):
    access_token: str
    user_id: uuid.UUID
    placement: list[PlacementResultOut]
    plan_weeks: int
    first_topic: str | None


class LoginIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    phone: str = Field(max_length=30)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_uz_phone(value)


class LoginOut(BaseModel):
    access_token: str
    full_name: str
    subjects: Literal["kimyo", "biologiya", "ikkalasi"]


class LeaderboardRowOut(BaseModel):
    rank: int
    name: str
    grade: int
    xp: int
    streak: int
    is_me: bool


class MyStatsOut(BaseModel):
    xp_total: int
    week_xp: int
    streak: int
    longest_streak: int


class LeaderboardOut(BaseModel):
    period: Literal["week", "all"]
    scope: Literal["all", "grade"]
    rows: list[LeaderboardRowOut]
    my_rank: int
    my_xp: int


class TestCreateIn(BaseModel):
    kind: Literal["dtm_mock", "topic", "milliy_sertifikat"]
    subject: SubjectSchema = SubjectSchema.KIMYO
    topic: str | None = Field(default=None, max_length=150)
    question_count: Literal[10, 20] = 10
    first_subject: SubjectSchema | None = None
    dtm_blocks: Literal["both", "first", "second"] = "both"


class TestQuestionOut(BaseModel):
    id: str
    subject: SubjectSchema
    topic: str
    question: str
    options: list[str]


class TestSessionOut(BaseModel):
    attempt_id: uuid.UUID
    kind: str
    subject: str
    topic: str | None
    status: Literal["active"]
    questions: list[TestQuestionOut]
    answers: dict[str, int]
    deadline_at: datetime
    server_now: datetime
    max_score: float


class TestAnswerIn(BaseModel):
    question_id: str = Field(max_length=64)
    choice: int | None = Field(default=None, ge=0, le=3)


class SubjectScoreOut(BaseModel):
    subject: SubjectSchema
    correct: int
    total: int
    score: float
    max_score: float


class TopicScoreOut(BaseModel):
    subject: SubjectSchema
    category: str
    topic: str
    correct: int
    total: int


class ReviewItemOut(BaseModel):
    question_id: str
    subject: SubjectSchema
    topic: str
    question: str
    options: list[str]
    chosen: int | None
    correct_index: int
    explanation: str


class TestResultOut(BaseModel):
    attempt_id: uuid.UUID
    kind: str
    subject: str
    status: Literal["finished"]
    score: float
    max_score: float
    percent: float
    correct_count: int
    total: int
    xp_earned: int
    duration_seconds: int
    per_subject: list[SubjectScoreOut]
    per_topic: list[TopicScoreOut]
    review: list[ReviewItemOut]
    ms_level: str | None
    ms_is_official: bool


class CatalogTopicOut(BaseModel):
    category: str
    topic: str


class TestCatalogOut(BaseModel):
    topics: dict[str, list[CatalogTopicOut]]
    dtm_questions_per_subject: int
    dtm_first_weight: float
    dtm_second_weight: float
    dtm_seconds_per_question: int
    ms_question_count: int
    ms_seconds_per_question: int
    ms_is_official: bool


class GameStartIn(BaseModel):
    subject: SubjectSchema


class MillionerQuestionOut(BaseModel):
    id: str
    topic: str
    question: str
    options: list[str]
    removed: list[int]


class MillionerStateOut(BaseModel):
    attempt_id: uuid.UUID
    status: Literal["active", "finished"]
    level: int
    prize_ladder: list[int]
    safe_levels: list[int]
    lifelines: dict[str, bool]
    question: MillionerQuestionOut | None
    prize: int
    won: bool
    xp_earned: int


class MillionerAnswerIn(BaseModel):
    choice: int = Field(ge=0, le=3)


class MillionerAnswerOut(BaseModel):
    correct: bool
    correct_index: int
    explanation: str
    game: MillionerStateOut


class BlitzStatementOut(BaseModel):
    id: str
    topic: str
    text: str


class BlitzStartOut(BaseModel):
    attempt_id: uuid.UUID
    statements: list[BlitzStatementOut]
    deadline_at: datetime
    server_now: datetime


class BlitzAnswerIn(BaseModel):
    question_id: str = Field(max_length=64)
    is_true: bool


class BlitzAnswerOut(BaseModel):
    correct: bool
    statement_is_true: bool
    points: int
    combo: int
    multiplier: int
    score: float


class BlitzResultOut(BaseModel):
    score: float
    correct: int
    wrong: int
    best_combo: int
    xp_earned: int


class MatchingStartOut(BaseModel):
    attempt_id: uuid.UUID
    title: str
    topic: str
    left: list[str]
    right: list[str]
    deadline_at: datetime
    server_now: datetime


class MatchingMatchIn(BaseModel):
    left: int = Field(ge=0, le=20)
    right: int = Field(ge=0, le=20)


class MatchingMatchOut(BaseModel):
    correct: bool
    matched: list[list[int]]
    mistakes: int
    finished: bool
    time_is_up: bool
    xp_earned: int
    explanation: str | None


class DuelCreateIn(BaseModel):
    subject: SubjectSchema


class DuelJoinIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=6, max_length=6)


class DuelPlayerOut(BaseModel):
    name: str
    answered: int
    correct: int
    finished: bool
    seconds: float | None


class DuelQuestionOut(BaseModel):
    id: str
    topic: str
    question: str
    options: list[str]
    correct_index: int | None  # faqat duel tugagandan keyin


class DuelOut(BaseModel):
    id: uuid.UUID
    code: str
    subject: SubjectSchema
    status: Literal["waiting", "active", "finished", "cancelled", "expired"]
    is_host: bool
    me: DuelPlayerOut
    opponent: DuelPlayerOut | None
    questions: list[DuelQuestionOut]
    my_answers: dict[str, int]
    deadline_at: datetime | None
    server_now: datetime
    result: Literal["win", "loss", "draw"] | None
    xp_earned: int


class DuelAnswerIn(BaseModel):
    question_id: str = Field(max_length=64)
    choice: int = Field(ge=0, le=3)


class DuelAnswerOut(BaseModel):
    correct: bool
    correct_index: int
    explanation: str
    duel: DuelOut


class PlanSettingsIn(BaseModel):
    study_months: int = Field(ge=1, le=24)
    study_days_per_week: int = Field(ge=1, le=7)
    daily_study_minutes: int = Field(ge=15, le=600)


class PlanTopicOut(BaseModel):
    subject: SubjectSchema
    category: str
    topic: str
    grade: int
    is_new: bool
    minutes: int
    first_week: int | None
    last_week: int | None
    completed: bool
    percent: int | None


class PlanWeekItemOut(BaseModel):
    subject: SubjectSchema
    topic: str
    minutes: int
    completed: bool


class PlanWeekOut(BaseModel):
    week: int
    kind: Literal["study", "revision"]
    items: list[PlanWeekItemOut]


class LessonPartOut(BaseModel):
    label: str
    minutes: int


class PlanOut(BaseModel):
    study_months: int
    effective_months: int
    days_per_week: int
    daily_minutes: int
    weekly_minutes: int
    start_date: date
    exam_month: date | None
    total_weeks: int
    current_week: int
    status: Literal["on_track", "behind", "ahead", "done"]
    behind_weeks: int
    is_tight: bool
    suggested_daily_minutes: int | None
    completed_count: int
    topic_count: int
    current: PlanTopicOut | None
    lesson_outline: list[LessonPartOut]
    topics: list[PlanTopicOut]
    weeks: list[PlanWeekOut]


class HomeworkCreateIn(BaseModel):
    subject: SubjectSchema
    topic: str | None = Field(default=None, max_length=150)


class HomeworkSolutionIn(BaseModel):
    text: str = Field(default="", max_length=4000)
    # data:image/jpeg;base64,... — frontend rasmni ~1600px gacha kichraytirib yuboradi
    photo: str | None = Field(default=None, max_length=4_500_000)


class HomeworkSubmitIn(BaseModel):
    mcq_answers: dict[str, int] = Field(default_factory=dict, max_length=20)
    solutions: list[HomeworkSolutionIn] = Field(default_factory=list, max_length=5)


class HomeworkQuestionOut(BaseModel):
    id: str
    question: str
    options: list[str]


class HomeworkStepOut(BaseModel):
    step: str
    ok: bool
    comment: str


class HomeworkMcqReviewOut(BaseModel):
    question_id: str
    question: str
    options: list[str]
    choice: int | None
    correct_index: int
    correct: bool
    explanation: str


class HomeworkProblemReviewOut(BaseModel):
    problem: str
    answer: str
    solution_steps: list[str]
    score: int
    max_score: int
    final_answer_correct: bool
    steps: list[HomeworkStepOut]
    mistake: str
    comment: str
    has_photo: bool


class HomeworkResultOut(BaseModel):
    percent: int
    mcq: list[HomeworkMcqReviewOut]
    problems: list[HomeworkProblemReviewOut]


class HomeworkOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    category: str
    topic: str
    status: Literal["assigned", "checked"]
    assigned_at: datetime
    due_at: datetime
    is_overdue: bool
    questions: list[HomeworkQuestionOut]
    problems: list[str]  # faqat shart — javob va yechim tekshiruvdan keyin `result`da
    submissions: list[dict] | None
    result: HomeworkResultOut | None
    score: float | None
    max_score: float | None
    xp_earned: int
    is_late: bool
    checked_at: datetime | None
    server_now: datetime


class HomeworkSummaryOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    topic: str
    status: Literal["assigned", "checked"]
    assigned_at: datetime
    due_at: datetime
    is_overdue: bool
    percent: int | None
    xp_earned: int


class LectureRequestIn(BaseModel):
    subject: SubjectSchema
    topic: str = Field(min_length=1, max_length=150)


class LectureProgressOut(BaseModel):
    position_seconds: int
    completed: bool
    listen_count: int


class LectureSectionOut(BaseModel):
    title: str
    markdown: str
    start_seconds: float


class LectureOut(BaseModel):
    id: uuid.UUID
    subject: SubjectSchema
    category: str
    topic: str
    title: str | None
    status: Literal["generating", "ready", "failed"]
    sections: list[LectureSectionOut]
    audio_url: str | None
    duration_seconds: int
    progress: LectureProgressOut | None


class LectureCatalogItemOut(BaseModel):
    category: str
    topic: str
    lecture_id: uuid.UUID | None
    status: Literal["none", "generating", "ready", "failed"]
    duration_seconds: int
    progress: LectureProgressOut | None


class LectureCatalogOut(BaseModel):
    subject: SubjectSchema
    grade_band: int
    items: list[LectureCatalogItemOut]


class LectureProgressIn(BaseModel):
    position_seconds: float = Field(ge=0, le=24 * 3600)
    ended: bool = False


class LectureProgressResultOut(BaseModel):
    progress: LectureProgressOut
    xp_awarded: int


class IllustrationRequestIn(BaseModel):
    subject: SubjectSchema
    prompt: str = Field(min_length=3, max_length=400)


class IllustrationOut(BaseModel):
    id: uuid.UUID
    status: Literal["generating", "ready", "failed"]
    image_url: str | None


class PhotoRequestIn(BaseModel):
    subject: SubjectSchema
    query: str = Field(min_length=2, max_length=200)

    @field_validator("query", mode="before")
    @classmethod
    def strip_query(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PhotoOut(BaseModel):
    id: uuid.UUID
    status: Literal["searching", "ready", "not_found", "failed"]
    image_url: str | None
    title: str | None = None
    author: str | None = None
    license: str | None = None
    license_url: str | None = None
    source_url: str | None = None
