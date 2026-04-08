from fastapi import APIRouter
from ....core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    s = get_settings()
    return {
        "status": "ok",
        "providers": {
            "stt":       s.STT_PROVIDER,
            "tts":       s.TTS_PROVIDER,
            "llm":       s.LLM_PROVIDER,
            "knowledge": s.KNOWLEDGE_PROVIDER,
        },
    }
