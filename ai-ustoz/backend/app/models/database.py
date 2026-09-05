"""
SQLAlchemy ORM modellari.

Manba haqiqat (source of truth) sifatida `database/schema.sql` fayli ishlatiladi —
bu modellar o'sha sxemaga mos yoziladi. Productionda Alembic migratsiyalari
orqali sinxronlashtiring.
"""
import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
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
