from typing import Protocol, runtime_checkable


@runtime_checkable
class STTProvider(Protocol):
    """Speech-to-text contract. Swap AWS Transcribe → Google STT by
    implementing this interface and updating STT_PROVIDER in .env."""

    async def transcribe(self, audio_bytes: bytes, language_code: str = "en-US", audio_format: str = "mp4") -> str:
        """Convert audio bytes to a transcript string."""
        ...
