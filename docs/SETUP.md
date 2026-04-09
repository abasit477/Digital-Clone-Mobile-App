# Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | |
| Python | 3.11 exactly | 3.14 breaks pydantic-core/tokenizers wheels |
| Expo CLI | latest | `npm install -g expo-cli` |
| AWS account | — | With Bedrock, Transcribe, Polly, Cognito access |

---

## Backend

### 1. Create virtual environment

```bash
cd backend
/opt/homebrew/bin/python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Where to find it |
|----------|-----------------|
| `AWS_ACCESS_KEY_ID` | AWS Console → IAM → Your user → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | Same as above |
| `AWS_REGION` | Your preferred region (default: `us-east-1`) |
| `COGNITO_USER_POOL_ID` | Cognito → User Pools → your pool |
| `COGNITO_CLIENT_ID` | Cognito → User Pools → App clients |
| `BEDROCK_MODEL_ID` | Use `us.amazon.nova-pro-v1:0` or check Bedrock Model access page |

### 3. Enable Bedrock model access

1. AWS Console → Amazon Bedrock → Model access
2. Request access to **Amazon Nova Pro** (instant approval)
3. Use the **inference profile ID** with `us.` prefix: `us.amazon.nova-pro-v1:0`

> **Note:** Direct `anthropic.*` model IDs require on-demand throughput which may not be available. The `us.` prefix (cross-region inference profile) is required for most Claude and Nova models.

### 4. Create S3 bucket for Transcribe

The STT provider auto-creates the bucket `digital-clone-audio-{region}` on first use. Ensure your IAM user has `s3:CreateBucket`, `s3:PutObject`, `s3:GetObject` permissions.

### 5. Run the server

```bash
# Accessible from mobile device on same network
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Localhost only
uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/docs`

---

## Mobile App

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Configure admin account

```bash
cp src/config/adminConfig.example.js src/config/adminConfig.js
```

Edit `adminConfig.js` and set `ADMIN_EMAIL` to the Cognito account that should have admin access. This file is git-ignored.

### 3. Set backend URL

Create `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000/api/v1
```

Find your Mac's local IP: `System Settings → Wi-Fi → Details` or run `ipconfig getifaddr en0`.

> The phone and Mac must be on the same Wi-Fi network.

### 4. Run the app

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone.

---

## AWS IAM Permissions

The IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["bedrock:InvokeModel", "bedrock:Converse"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["polly:SynthesizeSpeech"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["s3:CreateBucket", "s3:PutObject", "s3:GetObject"], "Resource": "*" }
  ]
}
```

---

## First Run Notes

- **First knowledge ingest downloads ~90 MB** embedding model (`all-MiniLM-L6-v2`). The mobile client uses a 120s timeout for this.
- SQLite DB and ChromaDB are auto-created in `backend/` on first server start.
- Cognito User Pool must have the `name` attribute enabled for the signup name field to work.
