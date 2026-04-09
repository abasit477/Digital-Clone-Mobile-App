# Feature Modules — Architecture & Development Plan

Each section covers one feature module: its architecture diagram, tools & technologies, current status, and development plan.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Role-Based Access Control](#2-role-based-access-control)
3. [Clone Management (Admin)](#3-clone-management-admin)
4. [Knowledge Base](#4-knowledge-base)
5. [Voice Interaction](#5-voice-interaction)
6. [Clone Discovery (User)](#6-clone-discovery-user)
7. [User Profile](#7-user-profile)
8. [Admin Dashboard](#8-admin-dashboard)

---

## 1. Authentication

### Overview
Handles user registration, email verification, login, session persistence, and password reset. Entirely powered by AWS Cognito — no custom auth backend needed.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Mobile App                           │
│                                                             │
│  SignupScreen ──► VerificationScreen                        │
│       │                  │                                  │
│  LoginScreen ◄───────────┘                                  │
│       │                                                     │
│  ForgotPasswordScreen ──► ResetPasswordScreen               │
│       │                          │                          │
│       └──────────┬───────────────┘                          │
│                  ▼                                          │
│            authService.js                                   │
│     (amazon-cognito-identity-js)                            │
└──────────────────┬──────────────────────────────────────────┘
                   │  HTTPS (Cognito SDK)
┌──────────────────▼──────────────────────────────────────────┐
│                    AWS Cognito                               │
│                                                             │
│  User Pool ──► Email OTP ──► JWT (ID + Access + Refresh)    │
│                                                             │
│  Attributes stored: email, name                             │
└─────────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    authStore.js (Zustand)                    │
│                                                             │
│  user: { username, displayName, role }                      │
│  isAuthenticated, isInitialized                             │
│  signIn / signOut / initializeAuth                          │
└─────────────────────────────────────────────────────────────┘
```

### Flows

```
SIGN UP:
  Enter name + email + password
    → Cognito creates unverified user (stores name attribute)
    → Sends 6-digit OTP to email
    → User enters OTP on VerificationScreen
    → Account confirmed → navigate to Login

SIGN IN:
  Enter email + password
    → Cognito returns JWT tokens (ID, Access, Refresh)
    → authStore reads ID token payload: email, name
    → Sets user.role based on adminConfig.js ADMIN_EMAIL
    → AppNavigator routes to Admin or User stack

FORGOT PASSWORD:
  Enter email → Cognito sends OTP
    → ResetPasswordScreen: enter OTP + new password
    → confirmPassword() → navigate to Login

SESSION PERSISTENCE:
  On app launch → initializeAuth()
    → getSession() from Cognito (uses stored tokens)
    → Refreshes silently if expired
    → Restores user object in authStore
```

### Tools & Technologies

| Tool | Role |
|------|------|
| `amazon-cognito-identity-js` | Cognito SDK for React Native |
| AWS Cognito User Pool | User storage, JWT issuing, OTP emails |
| Zustand (`authStore.js`) | Global auth state |
| `syncStorage` (custom util) | Synchronous wrapper over AsyncStorage — required by Cognito SDK |
| React Navigation | Screen transitions between auth screens |

### Screens

| Screen | File |
|--------|------|
| Login | `mobile/src/screens/LoginScreen.js` |
| Signup | `mobile/src/screens/SignupScreen.js` |
| Email Verification | `mobile/src/screens/VerificationScreen.js` |
| Forgot Password | `mobile/src/screens/ForgotPasswordScreen.js` |
| Reset Password | `mobile/src/screens/ResetPasswordScreen.js` |

### Status: ✅ Complete

### Development Plan

- [x] Sign up with name, email, password
- [x] Email OTP verification
- [x] Sign in with JWT session
- [x] Session persistence across app restarts
- [x] Forgot password (Cognito OTP flow)
- [x] Reset password
- [x] Name stored as Cognito attribute, read on login
- [ ] Social login (Google / Apple) — future
- [ ] Biometric login (Face ID / fingerprint) — future
- [ ] Account deletion — future

---

## 2. Role-Based Access Control

### Overview
After login, users are routed to either the Admin stack or the User stack based on their email. A single hardcoded admin email is the source of truth — no admin signup path exists.

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      authStore.js                          │
│                                                            │
│  signIn() reads ID token payload                           │
│  compares email against ADMIN_EMAIL                        │
│                                                            │
│  user.role = email === ADMIN_EMAIL ? 'admin' : 'user'      │
└───────────────────────┬────────────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────────────┐
│                    AppNavigator.js                          │
│                                                            │
│  isAuthenticated?                                          │
│    NO  → AuthStack (Login / Signup / etc.)                 │
│    YES →                                                   │
│      user.role === 'admin'                                 │
│        → AdminNavigator (Dashboard, CreateClone, Manage)   │
│      user.role === 'user'                                  │
│        → MainNavigator (CloneList, Interaction, Profile)   │
└────────────────────────────────────────────────────────────┘

┌──────────────────────┐    ┌──────────────────────────────┐
│   AdminNavigator      │    │       MainNavigator           │
│                      │    │                              │
│  AdminDashboard      │    │  CloneListScreen             │
│  CreateClone         │    │  InteractionScreen           │
│  ManageClone         │    │  ProfileScreen               │
└──────────────────────┘    └──────────────────────────────┘
```

### Tools & Technologies

| Tool | Role |
|------|------|
| `adminConfig.js` (git-ignored) | Stores `ADMIN_EMAIL` constant |
| Zustand (`authStore.js`) | Holds `user.role` |
| React Navigation v7 | Stack-based role routing |
| AWS Cognito ID Token | Source of email used for role comparison |

### Files

| File | Role |
|------|------|
| `mobile/src/config/adminConfig.js` | `ADMIN_EMAIL` constant (git-ignored) |
| `mobile/src/config/adminConfig.example.js` | Template for new developers |
| `mobile/src/store/authStore.js` | Sets `user.role` on login |
| `mobile/src/navigation/AppNavigator.js` | Routes by role |
| `mobile/src/navigation/AdminNavigator.js` | Admin screen stack |
| `mobile/src/navigation/MainNavigator.js` | User screen stack |

### Status: ✅ Complete

### Development Plan

- [x] Hardcoded admin email in git-ignored config file
- [x] Role set on sign-in from ID token payload
- [x] Role-based navigation in AppNavigator
- [x] Admin and user stacks separated
- [ ] Backend role enforcement (currently client-side only) — future
- [ ] Multiple admin support via Cognito groups — future
- [ ] Permission levels within admin (read-only admin, super admin) — future

---

## 3. Clone Management (Admin)

### Overview
Admin can create, view, update, and delete digital clones. Each clone has a persona prompt (used as the LLM system prompt base), domain configuration, and a Polly voice assignment.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Admin Mobile Screens                       │
│                                                             │
│  AdminDashboard ──► [+ Create Clone] ──► CreateCloneScreen  │
│        │                                                    │
│        └──► CloneRow.onManage ──► ManageCloneScreen         │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST (Axios)
                       │ cloneService.js
┌──────────────────────▼──────────────────────────────────────┐
│               Backend — /api/v1/clones                      │
│                                                             │
│  GET    /clones          → list all active                  │
│  GET    /clones/:id      → single clone                     │
│  POST   /clones          → create                           │
│  PUT    /clones/:id      → update                           │
│  DELETE /clones/:id      → soft delete (is_active=false)    │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQLAlchemy ORM
┌──────────────────────▼──────────────────────────────────────┐
│              SQLite / PostgreSQL                            │
│                                                             │
│  clones table: id, name, title, description,               │
│  persona_prompt, domains, avatar_url, voice_id,            │
│  is_active, created_at, updated_at                         │
└─────────────────────────────────────────────────────────────┘
```

### Clone Data Model

```
Clone {
  id:             UUID (auto)
  name:           string        "John"
  title:          string        "Father & Entrepreneur"
  description:    text          Short bio shown to users
  persona_prompt: text          Base system prompt for the LLM
  domains:        string        Comma-separated: "family,professional"
  avatar_url:     string?       Future: image URL
  voice_id:       string        Polly voice ID e.g. "Matthew"
  is_active:      boolean       False = soft deleted
  created_at:     datetime
  updated_at:     datetime
}
```

### Tools & Technologies

| Tool | Role |
|------|------|
| FastAPI | REST endpoints |
| SQLAlchemy | ORM |
| Pydantic | Request/response validation schemas |
| SQLite (dev) / PostgreSQL (prod) | Persistence |
| Axios (`cloneService.js`) | Mobile HTTP client |
| React Native `TextInput`, `ScrollView` | Form UI |
| `expo-document-picker` | File upload in ManageCloneScreen |

### Screens & Files

| File | Role |
|------|------|
| `mobile/src/screens/AdminDashboardScreen.js` | Clone list with manage/create actions |
| `mobile/src/screens/CreateCloneScreen.js` | Form: name, title, description, persona, domains, voice |
| `mobile/src/screens/ManageCloneScreen.js` | Edit, ingest knowledge, delete |
| `mobile/src/services/cloneService.js` | All clone API calls |
| `backend/app/api/v1/routes/clones.py` | REST handlers |
| `backend/app/models/clone.py` | SQLAlchemy ORM model |
| `backend/app/models/schemas.py` | Pydantic schemas |

### Status: ✅ Complete

### Development Plan

- [x] Clone CRUD API (FastAPI + SQLAlchemy)
- [x] Create clone form (name, title, description, persona prompt)
- [x] Domain selection (checkboxes: family, professional, general, mentorship)
- [x] Polly voice picker (6 neural voices)
- [x] Soft delete (is_active flag)
- [x] Admin dashboard clone list with pull-to-refresh
- [ ] Avatar image upload (S3) — future
- [ ] Clone duplication — future
- [ ] Clone analytics (conversation count, active users) — future
- [ ] Clone preview / test conversation from admin — future

---

## 4. Knowledge Base

### Overview
Admin uploads text or files to train a clone's knowledge. Content is chunked, embedded, and stored in ChromaDB. At inference time, the top-5 relevant chunks are retrieved and injected into the LLM prompt.

### Architecture

```
┌───────────────────────────────────────────────────────────┐
│               ManageCloneScreen (Admin)                   │
│                                                           │
│  Paste text ──► ingestText()                              │
│  Pick .txt/.md ──► ingestFile() (multipart)               │
│  Clear ──► clearKnowledge()                               │
└───────────────────────┬───────────────────────────────────┘
                        │ REST (120s timeout)
┌───────────────────────▼───────────────────────────────────┐
│          Backend — /api/v1/admin/clones/:id/ingest        │
│                                                           │
│  1. Receive text                                          │
│  2. Chunk: 500 chars / 100 overlap                        │
│  3. Embed: sentence-transformers/all-MiniLM-L6-v2         │
│     (downloads ~90 MB on first run)                       │
│  4. Store: ChromaDB collection  "clone_{id}"              │
└───────────────────────┬───────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────┐
│                    ChromaDB (local)                        │
│                                                           │
│  Collection per clone: "clone_{id}"                       │
│  Documents: text chunks                                   │
│  Metadata: { source, clone_id }                           │
│  Embeddings: 384-dim vectors (MiniLM)                     │
│  Persisted to: ./chroma_data/                             │
└───────────────────────────────────────────────────────────┘

AT INFERENCE TIME:
┌───────────────────────────────────────────────────────────┐
│  User transcript ──► vector search (top-5 chunks)         │
│                   ──► injected into LLM system prompt     │
└───────────────────────────────────────────────────────────┘
```

### Chunking Strategy

```
Input text (any length)
    │
    ▼
[chunk 1: chars 0–499]
[chunk 2: chars 400–899]   ← 100-char overlap with chunk 1
[chunk 3: chars 800–1299]  ← 100-char overlap with chunk 2
    ...
    ▼
Each chunk embedded independently → stored with metadata
```

### Tools & Technologies

| Tool | Role |
|------|------|
| ChromaDB `0.5.23` | Local vector database |
| `sentence-transformers/all-MiniLM-L6-v2` | 384-dim text embeddings (free, local) |
| ChromaDB `DefaultEmbeddingFunction` | Runs MiniLM via `chromadb.utils.embedding_functions` |
| `python-multipart` | Multipart file upload handling in FastAPI |
| `expo-document-picker` | Mobile file picker (.txt, .md) |

### Files

| File | Role |
|------|------|
| `backend/app/services/providers/chroma/knowledge.py` | Ingest, search, delete logic |
| `backend/app/services/interfaces/knowledge.py` | `KnowledgeProvider` Protocol + `Document` dataclass |
| `backend/app/api/v1/routes/knowledge.py` | Ingest/clear endpoints |
| `mobile/src/screens/ManageCloneScreen.js` | Admin UI for knowledge management |
| `mobile/src/services/cloneService.js` | `ingestText`, `ingestFile`, `clearKnowledge` |

### Status: ✅ Complete

### Development Plan

- [x] Text ingest endpoint
- [x] File upload endpoint (.txt, .md)
- [x] ChromaDB chunking and embedding
- [x] Per-clone collections
- [x] Clear knowledge (delete collection)
- [x] Detailed server-side logging (chunk count, scores, timing)
- [x] 120s client timeout for first-run model download
- [ ] Support PDF ingestion — future
- [ ] Support URL scraping — future
- [ ] View ingested sources list in ManageCloneScreen — future
- [ ] Per-source delete (delete only specific ingested file) — future
- [ ] Knowledge quality scoring / deduplication — future
- [ ] Switch to Pinecone for cloud-hosted vector store — future (set `KNOWLEDGE_PROVIDER=pinecone`)

---

## 5. Voice Interaction

### Overview
The core feature. User holds a mic button, speaks, and the clone responds with synthesized speech. The full pipeline runs server-side via a persistent WebSocket connection.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  InteractionScreen (Mobile)                  │
│                                                              │
│  [Hold mic] ──► expo-av records audio (WAV/iOS, MP4/Android) │
│  [Release]  ──► read file as base64                         │
│              ──► sendAudio(base64) over WebSocket            │
│              ──► endSpeech({ format })                       │
│                                                              │
│  ◄── transcript   → show in chat bubble                      │
│  ◄── audio_chunks → reassemble → write .mp3 → play          │
│                                                              │
│  FaceAvatar animates: idle → listening → thinking → speaking │
└──────────────────────┬───────────────────────────────────────┘
                       │ WebSocket  ws://<host>/api/v1/ws/voice
┌──────────────────────▼───────────────────────────────────────┐
│              Backend — voice.py (WebSocket handler)          │
│                                                              │
│  Receive audio_chunk(s) → buffer in memory                   │
│  Receive end_of_speech { format }                            │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 1. STT: upload buffer to S3 → Transcribe batch job  │     │
│  │         poll until complete → get transcript        │     │
│  ├─────────────────────────────────────────────────────┤     │
│  │ 2. RAG: ChromaDB search(clone_id, transcript, k=5)  │     │
│  │         returns top-5 relevant knowledge chunks     │     │
│  ├─────────────────────────────────────────────────────┤     │
│  │ 3. LLM: build system prompt                         │     │
│  │         (persona + domain + knowledge snippets)     │     │
│  │         Bedrock Converse API with last 10 turns     │     │
│  ├─────────────────────────────────────────────────────┤     │
│  │ 4. TTS: Polly synthesize reply → MP3 bytes          │     │
│  │         stream back in 32 KB WebSocket chunks       │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
          │              │                    │
   AWS Transcribe   ChromaDB +          AWS Bedrock
   (S3 batch job)   MiniLM embed       (Nova Pro, Converse API)
                                             │
                                        AWS Polly
                                        (neural MP3)
```

### WebSocket Message Flow

```
Client                              Server
  │                                   │
  ├──── init { clone_id, domain } ───►│
  │◄─── ready { session_id } ─────────┤
  │                                   │
  ├──── audio_chunk { data } ─────────►│  (multiple)
  ├──── end_of_speech { format } ─────►│
  │                                   │── transcribe
  │◄─── transcript { data } ──────────┤
  │                                   │── RAG search
  │                                   │── LLM call
  │◄─── response_text { data } ───────┤
  │                                   │── TTS
  │◄─── audio_chunk { data } ─────────┤  (multiple 32KB)
  │◄─── audio_done ───────────────────┤
  │                                   │
  ├──── audio_chunk ... (next turn) ──►│
```

### Audio Formats

```
iOS:     expo-av → LinearPCM → .wav (16kHz, mono)
                                    │
                              S3 upload
                                    │
                         Transcribe MediaFormat: "wav"

Android: expo-av → AAC → .mp4 (16kHz, mono)
                                    │
                              S3 upload
                                    │
                         Transcribe MediaFormat: "mp4"
```

### Avatar State Machine

```
         ┌──────────────────────────────────┐
         │            IDLE                  │
         │  Breathing pulse, smile, soft    │
         │  purple glow                     │
         └──────┬───────────────────────────┘
                │ onPressIn (mic)
         ┌──────▼───────────────────────────┐
         │          LISTENING               │
         │  Green glow, pulsing ring,       │
         │  slight mouth open               │
         └──────┬───────────────────────────┘
                │ onPressOut (mic released)
         ┌──────▼───────────────────────────┐
         │          THINKING                │
         │  Amber glow, slow pulse,         │
         │  closed mouth                    │
         └──────┬───────────────────────────┘
                │ onResponseText received
         ┌──────▼───────────────────────────┐
         │          SPEAKING                │
         │  Purple glow, irregular mouth    │
         │  animation (8-step loop)         │
         └──────┬───────────────────────────┘
                │ audio_done + playback complete
                └──► IDLE
```

### Tools & Technologies

| Tool | Role |
|------|------|
| `expo-av` | Audio recording (LinearPCM/AAC) and MP3 playback |
| `expo-file-system/legacy` | Read recording as base64, write MP3 to cache |
| WebSocket (React Native built-in) | Real-time bidirectional communication |
| AWS Transcribe | Speech-to-text (batch job via S3) |
| AWS S3 | Temporary audio storage for Transcribe |
| ChromaDB | Vector search for relevant knowledge |
| AWS Bedrock Converse API | LLM response (Amazon Nova Pro) |
| AWS Polly | Text-to-speech (neural, MP3) |
| React Native `Animated` | Avatar face animations (native driver) |
| `expo-linear-gradient` | Avatar face gradient, state color changes |

### Files

| File | Role |
|------|------|
| `mobile/src/screens/InteractionScreen.js` | Full UI + recording + playback logic |
| `mobile/src/services/voiceService.js` | WebSocket session factory |
| `backend/app/api/v1/routes/voice.py` | WebSocket handler, session management |
| `backend/app/services/providers/aws/stt.py` | Transcribe provider |
| `backend/app/services/providers/aws/tts.py` | Polly provider |
| `backend/app/services/providers/aws/agent.py` | Bedrock Converse API |
| `backend/app/services/providers/chroma/knowledge.py` | Vector search |

### Status: ✅ Complete (core flow working)

### Development Plan

- [x] WebSocket connection with session management
- [x] Push-to-talk recording (iOS WAV, Android MP4)
- [x] Audio format detection passed in `end_of_speech` message
- [x] AWS Transcribe batch job with polling
- [x] ChromaDB RAG injection into system prompt
- [x] AWS Bedrock Converse API (model-agnostic)
- [x] AWS Polly TTS, streamed back in 32KB chunks
- [x] MP3 reassembly and playback via expo-av
- [x] iOS audio routing fix (allowsRecordingIOS reset before playback)
- [x] Animated face avatar (blink, smile, speaking mouth, state glow)
- [x] Minimum recording duration guard (700ms)
- [x] Domain selector UI with active gradient chip
- [ ] Streaming LLM response (token by token) — future
- [ ] Real-time streaming STT (Transcribe streaming API) — future
- [ ] Conversation history persistence (currently in-memory) — future
- [ ] Interrupt/stop speaking button — future
- [ ] Voice activity detection (auto end-of-speech) — future
- [ ] Clone voice cloning (ElevenLabs provider) — future
- [ ] Redis session store for multi-instance backend — future

---

## 6. Clone Discovery (User)

### Overview
Authenticated users see a list of all active clones and can tap to start a voice interaction.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                  CloneListScreen                     │
│                                                      │
│  useEffect → cloneService.listClones()               │
│           → GET /api/v1/clones                       │
│                                                      │
│  CloneCard (per clone):                              │
│    Gradient avatar circle + initial letter           │
│    Name, title, domain badges                        │
│    onPress → navigate('Interaction', { clone })      │
│                                                      │
│  Pull-to-refresh (RefreshControl)                    │
└──────────────────────┬───────────────────────────────┘
                       │ REST
┌──────────────────────▼───────────────────────────────┐
│         GET /api/v1/clones                           │
│         Returns: CloneListItem[]                     │
│         Filter: is_active = true only                │
└──────────────────────────────────────────────────────┘
```

### Tools & Technologies

| Tool | Role |
|------|------|
| FastAPI | `GET /clones` endpoint |
| SQLAlchemy | Query active clones |
| Axios (`cloneService.js`) | Mobile HTTP client |
| React Native `FlatList` / `ScrollView` | Clone card list |
| `expo-linear-gradient` | Clone avatar gradient |

### Files

| File | Role |
|------|------|
| `mobile/src/screens/CloneListScreen.js` | User-facing clone list |
| `mobile/src/services/cloneService.js` | `listClones()` |
| `backend/app/api/v1/routes/clones.py` | `GET /clones` handler |

### Status: ✅ Complete

### Development Plan

- [x] Fetch and display active clones
- [x] Pull-to-refresh
- [x] Domain badge display
- [x] Navigate to InteractionScreen on tap
- [ ] Search / filter clones by domain — future
- [ ] Clone detail/preview screen before starting — future
- [ ] Favorites — future
- [ ] Recent conversations — future

---

## 7. User Profile

### Overview
Read-only profile screen showing the authenticated user's name and email. No editing allowed — name is set at signup only.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                   ProfileScreen                      │
│                                                      │
│  Reads from: useAuth() → user.displayName            │
│                        → user.username (email)       │
│                                                      │
│  Displays:                                           │
│    Avatar circle (gradient + initial)                │
│    Full Name (from Cognito name attribute)           │
│    Email                                             │
│    Sign Out button → authStore.signOut()             │
└──────────────────────────────────────────────────────┘
                       │
               authStore.js (Zustand)
                       │
               AWS Cognito session
               (name read from ID token payload)
```

### Tools & Technologies

| Tool | Role |
|------|------|
| Zustand (`authStore.js`) | Source of `user.displayName` and `user.username` |
| AWS Cognito ID Token | `payload.name` attribute |
| `expo-linear-gradient` | Avatar gradient |

### Files

| File | Role |
|------|------|
| `mobile/src/screens/ProfileScreen.js` | Profile display + sign out |
| `mobile/src/store/authStore.js` | Provides `user`, `signOut` |

### Status: ✅ Complete

### Development Plan

- [x] Display name and email (read-only)
- [x] Gradient avatar with initial
- [x] Sign out with confirmation dialog
- [ ] Edit profile (name update via Cognito `updateAttributes`) — future
- [ ] Profile photo upload (S3 → Cognito `picture` attribute) — future
- [ ] Conversation history list — future
- [ ] Notification preferences — future

---

## 8. Admin Dashboard

### Overview
The admin's home screen. Shows all clones (active and inactive), a system status panel, and provides navigation to create or manage individual clones.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  AdminDashboardScreen                    │
│                                                          │
│  Hero banner (gradient): admin name, email, badge        │
│                                                          │
│  Clone List ──► cloneService.listClones()                │
│    CloneRow: name, title, domains, active status dot     │
│    onManage → navigate('ManageClone', { clone })         │
│                                                          │
│  [+ Create Clone] → navigate('CreateClone')              │
│                                                          │
│  System Status panel (hardcoded):                        │
│    Auth Service, API Gateway, Cognito, Vector Store      │
│                                                          │
│  Sign Out button → authStore.signOut()                   │
│                                                          │
│  Pull-to-refresh (re-fetches clone list)                 │
│  navigation.addListener('focus') → refresh on return     │
└──────────────────────┬───────────────────────────────────┘
                       │ REST
┌──────────────────────▼───────────────────────────────────┐
│  GET /api/v1/clones  → full clone list (all active)      │
│  DELETE /api/v1/clones/:id → soft delete from row        │
└──────────────────────────────────────────────────────────┘
```

### Tools & Technologies

| Tool | Role |
|------|------|
| FastAPI | Clone list + delete endpoints |
| Axios (`cloneService.js`) | HTTP client |
| `expo-linear-gradient` | Hero banner, avatar circles |
| React Native `ScrollView` + `RefreshControl` | Pull-to-refresh list |
| React Navigation `focus` listener | Auto-refresh after managing a clone |

### Files

| File | Role |
|------|------|
| `mobile/src/screens/AdminDashboardScreen.js` | Admin home screen |
| `mobile/src/navigation/AdminNavigator.js` | Admin screen stack |
| `mobile/src/services/cloneService.js` | `listClones`, `deleteClone` |

### Status: ✅ Complete

### Development Plan

- [x] Clone list with pull-to-refresh
- [x] Auto-refresh on screen focus
- [x] Navigate to create / manage clone
- [x] Soft delete from dashboard
- [x] Admin hero banner with name and badge
- [x] System status panel
- [ ] Real system status (ping health endpoints) — future
- [ ] Analytics cards (total users, conversations today) — future
- [ ] Clone usage stats per clone — future
- [ ] Bulk operations (activate/deactivate multiple) — future

---

## Future Modules (Planned)

| Module | Description | Priority |
|--------|-------------|----------|
| **Streaming STT** | Replace Transcribe batch with real-time streaming API — eliminates S3 roundtrip | High |
| **Conversation History** | Persist session history to DB, show past conversations | High |
| **Push Notifications** | Notify users when new clones are available | Medium |
| **Clone Voice Cloning** | ElevenLabs provider for personalized voice (instead of Polly) | Medium |
| **Avatar Image** | Upload real photo for clone, show in CloneList | Medium |
| **Backend Role Enforcement** | Admin middleware in FastAPI (currently only client-side) | High |
| **Redis Sessions** | Replace in-memory WebSocket session store for multi-instance support | High |
| **PostgreSQL Migration** | Switch from SQLite for production deployment | High |
| **PDF Ingestion** | Support PDF files in knowledge base | Medium |
| **URL Scraping** | Ingest content from a URL | Low |
