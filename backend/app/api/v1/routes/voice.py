"""
Real-time voice interaction via WebSocket.

Protocol (JSON messages):
  Client → Server:
    { "type": "init",          "clone_id": "...", "domain": "family|professional|general", "session_id": "..." }
    { "type": "audio_chunk",   "data": "<base64 WAV bytes>" }
    { "type": "end_of_speech" }
    { "type": "ping" }

  Server → Client:
    { "type": "ready" }
    { "type": "transcript",    "data": "what the user said" }
    { "type": "response_text", "data": "the clone's reply text" }
    { "type": "audio_chunk",   "data": "<base64 MP3 bytes>" }
    { "type": "audio_done" }
    { "type": "error",         "message": "..." }
"""
import asyncio
import base64
import uuid
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from ....db.database import get_db
from ....models.clone import Clone
from ....core.dependencies import get_stt_provider, get_tts_provider, get_agent_provider, get_knowledge_provider
from ....services.interfaces.agent import AgentContext
from ....services.interfaces.stt import STTProvider
from ....services.interfaces.tts import TTSProvider
from ....services.interfaces.agent import AgentProvider
from ....services.interfaces.knowledge import KnowledgeProvider

logger = logging.getLogger(__name__)
router = APIRouter(tags=["voice"])

# In-memory session store (replace with Redis for multi-instance deployments)
_sessions: dict[str, dict] = {}


async def _send(ws: WebSocket, msg: dict):
    await ws.send_text(json.dumps(msg))


@router.websocket("/ws/voice")
async def voice_websocket(
    ws: WebSocket,
    db: Session = Depends(get_db),
    stt: STTProvider = Depends(get_stt_provider),
    tts: TTSProvider = Depends(get_tts_provider),
    agent: AgentProvider = Depends(get_agent_provider),
    knowledge: KnowledgeProvider = Depends(get_knowledge_provider),
):
    await ws.accept()
    session_id = str(uuid.uuid4())
    audio_buffer: list[bytes] = []
    clone: Clone | None = None
    domain = "general"
    history: list[dict] = []

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            # ── init ───────────────────────────────────────────────────────
            if msg_type == "init":
                clone_id = msg.get("clone_id", "")
                domain = msg.get("domain", "general")
                session_id = msg.get("session_id") or session_id

                clone = db.query(Clone).filter(Clone.id == clone_id).first()
                if not clone:
                    await _send(ws, {"type": "error", "message": f"Clone '{clone_id}' not found"})
                    await ws.close()
                    return

                # Restore history if session already exists
                history = _sessions.get(session_id, {}).get("history", [])
                _sessions[session_id] = {"clone_id": clone_id, "domain": domain, "history": history}
                await _send(ws, {"type": "ready", "session_id": session_id})

            # ── audio chunk ────────────────────────────────────────────────
            elif msg_type == "audio_chunk":
                raw_audio = base64.b64decode(msg.get("data", ""))
                audio_buffer.append(raw_audio)

            # ── end of speech ──────────────────────────────────────────────
            elif msg_type == "end_of_speech":
                if not clone:
                    await _send(ws, {"type": "error", "message": "Session not initialized. Send 'init' first."})
                    continue

                if not audio_buffer:
                    await _send(ws, {"type": "error", "message": "No audio received."})
                    continue

                combined_audio = b"".join(audio_buffer)
                audio_buffer.clear()
                audio_format = msg.get("format", "mp4")

                # 1. Transcribe
                try:
                    transcript = await stt.transcribe(combined_audio, audio_format=audio_format)
                except Exception as e:
                    logger.exception("STT error")
                    await _send(ws, {"type": "error", "message": f"Transcription failed: {e}"})
                    continue

                await _send(ws, {"type": "transcript", "data": transcript})

                # 2. Retrieve relevant knowledge
                try:
                    docs = await knowledge.search(clone.id, transcript)
                    snippets = [d.content for d in docs]
                except Exception:
                    logger.exception("Knowledge search error")
                    snippets = []

                # 3. Generate clone response
                try:
                    context = AgentContext(
                        clone_id=clone.id,
                        domain=domain,
                        session_id=session_id,
                        persona_prompt=clone.persona_prompt,
                        knowledge_snippets=snippets,
                        history=history,
                    )
                    agent_resp = await agent.chat(transcript, context)
                    reply_text = agent_resp.text
                except Exception as e:
                    logger.exception("Agent error")
                    await _send(ws, {"type": "error", "message": f"Agent failed: {e}"})
                    continue

                await _send(ws, {"type": "response_text", "data": reply_text})

                # Update history
                history.append({"role": "user",      "content": transcript})
                history.append({"role": "assistant",  "content": reply_text})
                _sessions[session_id]["history"] = history

                # 4. Synthesize speech
                try:
                    audio_bytes = await tts.synthesize(reply_text, voice_id=clone.voice_id)
                except Exception as e:
                    logger.exception("TTS error")
                    await _send(ws, {"type": "error", "message": f"TTS failed: {e}"})
                    continue

                # Stream audio in 32KB chunks
                chunk_size = 32 * 1024
                for i in range(0, len(audio_bytes), chunk_size):
                    chunk = audio_bytes[i: i + chunk_size]
                    await _send(ws, {
                        "type": "audio_chunk",
                        "data": base64.b64encode(chunk).decode(),
                    })
                    await asyncio.sleep(0)   # yield to event loop

                await _send(ws, {"type": "audio_done"})

            # ── ping ───────────────────────────────────────────────────────
            elif msg_type == "ping":
                await _send(ws, {"type": "pong"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", session_id)
    except Exception as e:
        logger.exception("Unexpected WebSocket error")
        try:
            await _send(ws, {"type": "error", "message": str(e)})
        except Exception:
            pass
