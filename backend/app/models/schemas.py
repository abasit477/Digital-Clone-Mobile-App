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
    id:           str
    email:        str
    user_email:   Optional[str]
    role:         str
    invite_code:  str
    relationship: Optional[str] = None
    accepted_at:  Optional[datetime]

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
    email:        EmailStr
    relationship: Optional[str] = None  # "child" | "parent" | "spouse" | "sibling"


class JoinRequest(BaseModel):
    invite_code: str


class JoinResponse(FamilyMemberOut):
    """Extended join response that includes family context for the mobile client."""
    family_name:   str = ""
    creator_email: str = ""


# ── Persona synthesis ────────────────────────────────────────────────────────

class OnboardingAnswers(BaseModel):
    answers: dict  # question_key -> answer text


class PersonaSynthesisResponse(BaseModel):
    persona_prompt:  str
    knowledge_text:  str


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessageIn(BaseModel):
    message:    str
    is_opening: bool = False   # True = first-open greeting trigger (hidden from history)


class ChatMessageOut(BaseModel):
    id:         str
    role:       str
    content:    str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    messages:   list[ChatMessageOut]
    clone_name: str


# ── Voice chat ───────────────────────────────────────────────────────────────

class VoiceMessageIn(BaseModel):
    audio_data: str        # base64-encoded audio
    format:     str = "wav"  # "wav" | "mp4"


class VoiceMessageOut(BaseModel):
    transcript:   str
    id:           str
    role:         str
    content:      str
    created_at:   datetime
    audio_url:    str | None = None   # URL to MP3 TTS response (cloned voice)
    video_job_id: str | None = None   # SadTalker background job ID
    video_url:    str | None = None   # Set when video generation completes

    model_config = {"from_attributes": True}


class VideoStatusOut(BaseModel):
    status:    str           # "pending" | "done" | "failed"
    video_url: str | None = None


class VoiceSampleIn(BaseModel):
    audio_data: str          # base64-encoded WAV (30-60s recommended)


class VoiceSampleOut(BaseModel):
    voice_sample_url: str


# ── Assessments ───────────────────────────────────────────────────────────────

class AssessmentSaveRequest(BaseModel):
    answers: dict


class AssessmentAnswersResponse(BaseModel):
    answers: dict


class Question(BaseModel):
    key:         str
    text:        str
    type:        str                            # "mcq" | "text"
    category:    str
    placeholder: Optional[str] = None
    options:     Optional[dict[str, str]] = None


class QuestionsResponse(BaseModel):
    questions:       list[Question]
    branching_rules: dict                       # question_key → list of dependent keys
