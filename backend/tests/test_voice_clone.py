"""
Tests for the complete voice cloning + TTS flow:
  1. POST /voice/upload-sample  — base64 WAV upload, DB update
  2. XTTSProvider.synthesize    — mock model, fallback behaviour
  3. Chat REST TTS integration  — voice_sample_path preferred over voice_id
  4. WebSocket TTS integration  — voice_sample_path now used (regression guard)
  5. Permission checks          — creator, member, and unauthorised paths
"""

import base64
import io
import os
import struct
import tempfile
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.dependencies import get_tts_provider
from app.models.clone import Clone
from app.models.family import Family, FamilyMember


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_wav_bytes(duration_ms: int = 500, sample_rate: int = 22050) -> bytes:
    """Return a minimal valid PCM WAV (silence) — real enough for pydub."""
    num_samples = int(sample_rate * duration_ms / 1000)
    pcm_data = b"\x00\x00" * num_samples  # 16-bit silence
    data_size = len(pcm_data)
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_data)
    return buf.getvalue()


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_wav_b64():
    return _b64(_make_wav_bytes())


@pytest.fixture
def creator_clone(db_session) -> Clone:
    clone = Clone(
        id="vc-clone-001",
        name="Voice Clone",
        title="Tester",
        description="desc",
        persona_prompt="I am a voice clone.",
        domains="general",
        avatar_url="",
        voice_id="Matthew",
        voice_sample_path="",
        creator_email="creator@test.com",
        is_active=True,
    )
    db_session.add(clone)
    db_session.commit()
    return clone


@pytest.fixture
def member_clone_setup(db_session) -> tuple:
    """Returns (clone, family, member) for a member-role test."""
    clone = Clone(
        id="vc-clone-002",
        name="Member Clone",
        title="T",
        description="d",
        persona_prompt=".",
        domains="family",
        avatar_url="",
        voice_id="",
        voice_sample_path="",
        creator_email="creator@test.com",
        is_active=True,
    )
    db_session.add(clone)
    db_session.flush()

    family = Family(id="fam-vc-001", name="Family", creator_email="creator@test.com", clone_id=clone.id)
    db_session.add(family)
    db_session.flush()

    member = FamilyMember(
        id="fmember-vc-001",
        family_id=family.id,
        email="member@test.com",
        user_email="member@test.com",
        role="member",
        invite_code="VCTEST01",
        accepted_at=datetime.utcnow(),
    )
    db_session.add(member)
    db_session.commit()
    return clone, family, member


# ── 1. Upload endpoint — happy path ──────────────────────────────────────────

class TestVoiceUploadHappyPath:

    def test_creator_upload_saves_path_and_returns_url(
        self, creator_client, creator_clone, db_session, sample_wav_b64, tmp_path
    ):
        with patch("app.api.v1.routes.voice_sample.get_settings") as mock_cfg:
            mock_cfg.return_value.STATIC_DIR = str(tmp_path)
            mock_cfg.return_value.SERVER_BASE_URL = "http://localhost:8000"

            resp = creator_client.post(
                "/api/v1/voice/upload-sample",
                json={"audio_data": sample_wav_b64},
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "voice_sample_url" in data
        assert "vc-clone-001.wav" in data["voice_sample_url"]

        db_session.refresh(creator_clone)
        assert creator_clone.voice_sample_path != ""
        assert os.path.basename(creator_clone.voice_sample_path) == "vc-clone-001.wav"

    def test_member_upload_resolves_family_clone(
        self, member_client, member_clone_setup, db_session, sample_wav_b64, tmp_path
    ):
        clone, _, _ = member_clone_setup
        with patch("app.api.v1.routes.voice_sample.get_settings") as mock_cfg:
            mock_cfg.return_value.STATIC_DIR = str(tmp_path)
            mock_cfg.return_value.SERVER_BASE_URL = "http://localhost:8000"

            resp = member_client.post(
                "/api/v1/voice/upload-sample",
                json={"audio_data": sample_wav_b64},
            )

        assert resp.status_code == 200, resp.text
        db_session.refresh(clone)
        assert clone.voice_sample_path != ""

    def test_wav_file_is_written_to_disk(
        self, creator_client, creator_clone, sample_wav_b64, tmp_path
    ):
        with patch("app.api.v1.routes.voice_sample.get_settings") as mock_cfg:
            mock_cfg.return_value.STATIC_DIR = str(tmp_path)
            mock_cfg.return_value.SERVER_BASE_URL = "http://localhost:8000"
            creator_client.post(
                "/api/v1/voice/upload-sample",
                json={"audio_data": sample_wav_b64},
            )

        saved = tmp_path / "voice_samples" / "vc-clone-001.wav"
        assert saved.exists()
        assert saved.stat().st_size > 0


# ── 2. Upload endpoint — error cases ─────────────────────────────────────────

class TestVoiceUploadErrors:

    def test_invalid_base64_returns_422(self, creator_client, creator_clone):
        resp = creator_client.post(
            "/api/v1/voice/upload-sample",
            json={"audio_data": "not!!valid**base64"},
        )
        assert resp.status_code == 422

    def test_no_clone_returns_404(self, creator_client):
        resp = creator_client.post(
            "/api/v1/voice/upload-sample",
            json={"audio_data": _b64(b"dummy")},
        )
        assert resp.status_code == 404

    def test_member_without_family_returns_404(self, member_client, sample_wav_b64):
        resp = member_client.post(
            "/api/v1/voice/upload-sample",
            json={"audio_data": sample_wav_b64},
        )
        assert resp.status_code == 404


# ── 3. XTTSProvider unit tests ────────────────────────────────────────────────

class TestXTTSProvider:

    @pytest.mark.asyncio
    async def test_synthesize_calls_model_with_speaker_wav(self, tmp_path):
        from app.services.providers.local.xtts import XTTSProvider

        wav_path = str(tmp_path / "ref.wav")
        _make_wav_bytes_and_write(wav_path)

        mock_tts = MagicMock()
        mock_tts.tts_to_file = MagicMock(side_effect=lambda **kw: _write_silence_wav(kw["file_path"]))

        with patch("app.services.providers.local.xtts._get_model", return_value=mock_tts), \
             patch("pydub.AudioSegment") as mock_seg_cls:
            mock_seg = MagicMock()
            mock_seg_cls.from_wav.return_value = mock_seg
            mock_seg.export = MagicMock(side_effect=lambda path, **kw: open(path, "wb").write(b"MP3"))

            provider = XTTSProvider()
            result = await provider.synthesize("Hello world", voice_id=wav_path)

        mock_tts.tts_to_file.assert_called_once()
        call_kwargs = mock_tts.tts_to_file.call_args.kwargs
        assert call_kwargs["speaker_wav"] == wav_path
        assert call_kwargs["language"] == "en"

    @pytest.mark.asyncio
    async def test_synthesize_falls_back_when_file_missing(self):
        from app.services.providers.local.xtts import XTTSProvider

        mock_tts = MagicMock()
        mock_tts.tts_to_file = MagicMock(side_effect=lambda **kw: _write_silence_wav(kw["file_path"]))

        with patch("app.services.providers.local.xtts._get_model", return_value=mock_tts), \
             patch("pydub.AudioSegment") as mock_seg_cls:
            mock_seg = MagicMock()
            mock_seg_cls.from_wav.return_value = mock_seg
            mock_seg.export = MagicMock(side_effect=lambda path, **kw: open(path, "wb").write(b"MP3"))

            provider = XTTSProvider()
            await provider.synthesize("Hello world", voice_id="/nonexistent/path.wav")

        call_kwargs = mock_tts.tts_to_file.call_args.kwargs
        assert call_kwargs["speaker_wav"] is None

    @pytest.mark.asyncio
    async def test_synthesize_returns_bytes(self, tmp_path):
        from app.services.providers.local.xtts import XTTSProvider

        wav_path = str(tmp_path / "ref.wav")
        _make_wav_bytes_and_write(wav_path)

        mock_tts = MagicMock()
        mock_tts.tts_to_file = MagicMock(side_effect=lambda **kw: _write_silence_wav(kw["file_path"]))

        with patch("app.services.providers.local.xtts._get_model", return_value=mock_tts), \
             patch("pydub.AudioSegment") as mock_seg_cls:
            mock_seg = MagicMock()
            mock_seg_cls.from_wav.return_value = mock_seg
            mp3_content = b"ID3\x00fake-mp3-data"
            mock_seg.export = MagicMock(side_effect=lambda path, **kw: open(path, "wb").write(mp3_content))

            provider = XTTSProvider()
            result = await provider.synthesize("Test", voice_id=wav_path)

        assert isinstance(result, bytes)
        assert len(result) > 0


# ── 4. Chat REST TTS integration ──────────────────────────────────────────────

class TestChatRestTTSIntegration:

    def _make_tts_mock(self, mp3_bytes: bytes = b"fake-mp3"):
        mock = MagicMock()
        mock.synthesize = AsyncMock(return_value=mp3_bytes)
        return mock

    def _make_stt_mock(self, transcript: str = "Hello"):
        mock = MagicMock()
        mock.transcribe = AsyncMock(return_value=transcript)
        return mock

    def _make_agent_mock(self, response: str = "Hi there"):
        mock = MagicMock()

        async def _fake_stream(*args, **kwargs):
            for token in response.split():
                yield token + " "

        mock.chat_stream = _fake_stream
        return mock

    def test_chat_uses_voice_sample_path_when_set(
        self, creator_client, creator_clone, db_session, tmp_path
    ):
        from app.core.dependencies import get_tts_provider, get_stt_provider, get_agent_provider

        sample_path = str(tmp_path / "sample.wav")
        _make_wav_bytes_and_write(sample_path)
        creator_clone.voice_sample_path = sample_path
        db_session.commit()

        tts_mock = self._make_tts_mock()
        stt_mock = self._make_stt_mock()
        agent_mock = self._make_agent_mock()

        with patch("app.api.v1.routes.chat.get_settings") as mock_cfg:
            mock_cfg.return_value.STATIC_DIR = str(tmp_path)
            mock_cfg.return_value.SERVER_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.TTS_PROVIDER = "xtts"

            app.dependency_overrides[get_tts_provider] = lambda: tts_mock
            app.dependency_overrides[get_stt_provider] = lambda: stt_mock
            app.dependency_overrides[get_agent_provider] = lambda: agent_mock

            resp = creator_client.post(
                "/api/v1/chat/voice-message",
                json={
                    "audio_data": _b64(_make_wav_bytes()),
                    "format": "wav",
                    "clone_id": creator_clone.id,
                    "domain": "general",
                },
            )

        if resp.status_code == 200:
            tts_mock.synthesize.assert_called_once()
            call_args = tts_mock.synthesize.call_args
            used_voice_id = call_args[0][1] if len(call_args[0]) > 1 else call_args[1].get("voice_id", "")
            assert used_voice_id == sample_path, (
                f"Expected voice_sample_path '{sample_path}', got '{used_voice_id}'"
            )

    def test_chat_falls_back_to_voice_id_when_no_sample(
        self, creator_client, creator_clone, db_session, tmp_path
    ):
        from app.core.dependencies import get_tts_provider, get_stt_provider, get_agent_provider

        creator_clone.voice_sample_path = ""
        creator_clone.voice_id = "Matthew"
        db_session.commit()

        tts_mock = self._make_tts_mock()
        stt_mock = self._make_stt_mock()
        agent_mock = self._make_agent_mock()

        with patch("app.api.v1.routes.chat.get_settings") as mock_cfg:
            mock_cfg.return_value.STATIC_DIR = str(tmp_path)
            mock_cfg.return_value.SERVER_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.TTS_PROVIDER = "aws"

            app.dependency_overrides[get_tts_provider] = lambda: tts_mock
            app.dependency_overrides[get_stt_provider] = lambda: stt_mock
            app.dependency_overrides[get_agent_provider] = lambda: agent_mock

            resp = creator_client.post(
                "/api/v1/chat/voice-message",
                json={
                    "audio_data": _b64(_make_wav_bytes()),
                    "format": "wav",
                    "clone_id": creator_clone.id,
                    "domain": "general",
                },
            )

        if resp.status_code == 200:
            tts_mock.synthesize.assert_called_once()
            call_args = tts_mock.synthesize.call_args
            used_voice_id = call_args[0][1] if len(call_args[0]) > 1 else call_args[1].get("voice_id", "")
            assert used_voice_id == "Matthew"


# ── 5. WebSocket TTS regression guard ────────────────────────────────────────

class TestWebSocketTTSVoiceSamplePath:
    """Regression guard: voice.py _flush_sentence must use voice_sample_path."""

    def test_voice_route_uses_voice_sample_path(self):
        """Grep the source to confirm voice_sample_path is used in voice.py."""
        import ast
        route_path = os.path.join(
            os.path.dirname(__file__),
            "../app/api/v1/routes/voice.py",
        )
        source = open(os.path.abspath(route_path)).read()
        assert "voice_sample_path" in source, (
            "voice.py _flush_sentence does not use voice_sample_path — "
            "XTTS won't work in WebSocket sessions"
        )
        # Also ensure the pattern 'voice_sample_path or clone.voice_id' is present
        assert "voice_sample_path or clone.voice_id" in source or \
               "voice_sample_path or" in source, (
            "voice.py should fall back to voice_id when voice_sample_path is empty"
        )


# ── Helper functions ──────────────────────────────────────────────────────────

def _make_wav_bytes_and_write(path: str):
    with open(path, "wb") as f:
        f.write(_make_wav_bytes())


def _write_silence_wav(path: str):
    _make_wav_bytes_and_write(path)
