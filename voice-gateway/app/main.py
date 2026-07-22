"""
Voice Gateway — FastAPI WebSocket server.

WebSocket protocol (binary + JSON frames):

  Client → Server
    binary frame   : raw audio chunk (accumulated until end_of_speech)
    {"type": "end_of_speech"}  : flush accumulated audio, run STT → adapter → TTS
    {"type": "reset"}          : clear session history
    {"type": "ping"}           : keepalive

  Server → Client
    {"type": "transcript", "text": "..."}   : STT result
    {"type": "response_text", "text": "..."}: adapter text (full, after streaming)
    binary frame                             : TTS audio bytes (mp3 or aiff)
    {"type": "done"}                         : turn complete
    {"type": "error", "message": "..."}      : error (session continues)
    {"type": "expired"}                      : session time limit reached
    {"type": "pong"}                         : keepalive reply
"""

import json
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.config import settings
from app.router import build_adapter, build_stt, build_tts
from app.session import registry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Singletons — built once at startup, shared across connections
_stt = None
_tts = None
_adapter = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _stt, _tts, _adapter
    _stt = build_stt()
    _tts = build_tts()
    _adapter = build_adapter()
    logger.info(
        "Voice Gateway ready  stt=%s  tts=%s  adapter=%s",
        settings.stt_provider,
        settings.tts_provider,
        settings.adapter,
    )
    yield


app = FastAPI(title="Voice Gateway", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "adapter": settings.adapter}


@app.websocket("/ws/voice")
async def voice_ws(ws: WebSocket):
    session_id = str(uuid.uuid4())
    session = registry.create(session_id)

    await ws.accept()
    await ws.send_text(json.dumps({"type": "session_start", "session_id": session_id}))
    logger.info("ws[%s] connected", session_id)

    audio_buffer: list[bytes] = []

    try:
        while True:
            if registry.check_expiry(session_id):
                await ws.send_text(json.dumps({"type": "expired"}))
                break

            data = await ws.receive()

            # Binary frame: audio chunk
            if "bytes" in data and data["bytes"]:
                chunk = data["bytes"]
                audio_buffer.append(chunk)
                continue

            # Text frame: control message
            if "text" in data:
                try:
                    msg = json.loads(data["text"])
                except json.JSONDecodeError:
                    await ws.send_text(json.dumps({"type": "error", "message": "invalid JSON"}))
                    continue

                msg_type = msg.get("type")

                if msg_type == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
                    continue

                if msg_type == "reset":
                    audio_buffer.clear()
                    await _adapter.reset(session_id)
                    await ws.send_text(json.dumps({"type": "reset_ok"}))
                    continue

                if msg_type == "end_of_speech":
                    if not audio_buffer:
                        await ws.send_text(
                            json.dumps({"type": "error", "message": "no audio received"})
                        )
                        continue

                    audio_data = b"".join(audio_buffer)
                    audio_buffer.clear()

                    await _handle_turn(ws, session_id, audio_data)
                    continue

    except WebSocketDisconnect:
        logger.info("ws[%s] disconnected", session_id)
    except Exception as exc:
        logger.exception("ws[%s] unhandled error: %s", session_id, exc)
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))
        except Exception:
            pass
    finally:
        registry.remove(session_id)
        await _adapter.reset(session_id)


async def _handle_turn(ws: WebSocket, session_id: str, audio_data: bytes) -> None:
    # STT
    try:
        transcript = await _stt.transcribe(audio_data)
    except ValueError as exc:
        await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))
        return

    if not transcript:
        await ws.send_text(json.dumps({"type": "error", "message": "empty transcript"}))
        return

    await ws.send_text(json.dumps({"type": "transcript", "text": transcript}))
    logger.info("ws[%s] transcript: %r", session_id, transcript[:80])

    # Adapter (stream text, collect full response)
    full_text_parts: list[str] = []
    async for chunk in _adapter.respond(transcript, session_id):
        full_text_parts.append(chunk)

    full_text = "".join(full_text_parts)
    await ws.send_text(json.dumps({"type": "response_text", "text": full_text}))

    # TTS
    try:
        audio_out = await _tts.synthesize(full_text)
    except Exception as exc:
        logger.error("ws[%s] TTS error: %s", session_id, exc)
        await ws.send_text(json.dumps({"type": "error", "message": f"TTS failed: {exc}"}))
        await ws.send_text(json.dumps({"type": "done"}))
        return

    if audio_out:
        await ws.send_bytes(audio_out)

    await ws.send_text(json.dumps({"type": "done"}))
    logger.info("ws[%s] turn done (%d audio bytes)", session_id, len(audio_out))
