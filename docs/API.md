# API Reference

Base URL: `http://<host>:8000/api/v1`

---

## Health

### `GET /health`
Returns server status.

**Response:**
```json
{ "status": "ok" }
```

---

## Clones

### `GET /clones`
List all active clones.

**Response:** Array of `CloneListItem`
```json
[
  {
    "id": "uuid",
    "name": "John",
    "title": "Father & Entrepreneur",
    "domains": "family,professional",
    "avatar_url": null,
    "is_active": true
  }
]
```

---

### `GET /clones/{clone_id}`
Get a single clone's full details.

**Response:** `CloneResponse`
```json
{
  "id": "uuid",
  "name": "John",
  "title": "Father & Entrepreneur",
  "description": "...",
  "persona_prompt": "You are John...",
  "domains": "family,professional",
  "avatar_url": null,
  "voice_id": "Matthew",
  "is_active": true,
  "created_at": "2026-04-08T00:00:00",
  "updated_at": "2026-04-08T00:00:00"
}
```

---

### `POST /clones`
Create a new clone.

**Body:** `CloneCreate`
```json
{
  "name": "John",
  "title": "Father & Entrepreneur",
  "description": "...",
  "persona_prompt": "You are John. You speak warmly and draw on decades of experience...",
  "domains": "family,professional,mentorship",
  "avatar_url": null,
  "voice_id": "Matthew"
}
```

**Response:** `CloneResponse` (201)

---

### `PUT /clones/{clone_id}`
Update a clone.

**Body:** `CloneUpdate` (all fields optional)

**Response:** `CloneResponse`

---

### `DELETE /clones/{clone_id}`
Soft-delete a clone (sets `is_active = false`).

**Response:** `204 No Content`

---

## Knowledge Base

### `POST /admin/clones/{clone_id}/ingest`
Ingest plain text into the clone's knowledge base.

**Body:**
```json
{
  "text": "Full text content to ingest...",
  "source": "interview-2024.txt"
}
```

**Response:**
```json
{
  "message": "Ingested N chunks into clone {clone_id}",
  "chunks": 12
}
```

> First call downloads the ~90 MB embedding model. Use a 120s client timeout.

---

### `POST /admin/clones/{clone_id}/ingest/file`
Upload a `.txt` or `.md` file.

**Body:** `multipart/form-data`
- `file` — file content
- `source` — filename label

**Response:** Same as text ingest.

---

### `DELETE /admin/clones/{clone_id}/knowledge`
Delete all knowledge for a clone (drops the ChromaDB collection).

**Response:** `204 No Content`

---

## Voice (WebSocket)

### `WS /api/v1/ws/voice`

See [ARCHITECTURE.md — WebSocket Protocol](ARCHITECTURE.md#websocket-protocol) for the full message reference.

**Connection flow:**
```
connect
  → send init
  ← receive ready
  → hold mic: send audio_chunk (multiple)
  → release mic: send end_of_speech { format: "wav" | "mp4" }
  ← receive transcript
  ← receive response_text
  ← receive audio_chunk (multiple, base64 MP3)
  ← receive audio_done
  → repeat from audio_chunk step
```

**Polly Voice IDs** (neural engine, `en-US`):

| ID | Gender | Style |
|----|--------|-------|
| `Matthew` | Male | Conversational |
| `Joanna` | Female | Conversational |
| `Stephen` | Male | Conversational |
| `Salli` | Female | Conversational |
| `Joey` | Male | Conversational |
| `Kendra` | Female | Conversational |
