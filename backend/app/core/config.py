from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Digital Clone API"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./digital_clone.db"

    # ── AWS ──────────────────────────────────────────────────────────────────
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Cognito — for JWT validation
    COGNITO_USER_POOL_ID: str = "us-east-1_orFUeN52q"
    COGNITO_CLIENT_ID: str = "78gtfs160lm6m8lvcdovj64krt"

    # Bedrock
    BEDROCK_MODEL_ID: str = "us.amazon.nova-pro-v1:0"

    # Polly
    POLLY_DEFAULT_VOICE: str = "Matthew"   # used when clone has no voice set
    POLLY_ENGINE: str = "neural"

    # SES — for sending invite emails
    SES_SENDER_EMAIL: str = ""

    # ── Provider selection ────────────────────────────────────────────────────
    # Swap to "google" (or any registered provider) without changing code.
    STT_PROVIDER: str = "whisper"   # "whisper" (local, fast) | "aws" (batch, slow)
    TTS_PROVIDER: str = "aws"
    LLM_PROVIDER: str = "aws"
    KNOWLEDGE_PROVIDER: str = "chroma"

    # faster-whisper model size: tiny | base | small | medium | large-v3
    # tiny (~40 MB, fastest) | base (~145 MB, good balance) | small (~490 MB, best accuracy)
    WHISPER_MODEL_SIZE: str = "base"

    # ── SadTalker ─────────────────────────────────────────────────────────────
    # Absolute path to the cloned SadTalker repo directory.
    # Leave empty to disable face video generation (voice messages return text only).
    SADTALKER_DIR: str = ""

    # ── Static file serving ───────────────────────────────────────────────────
    # External base URL of this server (used to build avatar/video URLs returned to mobile).
    # Must match EXPO_PUBLIC_API_URL minus /api/v1, e.g. http://192.168.1.10:8000
    SERVER_BASE_URL: str = "http://localhost:8000"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
