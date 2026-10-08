"""
SQLAlchemy ORM modellari.

Manba haqiqat (source of truth) sifatida `database/schema.sql` fayli ishlatiladi —
bu modellar o'sha sxemaga mos yoziladi. Productionda Alembic migratsiyalari
orqali sinxronlashtiring.
"""
import enum
import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Subject(str, enum.Enum):
    KIMYO = "kimyo"
    BIOLOGIYA = "biologiya"


class TestType(str, enum.Enum):
    ORALIQ = "oraliq"  # oddiy mavzu testi
    DTM_MOCK = "dtm_mock"  # DTM/BMBA simulyatsiyasi
    MILLIY_SERTIFIKAT = "milliy_sertifikat"


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    telegram_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    current_grade: Mapped[int] = mapped_column(Integer, default=9)
    target_score: Mapped[int] = mapped_column(Integer, default=189)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    is_graduate: Mapped[bool] = mapped_column(Boolean, default=False)
    subjects: Mapped[str] = mapped_column(String(20), default="ikkalasi")
    target_exam: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_cert_level: Mapped[str | None] = mapped_column(String(2), nullable=True)
    target_university: Mapped[str | None] = mapped_column(String(255), nullable=True)
    self_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    exam_month: Mapped[date | None] = mapped_column(Date, nullable=True)
    daily_study_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    study_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    study_days_per_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(13), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    xp_total: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_active_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    progress_entries: Mapped[list["Progress"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    weak_spots: Mapped[list["WeakSpot"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    test_results: Mapped[list["TestResult"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = _uuid_pk()
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    topic_order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    __table_args__ = (UniqueConstraint("subject", "grade", "topic_order", name="uq_lesson_order"),)


class Progress(Base):
    """O'quvchining har bir fan bo'yicha joriy holati — 'qayerda to'xtagani'."""

    __tablename__ = "progress"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    current_lesson_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    current_step: Mapped[str | None] = mapped_column(String(255), nullable=True)
    average_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="progress_entries")
    current_lesson: Mapped["Lesson | None"] = relationship()

    __table_args__ = (UniqueConstraint("user_id", "subject", name="uq_progress_user_subject"),)


class WeakSpot(Base):
    """O'quvchi doimiy xato qiladigan mavzular — repetitor 'eslab qoladigan' joy."""

    __tablename__ = "weak_spots"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mistake_description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[int] = mapped_column(Integer, default=1)  # 1..5
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="weak_spots")


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    test_type: Mapped[TestType] = mapped_column(String(30), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="test_results")


class ChatMessage(Base):
    """Uzoq muddatli suhbat arxivi (analitika va audit uchun; qisqa muddatli holat Redisda)."""

    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KnowledgeChunk(Base):
    """RAG uchun: darslik matn bo'laklari + rasm/sxema havolalari + embedding vektori."""

    __tablename__ = "knowledge_chunks"

    id: Mapped[uuid.UUID] = _uuid_pk()
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    source_title: Mapped[str] = mapped_column(String(255), nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)


# Ebbinghaus unutish egri chizig'i bosqichlari: har biridan keyin necha kunda takrorlash kerak.
SPACED_REPETITION_INTERVALS_DAYS: list[int] = [1, 3, 7, 30]


class Flashcard(Base):
    """AI tomonidan dars/suhbat oxirida avtomatik generatsiya qilingan flashcard."""

    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    front_text: Mapped[str] = mapped_column(Text, nullable=False)
    back_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    queue_entry: Mapped["SpacedRepetitionQueue"] = relationship(
        back_populates="flashcard", cascade="all, delete-orphan", uselist=False
    )


class SpacedRepetitionQueue(Base):
    """Har bir flashcard uchun keyingi takrorlash vaqti (Anki uslubidagi navbat)."""

    __tablename__ = "spaced_repetition_queue"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    flashcard_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("flashcards.id", ondelete="CASCADE"), unique=True
    )
    stage: Mapped[int] = mapped_column(Integer, default=0)  # SPACED_REPETITION_INTERVALS_DAYS indeksi
    remembered_streak: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")  # "active" | "mastered"
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_result: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "remembered" | "forgot"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    flashcard: Mapped["Flashcard"] = relationship(back_populates="queue_entry")


class UserWeaknessRadar(Base):
    """O'quvchining bo'lim (category) bo'yicha o'zlashtirish foizi — Radar Chart uchun keshlanadi."""

    __tablename__ = "user_weakness_radar"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    mastery_percentage: Mapped[float] = mapped_column(Float, default=50.0)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (UniqueConstraint("user_id", "subject", "category", name="uq_radar_user_subject_category"),)


# =============================================================================
# MODUL 6: EXAM CROWDSOURCING & MEMORY ENGINE
# =============================================================================


class StudentExamStatus(Base):
    """O'quvchining imtihon holati ("Exam Today" belgisi) — 1:1 users bilan."""

    __tablename__ = "student_exam_status"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_exam_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    exam_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    feedback_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RealExamSubmittedQuestion(Base):
    """O'quvchi imtihondan keyin "topshirgan" haqiqiy savol — AI'ning xotira bazasi."""

    __tablename__ = "real_exam_submitted_questions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    raw_input_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "text" | "voice" | "image"
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cert_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    difficulty_level: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "A" | "A+"
    reconstructed_question: Mapped[str] = mapped_column(Text, nullable=False)
    verified_solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    vector_embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
    submission_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# MODUL 7: AUTONOMOUS AI RESEARCHER & PEDAGOGICAL INNOVATOR ENGINE
# =============================================================================


class InnovationType(str, enum.Enum):
    NEW_METHOD = "NEW_METHOD"
    TRICK_QUESTION = "TRICK_QUESTION"


class AiGeneratedInnovation(Base):
    """AI mustaqil yaratgan yangi tushuntirish usuli yoki "tuzoq masala"."""

    __tablename__ = "ai_generated_innovations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    topic_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    innovation_type: Mapped[InnovationType] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    validation_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiResearchLog(Base):
    """AI'ning mustaqil izlanish (web-scan) natijalari jurnali."""

    __tablename__ = "ai_research_logs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extracted_insight: Mapped[str] = mapped_column(Text, nullable=False)
    added_to_knowledge_base: Mapped[bool] = mapped_column(Boolean, default=False)
    timestamp: Mapped[datetime] = mapped_column(
        "timestamp", DateTime(timezone=True), server_default=func.now()
    )


# =============================================================================
# MODUL 8: AUDIO LECTURE ENGINE
# =============================================================================


class UserAudioLecture(Base):
    """AI Ustoz ma'ruzasining audio (TTS) versiyasi — Supabase Storage'da saqlanadi."""

    __tablename__ = "user_audio_lectures"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[Subject] = mapped_column(String(20), nullable=False)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lecture_title: Mapped[str] = mapped_column(String(255), nullable=False)
    lecture_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QuizQuestion(Base):
    """AI tuzgan va mustaqil yechib tekshirilgan savol (testlar va o'yinlar uchun umumiy bank)."""

    __tablename__ = "quiz_questions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    subject: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    topic: Mapped[str] = mapped_column(String(150), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    qtype: Mapped[str] = mapped_column(String(20), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSONB, nullable=False)
    correct_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    explanation: Mapped[str] = mapped_column(Text, default="")
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="ai_verified")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QuizAttempt(Base):
    """Bitta test yoki o'yin urinishi. Javob kaliti faqat serverda saqlanadi."""

    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str] = mapped_column(String(20), nullable=False)
    question_ids: Mapped[list] = mapped_column(JSONB, default=list)
    answers: Mapped[dict] = mapped_column(JSONB, default=dict)
    state: Mapped[dict] = mapped_column(JSONB, default=dict)
    score: Mapped[float] = mapped_column(Float, default=0)
    max_score: Mapped[float] = mapped_column(Float, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(12), default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Duel(Base):
    """Do'st bilan duel: ikkala o'yinchiga bir xil savollar, taklif kodi orqali qo'shiladi."""

    __tablename__ = "duels"

    id: Mapped[uuid.UUID] = _uuid_pk()
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    subject: Mapped[str] = mapped_column(String(20), nullable=False)
    host_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    guest_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    question_ids: Mapped[list] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(10), default="waiting")
    winner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StudyPlan(Base):
    """Shaxsiy haftalik o'quv reja (bitta o'quvchiga bitta)."""

    __tablename__ = "study_plans"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False)
    plan: Mapped[dict] = mapped_column(JSONB, nullable=False)
    completed: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Homework(Base):
    """Uyga vazifa: test qismi + AI tekshiradigan yozma masalalar."""

    __tablename__ = "homeworks"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    subject: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    topic: Mapped[str] = mapped_column(String(150), nullable=False)
    status: Mapped[str] = mapped_column(String(10), default="assigned")
    question_ids: Mapped[list] = mapped_column(JSONB, default=list)
    problems: Mapped[list] = mapped_column(JSONB, default=list)
    answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    submissions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    is_late: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
