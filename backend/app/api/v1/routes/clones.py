import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.clone import Clone
from ....models.family import Family, FamilyMember
from ....models.schemas import CloneCreate, CloneUpdate, CloneResponse, CloneListItem
from ....core.security import verify_token

router = APIRouter(prefix="/clones", tags=["clones"])


@router.get("", response_model=list[CloneListItem])
def list_clones(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """
    Return clones scoped by caller role:
    - platform_admin: all active clones
    - creator: only their own clone
    - member: the single clone belonging to their family
    - no role / legacy: all active clones (backward compat)
    """
    role = token.get("custom:role", "")
    email = token.get("email", "")

    if role == "platform_admin":
        return db.query(Clone).filter(Clone.is_active == True).all()

    if role == "creator":
        return db.query(Clone).filter(
            Clone.creator_email == email,
            Clone.is_active == True,
        ).all()

    if role == "member":
        membership = db.query(FamilyMember).filter(
            FamilyMember.user_email == email,
        ).first()
        if not membership:
            return []
        family = db.query(Family).filter(Family.id == membership.family_id).first()
        if not family or not family.clone_id:
            return []
        clone = db.query(Clone).filter(
            Clone.id == family.clone_id,
            Clone.is_active == True,
        ).first()
        return [clone] if clone else []

    # Legacy / no role — return all (existing users before role system)
    return db.query(Clone).filter(Clone.is_active == True).all()


@router.get("/{clone_id}", response_model=CloneResponse)
def get_clone(
    clone_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    role = token.get("custom:role", "")
    email = token.get("email", "")

    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")

    if role == "creator" and clone.creator_email != email:
        raise HTTPException(status_code=403, detail="Not your clone")
    elif role == "member":
        membership = db.query(FamilyMember).filter(FamilyMember.user_email == email).first()
        if not membership:
            raise HTTPException(status_code=403, detail="No family access")
        family = db.query(Family).filter(Family.id == membership.family_id).first()
        if not family or family.clone_id != clone_id:
            raise HTTPException(status_code=403, detail="Not your family's clone")

    return clone


@router.post("", response_model=CloneResponse, status_code=201)
def create_clone(
    payload: CloneCreate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Create a new clone. Only creators and admins may call this."""
    role = token.get("custom:role", "")
    if role not in ("creator", "platform_admin"):
        raise HTTPException(status_code=403, detail="Only creators can create clones")

    email = token.get("email", "")
    data = payload.model_dump()
    data["creator_email"] = email  # always derive from JWT, never trust payload
    clone = Clone(id=str(uuid.uuid4()), **data)
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


@router.put("/{clone_id}", response_model=CloneResponse)
def update_clone(
    clone_id: str,
    payload: CloneUpdate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Update clone details. Admins can update any; creators only their own."""
    role = token.get("custom:role", "")
    email = token.get("email", "")

    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")

    if role == "platform_admin":
        pass
    elif role == "creator":
        if clone.creator_email != email:
            raise HTTPException(status_code=403, detail="Not your clone")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(clone, field, value)
    db.commit()
    db.refresh(clone)
    return clone


@router.delete("/{clone_id}", status_code=204)
def delete_clone(
    clone_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Soft-delete a clone. Admins can delete any; creators only their own."""
    role = token.get("custom:role", "")
    email = token.get("email", "")

    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")

    if role == "platform_admin":
        pass
    elif role == "creator":
        if clone.creator_email != email:
            raise HTTPException(status_code=403, detail="Not your clone")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    clone.is_active = False
    db.commit()
