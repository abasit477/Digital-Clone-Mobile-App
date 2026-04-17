"""
Family management endpoints.
Creator role: create family, view family, invite members, remove members.
Member role: join via invite code, get their family's clone.
"""
import uuid
import secrets
import string
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.family import Family, FamilyMember
from ....models.clone import Clone
from ....models.schemas import (
    FamilyCreate, FamilyResponse, FamilyMemberOut,
    InviteRequest, JoinRequest, JoinResponse,
    CloneListItem,
)
from ....core.security import verify_token
from ....services.email import send_invite_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/families", tags=["families"])


def _require_role(token: dict, *roles: str) -> str:
    """Return the caller's email if their role is in `roles`, else 403.
    Users with no role set are treated as 'creator' (token refresh lag after signup)."""
    caller_role = token.get("custom:role", "") or "creator"
    email = token.get("email", "")
    if caller_role not in roles:
        raise HTTPException(status_code=403, detail=f"Role '{caller_role}' not allowed here")
    return email


def _gen_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ── Creator endpoints ─────────────────────────────────────────────────────────

@router.post("", response_model=FamilyResponse, status_code=201)
def create_family(
    payload: FamilyCreate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Creator creates a family and links their clone."""
    creator_email = _require_role(token, "creator", "platform_admin")

    existing = db.query(Family).filter(Family.creator_email == creator_email).first()
    if existing:
        raise HTTPException(status_code=409, detail="You already have a family")

    family = Family(
        id=str(uuid.uuid4()),
        name=payload.name,
        creator_email=creator_email,
        clone_id=payload.clone_id,
    )
    db.add(family)

    # Add creator as a member with role "creator"
    creator_member = FamilyMember(
        id=str(uuid.uuid4()),
        family_id=family.id,
        email=creator_email,
        user_email=creator_email,
        role="creator",
        invite_code=_gen_code(),
    )
    from datetime import datetime
    creator_member.accepted_at = datetime.utcnow()
    db.add(creator_member)
    db.commit()
    db.refresh(family)

    members = db.query(FamilyMember).filter(FamilyMember.family_id == family.id).all()
    result = FamilyResponse(
        id=family.id,
        name=family.name,
        creator_email=family.creator_email,
        clone_id=family.clone_id,
        created_at=family.created_at,
        members=[FamilyMemberOut.model_validate(m) for m in members],
    )
    return result


@router.get("/mine", response_model=FamilyResponse)
def get_my_family(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Creator gets their own family and member list."""
    creator_email = _require_role(token, "creator", "platform_admin")
    family = db.query(Family).filter(Family.creator_email == creator_email).first()
    if not family:
        raise HTTPException(status_code=404, detail="No family found")

    members = db.query(FamilyMember).filter(FamilyMember.family_id == family.id).all()
    return FamilyResponse(
        id=family.id,
        name=family.name,
        creator_email=family.creator_email,
        clone_id=family.clone_id,
        created_at=family.created_at,
        members=[FamilyMemberOut.model_validate(m) for m in members],
    )


@router.post("/invite", response_model=FamilyMemberOut, status_code=201)
def invite_member(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Creator invites a member by email. Sends SES email with invite code."""
    creator_email = _require_role(token, "creator", "platform_admin")
    family = db.query(Family).filter(Family.creator_email == creator_email).first()
    if not family:
        raise HTTPException(status_code=404, detail="Create a family first")

    # Prevent duplicate invites for same email
    existing = db.query(FamilyMember).filter(
        FamilyMember.family_id == family.id,
        FamilyMember.email == payload.email,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This email is already invited")

    invite_code = _gen_code()
    member = FamilyMember(
        id=str(uuid.uuid4()),
        family_id=family.id,
        email=payload.email,
        user_email=None,
        role="member",
        invite_code=invite_code,
        relationship=payload.relationship,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    # Send invite email (fire-and-forget style; log failures but don't fail the request)
    creator_name = token.get("name", creator_email)
    try:
        send_invite_email(
            to_email=payload.email,
            creator_name=creator_name,
            family_name=family.name,
            invite_code=invite_code,
        )
    except Exception as e:
        logger.warning(f"SES invite email failed (non-fatal): {e}")

    return FamilyMemberOut.model_validate(member)


@router.delete("/members/{member_id}", status_code=204)
def remove_member(
    member_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Creator removes a member from the family."""
    creator_email = _require_role(token, "creator", "platform_admin")
    family = db.query(Family).filter(Family.creator_email == creator_email).first()
    if not family:
        raise HTTPException(status_code=404, detail="No family found")

    member = db.query(FamilyMember).filter(
        FamilyMember.id == member_id,
        FamilyMember.family_id == family.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "creator":
        raise HTTPException(status_code=400, detail="Cannot remove the creator")

    db.delete(member)
    db.commit()


# ── Member endpoints ──────────────────────────────────────────────────────────

@router.post("/join", response_model=JoinResponse)
def join_family(
    payload: JoinRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Member accepts an invite by entering their 8-char code."""
    from datetime import datetime
    user_email = token.get("email", "")

    member = db.query(FamilyMember).filter(
        FamilyMember.invite_code == payload.invite_code.upper(),
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if member.accepted_at is not None:
        raise HTTPException(status_code=409, detail="Invite code already used")

    member.user_email = user_email
    member.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(member)

    family = db.query(Family).filter(Family.id == member.family_id).first()
    base = FamilyMemberOut.model_validate(member)
    return JoinResponse(
        **base.model_dump(),
        family_name=family.name if family else "",
        creator_email=family.creator_email if family else "",
    )


@router.get("/my-clone", response_model=CloneListItem)
def get_my_family_clone(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Member gets the clone they have access to via their family."""
    user_email = token.get("email", "")

    membership = db.query(FamilyMember).filter(
        FamilyMember.user_email == user_email,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="You are not in any family")

    family = db.query(Family).filter(Family.id == membership.family_id).first()
    if not family or not family.clone_id:
        raise HTTPException(status_code=404, detail="No clone linked to this family")

    clone = db.query(Clone).filter(Clone.id == family.clone_id, Clone.is_active == True).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found or inactive")

    return clone


# ── Persona synthesis endpoint ────────────────────────────────────────────────

from ....models.schemas import OnboardingAnswers, PersonaSynthesisResponse
from ....services.persona_synthesis import synthesize_persona


@router.post("/synthesize-persona", response_model=PersonaSynthesisResponse)
def synthesize_persona_endpoint(
    payload: OnboardingAnswers,
    token: dict = Depends(verify_token),
):
    """Synthesize a persona_prompt + knowledge_text from onboarding answers."""
    _require_role(token, "creator", "platform_admin")
    result = synthesize_persona(payload.answers)
    return PersonaSynthesisResponse(**result)
