import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.clone import Clone
from ....models.schemas import CloneCreate, CloneUpdate, CloneResponse, CloneListItem
from ....core.security import verify_token

router = APIRouter(prefix="/clones", tags=["clones"])


@router.get("", response_model=list[CloneListItem])
def list_clones(
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Return all active clones. Shown on the clone selection screen."""
    return db.query(Clone).filter(Clone.is_active == True).all()


@router.get("/{clone_id}", response_model=CloneResponse)
def get_clone(
    clone_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")
    return clone


@router.post("", response_model=CloneResponse, status_code=201)
def create_clone(
    payload: CloneCreate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Admin-only: create a new clone."""
    clone = Clone(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


@router.put("/{clone_id}", response_model=CloneResponse)
def update_clone(
    clone_id: str,
    payload: CloneUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Admin-only: update clone details."""
    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(clone, field, value)
    db.commit()
    db.refresh(clone)
    return clone


@router.delete("/{clone_id}", status_code=204)
async def delete_clone(
    clone_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Admin-only: soft-delete a clone."""
    clone = db.query(Clone).filter(Clone.id == clone_id).first()
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")
    clone.is_active = False
    db.commit()
