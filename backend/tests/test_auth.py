"""
Tests for authentication and authorization enforcement.
Covers: missing tokens, invalid tokens, WebSocket auth.
"""

import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app


# ── HTTP endpoint auth ────────────────────────────────────────────────────────

@pytest.fixture
def bare_client():
    """TestClient with NO dependency overrides — uses real verify_token."""
    return TestClient(app, raise_server_exceptions=False)


class TestMissingToken:
    def test_list_clones_without_token(self, bare_client):
        r = bare_client.get("/api/v1/clones")
        assert r.status_code in (401, 403)

    def test_create_clone_without_token(self, bare_client):
        r = bare_client.post("/api/v1/clones", json={
            "name": "X", "title": "", "description": "",
            "persona_prompt": "I am.", "domains": "general",
        })
        assert r.status_code in (401, 403)

    def test_families_without_token(self, bare_client):
        r = bare_client.get("/api/v1/families/mine")
        assert r.status_code in (401, 403)

    def test_ingest_without_token(self, bare_client):
        r = bare_client.post("/api/v1/admin/clones/abc/ingest", json={"text": "hi"})
        assert r.status_code in (401, 403)


class TestInvalidToken:
    def test_garbage_token_rejected(self, bare_client):
        r = bare_client.get(
            "/api/v1/clones",
            headers={"Authorization": "Bearer this.is.garbage"},
        )
        assert r.status_code == 401

    def test_malformed_bearer_scheme(self, bare_client):
        r = bare_client.get(
            "/api/v1/clones",
            headers={"Authorization": "Token something"},
        )
        assert r.status_code in (401, 403)


# ── WebSocket auth ────────────────────────────────────────────────────────────

class TestWebSocketAuth:
    def test_websocket_without_token_gets_error(self, db_session):
        """Connecting with no token receives an error message then close."""
        from app.core.dependencies import get_knowledge_provider
        from app.db.database import get_db
        from tests.conftest import make_mock_knowledge

        def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_knowledge_provider] = lambda: make_mock_knowledge()

        with TestClient(app) as client:
            with client.websocket_connect("/api/v1/ws/voice") as ws:
                msg = json.loads(ws.receive_text())
                assert msg["type"] == "error"
                assert "authentication" in msg["message"].lower()

        app.dependency_overrides.clear()

    def test_websocket_with_invalid_token_gets_error(self, db_session):
        """Connecting with a bad token receives an error message."""
        from app.core.dependencies import get_knowledge_provider
        from app.db.database import get_db
        from tests.conftest import make_mock_knowledge

        def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_knowledge_provider] = lambda: make_mock_knowledge()

        with TestClient(app) as client:
            with client.websocket_connect("/api/v1/ws/voice?token=bad.jwt.token") as ws:
                msg = json.loads(ws.receive_text())
                assert msg["type"] == "error"
                assert "token" in msg["message"].lower() or "invalid" in msg["message"].lower()

        app.dependency_overrides.clear()

    def test_websocket_with_valid_token_proceeds(self, db_session, test_clone):
        """A valid token (mocked) allows connection and responds to init."""
        from app.core.dependencies import (
            get_knowledge_provider, get_stt_provider,
            get_tts_provider, get_agent_provider,
        )
        from app.db.database import get_db
        from app.core.security import verify_token_string
        from tests.conftest import make_mock_knowledge
        from unittest.mock import MagicMock, AsyncMock, patch

        def override_get_db():
            yield db_session

        mock_knowledge = make_mock_knowledge()
        mock_stt = MagicMock()
        mock_tts = MagicMock()
        mock_agent = MagicMock()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_knowledge_provider] = lambda: mock_knowledge
        app.dependency_overrides[get_stt_provider] = lambda: mock_stt
        app.dependency_overrides[get_tts_provider] = lambda: mock_tts
        app.dependency_overrides[get_agent_provider] = lambda: mock_agent

        with patch("app.api.v1.routes.voice.verify_token_string", return_value={"email": "creator@test.com"}):
            with TestClient(app) as client:
                with client.websocket_connect("/api/v1/ws/voice?token=fake.valid.token") as ws:
                    ws.send_text(json.dumps({
                        "type": "init",
                        "clone_id": test_clone.id,
                        "domain": "general",
                    }))
                    msg = json.loads(ws.receive_text())
                    assert msg["type"] == "ready"

        app.dependency_overrides.clear()


# ── Role enforcement spot checks ──────────────────────────────────────────────

class TestRoleEnforcement:
    """Quick checks that roles are enforced consistently across endpoints."""

    def test_member_blocked_from_create_clone(self, member_client):
        r = member_client.post("/api/v1/clones", json={
            "name": "X", "title": "", "description": "",
            "persona_prompt": "I am.", "domains": "general",
        })
        assert r.status_code == 403

    def test_member_blocked_from_create_family(self, member_client):
        r = member_client.post("/api/v1/families", json={"name": "X"})
        assert r.status_code == 403

    def test_member_blocked_from_inviting(self, member_client):
        r = member_client.post("/api/v1/families/invite", json={"email": "x@test.com"})
        assert r.status_code == 403

    def test_member_blocked_from_synthesize_persona(self, member_client):
        r = member_client.post("/api/v1/families/synthesize-persona", json={"answers": {}})
        assert r.status_code == 403
