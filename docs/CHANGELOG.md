# Changelog

All notable changes to this project are documented here, newest first.

---

## 2026-04-08

### Fixed
- **WebSocket URL mismatch** — voice router was mounted without `/api/v1` prefix on the backend but the mobile client was appending `/ws/voice` to `API_BASE_URL` which already contained `/api/v1`. Fixed by adding `prefix="/api/v1"` to `app.include_router(voice.router)` in `main.py`.
- **`FileSystem.EncodingType` undefined** — `expo-file-system` SDK 54 removed `EncodingType` from the default namespace. Replaced `FileSystem.EncodingType.Base64` with the string literal `'base64'` in both `readAsStringAsync` and `writeAsStringAsync` calls.
- **`readAsStringAsync` deprecated** — changed `expo-file-system` import to `expo-file-system/legacy` in `InteractionScreen.js`.
- **Transcription job failing** — added `FailureReason` to the error message from AWS Transcribe so failures are diagnosable. Root cause was wrong audio format (`wav` declared but iOS records `.caf`).
- **iOS recording "recorder not prepared"** — switched from `Audio.RecordingOptionsPresets.HIGH_QUALITY` (records `.caf` on iOS, unsupported by Transcribe) to a custom config: iOS uses LinearPCM → `.wav`, Android uses AAC → `.mp4`.
- **Audio format mismatch with Transcribe** — `end_of_speech` WebSocket message now includes a `format` field (`"wav"` or `"mp4"`) detected from the recording URI. Backend reads this and passes it to `MediaFormat` in the Transcribe job. STT interface and provider updated to accept `audio_format` parameter.
- **Avatar state showing "Thinking" on press** — `setAvatarState(LISTENING)` was called after the async `createAsync` call, so `stopRecording` could fire and set "Thinking" before "Listening" was ever visible. Moved state updates to before `createAsync` (optimistic update).
- **Short recordings failing Transcribe** — added a 700 ms minimum duration guard in `stopRecording`. Recordings shorter than 700 ms are discarded with a "Hold longer to speak" hint.
- **No audio playback after response** — iOS routes audio to the earpiece when `allowsRecordingIOS: true` is still active. Fixed by setting `allowsRecordingIOS: false` in `setAudioModeAsync` before calling `Audio.Sound.createAsync`.
- **Bedrock model end-of-life** — `anthropic.claude-3-5-sonnet-20241022-v2:0` was retired. Updated to `us.amazon.nova-pro-v1:0` (Amazon Nova Pro).
- **Bedrock direct model ID rejected** — `anthropic.claude-3-7-sonnet-20250219-v1:0` without `us.` prefix returns "on-demand throughput not supported". Switched to **Converse API** (`client.converse()`) which works universally with inference profile IDs.
- **AWS payment instrument error** — Claude 3.7 Sonnet required an AWS Marketplace subscription with a payment method. Switched to **Amazon Nova Pro** (`us.amazon.nova-pro-v1:0`) which is an AWS-native model covered by APN credits.
- **Avatar smile not rendering** — the `overflow: hidden` + circle-border trick for the smile was unreliable. Replaced with a U-shaped border approach: a View with `borderBottomLeftRadius`, `borderBottomRightRadius`, and only left/right/bottom borders drawn.

### Added
- **Animated face avatar** on `InteractionScreen` — 172px gradient circle with blinking eyes (random 2.5–5s interval), animated smile↔open-mouth, and per-state glow ring. States: idle (purple breathing), listening (green pulsing), thinking (amber slow pulse), speaking (irregular mouth animation).
- **Redesigned InteractionScreen UI** — follows app light theme (`colors.background`, `colors.surface`, indigo/purple gradients). Domain chips with emoji icons and gradient active state. Frosted clone bubbles, gradient user bubbles. Mic button with expanding ripple animation. Live/Off status pill in header.
- **`MicButton` component** — extracted animated mic button with ripple effect, scale spring on press, green gradient when recording.
- **State badge** beneath avatar — colored pill with dot indicator showing current avatar state label.
- **`CLAUDE.md`** — added to `backend/` with architecture overview, setup commands, audio format notes, Bedrock model quirks, and git workflow.
- **Project documentation** — created `docs/` with `SETUP.md`, `ARCHITECTURE.md`, `API.md`, and this `CHANGELOG.md`.
- **`README.md`** — root-level project overview with tech stack and links to docs.

### Changed
- **Bedrock agent** switched from `invoke_model` (Claude-specific JSON body) to **Converse API** (`client.converse()`) — model-agnostic, works with all Bedrock models by changing only `BEDROCK_MODEL_ID` in `.env`.
- **Default `BEDROCK_MODEL_ID`** updated to `us.amazon.nova-pro-v1:0` in both `config.py` and `.env.example`.

### Security
- **`adminConfig.js` removed from git tracking** — contained hardcoded admin email. Added to `.gitignore`, replaced with `adminConfig.example.js` template.
- **`.gitignore` hardened** — added recursive `__pycache__/`, `*.pyc`, `.env.*` variants, certificate files (`*.pem`, `*.key`, `*.p12`), IDE files.
- **Pushed `main` branch** to `abasit477/Digital-Clone-Mobile-App` on GitHub.
- **`develop` branch created** — all future development happens on `develop`, merged to `main` when complete.

---

## 2026-04-07 and earlier

### Added — Initial Platform Build

#### Monorepo restructure
- Moved existing Expo app from root into `mobile/` subdirectory
- Created `backend/` Python FastAPI server alongside mobile app

#### Auth & User Management
- Signup collects `name` field, stored as Cognito `name` attribute
- Login reads `name` from ID token payload → `user.displayName`
- Role-based routing: `adminConfig.js` → `ADMIN_EMAIL` → `user.role`
- `ForgotPasswordScreen` + `ResetPasswordScreen` (Cognito native OTP flow)
- Read-only `ProfileScreen` (name + email, sign out)
- `PrimaryButton` fullWidth fix: `width: '100%'` → `alignSelf: 'stretch'`

#### Backend — FastAPI
- Modular provider architecture with Python Protocol interfaces
- `CloneProvider`, `STTProvider`, `TTSProvider`, `AgentProvider`, `KnowledgeProvider`
- Clone CRUD endpoints (`/api/v1/clones`)
- Knowledge ingest endpoints (text + multipart file upload)
- WebSocket voice endpoint (`/api/v1/ws/voice`)
- Cognito JWT validation via JWKS in `core/security.py`
- SQLite (dev) + PostgreSQL-ready via SQLAlchemy

#### Clone Platform
- Clone model: name, title, description, persona_prompt, domains, voice_id, is_active
- `AdminDashboardScreen` with live clone list, create button, system status
- `CreateCloneScreen` — form with domain checkboxes and Polly voice picker
- `ManageCloneScreen` — ingest text/file, clear knowledge, delete clone
- `CloneListScreen` — card list of active clones for users
- `InteractionScreen` — initial push-to-talk voice UI with avatar states

#### RAG Knowledge Base
- ChromaDB local vector store, one collection per clone
- `sentence-transformers/all-MiniLM-L6-v2` embeddings (local, ~90 MB)
- 500-char chunks with 100-char overlap
- Detailed logging: chunk count, per-chunk preview, embedding time, doc count

#### Services
- `cloneService.js` — full clone CRUD + ingest with 120s timeout
- `voiceService.js` — WebSocket session factory
- `apiService.js` — Axios instance reading `EXPO_PUBLIC_API_URL`

#### Bug Fixes
- Network errors: backend bound to `127.0.0.1` only → restarted with `--host 0.0.0.0`
- Mobile `.env` missing → app used `localhost` (phone loopback) → created `.env` with Mac IP
- 15s timeout on knowledge ingest (embedding model download) → increased to 120s
- Sign out button off bottom of screen → `paddingBottom: spacing[20]`
- `typography.displaySmall` undefined → changed to `typography.displayMedium`
