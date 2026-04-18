"""
Avatar endpoints.
POST /avatar/upload — receives a base64 face photo, saves it to static/avatars/,
                      updates clone.avatar_url, returns the full accessible URL.
"""
import base64
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ....db.database import get_db
from ....models.clone import Clone
from ....models.family import Family, FamilyMember
from ....core.security import verify_token
from ....core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/avatar", tags=["avatar"])


class AvatarUploadIn(BaseModel):
    image_data: str   # base64-encoded JPEG


class AvatarUploadOut(BaseModel):
    avatar_url: str   # full URL: SERVER_BASE_URL + /static/avatars/{clone_id}.jpg


@router.post("/upload", response_model=AvatarUploadOut)
def upload_avatar(
    payload: AvatarUploadIn,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    settings  = get_settings()
    user_email = token.get("email", "")
    role       = token.get("custom:role", "")

    # ── Resolve clone ─────────────────────────────────────────────────────────
    if role == "member":
        membership = db.query(FamilyMember).filter(
            FamilyMember.user_email == user_email
        ).first()
        if not membership:
            raise HTTPException(status_code=404, detail="Not in any family")
        family = db.query(Family).filter(Family.id == membership.family_id).first()
        clone  = db.query(Clone).filter(Clone.id == family.clone_id, Clone.is_active == True).first() if family else None
    else:
        clone = db.query(Clone).filter(
            Clone.creator_email == user_email, Clone.is_active == True
        ).first()

    if not clone:
        raise HTTPException(status_code=404, detail="No clone found — complete onboarding first")

    # ── Decode and save image ─────────────────────────────────────────────────
    try:
        image_bytes = base64.b64decode(payload.image_data)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid base64 image data")

    save_dir  = "static/avatars"
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, f"{clone.id}.jpg")

    try:
        with open(file_path, "wb") as f:
            f.write(image_bytes)
    except OSError as e:
        logger.error(f"[avatar] Failed to save image: {e}")
        raise HTTPException(status_code=500, detail="Failed to save avatar image")

    # ── Update clone record ───────────────────────────────────────────────────
    avatar_url = f"{settings.SERVER_BASE_URL}/static/avatars/{clone.id}.jpg"
    clone.avatar_url = avatar_url
    db.commit()

    logger.info(f"[avatar] Saved avatar for clone {clone.id} → {avatar_url}")
    return AvatarUploadOut(avatar_url=avatar_url)
