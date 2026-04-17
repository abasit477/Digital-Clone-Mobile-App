import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..db.database import Base


class AssessmentAnswer(Base):
    """Creator's onboarding answers — one row per creator, upserted on retake."""
    __tablename__ = "assessment_answers"

    id:         Mapped[str]      = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email: Mapped[str]      = mapped_column(String(200), nullable=False, unique=True, index=True)
    answers:    Mapped[str]      = mapped_column(Text, nullable=False)   # JSON blob
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MemberAssessmentAnswer(Base):
    """Member's 4-question assessment — one row per member, upserted on retake."""
    __tablename__ = "member_assessment_answers"

    id:         Mapped[str]          = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email: Mapped[str]          = mapped_column(String(200), nullable=False, unique=True, index=True)
    family_id:  Mapped[str]          = mapped_column(String(36), ForeignKey("families.id"), nullable=False)
    answers:    Mapped[str]          = mapped_column(Text, nullable=False)   # JSON blob
    created_at: Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatMessage(Base):
    """Persistent chat history — one row per message, keyed by (user_email, clone_id)."""
    __tablename__ = "chat_messages"

    id:         Mapped[str]      = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email: Mapped[str]      = mapped_column(String(200), nullable=False, index=True)
    clone_id:   Mapped[str]      = mapped_column(String(36), ForeignKey("clones.id"), nullable=False)
    role:       Mapped[str]      = mapped_column(String(20), nullable=False)    # "user" | "assistant"
    content:    Mapped[str]      = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
