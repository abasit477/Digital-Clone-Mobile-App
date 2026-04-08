# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Backend

Requires Python 3.11 (3.14 is too new — pydantic-core and tokenizers wheels don't exist yet).

```bash
# Create venv with Python 3.11
/opt/homebrew/bin/python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run dev server (accessible from phone on local network)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run only on localhost
uvicorn app.main:app --reload
```

API docs auto-generated at `http://localhost:8000/docs`.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` — required for voice interactions (Bedrock, Transcribe, Polly)
- Cognito IDs are already set to the project pool/client
- Everything else has working defaults for local dev

ChromaDB persists to `./chroma_data/`. SQLite DB is `./digital_clone.db`. Both are created automatically on first run.

## Architecture

```
api/v1/routes/        ← HTTP + WebSocket endpoints
core/                 ← Config (pydantic-settings), security (Cognito JWT), DI factory
db/                   ← SQLAlchemy engine + session
models/               ← ORM (clone.py) + Pydantic schemas (schemas.py)
services/interfaces/  ← Python Protocols: STTProvider, TTSProvider, AgentProvider, KnowledgeProvider
services/providers/   ← Concrete implementations per provider (aws/, chroma/, google/)
```

### Provider Swap Pattern

All four AI services (STT, TTS, LLM, knowledge) are behind Protocol interfaces. To swap a provider:
1. Set the env var (`STT_PROVIDER=google`)
2. Add a class in `services/providers/google/stt.py` implementing `STTProvider`
3. Add the `elif` branch in `core/dependencies.py`

The factory in `core/dependencies.py` is the only place that knows which concrete class to instantiate.

### Voice Interaction Flow

WebSocket at `/ws/voice/{clone_id}`:
1. Client sends `init` message with `clone_id` and `domain`
2. Client streams `audio_chunk` messages (base64 PCM)
3. Client sends `end_of_speech`
4. Server: AWS Transcribe (STT) → ChromaDB search (RAG, top-5) → Bedrock Claude (LLM) → AWS Polly (TTS)
5. Server streams audio back in 32 KB chunks
6. Session history kept in-memory (`_sessions` dict in `voice.py`) — replace with Redis for multi-instance

### RAG / Knowledge Base

ChromaDB collection per clone: `clone_{id}`. Text is chunked at 500 chars / 100-char overlap, embedded with `sentence-transformers/all-MiniLM-L6-v2` (auto-downloaded ~90 MB on first ingest). Top-5 results injected into Claude's system prompt.

Knowledge endpoints (`/api/v1/admin/clones/{id}/ingest`):
- POST with `{ text, source }` — plain text ingest
- POST `/ingest/file` — multipart `.txt` or `.md` upload
- DELETE `/knowledge` — clears the clone's ChromaDB collection

### Clone Domain System

Each clone has a `domains` field (comma-separated string). At interaction time the client passes the active `domain`. `aws/agent.py` appends domain-specific instruction to Claude's system prompt: `family` → warm/nurturing tone, `professional` → clear/decisive, `general` → balanced.

## Key Settings

| Setting | Default | Notes |
|---------|---------|-------|
| `DATABASE_URL` | `sqlite:///./digital_clone.db` | Switch to postgres URL for prod |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.7 Sonnet if available |
| `COGNITO_USER_POOL_ID` | `us-east-1_orFUeN52q` | Project pool |
| `COGNITO_CLIENT_ID` | `78gtfs160lm6m8lvcdovj64krt` | Project client |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | Local disk persistence |
| `STT_PROVIDER` | `aws` | AWS Transcribe |
| `TTS_PROVIDER` | `aws` | AWS Polly |
| `LLM_PROVIDER` | `aws` | AWS Bedrock |
| `KNOWLEDGE_PROVIDER` | `chroma` | ChromaDB |
