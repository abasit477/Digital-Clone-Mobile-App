# Digital Clone — AI Voice Assistant Platform

A mobile platform for interacting with AI-powered digital clones of real people. Each clone is trained on a person's values, beliefs, and life lessons and can be conversed with via real-time voice across different domains (family, professional, mentorship).

## Features

- **Real-time voice interaction** — push-to-talk, live transcription, AI response, speech synthesis
- **Digital clone management** — create clones with personas, domains, and voice preferences
- **RAG knowledge base** — upload text or files to train each clone's knowledge
- **Role-based access** — admin dashboard for clone management, user view for interaction
- **Animated avatar** — face avatar with blinking eyes, smile, and speaking mouth animation
- **AWS-powered** — Bedrock (LLM), Transcribe (STT), Polly (TTS), Cognito (auth)
- **Modular providers** — swap any AI service via `.env` without code changes

## Project Structure

```
Digital Assistant/
├── mobile/          # Expo React Native app (SDK 54)
├── backend/         # Python FastAPI server
└── docs/            # Project documentation
```

## Quick Start

See [docs/SETUP.md](docs/SETUP.md) for full setup instructions.

**Backend:**
```bash
cd backend
cp .env.example .env   # fill in AWS credentials
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Mobile:**
```bash
cd mobile
cp src/config/adminConfig.example.js src/config/adminConfig.js
npx expo start
```

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/SETUP.md) | Full installation and configuration |
| [Architecture](docs/ARCHITECTURE.md) | System design and technical decisions |
| [API Reference](docs/API.md) | Backend REST + WebSocket API |
| [Changelog](docs/CHANGELOG.md) | Daily development log |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 54, React Native, React Navigation v7 |
| Auth | AWS Cognito (`amazon-cognito-identity-js`) |
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| LLM | AWS Bedrock (Amazon Nova Pro via Converse API) |
| STT | AWS Transcribe |
| TTS | AWS Polly (neural) |
| Vector DB | ChromaDB + `sentence-transformers/all-MiniLM-L6-v2` |
| App DB | SQLite (dev) → PostgreSQL (prod) |
