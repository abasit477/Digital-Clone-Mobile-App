"""
ChromaDB knowledge provider.
Runs locally with disk persistence — no extra infrastructure needed for development.
Swap to Pinecone / AWS Bedrock KB by implementing KnowledgeProvider and
changing KNOWLEDGE_PROVIDER in .env.
"""
import asyncio
import logging
import time
import uuid

import chromadb
from chromadb.utils import embedding_functions

from ....core.config import get_settings
from ....services.interfaces.knowledge import Document

logger = logging.getLogger(__name__)


class ChromaKnowledgeProvider:
    def __init__(self):
        settings = get_settings()
        logger.info("[ChromaDB] Initializing persistent client at: %s", settings.CHROMA_PERSIST_DIR)
        self._client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        logger.info("[ChromaDB] Loading embedding function (downloads model on first use)...")
        t0 = time.time()
        self._ef = embedding_functions.DefaultEmbeddingFunction()
        logger.info("[ChromaDB] Embedding function ready in %.2fs", time.time() - t0)

    def _get_collection(self, clone_id: str):
        collection = self._client.get_or_create_collection(
            name=f"clone_{clone_id}",
            embedding_function=self._ef,
        )
        logger.info("[ChromaDB] Collection 'clone_%s' — current doc count: %d", clone_id, collection.count())
        return collection

    # ── Search ────────────────────────────────────────────────────────────────

    async def search(self, clone_id: str, query: str, top_k: int = 5) -> list[Document]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._search_sync, clone_id, query, top_k)

    def _search_sync(self, clone_id: str, query: str, top_k: int) -> list[Document]:
        logger.info("[ChromaDB] search | clone=%s | query='%s...' | top_k=%d",
                    clone_id, query[:60], top_k)
        t0 = time.time()
        collection = self._get_collection(clone_id)

        if collection.count() == 0:
            logger.warning("[ChromaDB] search | collection is empty — no results")
            return []

        n = min(top_k, collection.count())
        results = collection.query(query_texts=[query], n_results=n)
        docs = []
        for i, doc in enumerate(results["documents"][0]):
            score  = 1.0 - (results["distances"][0][i] if results.get("distances") else 0)
            source = results["metadatas"][0][i].get("source", "") if results.get("metadatas") else ""
            logger.info("[ChromaDB] search | result %d | score=%.3f | source='%s' | preview='%s...'",
                        i + 1, score, source, doc[:80])
            docs.append(Document(content=doc, source=source, score=score))

        logger.info("[ChromaDB] search | returned %d results in %.2fs", len(docs), time.time() - t0)
        return docs

    # ── Ingest ────────────────────────────────────────────────────────────────

    async def ingest(self, clone_id: str, text: str, source: str = "") -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._ingest_sync, clone_id, text, source)

    def _ingest_sync(self, clone_id: str, text: str, source: str) -> None:
        logger.info("[ChromaDB] ingest | clone=%s | source='%s' | text_length=%d chars",
                    clone_id, source, len(text))
        t0 = time.time()

        # 1. Chunk
        chunks = self._chunk(text, size=500, overlap=100)
        logger.info("[ChromaDB] ingest | split into %d chunks (size=500, overlap=100)", len(chunks))
        for i, chunk in enumerate(chunks):
            logger.info("[ChromaDB] ingest | chunk %d/%d | %d chars | preview: '%s...'",
                        i + 1, len(chunks), len(chunk), chunk[:60])

        # 2. Generate IDs and metadata
        ids       = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [{"source": source, "clone_id": clone_id} for _ in chunks]

        # 3. Embed + store (this is the slow step on first run)
        logger.info("[ChromaDB] ingest | embedding %d chunks (may download model on first run)...", len(chunks))
        t_embed = time.time()
        collection = self._get_collection(clone_id)
        collection.add(documents=chunks, ids=ids, metadatas=metadatas)
        logger.info("[ChromaDB] ingest | embedding + storage done in %.2fs", time.time() - t_embed)

        new_count = collection.count()
        logger.info("[ChromaDB] ingest | complete in %.2fs | collection now has %d total docs",
                    time.time() - t0, new_count)

    def _chunk(self, text: str, size: int, overlap: int) -> list[str]:
        chunks, start = [], 0
        while start < len(text):
            end = start + size
            chunks.append(text[start:end].strip())
            start += size - overlap
        return [c for c in chunks if c]

    # ── Delete ────────────────────────────────────────────────────────────────

    async def delete_clone(self, clone_id: str) -> None:
        logger.info("[ChromaDB] delete_clone | clone=%s", clone_id)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.delete_collection(f"clone_{clone_id}"),
        )
        logger.info("[ChromaDB] delete_clone | done")
