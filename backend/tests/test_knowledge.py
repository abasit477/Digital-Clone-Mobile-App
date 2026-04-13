"""
Tests for /api/v1/admin/clones/{id}/ingest and related knowledge endpoints.
AWS (ChromaDB) is fully mocked — no embedding model is loaded.
"""

import io
import pytest


class TestIngestText:
    def test_ingest_text_success(self, creator_client, test_clone):
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest",
            json={"text": "I grew up in Lahore and love cricket.", "source": "autobiography"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["clone_id"] == test_clone.id
        assert body["source"] == "autobiography"
        assert body["chunks_added"] >= 1

    def test_ingest_returns_chunk_estimate(self, creator_client, test_clone):
        long_text = "x" * 1200  # 1200 chars → ~3 chunks (1200 / 400)
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest",
            json={"text": long_text},
        )
        assert r.status_code == 200
        assert r.json()["chunks_added"] == 3

    def test_ingest_clone_not_found(self, creator_client):
        r = creator_client.post(
            "/api/v1/admin/clones/ghost/ingest",
            json={"text": "Some text"},
        )
        assert r.status_code == 404

    def test_ingest_requires_auth(self, db_session):
        """Endpoint must reject requests without a valid token."""
        from fastapi.testclient import TestClient
        from app.main import app
        # No dependency override — uses real verify_token which needs a real JWT
        bare_client = TestClient(app, raise_server_exceptions=False)
        r = bare_client.post(
            "/api/v1/admin/clones/clone-001/ingest",
            json={"text": "hello"},
        )
        assert r.status_code in (401, 403)


class TestIngestFile:
    def test_ingest_txt_file(self, creator_client, test_clone):
        content = b"My life story in plain text."
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest/file",
            files={"file": ("story.txt", io.BytesIO(content), "text/plain")},
        )
        assert r.status_code == 200
        assert r.json()["source"] == "story.txt"

    def test_ingest_md_file(self, creator_client, test_clone):
        content = b"# My Values\n\nHonesty is everything."
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest/file",
            files={"file": ("values.md", io.BytesIO(content), "text/markdown")},
        )
        assert r.status_code == 200

    def test_ingest_unsupported_extension_returns_422(self, creator_client, test_clone):
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest/file",
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        )
        assert r.status_code == 422

    def test_ingest_empty_file_returns_422(self, creator_client, test_clone):
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest/file",
            files={"file": ("empty.txt", io.BytesIO(b"   "), "text/plain")},
        )
        assert r.status_code == 422

    def test_ingest_file_clone_not_found(self, creator_client):
        r = creator_client.post(
            "/api/v1/admin/clones/ghost/ingest/file",
            files={"file": ("a.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert r.status_code == 404

    def test_ingest_file_custom_source_label(self, creator_client, test_clone):
        r = creator_client.post(
            f"/api/v1/admin/clones/{test_clone.id}/ingest/file",
            files={"file": ("notes.txt", io.BytesIO(b"Some notes."), "text/plain")},
            data={"source": "personal-notes"},
        )
        assert r.status_code == 200
        assert r.json()["source"] == "personal-notes"


class TestClearKnowledge:
    def test_clear_knowledge_success(self, creator_client, test_clone):
        r = creator_client.delete(f"/api/v1/admin/clones/{test_clone.id}/knowledge")
        assert r.status_code == 204

    def test_clear_knowledge_requires_auth(self, db_session):
        from fastapi.testclient import TestClient
        from app.main import app
        bare_client = TestClient(app, raise_server_exceptions=False)
        r = bare_client.delete("/api/v1/admin/clones/clone-001/knowledge")
        assert r.status_code in (401, 403)
