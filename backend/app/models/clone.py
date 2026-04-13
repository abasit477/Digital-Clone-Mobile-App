from datetime import datetime
from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from ..db.database import Base


class Clone(Base):
    __tablename__ = "clones"

    id:             Mapped[str]      = mapped_column(String(36), primary_key=True)
    name:           Mapped[str]      = mapped_column(String(100), nullable=False)
    title:          Mapped[str]      = mapped_column(String(200), default="")
    description:    Mapped[str]      = mapped_column(Text, default="")
    persona_prompt: Mapped[str]      = mapped_column(Text, nullable=False)
    # Available domains e.g. "family,professional,general" (comma-separated)
    domains:        Mapped[str]      = mapped_column(String(300), default="general")
    avatar_url:     Mapped[str]      = mapped_column(String(500), default="")
    # AWS Polly voice ID for this clone
    voice_id:       Mapped[str]      = mapped_column(String(50), default="")
    creator_email:  Mapped[str]      = mapped_column(String(200), default="")
    is_active:      Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at:     Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:     Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow,
                                                      onupdate=datetime.utcnow)
