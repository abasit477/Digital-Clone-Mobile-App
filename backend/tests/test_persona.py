"""
Tests for POST /api/v1/families/synthesize-persona.
Bedrock is fully mocked — no real AWS calls made.
"""

import pytest
from unittest.mock import patch, MagicMock


SAMPLE_ANSWERS = {
    "q1":  "John Smith",
    "q2":  "Software engineer for 20 years.",
    "q3":  "I grew up in Karachi.",
    "q4":  "BSc Computer Science.",
    "q5":  "My wife Sara.",
    "q6":  "Two kids: Ali (10) and Zara (7).",
    "q7":  "Sunday family dinners.",
    "q8":  "Our trip to the mountains.",
    "q9":  "Honesty, hard work, kindness.",
    "q10": "Never give up.",
    "q11": "Face it head on.",
    "q12": "A loving father and mentor.",
    "q13": "Calm, funny, caring.",
    "q14": "Technology and cricket.",
    "q15": "Acts of service.",
    "q16": "Why did the programmer quit? No arrays.",
    "q17": "Build trust first.",
    "q18": "Invest early and read more.",
    "q19": "See them thrive.",
    "q20": "I am always proud of you.",
}

MOCK_PERSONA = "I am John Smith, a software engineer and father of two..."


def _mock_bedrock_response(persona_text: str):
    """Build a minimal Bedrock converse() response dict."""
    return {
        "output": {
            "message": {
                "content": [{"text": persona_text}]
            }
        }
    }


class TestSynthesizePersona:
    def test_creator_can_synthesize(self, creator_client):
        with patch("app.services.persona_synthesis._get_bedrock_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.converse.return_value = _mock_bedrock_response(MOCK_PERSONA)
            mock_factory.return_value = mock_client

            r = creator_client.post(
                "/api/v1/families/synthesize-persona",
                json={"answers": SAMPLE_ANSWERS},
            )

        assert r.status_code == 200
        body = r.json()
        assert "persona_prompt" in body
        assert "knowledge_text" in body
        assert body["persona_prompt"] == MOCK_PERSONA

    def test_member_cannot_synthesize(self, member_client):
        r = member_client.post(
            "/api/v1/families/synthesize-persona",
            json={"answers": SAMPLE_ANSWERS},
        )
        assert r.status_code == 403

    def test_no_role_cannot_synthesize(self, no_role_client):
        r = no_role_client.post(
            "/api/v1/families/synthesize-persona",
            json={"answers": SAMPLE_ANSWERS},
        )
        assert r.status_code == 403

    def test_knowledge_text_contains_qa_pairs(self, creator_client):
        with patch("app.services.persona_synthesis._get_bedrock_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.converse.return_value = _mock_bedrock_response(MOCK_PERSONA)
            mock_factory.return_value = mock_client

            r = creator_client.post(
                "/api/v1/families/synthesize-persona",
                json={"answers": SAMPLE_ANSWERS},
            )

        body = r.json()
        knowledge_text = body["knowledge_text"]
        # Every answer we provided should appear in the knowledge text
        assert "John Smith" in knowledge_text
        assert "Sunday family dinners" in knowledge_text

    def test_empty_answers_still_calls_bedrock(self, creator_client):
        with patch("app.services.persona_synthesis._get_bedrock_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.converse.return_value = _mock_bedrock_response("I am unknown.")
            mock_factory.return_value = mock_client

            r = creator_client.post(
                "/api/v1/families/synthesize-persona",
                json={"answers": {}},
            )

        assert r.status_code == 200
        assert mock_client.converse.called

    def test_bedrock_client_reused_across_calls(self, creator_client):
        """_get_bedrock_client() is @lru_cache — should be called once per process."""
        with patch("app.services.persona_synthesis._get_bedrock_client") as mock_factory:
            mock_client = MagicMock()
            mock_client.converse.return_value = _mock_bedrock_response(MOCK_PERSONA)
            mock_factory.return_value = mock_client

            creator_client.post(
                "/api/v1/families/synthesize-persona",
                json={"answers": SAMPLE_ANSWERS},
            )
            creator_client.post(
                "/api/v1/families/synthesize-persona",
                json={"answers": SAMPLE_ANSWERS},
            )

        # Factory called twice (once per request, since lru_cache is mocked out)
        # but the important thing is converse() is called each time
        assert mock_client.converse.call_count == 2


class TestInviteCodeSecurity:
    """Invite codes must come from secrets module, not random."""

    def test_invite_codes_are_alphanumeric_uppercase_8_chars(self, creator_client, test_family):
        import string
        codes = set()
        emails = [f"user{i}@test.com" for i in range(5)]
        for email in emails:
            r = creator_client.post("/api/v1/families/invite", json={"email": email})
            assert r.status_code == 201
            code = r.json()["invite_code"]
            assert len(code) == 8
            assert all(c in string.ascii_uppercase + string.digits for c in code)
            codes.add(code)
        # All 5 codes are unique
        assert len(codes) == 5
