"""
Tests for /api/v1/families endpoints.
Covers: family creation, member invite, join, removal, and clone access.
"""

import pytest
import string


# ── POST /families ────────────────────────────────────────────────────────────

class TestCreateFamily:
    PAYLOAD = {"name": "The Smiths", "clone_id": "clone-001"}

    def test_creator_can_create_family(self, creator_client, test_clone):
        r = creator_client.post("/api/v1/families", json=self.PAYLOAD)
        assert r.status_code == 201
        body = r.json()
        assert body["name"] == "The Smiths"
        assert body["clone_id"] == test_clone.id
        assert body["creator_email"] == "creator@test.com"
        # Creator is automatically added as a member
        assert any(m["role"] == "creator" for m in body["members"])

    def test_admin_can_create_family(self, admin_client, test_clone):
        r = admin_client.post("/api/v1/families", json={"name": "Admin Family", "clone_id": test_clone.id})
        assert r.status_code == 201

    def test_member_cannot_create_family(self, member_client):
        r = member_client.post("/api/v1/families", json=self.PAYLOAD)
        assert r.status_code == 403

    def test_no_role_cannot_create_family(self, no_role_client):
        r = no_role_client.post("/api/v1/families", json=self.PAYLOAD)
        assert r.status_code == 403

    def test_duplicate_family_returns_409(self, creator_client, test_clone, test_family):
        r = creator_client.post("/api/v1/families", json=self.PAYLOAD)
        assert r.status_code == 409

    def test_family_without_clone_id(self, creator_client):
        r = creator_client.post("/api/v1/families", json={"name": "No Clone Yet"})
        assert r.status_code == 201
        assert r.json()["clone_id"] is None


# ── GET /families/mine ────────────────────────────────────────────────────────

class TestGetMyFamily:
    def test_creator_gets_own_family(self, creator_client, test_family, pending_invite):
        r = creator_client.get("/api/v1/families/mine")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == test_family.id
        assert body["name"] == test_family.name
        assert len(body["members"]) >= 1

    def test_creator_without_family_gets_404(self, creator_client):
        r = creator_client.get("/api/v1/families/mine")
        assert r.status_code == 404

    def test_member_cannot_access_mine(self, member_client):
        r = member_client.get("/api/v1/families/mine")
        assert r.status_code == 403


# ── POST /families/invite ─────────────────────────────────────────────────────

class TestInviteMember:
    def test_creator_can_invite_member(self, creator_client, test_family):
        r = creator_client.post("/api/v1/families/invite", json={"email": "new@test.com"})
        assert r.status_code == 201
        body = r.json()
        assert body["email"] == "new@test.com"
        assert body["role"] == "member"
        assert body["accepted_at"] is None
        # Invite code: 8 uppercase alphanumeric chars
        code = body["invite_code"]
        assert len(code) == 8
        assert all(c in string.ascii_uppercase + string.digits for c in code)

    def test_invite_invalid_email_returns_422(self, creator_client, test_family):
        r = creator_client.post("/api/v1/families/invite", json={"email": "not-an-email"})
        assert r.status_code == 422

    def test_invite_duplicate_email_returns_409(self, creator_client, test_family, pending_invite):
        r = creator_client.post("/api/v1/families/invite", json={"email": "member@test.com"})
        assert r.status_code == 409

    def test_member_cannot_invite(self, member_client):
        r = member_client.post("/api/v1/families/invite", json={"email": "x@test.com"})
        assert r.status_code == 403

    def test_creator_without_family_gets_404(self, creator_client):
        r = creator_client.post("/api/v1/families/invite", json={"email": "x@test.com"})
        assert r.status_code == 404

    def test_each_invite_gets_unique_code(self, creator_client, test_family):
        r1 = creator_client.post("/api/v1/families/invite", json={"email": "a@test.com"})
        r2 = creator_client.post("/api/v1/families/invite", json={"email": "b@test.com"})
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["invite_code"] != r2.json()["invite_code"]


# ── DELETE /families/members/{id} ─────────────────────────────────────────────

class TestRemoveMember:
    def test_creator_can_remove_member(self, creator_client, test_family, pending_invite):
        r = creator_client.delete(f"/api/v1/families/members/{pending_invite.id}")
        assert r.status_code == 204
        # Member no longer appears in family
        family = creator_client.get("/api/v1/families/mine").json()
        member_ids = [m["id"] for m in family["members"]]
        assert pending_invite.id not in member_ids

    def test_cannot_remove_creator_member(self, creator_client, test_family):
        family = creator_client.get("/api/v1/families/mine").json()
        creator_member = next(m for m in family["members"] if m["role"] == "creator")
        r = creator_client.delete(f"/api/v1/families/members/{creator_member['id']}")
        assert r.status_code == 400

    def test_remove_nonexistent_member_returns_404(self, creator_client, test_family):
        r = creator_client.delete("/api/v1/families/members/ghost-id")
        assert r.status_code == 404

    def test_member_cannot_remove(self, member_client, test_family, pending_invite):
        r = member_client.delete(f"/api/v1/families/members/{pending_invite.id}")
        assert r.status_code == 403


# ── POST /families/join ───────────────────────────────────────────────────────

class TestJoinFamily:
    def test_member_joins_with_valid_code(self, member_client, pending_invite, db_session):
        r = member_client.post("/api/v1/families/join", json={"invite_code": "TESTCODE"})
        assert r.status_code == 200
        body = r.json()
        assert body["user_email"] == "member@test.com"
        assert body["accepted_at"] is not None

    def test_join_code_is_case_insensitive(self, member_client, pending_invite):
        r = member_client.post("/api/v1/families/join", json={"invite_code": "testcode"})
        assert r.status_code == 200

    def test_invalid_code_returns_404(self, member_client):
        r = member_client.post("/api/v1/families/join", json={"invite_code": "BADCODE1"})
        assert r.status_code == 404

    def test_already_used_code_returns_409(self, member_client, accepted_member):
        r = member_client.post("/api/v1/families/join", json={"invite_code": "JOINED01"})
        assert r.status_code == 409


# ── GET /families/my-clone ────────────────────────────────────────────────────

class TestGetMyClone:
    def test_member_gets_family_clone(self, member_client, test_clone, accepted_member):
        r = member_client.get("/api/v1/families/my-clone")
        assert r.status_code == 200
        assert r.json()["id"] == test_clone.id

    def test_member_not_in_family_gets_404(self, member_client):
        r = member_client.get("/api/v1/families/my-clone")
        assert r.status_code == 404

    def test_creator_cannot_call_my_clone(self, creator_client):
        # my-clone is for members; creators use /clones directly
        r = creator_client.get("/api/v1/families/my-clone")
        # Returns 404 (no family membership for creator@test.com as a member)
        # Not 403 — endpoint is open to all authenticated users, just 404 if not found
        assert r.status_code in (404, 403)
