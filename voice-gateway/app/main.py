"""
Voice Gateway — FastAPI WebSocket server.

WebSocket protocol (binary + JSON frames):

  Client → Server
    binary frame   : raw audio chunk (accumulated until end_of_speech)
    {"type": "end_of_speech"}                         : flush audio, run STT → adapter → TTS
    {"type": "reset"}                                 : clear session history
    {"type": "ping"}                                  : keepalive
    {"type": "set_task", "title": "...", "description": "..."}  : set current task (description optional)
    {"type": "update_task", "title"?: "...", "description"?: "...", "status"?: "..."}
    {"type": "complete_task"}                         : mark current task completed
    {"type": "clear_task"}                            : remove current task
    {"type": "record_tool_result", "tool": "...", "fact": "...", "source": "...", "key"?: "..."}
    {"type": "propose_memory", "key": "...", "value": <any JSON>, "category"?: "...", "reason"?: "...", "source"?: "...", "confidence"?: 1.0}
    {"type": "approve_memory", "candidate_id": "..."}  : write candidate to persistent memory
    {"type": "reject_memory", "candidate_id": "..."}   : discard candidate
    {"type": "list_memory_candidates"}                  : list pending candidates for this session

  Server → Client
    {"type": "transcript", "text": "..."}   : STT result
    {"type": "response_text", "text": "..."}: adapter text (full, after streaming)
    binary frame                             : TTS audio bytes (mp3 or aiff)
    {"type": "timing", "stages": {...}}      : per-stage latency in ms (sent before "done")
    {"type": "done"}                         : turn complete
    {"type": "error", "message": "..."}      : error (session continues)
    {"type": "expired"}                      : session time limit reached
    {"type": "pong"}                         : keepalive reply
    {"type": "task_ok", "action": "..."}     : task operation acknowledged
    {"type": "tool_memory_ok"}               : tool result recorded
    {"type": "candidate_proposed", "candidate_id": "...", "key": "..."}
    {"type": "candidate_approved", "candidate_id": "...", "key": "..."}
    {"type": "candidate_rejected", "candidate_id": "..."}
    {"type": "candidates", "items": [...]}   : response to list_memory_candidates

Timing stages (all in milliseconds, server-side only):
    stt_ms        — audio received → transcript ready
    adapter_ms    — transcript ready → last text chunk
    tts_ms        — text ready → audio bytes ready
    total_ms      — end_of_speech received → audio sent
"""

import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app import turn_context
from app.audio.sentence import SentenceBuffer
from app.config import settings
from app.memory_candidates import candidate_registry
from app.memory_promotion import promote as _promote_to_memory
from app.observability.json_log import json_log_subscriber
from app.router import build_orchestrator, build_stt, build_tts
from app.session import registry
from app.summary import summary_registry
from app.task import task_registry
from app.tool_memory import ToolMemoryEntry, tool_memory_registry
from app.trace import TraceStep, TurnTrace
from app.trace_bus import trace_bus

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
    _adapter = build_orchestrator()
    trace_bus.subscribe(json_log_subscriber)
    logger.info(
        "Voice Gateway ready  stt=%s(%s)  tts=%s(%s)  adapter=%s  backend=%s",
        settings.stt_provider, type(_stt).__name__,
        settings.tts_provider, type(_tts).__name__,
        settings.adapter,
        type(_adapter).__name__,
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

            # Client closed connection cleanly
            if data.get("type") == "websocket.disconnect":
                break

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

                if msg_type == "set_task":
                    title = msg.get("title", "").strip()
                    if not title:
                        await ws.send_text(
                            json.dumps({"type": "error", "message": "set_task requires title"})
                        )
                        continue
                    task_registry.set(session_id, title, msg.get("description", ""))
                    await ws.send_text(json.dumps({"type": "task_ok", "action": "set"}))
                    continue

                if msg_type == "update_task":
                    allowed = {"title", "description", "status"}
                    kwargs = {
                        k: v for k, v in msg.items()
                        if k in allowed and isinstance(v, str)
                    }
                    task_registry.update(session_id, **kwargs)
                    await ws.send_text(json.dumps({"type": "task_ok", "action": "update"}))
                    continue

                if msg_type == "complete_task":
                    task_registry.complete(session_id)
                    await ws.send_text(json.dumps({"type": "task_ok", "action": "complete"}))
                    continue

                if msg_type == "clear_task":
                    task_registry.clear(session_id)
                    await ws.send_text(json.dumps({"type": "task_ok", "action": "clear"}))
                    continue

                if msg_type == "record_tool_result":
                    tool = msg.get("tool", "").strip()
                    fact = msg.get("fact", "").strip()
                    source = msg.get("source", "").strip()
                    if not tool or not fact or not source:
                        await ws.send_text(json.dumps({
                            "type": "error",
                            "message": "record_tool_result requires tool, fact, source",
                        }))
                        continue
                    try:
                        tool_memory_registry.record(
                            session_id,
                            ToolMemoryEntry(
                                tool=tool,
                                fact=fact,
                                source=source,
                                key=msg.get("key", ""),
                            ),
                        )
                        await ws.send_text(json.dumps({"type": "tool_memory_ok"}))
                    except Exception as exc:
                        logger.error("ws[%s] tool_memory record error: %s", session_id, exc)
                        await ws.send_text(json.dumps({"type": "error", "message": f"tool_memory: {exc}"}))
                    continue

                if msg_type == "propose_memory":
                    key = msg.get("key", "")
                    if not isinstance(key, str) or not key.strip():
                        await ws.send_text(json.dumps({
                            "type": "error",
                            "message": "propose_memory requires key",
                        }))
                        continue
                    if "value" not in msg:
                        await ws.send_text(json.dumps({
                            "type": "error",
                            "message": "propose_memory requires value",
                        }))
                        continue
                    try:
                        candidate = candidate_registry.propose(
                            session_id=session_id,
                            persona=settings.persona,
                            key=key,
                            value=msg["value"],
                            category=msg.get("category", "general"),
                            reason=msg.get("reason", ""),
                            source=msg.get("source", "session"),
                            confidence=float(msg.get("confidence", 1.0)),
                        )
                        await ws.send_text(json.dumps({
                            "type": "candidate_proposed",
                            "candidate_id": candidate.id,
                            "key": candidate.key,
                        }))
                    except ValueError as exc:
                        await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))
                    except Exception as exc:
                        logger.error("ws[%s] propose_memory error: %s", session_id, exc)
                        await ws.send_text(json.dumps({"type": "error", "message": f"propose_memory: {exc}"}))
                    continue

                if msg_type == "approve_memory":
                    candidate_id = msg.get("candidate_id", "")
                    if not candidate_id:
                        await ws.send_text(json.dumps({
                            "type": "error",
                            "message": "approve_memory requires candidate_id",
                        }))
                        continue
                    candidate = candidate_registry.get(session_id, candidate_id)
                    if candidate is None:
                        await ws.send_text(json.dumps({
                            "type": "error",
                            "message": f"candidate {candidate_id!r} not found",
                        }))
                        continue
                    try:
                        _promote_to_memory(candidate.persona, candidate.key, candidate.value)
                        candidate_registry.remove(session_id, candidate_id)
                        await ws.send_text(json.dumps({
                            "type": "candidate_approved",
                            "candidate_id": candidate_id,
                            "key": candidate.key,
                        }))
                    except Exception as exc:
                        logger.error("ws[%s] approve_memory error: %s", session_id, exc)
                        await ws.send_text(json.dumps({"type": "error", "message": f"approve_memory: {exc}"}))
                    continue

                if msg_type == "reject_memory":
                    candidate_id = msg.get("candidate_id", "")
                    if not candidate_id:
                        await ws.send_text(json.dumps({
                            "type": "error",
                            "message": "reject_memory requires candidate_id",
                        }))
                        continue
                    candidate_registry.remove(session_id, candidate_id)
                    await ws.send_text(json.dumps({
                        "type": "candidate_rejected",
                        "candidate_id": candidate_id,
                    }))
                    continue

                if msg_type == "list_memory_candidates":
                    items = [
                        {
                            "id": c.id,
                            "key": c.key,
                            "value": c.value,
                            "category": c.category,
                            "reason": c.reason,
                            "source": c.source,
                            "confidence": c.confidence,
                            "proposed_at": c.proposed_at,
                        }
                        for c in candidate_registry.list(session_id)
                    ]
                    await ws.send_text(json.dumps({"type": "candidates", "items": items}))
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
        task_registry.clear(session_id)
        summary_registry.clear(session_id)
        tool_memory_registry.clear(session_id)
        candidate_registry.clear(session_id)
        await _adapter.reset(session_id)


async def _handle_turn(ws: WebSocket, session_id: str, audio_data: bytes) -> None:
    t_start = time.perf_counter()

    _trace = TurnTrace(
        session_id=session_id,
        turn_id=str(uuid.uuid4()),
        user_text="",
    )
    turn_context.set_trace(_trace)

    try:
        # STT
        turn_context.emit(TraceStep(
            from_node="gateway", to_node="stt",
            type="voice.stt.start",
            payload_size=len(audio_data),
        ))
        try:
            transcript = await _stt.transcribe(audio_data)
        except Exception as exc:
            logger.error("ws[%s] STT error: %s", session_id, exc)
            _trace.error = f"STT: {exc}"
            await ws.send_text(json.dumps({"type": "error", "message": f"STT: {exc}"}))
            await ws.send_text(json.dumps({"type": "done"}))
            return

        t_stt = time.perf_counter()
        turn_context.emit(TraceStep(
            from_node="stt", to_node="gateway",
            type="voice.stt.complete",
            latency_ms=round((t_stt - t_start) * 1000),
            payload_size=len(transcript or ""),
        ))

        if not transcript:
            _trace.error = "empty transcript"
            await ws.send_text(json.dumps({"type": "error", "message": "empty transcript"}))
            return

        _trace.user_text = transcript
        await ws.send_text(json.dumps({"type": "transcript", "text": transcript}))
        logger.info("ws[%s] transcript: %r", session_id, transcript[:80])

        # Pipeline: stream adapter → sentence buffer → TTS per sentence → audio frames.
        # TTS is interleaved with Claude generation, so time_to_first_audio_ms <<
        # total adapter_ms. adapter_ms and tts_ms may overlap — total_ms is the
        # authoritative wall-clock figure.
        _sentence_buf = SentenceBuffer()
        full_text_parts: list[str] = []
        first_token_ms: int | None = None
        first_audio_ms: int | None = None
        t_last_token = time.perf_counter()
        tts_total_ms: int = 0
        total_audio_bytes: int = 0
        t_adapter_start = time.perf_counter()

        turn_context.emit(TraceStep(
            from_node="gateway", to_node="tts",
            type="voice.tts.start",
        ))

        async def _tts_send(sentence: str) -> None:
            nonlocal first_audio_ms, tts_total_ms, total_audio_bytes
            if not sentence:
                return
            t0 = time.perf_counter()
            try:
                audio_chunk = await _tts.synthesize(sentence)
            except Exception as exc:
                logger.error("ws[%s] TTS error for sentence %r: %s", session_id, sentence[:40], exc)
                return
            tts_total_ms += round((time.perf_counter() - t0) * 1000)
            if audio_chunk:
                if first_audio_ms is None:
                    first_audio_ms = round((time.perf_counter() - t_start) * 1000)
                await ws.send_bytes(audio_chunk)
                total_audio_bytes += len(audio_chunk)

        try:
            async for chunk in _adapter.respond(transcript, session_id):
                if first_token_ms is None:
                    first_token_ms = round((time.perf_counter() - t_start) * 1000)
                t_last_token = time.perf_counter()
                full_text_parts.append(chunk)
                sentence = _sentence_buf.push(chunk)
                if sentence:
                    await _tts_send(sentence)

            tail = _sentence_buf.flush()
            if tail:
                await _tts_send(tail)

        except Exception as exc:
            logger.error("ws[%s] adapter error: %s", session_id, exc)
            _trace.error = f"adapter: {exc}"
            await ws.send_text(json.dumps({"type": "error", "message": f"adapter: {exc}"}))
            await ws.send_text(json.dumps({"type": "done"}))
            return

        t_pipeline_end = time.perf_counter()
        full_text = "".join(full_text_parts)
        await ws.send_text(json.dumps({"type": "response_text", "text": full_text}))

        turn_context.emit(TraceStep(
            from_node="tts", to_node="gateway",
            type="voice.tts.complete",
            latency_ms=tts_total_ms,
            payload_size=total_audio_bytes,
        ))

        timing = {
            "stt_ms":                    round((t_stt - t_start) * 1000),
            "adapter_ms":                round((t_last_token - t_adapter_start) * 1000),
            "adapter_first_token_ms":    first_token_ms or 0,
            "tts_ms":                    tts_total_ms,
            "time_to_first_audio_ms":    first_audio_ms or 0,
            "total_ms":                  round((t_pipeline_end - t_start) * 1000),
        }
        await ws.send_text(json.dumps({"type": "timing", "stages": timing}))
        await ws.send_text(json.dumps({"type": "done"}))

        logger.info(
            "ws[%s] turn done — STT %dms · TTFT %dms · TTFA %dms · total %dms · audio %d bytes",
            session_id,
            timing["stt_ms"],
            timing["adapter_first_token_ms"],
            timing["time_to_first_audio_ms"],
            timing["total_ms"],
            total_audio_bytes,
        )
    finally:
        _trace.total_ms = round((time.perf_counter() - t_start) * 1000)
        trace_bus.publish(_trace)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8765, reload=False)
