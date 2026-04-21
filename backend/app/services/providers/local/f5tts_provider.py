"""
F5-TTS zero-shot voice cloning TTS provider.

Uses the F5-TTS flow-matching model (~600 MB, auto-downloaded from HuggingFace on first use).
Clones any voice from a 3-30s reference WAV — no fine-tuning, no time-stretching.

Install:  pip install f5-tts
voice_id: absolute path to a reference WAV file (6-30s of target speaker)
"""
import asyncio
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

_model = None
# cache ref_text per voice_id path — avoids re-running Whisper on every call
# We pre-transcribe with faster-whisper to avoid torchcodec/FFmpeg dependency in F5-TTS's ASR path
_ref_text_cache: dict[str, str] = {}

REF_MAX_MS = 8_000  # trim reference audio to first 8 s — F5-TTS quality degrades beyond ~12 s


def _get_model():
    global _model
    if _model is None:
        from f5_tts.api import F5TTS
        logger.info("[f5tts] Loading F5-TTS model (downloads ~600 MB on first run)...")
        _model = F5TTS(device="cpu")
        logger.info("[f5tts] F5-TTS model ready on CPU")
    return _model


def _transcribe_ref(wav_path: str) -> str:
    """Transcribe a reference WAV using faster-whisper (avoids torchcodec dependency)."""
    from faster_whisper import WhisperModel
    logger.info("[f5tts] Transcribing reference audio with faster-whisper small...")
    wm = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = wm.transcribe(wav_path, beam_size=5)
    text = " ".join(s.text for s in segments).strip()
    logger.info("[f5tts] ref_transcript: %r", text[:120])
    return text


class F5TTSProvider:
    """TTSProvider using F5-TTS zero-shot voice cloning."""

    async def synthesize(self, text: str, voice_id: str = "") -> bytes:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._synthesize_sync, text, voice_id)

    def _synthesize_sync(self, text: str, voice_id: str) -> bytes:
        model = _get_model()

        ref_file = None
        ref_text = ""
        _tmp_ref = None  # trimmed reference audio temp path

        if voice_id and os.path.isfile(voice_id):
            # Trim to first 8 s — longer references hurt F5-TTS cloning quality
            from pydub import AudioSegment
            seg = AudioSegment.from_wav(voice_id)
            seg = seg[:REF_MAX_MS]
            _tmp_ref = tempfile.mktemp(suffix=".wav")
            seg.export(_tmp_ref, format="wav")
            ref_file = _tmp_ref

            if voice_id in _ref_text_cache:
                ref_text = _ref_text_cache[voice_id]
            else:
                ref_text = _transcribe_ref(ref_file)
                _ref_text_cache[voice_id] = ref_text
        elif voice_id:
            logger.warning("[f5tts] Reference WAV not found: %s — using default voice", voice_id)

        tmp_wav = tempfile.mktemp(suffix=".wav")
        tmp_mp3 = tempfile.mktemp(suffix=".mp3")

        try:
            logger.info("[f5tts] Synthesizing %d chars...", len(text))

            # speed=0.83: natural conversational pace; cfg_strength=2.0: avoids diffusion artifacts
            # remove_silence=False: preserve inter-word pauses
            if ref_file:
                wav, sr, _ = model.infer(
                    ref_file=ref_file,
                    ref_text=ref_text,
                    gen_text=text,
                    remove_silence=False,
                    speed=0.83,
                    cfg_strength=2.0,
                    show_info=lambda x: logger.debug("[f5tts] %s", x),
                )
            else:
                import importlib.resources as pkg_res
                try:
                    ref_audio = str(pkg_res.files("f5_tts").joinpath("infer/examples/basic/basic_ref_en.wav"))
                    ref_txt = "Some call me nature, others call me mother nature."
                except Exception:
                    ref_audio = None
                    ref_txt = ""

                if ref_audio and os.path.isfile(ref_audio):
                    wav, sr, _ = model.infer(
                        ref_file=ref_audio,
                        ref_text=ref_txt,
                        gen_text=text,
                        remove_silence=False,
                        speed=0.83,
                        cfg_strength=2.0,
                        show_info=lambda x: logger.debug("[f5tts] %s", x),
                    )
                else:
                    raise RuntimeError("No reference audio and no bundled fallback found")

            # Convert numpy float32 wav → MP3 via soundfile + ffmpeg
            # F5-TTS outputs 24 kHz; ffmpeg SWR resamples to 44100 Hz (standard MPEG-1 rate)
            import soundfile as sf
            import subprocess

            logger.debug("[f5tts] wav sr=%s shape=%s", sr, getattr(wav, 'shape', '?'))
            wav_data = wav.squeeze() if hasattr(wav, 'squeeze') else wav
            sf.write(tmp_wav, wav_data, sr)

            proc = subprocess.run(
                ['ffmpeg', '-y', '-i', tmp_wav, '-ar', '44100', '-b:a', '128k', tmp_mp3],
                capture_output=True,
            )
            if proc.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {proc.stderr.decode()[:300]}")

            with open(tmp_mp3, "rb") as f:
                mp3_bytes = f.read()
            logger.info("[f5tts] Done — %d bytes", len(mp3_bytes))
            return mp3_bytes

        finally:
            for p in (tmp_wav, tmp_mp3):
                if os.path.exists(p):
                    os.unlink(p)
            if _tmp_ref and os.path.exists(_tmp_ref):
                os.unlink(_tmp_ref)
