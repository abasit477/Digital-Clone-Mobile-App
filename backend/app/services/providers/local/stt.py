"""
Local Whisper STT provider using faster-whisper.
Runs inference in-process — no S3, no polling, no network round trips.
First call downloads the model (~145 MB for 'base'); subsequent calls are fast.

Install: pip install faster-whisper
Requires: ffmpeg on PATH for MP4/AAC audio (not needed for WAV).
"""
import asyncio
import os
import tempfile
import logging

logger = logging.getLogger(__name__)


class FasterWhisperProvider:
    """STT provider backed by faster-whisper (CTranslate2 + Whisper weights)."""

    # Class-level model cache — shared across all instances / requests
    _model = None

    def __init__(self, model_size: str = "base"):
        self._model_size = model_size

    def _get_model(self):
        if FasterWhisperProvider._model is None:
            from faster_whisper import WhisperModel
            logger.info(f"[whisper] Loading model '{self._model_size}' (first-time download if absent)…")
            FasterWhisperProvider._model = WhisperModel(
                self._model_size,
                device="cpu",
                compute_type="int8",  # fastest on CPU with minimal accuracy loss
            )
            logger.info("[whisper] Model ready.")
        return FasterWhisperProvider._model

    async def transcribe(self, audio_bytes: bytes, language_code: str = "en-US", audio_format: str = "wav") -> str:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio_bytes, audio_format)

    def _transcribe_sync(self, audio_bytes: bytes, audio_format: str = "wav") -> str:
        model = self._get_model()
        ext = f".{audio_format}"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name
        try:
            # beam_size=1 = greedy decoding — fastest with acceptable accuracy
            segments, _ = model.transcribe(tmp_path, language="en", beam_size=1)
            return " ".join(seg.text.strip() for seg in segments).strip()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
