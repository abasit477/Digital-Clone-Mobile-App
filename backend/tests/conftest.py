"""
Shared fixtures for the test suite.

Design:
- `db_engine` is function-scoped — a fresh in-memory SQLite per test.
- `db_session` uses the engine for test data setup (insert + commit).
- HTTP routes get a separate Session from the same engine via override_get_db.
  This avoids SQLite cross-thread session sharing, which causes ProgrammingError.
- `verify_token` overridden per-client — no real Cognito calls.
- `get_knowledge_provider` overridden with async mock — no ChromaDB/embeddings loaded.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import AsyncMock, MagicMock

from app.main import app
from app.db.database import Base, get_db
from app.core.security import verify_token
from app.core.dependencies import get_knowledge_provider
from app.models.clone import Clone
from app.models.family import Family, FamilyMember


# ── Database fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def db_engine():
    """
    Fresh in-memory SQLite engine per test.
    StaticPool ensures ALL sessions (setup + request handler) share the same
    connection, so data committed in the test is visible to route sessions.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    """
    Session for test data setup only.
    Always commit after inserting — routes use separate sessions from the same engine.
    """
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


# ── Mock knowledge provider ──────────────────────────────────────────────────

def make_mock_knowledge():
    mock = MagicMock()
    mock.ingest = AsyncMock(return_value=None)
    mock.search = AsyncMock(return_value=[])
    mock.delete_clone = AsyncMock(return_value=None)
    return mock


# ── Client factory ───────────────────────────────────────────────────────────

def make_client(db_engine, role: str, email: str) -> TestClient:
    """
    Build a TestClient with:
    - DB overridden to create fresh sessions from the test engine (thread-safe).
    - verify_token returns the given role/email.
    - knowledge provider is a no-op mock.
    """
    SessionFactory = sessionmaker(bind=db_engine)

    def override_get_db():
        session = SessionFactory()
        try:
            yield session
        finally:
            session.close()

    def override_verify_token():
        return {"custom:role": role, "email": email, "sub": str(uuid.uuid4())}

    def override_knowledge():
        return make_mock_knowledge()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[verify_token] = override_verify_token
    app.dependency_overrides[get_knowledge_provider] = override_knowledge

    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """Reset app.dependency_overrides after every test."""
    yield
    app.dependency_overrides.clear()


# ── Role-specific clients ────────────────────────────────────────────────────

@pytest.fixture
def admin_client(db_engine):
    return make_client(db_engine, "platform_admin", "admin@test.com")


@pytest.fixture
def creator_client(db_engine):
    return make_client(db_engine, "creator", "creator@test.com")


@pytest.fixture
def other_creator_client(db_engine):
    return make_client(db_engine, "creator", "other@test.com")


@pytest.fixture
def member_client(db_engine):
    return make_client(db_engine, "member", "member@test.com")


@pytest.fixture
def no_role_client(db_engine):
    return make_client(db_engine, "", "norole@test.com")


# ── Data fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def test_clone(db_session) -> Clone:
    """A clone owned by creator@test.com."""
    clone = Clone(
        id="clone-001",
        name="Test Clone",
        title="Test Title",
        description="A test clone",
        persona_prompt="I am a test persona.",
        domains="general,family",
        avatar_url="",
        voice_id="",
        creator_email="creator@test.com",
        is_active=True,
    )
    db_session.add(clone)
    db_session.commit()
    return clone


@pytest.fixture
def other_clone(db_session) -> Clone:
    """A clone owned by other@test.com."""
    clone = Clone(
        id="clone-002",
        name="Other Clone",
        title="Other Title",
        description="Another test clone",
        persona_prompt="I am another test persona.",
        domains="general",
        avatar_url="",
        voice_id="",
        creator_email="other@test.com",
        is_active=True,
    )
    db_session.add(clone)
    db_session.commit()
    return clone


@pytest.fixture
def test_family(db_session, test_clone) -> Family:
    """A family linked to test_clone, created by creator@test.com."""
    family = Family(
        id="family-001",
        name="Test Family",
        creator_email="creator@test.com",
        clone_id=test_clone.id,
    )
    db_session.add(family)

    from datetime import datetime
    creator_member = FamilyMember(
        id="member-creator",
        family_id=family.id,
        email="creator@test.com",
        user_email="creator@test.com",
        role="creator",
        invite_code="CREATOR1",
        accepted_at=datetime.utcnow(),
    )
    db_session.add(creator_member)
    db_session.commit()
    return family


@pytest.fixture
def pending_invite(db_session, test_family) -> FamilyMember:
    """A pending invite for member@test.com."""
    member = FamilyMember(
        id="member-001",
        family_id=test_family.id,
        email="member@test.com",
        user_email=None,
        role="member",
        invite_code="TESTCODE",
        accepted_at=None,
    )
    db_session.add(member)
    db_session.commit()
    return member


@pytest.fixture
def accepted_member(db_session, test_family) -> FamilyMember:
    """A member who has already joined (user_email set, accepted_at set)."""
    from datetime import datetime
    member = FamilyMember(
        id="member-002",
        family_id=test_family.id,
        email="member@test.com",
        user_email="member@test.com",
        role="member",
        invite_code="JOINED01",
        accepted_at=datetime.utcnow(),
    )
    db_session.add(member)
    db_session.commit()
    return member
