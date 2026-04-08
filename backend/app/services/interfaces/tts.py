from typing import Protocol, runtime_checkable


@runtime_checkable
class TTSProvider(Protocol):
    """Text-to-speech contract. Swap AWS Polly → ElevenLabs / Google TTS
    by implementing this interface and updating TTS_PROVIDER in .env."""

    async def synthesize(self, text: str, voice_id: str = "") -> bytes:
        """Convert text to audio bytes (MP3)."""
        ...
