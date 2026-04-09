# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

- **Never commit directly to `main`** — all development happens on `develop` or a feature branch
- Merge into `main` only when a feature is complete and tested
- Repo: `abasit477/Digital-Clone-Mobile-App`

## Project Structure

This is a monorepo with two sub-projects:

```
mobile/    ← Expo React Native app (SDK 54)
backend/   ← Python FastAPI server
```

## Running the Backend

Requires **Python 3.11** (`/opt/homebrew/bin/python3.11`) — 3.14 is too new for pydantic-core/tokenizers wheels.

```bash
# First time setup
/opt/homebrew/bin/python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Dev server — use 0.0.0.0 so the phone can reach it on the local network
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Localhost only
uvicorn app.main:app --reload
```

API docs: `http://localhost:8000/docs`

## Environment Setup

```bash
cp .env.example .env
```

Fill in:
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` — required for Bedrock, Transcribe, Polly
- `BEDROCK_MODEL_ID` — must be an **inference profile ID** with `us.` prefix (e.g. `us.amazon.nova-pro-v1:0`) or a model enabled in your account; direct `anthropic.*` IDs require on-demand throughput which may not be enabled
- Everything else has working defaults

Mobile `.env`:
```
EXPO_PUBLIC_API_URL=http://<your-mac-local-ip>:8000/api/v1
```

Admin config (git-ignored):
```bash
cp mobile/src/config/adminConfig.example.js mobile/src/config/adminConfig.js
# then set ADMIN_EMAIL to the Cognito account that should get admin access
```

ChromaDB auto-persists to `./chroma_data/`. SQLite DB is `./digital_clone.db`. Both created on first run.

**First ingest downloads the embedding model (~90 MB)** — set a 120s timeout on the client side.

## Architecture

```
api/v1/routes/        ← HTTP + WebSocket endpoints
core/                 ← Config (pydantic-settings), Cognito JWT security, DI factory
db/                   ← SQLAlchemy engine + session
models/               ← ORM (clone.py) + Pydantic schemas (schemas.py)
services/interfaces/  ← Python Protocols: STTProvider, TTSProvider, AgentProvider, KnowledgeProvider
services/providers/   ← Concrete implementations: aws/ (Transcribe, Polly, Bedrock), chroma/
```

### Provider Swap Pattern

All four AI services are behind Protocol interfaces. To add a new provider:
1. Set the env var (`STT_PROVIDER=google`)
2. Implement the Protocol in `services/providers/google/stt.py`
3. Add the `elif` branch in `core/dependencies.py`

`core/dependencies.py` is the only place that selects which concrete class to use.

### Voice Interaction Flow

WebSocket at `/api/v1/ws/voice`:
1. Client → `init` with `clone_id`, `domain`
2. Client → `audio_chunk` (base64 audio, multiple messages)
3. Client → `end_of_speech` with `format` field (`"wav"` on iOS, `"mp4"` on Android)
4. Server: AWS Transcribe → ChromaDB RAG (top-5) → Bedrock LLM (Converse API) → AWS Polly
5. Server → `transcript`, `response_text`, `audio_chunk` (32 KB each), `audio_done`
6. In-memory session history (`_sessions` dict) — replace with Redis for multi-instance

**Converse API** is used for Bedrock (`client.converse(...)`) — works with Claude, Nova, and other models without changing code.

### Audio Formats

- **iOS**: records as `.wav` (LinearPCM, 16 kHz mono) → Transcribe `MediaFormat: "wav"`
- **Android**: records as `.mp4` (AAC, 16 kHz mono) → Transcribe `MediaFormat: "mp4"`
- Format is sent in the `end_of_speech` WebSocket message so the backend uses the correct format
- Note: Transcribe Streaming API (`amazon-transcribe` SDK) was attempted but abandoned — `awscrt`'s native C event loop is incompatible with uvicorn's asyncio loop and cannot be bridged reliably

### RAG / Knowledge Base

ChromaDB collection per clone: `clone_{id}`. Chunks: 500 chars / 100-char overlap. Embeddings: `sentence-transformers/all-MiniLM-L6-v2` (local, free). Top-5 results injected into the LLM system prompt.

Knowledge endpoints:
- `POST /api/v1/admin/clones/{id}/ingest` — `{ text, source }`
- `POST /api/v1/admin/clones/{id}/ingest/file` — multipart `.txt` or `.md`
- `DELETE /api/v1/admin/clones/{id}/knowledge` — clears the ChromaDB collection

### Clone Domain System

`domains` is a comma-separated string on the Clone model (e.g. `"family,professional"`). The active domain is sent with `init`. `aws/agent.py` appends a domain-specific tone instruction to the system prompt:
- `family` → warm, nurturing, parental
- `professional` → clear, decisive, leadership
- `mentorship` → guiding, encouraging
- `general` → balanced

## Mobile App

- **Expo SDK 54**, React Navigation v7, `expo-av` for recording/playback
- Auth: AWS Cognito via `amazon-cognito-identity-js`
- Role routing: `adminConfig.js` → `ADMIN_EMAIL` → `user.role = 'admin' | 'user'`
- Admin screens: `AdminDashboard` → `CreateClone` / `ManageClone`
- User screens: `CloneList` → `Interaction` + `Profile`
- `expo-file-system/legacy` import required — `readAsStringAsync` moved to legacy API in SDK 54
- After recording, must reset `allowsRecordingIOS: false` in `setAudioModeAsync` before playback or audio routes to earpiece

## Key Settings

| Setting | Default | Notes |
|---------|---------|-------|
| `DATABASE_URL` | `sqlite:///./digital_clone.db` | Switch to PostgreSQL URL for prod |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-pro-v1:0` | Use `us.` prefix (inference profile) |
| `COGNITO_USER_POOL_ID` | `us-east-1_orFUeN52q` | Project pool |
| `COGNITO_CLIENT_ID` | `78gtfs160lm6m8lvcdovj64krt` | Project client |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | Local disk persistence |
| `STT_PROVIDER` | `aws` | AWS Transcribe (batch job via S3) |
| `TTS_PROVIDER` | `aws` | AWS Polly (neural, MP3) |
| `LLM_PROVIDER` | `aws` | AWS Bedrock (Converse API) |
| `KNOWLEDGE_PROVIDER` | `chroma` | ChromaDB local vector store |
| `POLLY_DEFAULT_VOICE` | `Matthew` | Used when clone has no voice_id set |
