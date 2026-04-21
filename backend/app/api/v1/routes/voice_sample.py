"""
POST /voice/upload-sample — upload a WAV voice sample for XTTS voice cloning.

The creator records ~30s of their voice. The WAV is stored on the server and
the clone's voice_sample_path is updated so future TTS calls use their cloned voice.
"""
import base64
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.clone import Clone
from ....models.family import Family, FamilyMember
from ....models.schemas import VoiceSampleIn, VoiceSampleOut
from ....core.security import verify_token
from ....core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice-clone"])


@router.post("/upload-sample", response_model=VoiceSampleOut)
def upload_voice_sample(
    payload: VoiceSampleIn,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Accept a base64-encoded WAV, save it, and link it to the caller's clone."""
    settings = get_settings()
    user_email = token.get("email", "")
    role = token.get("custom:role", "")

    # ── Resolve clone ────────────────────────────────────────────────────────
    if role == "member":
        membership = db.query(FamilyMember).filter(
            FamilyMember.user_email == user_email
        ).first()
        if not membership:
            raise HTTPException(status_code=404, detail="Not in any family")
        family = db.query(Family).filter(Family.id == membership.family_id).first()
        clone = db.query(Clone).filter(Clone.id == family.clone_id).first()
    else:
        clone = db.query(Clone).filter(
            Clone.creator_email == user_email,
            Clone.is_active == True,
        ).first()

    if not clone:
        raise HTTPException(status_code=404, detail="No clone found — complete onboarding first")

    # ── Decode and save WAV ──────────────────────────────────────────────────
    try:
        audio_bytes = base64.b64decode(payload.audio_data)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid base64 audio data")

    static_dir = settings.STATIC_DIR or os.path.join(
        os.path.dirname(__file__), "../../../../..", "static"
    )
    samples_dir = os.path.join(os.path.abspath(static_dir), "voice_samples")
    os.makedirs(samples_dir, exist_ok=True)

    sample_path = os.path.join(samples_dir, f"{clone.id}.wav")

    # expo-av on iOS records m4a/AAC regardless of the filename extension.
    # Convert to PCM WAV via pydub so XTTS can read it with soundfile.
    try:
        import io
        from pydub import AudioSegment
        seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
        seg = seg.set_frame_rate(22050).set_channels(1).set_sample_width(2)  # 22kHz mono 16-bit
        seg.export(sample_path, format="wav")
        logger.info(f"[voice-clone] Converted and saved voice sample for clone {clone.id} "
                    f"({len(audio_bytes)} raw bytes → {os.path.getsize(sample_path)} WAV bytes)")
    except Exception as e:
        # Fallback: save raw bytes and hope it's already PCM WAV
        logger.warning(f"[voice-clone] pydub conversion failed ({e}), saving raw bytes")
        with open(sample_path, "wb") as f:
            f.write(audio_bytes)

    # ── Update clone record ──────────────────────────────────────────────────
    clone.voice_sample_path = sample_path
    db.commit()

    base_url = settings.SERVER_BASE_URL.rstrip("/")
    voice_sample_url = f"{base_url}/static/voice_samples/{clone.id}.wav"

    return VoiceSampleOut(voice_sample_url=voice_sample_url)
