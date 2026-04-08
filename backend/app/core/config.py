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

    # ── Provider selection ────────────────────────────────────────────────────
    # Swap to "google" (or any registered provider) without changing code.
    STT_PROVIDER: str = "aws"
    TTS_PROVIDER: str = "aws"
    LLM_PROVIDER: str = "aws"
    KNOWLEDGE_PROVIDER: str = "chroma"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
