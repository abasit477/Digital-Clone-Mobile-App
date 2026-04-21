# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

- **Never commit directly to `main`** — all development happens on `develop` or a feature branch
- Do not push until the user has tested and explicitly confirmed
- Repo: `abasit477/Digital-Clone-Mobile-App`

## Project Structure

Monorepo with two sub-projects:

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
# PYTORCH_ENABLE_MPS_FALLBACK=1 required — XTTS v2 runs on CPU (MPS channel limit issue)
PYTORCH_ENABLE_MPS_FALLBACK=1 uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Logs are written to `./logs/backend.log` (directory auto-created). Tail live:
```bash
tail -f logs/backend.log
```

API docs: `http://localhost:8000/docs`

## Environment Setup

```bash
cp .env.example .env
```

Key values to fill in:
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
- `BEDROCK_MODEL_ID` — must use `us.` prefix inference profile (e.g. `us.amazon.nova-pro-v1:0`)
- `SES_SENDER_EMAIL` — verified SES sender for invite emails (optional; invites still work without it)

ChromaDB persists to `./chroma_data/`. SQLite DB is `./digital_clone.db`. Both created on first run.

**First ingest downloads the embedding model (~90 MB)** — set a 120s timeout on the client side.

## Architecture

```
api/v1/routes/        ← HTTP + WebSocket endpoints
core/                 ← Config (pydantic-settings), Cognito JWT security, DI factory
db/                   ← SQLAlchemy engine + session
models/               ← ORM (clone.py, family.py) + Pydantic schemas (schemas.py)
services/interfaces/  ← Python Protocols: STTProvider, TTSProvider, AgentProvider, KnowledgeProvider
services/providers/   ← Concrete implementations: aws/ (Transcribe, Polly, Bedrock), chroma/
services/email.py     ← AWS SES invite emails
services/persona_synthesis.py ← Bedrock Converse API → first-person persona prompt
```

### Role System

Role stored as Cognito custom attribute `custom:role`. The backend reads it from the **ID token** (not access token — mobile was updated to send ID token).

| Role | `GET /clones` returns | Can call `/families/*` creator endpoints |
|------|----------------------|------------------------------------------|
| `platform_admin` | All active clones | Yes |
| `creator` | Only clones where `creator_email == caller` | Yes |
| `member` | Only their family's clone | No (403) |
| no role | All active clones (legacy compat) | No |

`_require_role()` helper in `families.py` enforces role checks — raises 403 if caller role not in allowed list.

### Family Platform

New tables: `families`, `family_members`. `clones` table has `creator_email` column.

**DB migration note:** `creator_email` was added after the initial DB was created. On any existing SQLite DB run:
```sql
ALTER TABLE clones ADD COLUMN creator_email VARCHAR(200) DEFAULT "";
```

Family endpoints (`/api/v1/families/`):
- `POST /families` — create family + link clone (creator only)
- `GET /families/mine` — get family + members (creator only)
- `POST /families/invite` — invite by email, generates 8-char code, fires SES email (non-fatal if SES not set up)
- `DELETE /families/members/{id}` — remove member (creator only)
- `POST /families/join` — accept invite by code (member)
- `GET /families/my-clone` — get the clone the member belongs to (member)
- `POST /families/synthesize-persona` — Bedrock → persona_prompt + knowledge_text from 20 Q&A answers

### Voice Interaction Flow

WebSocket at `/api/v1/ws/voice` — **streaming pipeline**:
1. Client → `init` (clone_id, domain)
2. Client → `audio_chunk` (base64, multiple) + `end_of_speech` (with `format` field)
3. Server: Transcribe STT → ChromaDB RAG (top-5) → Bedrock `converse_stream()` → sentence-level TTS
4. Server → `transcript`, `response_text`, per-sentence `audio_chunk` + `audio_segment_done`, final `turn_done`

Audio format: iOS records `.wav` (LinearPCM 16kHz), Android records `.mp4` (AAC 16kHz). Format sent in `end_of_speech`.

Transcribe Streaming was attempted and reverted — `awscrt` native C event loop incompatible with uvicorn asyncio.

### Voice Cloning (F5-TTS)

**Upload endpoint:** `POST /api/v1/voice/upload-sample`
- Accepts base64-encoded audio (any format — pydub converts to 22kHz mono 16-bit WAV)
- Resolves clone from token: creator → their own clone, member → their family's clone
- Saves to `{STATIC_DIR}/voice_samples/{clone_id}.wav`
- Updates `clone.voice_sample_path` in DB

**F5-TTS provider:** `services/providers/local/f5tts_provider.py`
- Model: F5-TTS flow-matching model (~600 MB, auto-downloaded from HuggingFace on first call)
- Device: CPU (MPS can be enabled by changing `device="cpu"` → `device="mps"` in provider)
- `voice_id` = absolute path to reference WAV (6–30s). Empty → bundled EN reference voice
- Lazy-loaded singleton. First call also runs Whisper to transcribe the reference audio (cached per path)
- No time-stretching bug. ~3–5s inference on CPU for a short sentence.
- Install: `pip install f5-tts`

**XTTS provider (deprecated, kept for reference):** `services/providers/local/xtts.py`
- Has severe time-stretching bug for certain voices — use F5-TTS instead

**TTS voice selection in routes:**
- `chat.py` (`POST /chat/voice-message`): uses `clone.voice_sample_path or clone.voice_id`
- `voice.py` (WebSocket `_flush_sentence`): uses `clone.voice_sample_path or clone.voice_id`

**DB columns on `clones`:**
- `voice_id` — AWS Polly voice name (e.g. `"Matthew"`) or XTTS label
- `voice_sample_path` — absolute server path to uploaded WAV; takes priority over `voice_id`

**DB migration note:** `voice_sample_path` was added after initial DB creation. On existing DBs run:
```sql
ALTER TABLE clones ADD COLUMN voice_sample_path VARCHAR(500) DEFAULT "";
```

**Mobile:** `VoiceRecordScreen.js` — records 30s via `expo-av`, base64-encodes, POSTs to upload endpoint.

### Persona Synthesis

`services/persona_synthesis.py` takes a dict of 20 answers (keys `q1`–`q20`), calls Bedrock Converse API with a biographer system prompt, and returns:
- `persona_prompt` — 200–300 word first-person description injected as the clone's system prompt
- `knowledge_text` — formatted Q&A pairs for ChromaDB ingestion

### RAG / Knowledge Base

ChromaDB collection per clone: `clone_{id}`. Chunks: 500 chars / 100-char overlap. Embeddings: `sentence-transformers/all-MiniLM-L6-v2` (local). Top-5 injected into LLM system prompt.

Knowledge endpoints (under `/api/v1/admin/clones/{id}/`):
- `POST ingest` — `{ text, source }`
- `POST ingest/file` — multipart `.txt` or `.md`
- `DELETE knowledge` — clears the collection

### Clone Domain System

`domains` is comma-separated (e.g. `"family,general"`). Sent with `init`. `aws/agent.py` appends tone instruction:
- `family` → warm, nurturing
- `professional` → clear, decisive
- `mentorship` → guiding, encouraging
- `general` → balanced

### Provider Swap Pattern

All AI services behind Protocol interfaces. To add a provider:
1. Set env var (`STT_PROVIDER=google`)
2. Implement Protocol in `services/providers/google/stt.py`
3. Add `elif` branch in `core/dependencies.py`

## Mobile App

- **Expo SDK 54**, React Navigation v7, `expo-av` for recording/playback
- Auth: `amazon-cognito-identity-js` — **ID token** sent in Authorization header (not access token)
- Role routing via `custom:role` Cognito attribute; legacy `ADMIN_EMAIL` fallback still works
- `expo-file-system/legacy` import required — `readAsStringAsync` moved to legacy API in SDK 54
- After recording, reset `allowsRecordingIOS: false` before playback or audio routes to earpiece

### Navigation Structure

```
AppNavigator
├── Auth (unauthenticated)
├── RoleSelect (authenticated, no role)
├── AdminNavigator (platform_admin / admin)
├── CreatorNavigator (creator)
│   ├── CreatorHome → CloneTypeSelect → CreatorOnboarding
│   ├── FamilyManagement (family creators)
│   ├── PersonalClone (personal creators)
│   ├── ManageClone, Interaction, Profile
└── MemberNavigator (member)
    ├── JoinFamily (no clone yet)
    └── Interaction, Profile
```

`CreatorNavigator` checks `listClones()` on mount to decide initial route (home vs management).
`MemberNavigator` checks `getMyClone()` on mount (join vs interaction).

### Clone Onboarding (20 questions, 5 steps)

`CreatorOnboardingScreen` receives `cloneType: 'family' | 'personal'` param.
Step 2 ("Your Family" vs "Your Relationships"), Step 4 Q13/Q15, and Step 5 questions all adapt.
On submit: synthesize persona → create clone → ingest knowledge → (family: create family record) → navigate.

## Key Settings

| Setting | Default | Notes |
|---------|---------|-------|
| `DATABASE_URL` | `sqlite:///./digital_clone.db` | Switch to PostgreSQL for prod |
| `BEDROCK_MODEL_ID` | `us.amazon.nova-pro-v1:0` | `us.` prefix required |
| `COGNITO_USER_POOL_ID` | `us-east-1_orFUeN52q` | Project pool |
| `COGNITO_CLIENT_ID` | `78gtfs160lm6m8lvcdovj64krt` | Project client |
| `SES_SENDER_EMAIL` | `""` | Verified SES address; empty = skip email |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | Local disk |
| `POLLY_DEFAULT_VOICE` | `Matthew` | Used when clone has no voice_id |
| `TTS_PROVIDER` | `aws` | `f5tts` = local voice cloning (recommended), `aws` = Polly, `xtts` = deprecated |
| `STT_PROVIDER` | `aws` | `aws` = Transcribe, `whisper` = local Whisper |
| `STATIC_DIR` | `./static` | Served at `/static/`; subdirs: `avatars/`, `voice_samples/`, `audio/`, `videos/` |
