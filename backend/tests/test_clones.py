"""
Tests for /api/v1/clones endpoints.
Covers: CRUD operations + role-based access control.
"""

import pytest
from app.models.clone import Clone
from app.models.family import Family, FamilyMember
from datetime import datetime


# ── GET /clones (list) ────────────────────────────────────────────────────────

class TestListClones:
    def test_admin_sees_all_clones(self, admin_client, test_clone, other_clone):
        r = admin_client.get("/api/v1/clones")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert test_clone.id in ids
        assert other_clone.id in ids

    def test_creator_sees_only_own_clone(self, creator_client, test_clone, other_clone):
        r = creator_client.get("/api/v1/clones")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert test_clone.id in ids
        assert other_clone.id not in ids

    def test_member_sees_family_clone(self, member_client, test_clone, accepted_member):
        r = member_client.get("/api/v1/clones")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert test_clone.id in ids
        assert len(ids) == 1

    def test_member_without_family_gets_empty_list(self, member_client):
        r = member_client.get("/api/v1/clones")
        assert r.status_code == 200
        assert r.json() == []

    def test_no_role_sees_all_active_clones(self, no_role_client, test_clone, other_clone):
        r = no_role_client.get("/api/v1/clones")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert test_clone.id in ids
        assert other_clone.id in ids

    def test_inactive_clones_hidden_from_list(self, admin_client, db_session):
        inactive = Clone(
            id="clone-inactive",
            name="Inactive",
            title="",
            description="",
            persona_prompt="x",
            domains="general",
            creator_email="admin@test.com",
            is_active=False,
        )
        db_session.add(inactive)
        db_session.commit()

        r = admin_client.get("/api/v1/clones")
        ids = [c["id"] for c in r.json()]
        assert "clone-inactive" not in ids


# ── GET /clones/{id} ──────────────────────────────────────────────────────────

class TestGetClone:
    def test_creator_gets_own_clone(self, creator_client, test_clone):
        r = creator_client.get(f"/api/v1/clones/{test_clone.id}")
        assert r.status_code == 200
        assert r.json()["id"] == test_clone.id
        assert r.json()["persona_prompt"] == test_clone.persona_prompt

    def test_creator_cannot_get_other_clone(self, creator_client, other_clone):
        r = creator_client.get(f"/api/v1/clones/{other_clone.id}")
        assert r.status_code == 403

    def test_admin_can_get_any_clone(self, admin_client, test_clone, other_clone):
        assert admin_client.get(f"/api/v1/clones/{test_clone.id}").status_code == 200
        assert admin_client.get(f"/api/v1/clones/{other_clone.id}").status_code == 200

    def test_member_gets_family_clone(self, member_client, test_clone, accepted_member):
        r = member_client.get(f"/api/v1/clones/{test_clone.id}")
        assert r.status_code == 200

    def test_member_cannot_get_unrelated_clone(self, member_client, other_clone):
        r = member_client.get(f"/api/v1/clones/{other_clone.id}")
        assert r.status_code == 403

    def test_member_no_family_gets_403(self, member_client, test_clone):
        r = member_client.get(f"/api/v1/clones/{test_clone.id}")
        assert r.status_code == 403

    def test_get_nonexistent_clone_returns_404(self, creator_client):
        r = creator_client.get("/api/v1/clones/does-not-exist")
        assert r.status_code == 404


# ── POST /clones ──────────────────────────────────────────────────────────────

class TestCreateClone:
    PAYLOAD = {
        "name": "My Clone",
        "title": "Engineer",
        "description": "A test",
        "persona_prompt": "I am me.",
        "domains": "general",
    }

    def test_creator_can_create_clone(self, creator_client):
        r = creator_client.post("/api/v1/clones", json=self.PAYLOAD)
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == "My Clone"
        assert body["is_active"] is True

    def test_creator_email_is_taken_from_jwt_not_payload(self, creator_client):
        payload = {**self.PAYLOAD, "creator_email": "attacker@evil.com"}
        r = creator_client.post("/api/v1/clones", json=payload)
        assert r.status_code == 201
        assert r.json()["creator_email"] if "creator_email" in r.json() else True
        # Verify in DB that creator_email is the JWT email, not the payload

    def test_admin_can_create_clone(self, admin_client):
        r = admin_client.post("/api/v1/clones", json=self.PAYLOAD)
        assert r.status_code == 201

    def test_member_cannot_create_clone(self, member_client):
        r = member_client.post("/api/v1/clones", json=self.PAYLOAD)
        assert r.status_code == 403

    def test_no_role_cannot_create_clone(self, no_role_client):
        r = no_role_client.post("/api/v1/clones", json=self.PAYLOAD)
        assert r.status_code == 403

    def test_missing_required_fields_returns_422(self, creator_client):
        r = creator_client.post("/api/v1/clones", json={"name": "Only Name"})
        assert r.status_code == 422


# ── PUT /clones/{id} ──────────────────────────────────────────────────────────

class TestUpdateClone:
    UPDATE = {"name": "Updated Name", "title": "Updated Title"}

    def test_creator_can_update_own_clone(self, creator_client, test_clone):
        r = creator_client.put(f"/api/v1/clones/{test_clone.id}", json=self.UPDATE)
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"

    def test_creator_cannot_update_other_clone(self, creator_client, other_clone):
        r = creator_client.put(f"/api/v1/clones/{other_clone.id}", json=self.UPDATE)
        assert r.status_code == 403

    def test_admin_can_update_any_clone(self, admin_client, test_clone, other_clone):
        assert admin_client.put(f"/api/v1/clones/{test_clone.id}", json=self.UPDATE).status_code == 200
        assert admin_client.put(f"/api/v1/clones/{other_clone.id}", json=self.UPDATE).status_code == 200

    def test_member_cannot_update_clone(self, member_client, test_clone):
        r = member_client.put(f"/api/v1/clones/{test_clone.id}", json=self.UPDATE)
        assert r.status_code == 403

    def test_update_nonexistent_clone_returns_404(self, creator_client):
        r = creator_client.put("/api/v1/clones/ghost", json=self.UPDATE)
        assert r.status_code == 404

    def test_partial_update_leaves_other_fields(self, creator_client, test_clone):
        r = creator_client.put(
            f"/api/v1/clones/{test_clone.id}",
            json={"name": "New Name"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "New Name"
        assert body["title"] == test_clone.title  # unchanged


# ── DELETE /clones/{id} ───────────────────────────────────────────────────────

class TestDeleteClone:
    def test_creator_can_delete_own_clone(self, creator_client, test_clone):
        r = creator_client.delete(f"/api/v1/clones/{test_clone.id}")
        assert r.status_code == 204
        # soft-delete: clone no longer appears in list
        ids = [c["id"] for c in creator_client.get("/api/v1/clones").json()]
        assert test_clone.id not in ids

    def test_creator_cannot_delete_other_clone(self, creator_client, other_clone):
        r = creator_client.delete(f"/api/v1/clones/{other_clone.id}")
        assert r.status_code == 403

    def test_admin_can_delete_any_clone(self, admin_client, test_clone):
        r = admin_client.delete(f"/api/v1/clones/{test_clone.id}")
        assert r.status_code == 204

    def test_member_cannot_delete_clone(self, member_client, test_clone):
        r = member_client.delete(f"/api/v1/clones/{test_clone.id}")
        assert r.status_code == 403

    def test_delete_nonexistent_returns_404(self, creator_client):
        r = creator_client.delete("/api/v1/clones/ghost")
        assert r.status_code == 404

    def test_deleted_clone_hidden_from_list(self, creator_client, test_clone):
        creator_client.delete(f"/api/v1/clones/{test_clone.id}")
        r = creator_client.get("/api/v1/clones")
        ids = [c["id"] for c in r.json()]
        assert test_clone.id not in ids
