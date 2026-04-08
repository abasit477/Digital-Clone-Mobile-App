from typing import Protocol, runtime_checkable
from dataclasses import dataclass, field


@dataclass
class AgentContext:
    clone_id: str
    domain: str                       # e.g. "family", "professional", "general"
    session_id: str
    persona_prompt: str               # the clone's system prompt
    knowledge_snippets: list[str] = field(default_factory=list)
    history: list[dict] = field(default_factory=list)  # [{"role": "user"|"assistant", "content": "..."}]


@dataclass
class AgentResponse:
    text: str
    session_id: str


@runtime_checkable
class AgentProvider(Protocol):
    """LLM agent contract. Swap AWS Bedrock → OpenAI / Google Gemini
    by implementing this interface and updating LLM_PROVIDER in .env."""

    async def chat(self, user_message: str, context: AgentContext) -> AgentResponse:
        """Generate the clone's response given the user's message and context."""
        ...
