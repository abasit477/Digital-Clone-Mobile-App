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
from .api.v1.routes import clones, knowledge, voice, health, families, chat, assessments, avatar


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables on startup
    Base.metadata.create_all(bind=get_engine())
    # Ensure static dirs exist
    os.makedirs("static/avatars", exist_ok=True)
    os.makedirs("static/videos", exist_ok=True)
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

# REST routes
app.include_router(health.router)
app.include_router(clones.router,    prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")

# Family routes
app.include_router(families.router, prefix="/api/v1")

# Chat + Assessment routes
app.include_router(chat.router,        prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")

# Avatar route
app.include_router(avatar.router, prefix="/api/v1")

# WebSocket route
app.include_router(voice.router, prefix="/api/v1")

# Serve uploaded avatars and generated videos
app.mount("/static", StaticFiles(directory="static"), name="static")
