from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ── Clone ─────────────────────────────────────────────────────────────────────

class CloneBase(BaseModel):
    name:           str
    title:          str = ""
    description:    str = ""
    persona_prompt: str
    domains:        str = "general"
    avatar_url:     str = ""
    voice_id:       str = ""


class CloneCreate(CloneBase):
    creator_email: str = ""


class CloneUpdate(BaseModel):
    name:           str | None = None
    title:          str | None = None
    description:    str | None = None
    persona_prompt: str | None = None
    domains:        str | None = None
    avatar_url:     str | None = None
    voice_id:       str | None = None
    is_active:      bool | None = None


class CloneResponse(CloneBase):
    id:         str
    is_active:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CloneListItem(BaseModel):
    id:          str
    name:        str
    title:       str
    description: str
    domains:     str
    avatar_url:  str
    is_active:   bool

    model_config = {"from_attributes": True}


# ── Knowledge ingestion ───────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    text:   str
    source: str = ""


class IngestResponse(BaseModel):
    clone_id:   str
    source:     str
    chunks_added: int


# ── Voice session ─────────────────────────────────────────────────────────────

class VoiceSessionInit(BaseModel):
    clone_id:   str
    domain:     str = "general"
    session_id: str = ""


# ── WebSocket message types ───────────────────────────────────────────────────

class WSMessage(BaseModel):
    type: str       # "audio_chunk" | "end_of_speech" | "ping"
    data: str = ""  # base64-encoded audio for audio_chunk


class WSResponse(BaseModel):
    type:    str    # "transcript" | "response_text" | "audio_chunk" | "audio_done" | "error"
    data:    str = ""
    message: str = ""


# ── Family ────────────────────────────────────────────────────────────────────

class FamilyCreate(BaseModel):
    name:     str
    clone_id: Optional[str] = None


class FamilyMemberOut(BaseModel):
    id:          str
    email:       str
    user_email:  Optional[str]
    role:        str
    invite_code: str
    accepted_at: Optional[datetime]

    model_config = {"from_attributes": True}


class FamilyResponse(BaseModel):
    id:            str
    name:          str
    creator_email: str
    clone_id:      Optional[str]
    created_at:    datetime
    members:       list[FamilyMemberOut] = []

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: EmailStr


class JoinRequest(BaseModel):
    invite_code: str


# ── Persona synthesis ────────────────────────────────────────────────────────

class OnboardingAnswers(BaseModel):
    answers: dict  # question_key -> answer text


class PersonaSynthesisResponse(BaseModel):
    persona_prompt:  str
    knowledge_text:  str
