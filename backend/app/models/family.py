from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..db.database import Base


class Family(Base):
    __tablename__ = "families"

    id:            Mapped[str]            = mapped_column(String(36), primary_key=True)
    name:          Mapped[str]            = mapped_column(String(200), nullable=False)
    creator_email: Mapped[str]            = mapped_column(String(200), nullable=False)
    clone_id:      Mapped[str | None]     = mapped_column(String(36), ForeignKey("clones.id"), nullable=True)
    created_at:    Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)


class FamilyMember(Base):
    __tablename__ = "family_members"

    id:          Mapped[str]          = mapped_column(String(36), primary_key=True)
    family_id:   Mapped[str]          = mapped_column(String(36), ForeignKey("families.id"), nullable=False)
    email:       Mapped[str]          = mapped_column(String(200), nullable=False)  # invited email
    user_email:  Mapped[str | None]   = mapped_column(String(200), nullable=True)   # set when accepted
    role:        Mapped[str]          = mapped_column(String(50), nullable=False)    # "creator" | "member"
    invite_code:  Mapped[str]           = mapped_column(String(8), nullable=False)
    relationship: Mapped[str | None]   = mapped_column(String(50), nullable=True)  # "child"|"parent"|"spouse"|"sibling"
    accepted_at:  Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:   Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow)
