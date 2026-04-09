# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                  Mobile App (Expo)                  │
│  Auth ──► Role routing ──► Clone list ──► Voice UI  │
└──────────────────────┬──────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────┐
│               FastAPI Backend (Python)              │
│  Routes → Services/Interfaces → Providers           │
└──────┬─────────────┬──────────────┬─────────────────┘
       │             │              │
   AWS Bedrock   AWS Polly    AWS Transcribe
   (Nova Pro)   (TTS/MP3)    (STT/S3 batch)
       │
   ChromaDB (local RAG)
```

---

## Backend

### Folder Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, CORS, lifespan, router registration
│   ├── api/v1/routes/
│   │   ├── clones.py            # Clone CRUD (GET/POST/PUT/DELETE)
│   │   ├── knowledge.py         # Ingest text/file, clear knowledge
│   │   ├── voice.py             # WebSocket voice session
│   │   └── health.py            # Health check
│   ├── core/
│   │   ├── config.py            # pydantic-settings, all env vars
│   │   ├── dependencies.py      # Provider factory (DI)
│   │   └── security.py          # Cognito JWT validation
│   ├── db/database.py           # SQLAlchemy engine + session
│   ├── models/
│   │   ├── clone.py             # ORM model
│   │   └── schemas.py           # Pydantic request/response models
│   └── services/
│       ├── interfaces/          # Python Protocols (contracts)
│       │   ├── agent.py         # AgentProvider, AgentContext, AgentResponse
│       │   ├── knowledge.py     # KnowledgeProvider, Document
│       │   ├── stt.py           # STTProvider
│       │   └── tts.py           # TTSProvider
│       └── providers/
│           ├── aws/
│           │   ├── agent.py     # Bedrock Converse API
│           │   ├── stt.py       # Transcribe (S3 batch job)
│           │   └── tts.py       # Polly (MP3)
│           ├── chroma/
│           │   └── knowledge.py # ChromaDB vector store
│           └── google/          # Future provider placeholder
```

### Provider Pattern

Every AI service is behind a Python Protocol interface. `core/dependencies.py` is the only place that instantiates a concrete provider, based on env vars. To swap a service:

1. Set `STT_PROVIDER=google` in `.env`
2. Create `services/providers/google/stt.py` implementing `STTProvider`
3. Add `elif settings.STT_PROVIDER == "google"` in `dependencies.py`

No other files need to change.

### Database

- **SQLite** in development (`digital_clone.db`)
- **PostgreSQL** in production (set `DATABASE_URL` in `.env`)
- Tables auto-created on startup via `Base.metadata.create_all()`

**Clone table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `name` | String | Display name |
| `title` | String | e.g. "Father & Entrepreneur" |
| `description` | Text | Short bio |
| `persona_prompt` | Text | System prompt base |
| `domains` | String | Comma-separated: `"family,professional"` |
| `avatar_url` | String | Optional image URL |
| `voice_id` | String | Polly voice ID |
| `is_active` | Boolean | Soft delete flag |
| `created_at` | DateTime | |
| `updated_at` | DateTime | Auto-updated |

---

## Voice Pipeline

### WebSocket Protocol

Endpoint: `ws://<host>/api/v1/ws/voice`

**Client → Server:**

| Message | Fields | Description |
|---------|--------|-------------|
| `init` | `clone_id`, `domain`, `session_id` | Start/resume session |
| `audio_chunk` | `data` (base64) | Streamed audio bytes |
| `end_of_speech` | `format` (`"wav"` or `"mp4"`) | Trigger processing |
| `ping` | — | Keepalive |

**Server → Client:**

| Message | Fields | Description |
|---------|--------|-------------|
| `ready` | `session_id` | Session initialized |
| `transcript` | `data` | What the user said |
| `response_text` | `data` | Clone's text reply |
| `audio_chunk` | `data` (base64 MP3) | 32 KB audio chunks |
| `audio_done` | — | All audio sent |
| `error` | `message` | Error description |
| `pong` | — | Ping response |

### Audio Formats

| Platform | Recording format | Transcribe format |
|----------|-----------------|-------------------|
| iOS | `.wav` (LinearPCM, 16 kHz mono) | `wav` |
| Android | `.mp4` (AAC, 16 kHz mono) | `mp4` |

The format is passed in the `end_of_speech` message so the backend uses the correct `MediaFormat` for Transcribe.

### Pipeline Steps

```
1. Audio chunks buffered in memory during recording
2. end_of_speech received → combine buffer → upload to S3
3. Start Transcribe job (batch) → poll until complete → fetch transcript
4. ChromaDB vector search: top-5 relevant knowledge chunks for this clone
5. Build system prompt: persona_prompt + domain instruction + knowledge snippets
6. Bedrock Converse API: last 10 turns of history + new transcript
7. Polly: synthesize response text → MP3 bytes
8. Stream MP3 back in 32 KB WebSocket chunks
9. Client reassembles → writes to temp file → plays via expo-av
```

---

## RAG (Knowledge Base)

- **Storage:** ChromaDB, one collection per clone (`clone_{id}`)
- **Chunking:** 500 chars, 100-char overlap
- **Embedding model:** `sentence-transformers/all-MiniLM-L6-v2` (local, ~90 MB, auto-downloaded)
- **Retrieval:** Top-5 by cosine similarity
- **Injection:** Appended to system prompt as bullet points

---

## Mobile App

### Navigation Structure

```
AppNavigator
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   ├── SignupScreen         ← collects name (stored as Cognito attribute)
│   ├── VerificationScreen
│   ├── ForgotPasswordScreen
│   └── ResetPasswordScreen
└── Authenticated
    ├── AdminNavigator       (role === 'admin')
    │   ├── AdminDashboardScreen
    │   ├── CreateCloneScreen
    │   └── ManageCloneScreen
    └── MainNavigator        (role === 'user')
        ├── CloneListScreen
        ├── InteractionScreen
        └── ProfileScreen
```

### Role Detection

`adminConfig.js` exports `ADMIN_EMAIL`. After every sign-in, `authStore` compares the Cognito email against this value and sets `user.role = 'admin' | 'user'`. This file is git-ignored — never commit the real email.

### InteractionScreen Avatar

The animated face avatar uses React Native `Animated` API only (no SVG/Canvas):

- **Eyes:** white oval Views with `scaleY` animation for blinking (random interval 2.5–5s)
- **Smile:** U-shaped border (left + right + bottom only, heavy border-radius) — visible in idle/thinking
- **Open mouth:** solid oval with `scaleY` animation — replaces smile during speaking/listening
- **Glow ring:** `position: absolute` View behind face, `scale` + `opacity` animated per state
- **State gradients:** idle/speaking = purple→indigo, listening = green, thinking = amber

---

## Security

- All backend routes are public in dev (CORS `allow_origins: ["*"]`)
- Cognito JWT validated via JWKS endpoint in `core/security.py`
- Admin access controlled by `adminConfig.js` on the client side only — backend does not enforce admin roles yet
- `.env` files are git-ignored; no credentials in source control
- `adminConfig.js` is git-ignored to prevent email exposure
