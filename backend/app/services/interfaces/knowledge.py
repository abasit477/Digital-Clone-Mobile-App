from typing import Protocol, runtime_checkable
from dataclasses import dataclass


@dataclass
class Document:
    content: str
    source: str = ""
    score: float = 0.0


@runtime_checkable
class KnowledgeProvider(Protocol):
    """Vector knowledge base contract. Swap ChromaDB → Pinecone / AWS Bedrock KB
    by implementing this interface and updating KNOWLEDGE_PROVIDER in .env."""

    async def search(self, clone_id: str, query: str, top_k: int = 5) -> list[Document]:
        """Retrieve the most relevant knowledge snippets for a given query."""
        ...

    async def ingest(self, clone_id: str, text: str, source: str = "") -> None:
        """Add a text document to the clone's knowledge base."""
        ...

    async def delete_clone(self, clone_id: str) -> None:
        """Remove all knowledge associated with a clone."""
        ...
