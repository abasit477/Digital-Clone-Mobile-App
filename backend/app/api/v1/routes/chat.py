"""
Chat endpoints — unified for creator and member roles.
POST /chat/message  — send a message, get a response from Bedrock
GET  /chat/history  — load last 50 messages
DELETE /chat/history — clear all messages (used on assessment retake)
"""
import base64
import uuid
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.assessment import AssessmentAnswer, MemberAssessmentAnswer, ChatMessage
from ....models.clone import Clone
from ....models.family import Family, FamilyMember
from ....models.schemas import ChatMessageIn, ChatMessageOut, ChatHistoryResponse, VoiceMessageIn, VoiceMessageOut
from ....core.security import verify_token
from ....services.prompt_builder import build_creator_system_prompt, build_member_system_prompt
from ....services.providers.aws.agent import AWSBedrockAgent
from ....services.interfaces.agent import AgentContext
from ....core.dependencies import get_stt_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# Reuse single instances (thread-safe; STT provider selected by STT_PROVIDER env var)
_agent = AWSBedrockAgent()
_stt   = get_stt_provider()


def _get_or_create_clone_for_creator(user_email: str, db: Session) -> Clone:
    """Return existing clone or auto-create one from assessment answers (MVP flow)."""
    clone = db.query(Clone).filter(
        Clone.creator_email == user_email,
        Clone.is_active == True,
    ).first()
    if clone:
        return clone

    # No clone yet — build persona from saved assessment answers (or empty fallback)
    c_row = db.query(AssessmentAnswer).filter(AssessmentAnswer.user_email == user_email).first()
    answers = json.loads(c_row.answers) if c_row else {}
    persona = build_creator_system_prompt(answers)

    display = user_email.split("@")[0].capitalize()
    clone = Clone(
        id=str(uuid.uuid4()),
        name=f"{display}'s Clone",
        title="Family Clone",
        description="",
        persona_prompt=persona,
        creator_email=user_email,
        domains="family",
        is_active=True,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    logger.info(f"[chat] Auto-created clone {clone.id} for {user_email}")
    return clone


def _get_clone_for_member(user_email: str, db: Session) -> Clone:
    membership = db.query(FamilyMember).filter(
        FamilyMember.user_email == user_email,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="You are not in any family")

    family = db.query(Family).filter(Family.id == membership.family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    # Try explicit clone_id link first, then fall back to creator's active clone
    clone = None
    if family.clone_id:
        clone = db.query(Clone).filter(Clone.id == family.clone_id, Clone.is_active == True).first()

    if not clone and family.creator_email:
        clone = db.query(Clone).filter(
            Clone.creator_email == family.creator_email,
            Clone.is_active == True,
        ).first()

    if not clone:
        raise HTTPException(status_code=404, detail="No clone found for this family")
    return clone


def _load_history(user_email: str, clone_id: str, db: Session, limit: int = 20) -> list[dict]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_email == user_email, ChatMessage.clone_id == clone_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return [{"role": r.role, "content": r.content} for r in rows]


def _save_message(user_email: str, clone_id: str, role: str, content: str, db: Session) -> ChatMessage:
    msg = ChatMessage(
        id=str(uuid.uuid4()),
        user_email=user_email,
        clone_id=clone_id,
        role=role,
        content=content,
        created_at=datetime.utcnow(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/message", response_model=ChatMessageOut)
def send_message(
    payload: ChatMessageIn,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")
    role       = token.get("custom:role", "")

    # ── Resolve clone + system prompt ────────────────────────────────────────
    if role == "member":
        clone = _get_clone_for_member(user_email, db)

        # Build family_info dict from DB
        membership  = db.query(FamilyMember).filter(FamilyMember.user_email == user_email).first()
        family      = db.query(Family).filter(Family.id == membership.family_id).first()
        family_info = {
            "creator_name":  (family.creator_email or "").split("@")[0],
            "creator_email": family.creator_email or "",
            "relationship":  membership.relationship or "family member",
        }

        # Load member assessment answers
        m_row = db.query(MemberAssessmentAnswer).filter(
            MemberAssessmentAnswer.user_email == user_email
        ).first()
        member_answers = json.loads(m_row.answers) if m_row else {}

        system_prompt = build_member_system_prompt(family_info, member_answers)

    else:
        # creator / platform_admin / legacy (no role)
        clone = _get_or_create_clone_for_creator(user_email, db)

        c_row = db.query(AssessmentAnswer).filter(AssessmentAnswer.user_email == user_email).first()
        creator_answers = json.loads(c_row.answers) if c_row else {}

        # Use persona_prompt from clone if assessment answers not yet saved
        if creator_answers:
            system_prompt = build_creator_system_prompt(creator_answers)
        else:
            system_prompt = clone.persona_prompt or build_creator_system_prompt({})

    # ── Load history ─────────────────────────────────────────────────────────
    history = _load_history(user_email, clone.id, db, limit=20)

    # Bedrock requires conversation to start with a user message — strip leading assistant turns
    first_user = next((i for i, m in enumerate(history) if m["role"] == "user"), None)
    history = history[first_user:] if first_user is not None else []

    # ── Build Bedrock context ─────────────────────────────────────────────────
    if payload.is_opening:
        # Hidden trigger — not persisted in DB
        trigger = "Please start our conversation."
        context = AgentContext(
            clone_id=clone.id,
            domain="family",
            session_id=user_email,
            persona_prompt=system_prompt,
            history=[],  # no prior history for opening
        )
        try:
            response = _agent._chat_sync(trigger, context)
        except Exception as e:
            logger.error(f"[chat] Bedrock error (opening): {e}")
            raise HTTPException(status_code=502, detail="Clone is unavailable right now")

        # Only save the assistant greeting — the trigger is never stored
        msg = _save_message(user_email, clone.id, "assistant", response, db)
        return ChatMessageOut.model_validate(msg)

    # ── Normal user message ───────────────────────────────────────────────────
    context = AgentContext(
        clone_id=clone.id,
        domain="family",
        session_id=user_email,
        persona_prompt=system_prompt,
        history=history,
    )
    try:
        response = _agent._chat_sync(payload.message, context)
    except Exception as e:
        logger.error(f"[chat] Bedrock error: {e}")
        raise HTTPException(status_code=502, detail="Clone is unavailable right now")

    # Persist both turns
    _save_message(user_email, clone.id, "user",      payload.message, db)
    assistant_msg = _save_message(user_email, clone.id, "assistant", response,       db)

    return ChatMessageOut.model_validate(assistant_msg)


@router.get("/history", response_model=ChatHistoryResponse)
def get_history(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")
    role       = token.get("custom:role", "")

    clone = _get_clone_for_member(user_email, db) if role == "member" else _get_or_create_clone_for_creator(user_email, db)

    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_email == user_email, ChatMessage.clone_id == clone.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
        .all()
    )
    return ChatHistoryResponse(
        messages=[ChatMessageOut.model_validate(r) for r in rows],
        clone_name=clone.name,
    )


@router.post("/voice-message", response_model=VoiceMessageOut)
async def send_voice_message(
    payload: VoiceMessageIn,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Transcribe audio and send as a chat message. Returns transcript + assistant response."""
    user_email = token.get("email", "")
    role       = token.get("custom:role", "")

    # ── Resolve clone + system prompt ────────────────────────────────────────
    if role == "member":
        clone = _get_clone_for_member(user_email, db)

        membership  = db.query(FamilyMember).filter(FamilyMember.user_email == user_email).first()
        family      = db.query(Family).filter(Family.id == membership.family_id).first()
        family_info = {
            "creator_name":  (family.creator_email or "").split("@")[0],
            "creator_email": family.creator_email or "",
            "relationship":  membership.relationship or "family member",
        }
        m_row = db.query(MemberAssessmentAnswer).filter(
            MemberAssessmentAnswer.user_email == user_email
        ).first()
        member_answers = json.loads(m_row.answers) if m_row else {}
        system_prompt  = build_member_system_prompt(family_info, member_answers)

    else:
        clone = _get_or_create_clone_for_creator(user_email, db)
        c_row = db.query(AssessmentAnswer).filter(AssessmentAnswer.user_email == user_email).first()
        creator_answers = json.loads(c_row.answers) if c_row else {}
        if creator_answers:
            system_prompt = build_creator_system_prompt(creator_answers)
        else:
            system_prompt = clone.persona_prompt or build_creator_system_prompt({})

    # ── Transcribe audio ─────────────────────────────────────────────────────
    audio_bytes = base64.b64decode(payload.audio_data)
    try:
        transcript = await _stt.transcribe(audio_bytes, audio_format=payload.format)
    except Exception as e:
        logger.error(f"[chat/voice] STT error: {e}")
        raise HTTPException(status_code=502, detail="Could not transcribe audio")

    if not transcript.strip():
        raise HTTPException(status_code=422, detail="No speech detected")

    # ── Load history + call Bedrock ──────────────────────────────────────────
    history = _load_history(user_email, clone.id, db, limit=20)
    first_user = next((i for i, m in enumerate(history) if m["role"] == "user"), None)
    history = history[first_user:] if first_user is not None else []

    context = AgentContext(
        clone_id=clone.id,
        domain="family",
        session_id=user_email,
        persona_prompt=system_prompt,
        history=history,
    )
    try:
        response = _agent._chat_sync(transcript, context)
    except Exception as e:
        logger.error(f"[chat/voice] Bedrock error: {e}")
        raise HTTPException(status_code=502, detail="Clone is unavailable right now")

    # ── Persist both turns ───────────────────────────────────────────────────
    _save_message(user_email, clone.id, "user", transcript, db)
    assistant_msg = _save_message(user_email, clone.id, "assistant", response, db)

    return VoiceMessageOut(
        transcript=transcript,
        id=assistant_msg.id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        created_at=assistant_msg.created_at,
    )


@router.delete("/history", status_code=204)
def clear_history(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_email = token.get("email", "")
    role       = token.get("custom:role", "")

    try:
        clone = _get_clone_for_member(user_email, db) if role == "member" else _get_or_create_clone_for_creator(user_email, db)
    except HTTPException:
        return  # no clone yet — nothing to clear

    db.query(ChatMessage).filter(
        ChatMessage.user_email == user_email,
        ChatMessage.clone_id == clone.id,
    ).delete()
    db.commit()
