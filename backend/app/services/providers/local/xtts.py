"""
XTTS v2 zero-shot voice cloning TTS provider.

Uses Coqui TTS (pip install TTS) — downloads xtts_v2 model (~1.8 GB) on first load.
Clones any voice from a reference WAV sample — no pre-training needed.

Usage:
    Set TTS_PROVIDER=xtts in .env.
    voice_id = absolute path to a 6-60s WAV file of the target voice.
"""
import asyncio
import io
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

_model = None  # module-level singleton — loaded once on first call


def _get_model():
    global _model
    if _model is None:
        import torch
        os.environ["COQUI_TOS_AGREED"] = "1"
        device = "cpu"  # MPS unsupported for some XTTS v2 ops (output channels > 65536)
        logger.info(f"[xtts] Loading XTTS v2 model on {device}...")
        from TTS.api import TTS as CoquiTTS
        _model = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2")
        _model.to(device)
        logger.info(f"[xtts] XTTS v2 model ready on {device}")
    return _model


class XTTSProvider:
    """TTSProvider implementation using XTTS v2 zero-shot voice cloning."""

    async def synthesize(self, text: str, voice_id: str = "") -> bytes:
        """
        Synthesize text in the cloned voice.

        Args:
            text:     The text to speak.
            voice_id: Absolute path to a reference WAV file (6-60s of the target voice).
                      Falls back to a default neutral voice if empty or file not found.

        Returns:
            MP3 audio bytes.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._synthesize_sync, text, voice_id)

    def _prepare_speaker_wav(self, speaker_wav: str) -> str:
        """
        Strip silences and cap to 12s — XTTS v2 time-stretches output when the
        reference has long pauses or exceeds ~15s of active speech.
        Returns path to a cleaned temp WAV, or the original path on failure.
        """
        try:
            from pydub import AudioSegment, silence as pydub_silence
            seg = AudioSegment.from_wav(speaker_wav)
            # Remove chunks quieter than -40 dBFS, keeping 200ms min silence between words
            chunks = pydub_silence.split_on_silence(seg, min_silence_len=400, silence_thresh=-40, keep_silence=150)
            if not chunks:
                return speaker_wav
            clean = chunks[0]
            for c in chunks[1:]:
                clean += c
            # Cap at 12s — longer references don't improve quality and slow inference
            clean = clean[:12000]
            clean = clean.set_frame_rate(22050).set_channels(1).set_sample_width(2)
            tmp = tempfile.mktemp(suffix="_ref.wav")
            clean.export(tmp, format="wav")
            active_s = len(clean) / 1000
            logger.info(f"[xtts] Prepared reference: {active_s:.1f}s active speech (from {len(seg)/1000:.1f}s original)")
            return tmp
        except Exception as e:
            logger.warning(f"[xtts] Reference prep failed ({e}), using original")
            return speaker_wav

    def _synthesize_sync(self, text: str, speaker_wav: str) -> bytes:
        tts = _get_model()

        if speaker_wav and not os.path.isfile(speaker_wav):
            logger.warning(f"[xtts] Voice sample not found: {speaker_wav} — using default voice")
            speaker_wav = ""

        cleaned_ref = None
        if speaker_wav:
            cleaned_ref = self._prepare_speaker_wav(speaker_wav)
            if cleaned_ref != speaker_wav:
                speaker_wav = cleaned_ref

        tmp_wav = tempfile.mktemp(suffix=".wav")
        tmp_mp3 = tempfile.mktemp(suffix=".mp3")

        try:
            logger.info(f"[xtts] Synthesizing {len(text)} chars, sample={'yes' if speaker_wav else 'no (default)'}")
            tts.tts_to_file(
                text=text,
                speaker_wav=speaker_wav if speaker_wav else None,
                language="en",
                file_path=tmp_wav,
            )
            # Convert WAV → MP3 via pydub using a real temp file
            # (ffmpeg needs to seek; BytesIO doesn't work for mp3 encoding)
            from pydub import AudioSegment
            from pydub.effects import normalize
            seg = AudioSegment.from_wav(tmp_wav)
            seg = normalize(seg, headroom=3.0)

            # XTTS v2 sometimes generates time-stretched audio (known issue with certain voices).
            # Target: ~2.5 words/second. Speed up if actual duration exceeds 2x expected.
            word_count = len(text.split())
            expected_ms = (word_count / 2.5) * 1000
            actual_ms = len(seg)
            if actual_ms > expected_ms * 2.0:
                speed = min(actual_ms / expected_ms, 4.0)
                # Frame-rate trick: resample to original rate after declaring a higher rate
                seg = seg._spawn(seg.raw_data, overrides={"frame_rate": int(seg.frame_rate * speed)})
                seg = seg.set_frame_rate(24000)
                logger.info(f"[xtts] Speed corrected {speed:.1f}x ({actual_ms/1000:.1f}s → {len(seg)/1000:.1f}s)")

            seg.export(tmp_mp3, format="mp3", bitrate="128k")
            with open(tmp_mp3, "rb") as f:
                mp3_bytes = f.read()
            logger.info(f"[xtts] Done — {len(mp3_bytes)} bytes")
            return mp3_bytes
        finally:
            for p in (tmp_wav, tmp_mp3):
                if os.path.exists(p):
                    os.unlink(p)
            if cleaned_ref and cleaned_ref != speaker_wav and os.path.exists(cleaned_ref):
                os.unlink(cleaned_ref)
