import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import get_settings
from .db.database import Base, get_engine
from .models import clone       # noqa: F401 — registers ORM model with Base
from .models import family      # noqa: F401 — registers Family + FamilyMember with Base
from .models import assessment  # noqa: F401 — registers AssessmentAnswer, MemberAssessmentAnswer, ChatMessage
from .api.v1.routes import clones, knowledge, voice, health, families, chat, assessments, voice_sample

logger = logging.getLogger(__name__)


def _prewarm_tts():
    """Load the local TTS model into memory at startup so the first request is fast."""
    try:
        settings = get_settings()
        if settings.TTS_PROVIDER == "f5tts":
            from .services.providers.local.f5tts_provider import _get_model
            _get_model()
        elif settings.TTS_PROVIDER == "xtts":
            from .services.providers.local.xtts import _get_model
            _get_model()
    except Exception as e:
        logger.warning(f"[startup] TTS pre-warm failed (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables on startup
    Base.metadata.create_all(bind=get_engine())

    # Pre-warm local TTS model in background thread so first voice request is fast
    _settings = get_settings()
    if _settings.TTS_PROVIDER in ("f5tts", "xtts"):
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, _prewarm_tts)

    yield


settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving (avatars, voice samples, generated audio/video) ──────
_static_base = os.path.abspath(
    settings.STATIC_DIR or os.path.join(os.path.dirname(__file__), "..", "static")
)
for _subdir in ("avatars", "voice_samples", "audio", "videos"):
    os.makedirs(os.path.join(_static_base, _subdir), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_base), name="static")

# REST routes
app.include_router(health.router)
app.include_router(clones.router,       prefix="/api/v1")
app.include_router(knowledge.router,    prefix="/api/v1")

# Family routes
app.include_router(families.router,     prefix="/api/v1")

# Chat + Assessment routes
app.include_router(chat.router,         prefix="/api/v1")
app.include_router(assessments.router,  prefix="/api/v1")

# Voice clone routes
app.include_router(voice_sample.router, prefix="/api/v1")

# WebSocket route
app.include_router(voice.router,        prefix="/api/v1")
