# Feature Backlog

Prioritized list of all pending features. Work through these one by one, highest priority first.
Source: extracted from `docs/FEATURES.md` development plans.

---

## Priority 1 — High (Core stability / production-readiness)

### 1. Backend Role Enforcement
Currently admin-only endpoints (`/admin/*`) have no server-side auth check — only client-side routing guards them.
- Add `require_admin` dependency in FastAPI that checks Cognito group or compares email from JWT
- Apply to all `/admin/clones/*` routes
- **Files:** `backend/app/core/security.py`, `backend/app/api/v1/routes/knowledge.py`, `backend/app/api/v1/routes/clones.py`

### 2. Conversation History Persistence
Session history is currently in-memory only — lost on reconnect or server restart.
- Add `conversations` and `messages` tables in SQLAlchemy
- Save each turn to DB after `audio_done`
- Expose `GET /conversations` and `GET /conversations/:id/messages`
- Show history list in ProfileScreen (user) and per-clone usage in AdminDashboard
- **Files:** new `backend/app/models/conversation.py`, new routes, `backend/app/api/v1/routes/voice.py`

### 3. Streaming STT (Replace Transcribe Batch)
Current STT: upload to S3 → start batch job → poll every 0.5s → fetch result (~3–6s latency).
- Replace with AWS Transcribe Streaming API (WebSocket-based, real-time)
- Eliminates S3 roundtrip, reduces latency to ~1s
- **Files:** `backend/app/services/providers/aws/stt.py`, `backend/app/services/interfaces/stt.py`
- **Note:** `amazon-transcribe` SDK attempted and reverted — `awscrt` native event loop incompatible with uvicorn. Revisit using `aiobotocore` or direct WebSocket + AWS SigV4.

### 4. Redis Session Store
`_sessions` dict in `voice.py` is in-memory — breaks with multiple backend instances.
- Add Redis client, store session history keyed by `session_id`
- **Files:** `backend/app/api/v1/routes/voice.py`, new `backend/app/core/redis.py`, `backend/requirements.txt`

### 5. PostgreSQL + Alembic Migrations
SQLite is dev-only; PostgreSQL needed for production.
- Add Alembic for schema migrations
- Update `DATABASE_URL` in `.env.example`
- **Files:** new `backend/alembic/`, `backend/requirements.txt`, `backend/.env.example`

---

## Priority 2 — Medium (Feature completeness)

### 6. PDF Ingestion (Knowledge Base)
- Accept `.pdf` in the file ingest endpoint alongside `.txt` and `.md`
- Extract text with `pypdf` or `pdfminer.six`
- **Files:** `backend/app/api/v1/routes/knowledge.py`, `backend/app/services/providers/chroma/knowledge.py`, `mobile/src/screens/ManageCloneScreen.js`

### 7. View Ingested Sources + Per-Source Delete
- `GET /admin/clones/:id/knowledge/sources` — list source names + chunk counts
- `DELETE /admin/clones/:id/knowledge/source/:name` — delete only chunks from one source
- Show source list in ManageCloneScreen with delete buttons
- **Files:** `backend/app/services/providers/chroma/knowledge.py`, `backend/app/api/v1/routes/knowledge.py`, `mobile/src/screens/ManageCloneScreen.js`

### 8. Clone Avatar Image Upload
- `POST /admin/clones/:id/avatar` — upload image to S3 → store URL in `clone.avatar_url`
- Show real avatar image in CloneListScreen and InteractionScreen (replace initial letter)
- **Files:** `backend/app/api/v1/routes/clones.py`, `mobile/src/screens/ManageCloneScreen.js`, `mobile/src/screens/CloneListScreen.js`

### 9. ElevenLabs TTS Provider (Clone Voice Cloning)
- Implement `ElevenLabsTTSProvider` following existing `TTSProvider` protocol
- Set `TTS_PROVIDER=elevenlabs` in `.env` — no other code changes
- **Files:** new `backend/app/services/providers/elevenlabs/tts.py`, `backend/app/core/dependencies.py`, `backend/.env.example`

### 10. Real System Status (Admin Dashboard)
- Replace hardcoded "Operational" rows with actual health pings
- Add Cognito reachability, S3 bucket check, ChromaDB collection count to `GET /health`
- **Files:** `backend/app/api/v1/routes/health.py`, `mobile/src/screens/AdminDashboardScreen.js`

### 11. Clone Analytics (Admin Dashboard)
- Add `conversation_count` and `last_active_at` to `CloneListItem` response
- Show mini stats on AdminDashboard clone rows
- **Files:** `backend/app/api/v1/routes/clones.py`, `backend/app/models/schemas.py`, `mobile/src/screens/AdminDashboardScreen.js`

### 12. Search / Filter Clones by Domain (Clone Discovery)
- Add search bar + domain filter chips to CloneListScreen
- Client-side filtering — no backend change needed
- **Files:** `mobile/src/screens/CloneListScreen.js`

### 13. Clone Detail / Preview Screen
- New screen between CloneListScreen and InteractionScreen
- Shows name, title, description, domains, "Start Conversation" button
- **Files:** new `mobile/src/screens/CloneDetailScreen.js`, `mobile/src/navigation/MainNavigator.js`

### 14. Edit User Profile
- Allow name update via Cognito `updateAttributes`
- Add edit mode toggle + save button to ProfileScreen
- **Files:** `mobile/src/screens/ProfileScreen.js`, `mobile/src/services/authService.js`

### 15. Stop Speaking Button
- Show "Stop" button while avatar is in SPEAKING state
- Stop current audio playback and reset to IDLE
- **Files:** `mobile/src/screens/InteractionScreen.js`

### 16. Voice Activity Detection (Auto End-of-Speech)
- Detect silence after speech using expo-av metering (`isMeteringEnabled: true`)
- Auto-trigger `endSpeech()` after ~1.5s of silence — removes need to hold button
- **Files:** `mobile/src/screens/InteractionScreen.js`

### 17 (new). Migrate expo-av → expo-audio / expo-video (SDK 55 upgrade)
- `expo-av` deprecated in SDK 54, removed in SDK 55
- Replace `Audio.Recording` with `AudioRecorder` from `expo-audio`
- Replace `Audio.Sound` playback with `AudioPlayer` from `expo-audio`
- Replace `Audio.setAudioModeAsync` with `AudioModule.setAudioModeAsync`
- **Files:** `mobile/src/screens/InteractionScreen.js`, `mobile/package.json`
- **Do when:** upgrading to SDK 55+

---

## Priority 3 — Low (Nice to have)

### 17. Social / Biometric Login
- Google / Apple Sign-In via Cognito Federated Identity
- Face ID / Touch ID via `expo-local-authentication`
- **Files:** `mobile/src/screens/LoginScreen.js`, `mobile/src/services/authService.js`

### 18. Multiple Admin Support (Cognito Groups)
- Replace hardcoded `ADMIN_EMAIL` with Cognito `admin` group membership check
- Backend reads group claims from JWT; mobile reads `cognito:groups` from ID token
- **Files:** `mobile/src/config/adminConfig.js`, `mobile/src/store/authStore.js`, `backend/app/core/security.py`

### 19. Favorites + Recent Conversations (Clone Discovery)
- Persist favorite clone IDs in AsyncStorage
- Show "Recently Talked To" section at top of CloneListScreen
- **Files:** `mobile/src/screens/CloneListScreen.js`

### 20. Push Notifications
- Notify users when new clones are published
- Use Expo Push Notifications; store device tokens in DB
- **Files:** new `backend/app/models/device_token.py`, new notification route, `mobile/App.js`

### 21. URL Scraping (Knowledge Base)
- Accept a URL, scrape with `httpx` + `beautifulsoup4`, ingest as text
- **Files:** `backend/app/api/v1/routes/knowledge.py`, `backend/requirements.txt`

### 22. Pinecone Provider (Knowledge Base)
- Implement `PineconeKnowledgeProvider` following `KnowledgeProvider` protocol
- Set `KNOWLEDGE_PROVIDER=pinecone` to switch from ChromaDB
- **Files:** new `backend/app/services/providers/pinecone/knowledge.py`, `backend/app/core/dependencies.py`

### 23. Profile Photo Upload
- S3 upload → store URL in Cognito `picture` attribute
- Show in ProfileScreen avatar circle
- **Files:** `mobile/src/screens/ProfileScreen.js`, `mobile/src/services/authService.js`

### 24. Account Deletion
- `cognitoUser.deleteUser()` + delete all user data from DB
- **Files:** `mobile/src/screens/ProfileScreen.js`, `mobile/src/services/authService.js`

---

## Summary

| # | Feature | Module | Priority | Effort |
|---|---------|--------|----------|--------|
| 1 | Backend role enforcement | RBAC | 🔴 High | Small |
| 2 | Conversation history persistence | Voice | 🔴 High | Large |
| 3 | Streaming STT | Voice | 🔴 High | Medium |
| 4 | Redis session store | Voice | 🔴 High | Medium |
| 5 | PostgreSQL + Alembic | Infrastructure | 🔴 High | Medium |
| 6 | PDF ingestion | Knowledge | 🟡 Medium | Small |
| 7 | View/delete ingested sources | Knowledge | 🟡 Medium | Small |
| 8 | Clone avatar image upload | Clone Mgmt | 🟡 Medium | Medium |
| 9 | ElevenLabs TTS provider | Voice | 🟡 Medium | Medium |
| 10 | Real system status | Admin | 🟡 Medium | Small |
| 11 | Clone analytics | Admin | 🟡 Medium | Medium |
| 12 | Search / filter clones | Discovery | 🟡 Medium | Small |
| 13 | Clone detail screen | Discovery | 🟡 Medium | Small |
| 14 | Edit user profile | Profile | 🟡 Medium | Small |
| 15 | Stop speaking button | Voice | 🟡 Medium | Small |
| 16 | Voice activity detection | Voice | 🟡 Medium | Medium |
| 17 | Social / biometric login | Auth | 🟢 Low | Large |
| 18 | Multiple admin (Cognito groups) | RBAC | 🟢 Low | Medium |
| 19 | Favorites + recent conversations | Discovery | 🟢 Low | Small |
| 20 | Push notifications | New module | 🟢 Low | Large |
| 21 | URL scraping | Knowledge | 🟢 Low | Small |
| 22 | Pinecone provider | Knowledge | 🟢 Low | Medium |
| 23 | Profile photo upload | Profile | 🟢 Low | Medium |
| 24 | Account deletion | Auth | 🟢 Low | Small |
