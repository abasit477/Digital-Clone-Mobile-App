"""
Dependency injection factory.
Returns the active provider based on env-var selection.
Swapping a provider = change one .env value, restart.
"""
from functools import lru_cache
from ..core.config import get_settings
from ..services.interfaces.stt import STTProvider
from ..services.interfaces.tts import TTSProvider
from ..services.interfaces.agent import AgentProvider
from ..services.interfaces.knowledge import KnowledgeProvider


@lru_cache
def get_stt_provider() -> STTProvider:
    settings = get_settings()
    if settings.STT_PROVIDER == "aws":
        from ..services.providers.aws.stt import AWSTranscribeProvider
        return AWSTranscribeProvider()
    if settings.STT_PROVIDER == "whisper":
        from ..services.providers.local.stt import FasterWhisperProvider
        return FasterWhisperProvider(model_size=settings.WHISPER_MODEL_SIZE)
    raise ValueError(f"Unknown STT provider: {settings.STT_PROVIDER}")


@lru_cache
def get_tts_provider() -> TTSProvider:
    settings = get_settings()
    if settings.TTS_PROVIDER == "aws":
        from ..services.providers.aws.tts import AWSPollyProvider
        return AWSPollyProvider()
    if settings.TTS_PROVIDER == "xtts":
        from ..services.providers.local.xtts import XTTSProvider
        return XTTSProvider()
    if settings.TTS_PROVIDER == "f5tts":
        from ..services.providers.local.f5tts_provider import F5TTSProvider
        return F5TTSProvider()
    raise ValueError(f"Unknown TTS provider: {settings.TTS_PROVIDER}")


@lru_cache
def get_agent_provider() -> AgentProvider:
    settings = get_settings()
    if settings.LLM_PROVIDER == "aws":
        from ..services.providers.aws.agent import AWSBedrockAgent
        return AWSBedrockAgent()
    raise ValueError(f"Unknown LLM provider: {settings.LLM_PROVIDER}")


@lru_cache
def get_knowledge_provider() -> KnowledgeProvider:
    settings = get_settings()
    if settings.KNOWLEDGE_PROVIDER == "chroma":
        from ..services.providers.chroma.knowledge import ChromaKnowledgeProvider
        return ChromaKnowledgeProvider()
    raise ValueError(f"Unknown knowledge provider: {settings.KNOWLEDGE_PROVIDER}")
