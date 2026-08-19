"""Shared, thread-safe runtime state for the Merlin Control Panel.

One instance lives for the lifetime of the process (created in
service/merlin_service.py::main(), threaded through record_utterance(),
stream_response(), and AudioPlayer.play_with_barge_in()). Read/written from
three different execution contexts that must never corrupt each other:
  - the asyncio event loop (run_conversation_session, stream_response)
  - the record_utterance PortAudio callback thread
  - the play_with_barge_in duplex-stream PortAudio callback thread
  - the control panel's own asyncio event loop tasks (same loop, different
    coroutines — HTTP handlers)

Every mutating method takes `self._lock` (a plain threading.Lock — safe to
call from a PortAudio callback thread, unlike asyncio primitives).
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

from service.turn_guard import REJECT_COMPRESSION_RATIO, REJECT_NO_SPEECH_PROB

logger = logging.getLogger("merlin.control_state")


@dataclass
class TurnRecord:
    turn_id: int
    timestamp: float
    # Truth view (section 3): five DISTINCT fields, never collapsed into one,
    # even though today mic_capture_text == stt_result == turn_input ==
    # llm_input by construction (proven in app/adapters/claude.py::respond —
    # no transformation point exists between STT output and the LLM message).
    # Keeping them as separate fields is what lets an operator SEE that
    # invariant holds turn by turn, rather than trusting a claim about it.
    mic_capture_text: str = ""
    stt_result: str = ""
    turn_input: str = ""
    llm_input: str = ""
    llm_output: str = ""     # raw generated text (may differ from tts_text if language-gate corrected it)
    tts_text: str = ""       # what was ACTUALLY sent to the speaker (spoken_text)
    transcript: str = ""     # kept for backward compat with the original 2-control-panel-ago shape
    response: str = ""
    status: str = "in_progress"  # in_progress | completed | interrupted | cancelled


@dataclass
class TimelineEvent:
    timestamp: float
    turn_id: int | None
    component: str
    event: str
    payload_summary: str = ""
    duration_ms: float | None = None
    result: str = ""


class RuntimeControlState:
    def __init__(self, *, history_size: int = 50, timeline_size: int = 500) -> None:
        self._lock = threading.Lock()
        self.start_time = time.time()
        self.session_id: str | None = None
        self.last_restart_ts: float | None = None
        self.last_restart_reason: str | None = None
        self.last_rejection_reason: str | None = None
        self.last_rejection_transcript: str | None = None
        self.clipping = False
        self.last_stt_latency_ms: float | None = None
        self.stt_model: str | None = None
        self.last_transcription_confidence: float | None = None
        self.last_no_speech_prob: float | None = None
        self.last_compression_ratio: float | None = None

        # ── Day Opening ──────────────────────────────────────────────────
        self.day_opening_state = "IDLE"   # IDLE|COLLECTING|PLAYING|COMPLETED|INTERRUPTED|ERROR
        self.day_opening_last_ts: float | None = None
        self.day_opening_last_error: str | None = None
        self.day_opening_double_clap_enabled = False

        # ── operator switches ──────────────────────────────────────────────
        self.muted = False            # MUTE OUTPUT — see stream_response._speak()
        self.input_muted = False      # MUTE INPUT — see _process_turn()
        self.force_stop_capture = threading.Event()   # signals record_utterance to end now
        self.manual_wake = threading.Event()           # signals main()'s wake loop to skip WakeTrigger
        self.forced_mic_channel: int | None = None      # None = AUTO (argmax); else fixed channel index

        # asyncio.Queue is created lazily, bound to whichever loop first calls
        # ensure_queue() (the merlin_service main loop) — HTTP handlers run on
        # the same loop, so put_nowait() from them is safe.
        self._injection_queue: "asyncio.Queue[str] | None" = None

        # ── live status ─────────────────────────────────────────────────────
        self.runtime_state = "IDLE"   # IDLE|LISTENING|THINKING|SPEAKING|INTERRUPTED|ERROR
        self.active_turn_id: int | None = None
        self.active_owner: str | None = None   # component currently holding the turn (see set_owner)
        self.playback_active = False
        self.capture_active = False
        self.current_transcript = ""
        self.current_mic_capture_text = ""
        self.current_stt_result = ""
        self.current_turn_input = ""
        self.current_llm_input = ""
        self.current_llm_output = ""
        self.current_tts_text = ""
        self.current_response = ""
        self.last_error: str | None = None
        self.invariant_violations: list[dict] = []   # section 10 — should always stay empty
        self.last_route_decision: dict | None = None   # app.domain_router.RouteResult, as dict

        # ── audio diagnostics ───────────────────────────────────────────────
        self.selected_mic_channel: int | None = None
        self.per_channel_rms: dict[int, float] = {}
        self.per_channel_peak: dict[int, float] = {}
        self.selected_channel_rms = 0.0
        self.selected_channel_peak = 0.0
        self.vad_state = "silent"   # silent | speech
        self.speech_detected = False
        self.noise_floor_estimate: float | None = None   # rolling min RMS seen while silent
        self._noise_floor_samples: deque[float] = deque(maxlen=200)
        self.sample_rate: int | None = None
        self.last_capture_duration_s: float | None = None

        self._history: deque[TurnRecord] = deque(maxlen=history_size)
        self._action_log: deque[dict] = deque(maxlen=200)
        self._timeline: deque[TimelineEvent] = deque(maxlen=timeline_size)

    # ── injection queue (SEND AS USER) ─────────────────────────────────────
    def ensure_queue(self) -> "asyncio.Queue[str]":
        if self._injection_queue is None:
            self._injection_queue = asyncio.Queue()
        return self._injection_queue

    def inject_text(self, text: str) -> None:
        q = self.ensure_queue()
        q.put_nowait(text)

    def has_pending_injection(self) -> bool:
        q = self.ensure_queue()
        return not q.empty()

    def try_pop_injection(self) -> str | None:
        q = self.ensure_queue()
        try:
            return q.get_nowait()
        except asyncio.QueueEmpty:
            return None

    # ── status snapshot (for the UI) ────────────────────────────────────────
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "runtime_state": self.runtime_state,
                "active_turn_id": self.active_turn_id,
                "active_owner": self.active_owner,
                "session_id": self.session_id,
                "uptime_seconds": round(time.time() - self.start_time, 1),
                "playback_active": self.playback_active,
                "capture_active": self.capture_active,
                "muted": self.muted,
                "input_muted": self.input_muted,
                "current_transcript": self.current_transcript,
                "current_turn_input": self.current_turn_input,
                "current_llm_input": self.current_llm_input,
                "current_response": self.current_response,
                "last_error": self.last_error,
                "invariant_violations": list(self.invariant_violations),
                "selected_mic_channel": self.selected_mic_channel,
                "forced_mic_channel": self.forced_mic_channel,
                "per_channel_rms": dict(self.per_channel_rms),
                "per_channel_peak": dict(self.per_channel_peak),
                "selected_channel_rms": self.selected_channel_rms,
                "selected_channel_peak": self.selected_channel_peak,
                "vad_state": self.vad_state,
                "speech_detected": self.speech_detected,
                "clipping": self.clipping,
                "last_restart_ts": self.last_restart_ts,
                "last_restart_reason": self.last_restart_reason,
                "last_rejection_reason": self.last_rejection_reason,
                "last_rejection_transcript": self.last_rejection_transcript,
                "last_stt_latency_ms": self.last_stt_latency_ms,
                "stt_model": self.stt_model,
                "day_opening_state": self.day_opening_state,
                "day_opening_last_ts": self.day_opening_last_ts,
                "day_opening_last_error": self.day_opening_last_error,
                "day_opening_double_clap_enabled": self.day_opening_double_clap_enabled,
                "last_route_decision": self.last_route_decision,
                "history": [
                    {
                        "turn_id": t.turn_id, "timestamp": t.timestamp,
                        "transcript": t.transcript, "turn_input": t.turn_input,
                        "llm_input": t.llm_input, "response": t.response,
                        "status": t.status,
                    }
                    for t in reversed(self._history)
                ],
            }

    def turn_truth_view(self) -> dict:
        """Section 3 — the six fields, never collapsed. Reads the ACTIVE
        turn's TurnRecord if one exists, else the live `current_*` mirrors."""
        with self._lock:
            rec = self._history[-1] if self._history else None
            if rec is not None:
                return {
                    "turn_id": rec.turn_id,
                    "mic_capture_text": rec.mic_capture_text,
                    "stt_result": rec.stt_result,
                    "turn_input": rec.turn_input,
                    "llm_input": rec.llm_input,
                    "llm_output": rec.llm_output,
                    "tts_text": rec.tts_text,
                    "status": rec.status,
                }
            return {
                "turn_id": self.active_turn_id,
                "mic_capture_text": self.current_mic_capture_text,
                "stt_result": self.current_stt_result,
                "turn_input": self.current_turn_input,
                "llm_input": self.current_llm_input,
                "llm_output": self.current_llm_output,
                "tts_text": self.current_tts_text,
                "status": None,
            }

    def audio_diagnostics(self) -> dict:
        """Section 6/7 — everything the audio/STT diagnostics panel needs,
        including the honest UNAVAILABLE marker for hardware gain (section 6:
        'If Babyface hardware gain cannot be controlled from this service,
        display HARDWARE_CONTROL_UNAVAILABLE instead of pretending')."""
        import service.merlin_service as _svc   # local import avoids a cycle at module load
        with self._lock:
            return {
                "selected_mic_channel": self.selected_mic_channel,
                "forced_mic_channel": self.forced_mic_channel,
                "channel_mode": "AUTO" if self.forced_mic_channel is None else "FORCED",
                "per_channel_rms": dict(self.per_channel_rms),
                "per_channel_peak": dict(self.per_channel_peak),
                "selected_channel_rms": self.selected_channel_rms,
                "selected_channel_peak": self.selected_channel_peak,
                "noise_floor_estimate": self.noise_floor_estimate,
                "vad_threshold": _svc.SILENCE_RMS,
                "speech_threshold": _svc.BARGE_IN_RMS,
                "sample_rate": self.sample_rate,
                "last_capture_duration_s": self.last_capture_duration_s,
                "vad_state": self.vad_state,
                "speech_detected": self.speech_detected,
                "clipping": self.clipping,
                "stt_model": self.stt_model,
                "last_stt_latency_ms": self.last_stt_latency_ms,
                "last_rejection_reason": self.last_rejection_reason,
                "last_rejection_transcript": self.last_rejection_transcript,
                "last_transcription_confidence": self.last_transcription_confidence,
                "last_no_speech_prob": self.last_no_speech_prob,
                "last_compression_ratio": self.last_compression_ratio,
                "no_speech_prob_available": self.stt_model == "whisper-1",
                "no_speech_prob_note": (
                    "stt_command_model='whisper-1' (as of 2026-08-07, evidence-based — see "
                    "app/config.py) exposes no_speech_prob/avg_logprob/compression_ratio via "
                    "response_format='verbose_json'. service/turn_guard.py::"
                    "evaluate_transcription_confidence() gates on them: reject if mean "
                    f"no_speech_prob >= {REJECT_NO_SPEECH_PROB} or max compression_ratio >= "
                    f"{REJECT_COMPRESSION_RATIO} (thresholds derived from a 6-sample real-"
                    "hardware comparison, not guessed)."
                ) if self.stt_model == "whisper-1" else (
                    f"stt_model={self.stt_model!r} does not expose verbose_json metadata."
                ),
                "hardware_gain_control": "HARDWARE_CONTROL_UNAVAILABLE",
                "hardware_gain_control_note": (
                    "This service has no code path to set Babyface Pro input gain — "
                    "sounddevice/PortAudio expose capture, not device mixer control. "
                    "Adjust gain in TotalMix FX / hardware directly."
                ),
            }

    def set_state(self, state: str) -> None:
        with self._lock:
            self.runtime_state = state

    def set_owner(self, owner: str | None) -> None:
        with self._lock:
            self.active_owner = owner

    def set_error(self, message: str | None) -> None:
        with self._lock:
            self.last_error = message
            if message:
                self.runtime_state = "ERROR"

    def begin_turn(self, turn_id: int, transcript: str, turn_input: str, llm_input: str) -> None:
        with self._lock:
            self.active_turn_id = turn_id
            self.active_owner = "stream_response"
            self.current_transcript = transcript
            self.current_mic_capture_text = transcript
            self.current_stt_result = transcript
            self.current_turn_input = turn_input
            self.current_llm_input = llm_input
            self.current_llm_output = ""
            self.current_tts_text = ""
            self.current_response = ""
            self._history.append(TurnRecord(
                turn_id=turn_id, timestamp=time.time(), transcript=transcript,
                mic_capture_text=transcript, stt_result=transcript,
                turn_input=turn_input, llm_input=llm_input,
            ))

    def update_turn_response(self, turn_id: int, response: str, status: str,
                               *, tts_text: str | None = None) -> None:
        with self._lock:
            if self.active_turn_id == turn_id:
                self.current_response = response
                self.current_llm_output = response
                if tts_text is not None:
                    self.current_tts_text = tts_text
                self.active_owner = None
            for t in self._history:
                if t.turn_id == turn_id:
                    t.response = response
                    t.llm_output = response
                    if tts_text is not None:
                        t.tts_text = tts_text
                    t.status = status
                    break

    def set_playback_active(self, active: bool) -> None:
        with self._lock:
            self.playback_active = active
            # INVARIANT (2026-08-10 stuck-SPEAKING fix): runtime_state "SPEAKING"
            # means audio is actively playing. set_state("SPEAKING") is asserted
            # together with set_playback_active(True) at playback start, but the
            # matching clear was missing — set_playback_active(False) left a
            # STALE "SPEAKING" that only self-healed on the next capture-loop
            # iteration and never on non-looping exits (day-opening, exception).
            # Enforce the pairing at the single source of truth: when playback
            # ends, SPEAKING cannot persist. The full-duplex mic stream stays
            # live, so LISTENING is the truthful resting state; a following
            # sentence re-asserts SPEAKING. Not a manual reset scattered across
            # call sites — the state machine keeps its own two facts consistent.
            if not active and self.runtime_state == "SPEAKING":
                self.runtime_state = "LISTENING"

    def set_capture_active(self, active: bool) -> None:
        with self._lock:
            self.capture_active = active

    def set_channel_rms(self, per_channel: dict[int, float], per_channel_peak: dict[int, float],
                          selected_ch: int, selected_rms: float, selected_peak: float) -> None:
        with self._lock:
            self.per_channel_rms = per_channel
            self.per_channel_peak = per_channel_peak
            self.selected_mic_channel = selected_ch
            self.selected_channel_rms = selected_rms
            self.selected_channel_peak = selected_peak
            self.clipping = selected_peak >= 0.99   # standard near-full-scale clipping indicator
            if not self.speech_detected:
                self._noise_floor_samples.append(selected_rms)
                if self._noise_floor_samples:
                    self.noise_floor_estimate = min(self._noise_floor_samples)

    def set_vad(self, *, speech: bool) -> None:
        with self._lock:
            self.speech_detected = speech
            self.vad_state = "speech" if speech else "silent"

    def set_sample_rate(self, sr: int) -> None:
        with self._lock:
            self.sample_rate = sr

    def set_capture_duration(self, seconds: float) -> None:
        with self._lock:
            self.last_capture_duration_s = seconds

    def report_invariant_violation(self, description: str, *, turn_id: int | None = None) -> None:
        """Section 10 — must stay empty in correct operation. Something calls
        this only if a stale/superseded turn is ever caught trying to produce
        output; see the is_current() guards in stream_response() — this
        method exists as the visible alarm if one of those guards is ever
        bypassed by a future change, not because a violation is expected."""
        with self._lock:
            self.invariant_violations.append({
                "ts": time.time(), "turn_id": turn_id, "description": description,
            })
            logger.error("OWNERSHIP_INVARIANT_VIOLATION turn_id=%s: %s", turn_id, description)

    def report_rejection(self, reason: str, transcript: str) -> None:
        """STT safety gate (section 4) — records WHY a transcript never
        reached the LLM, so an operator can see it instead of just silence."""
        with self._lock:
            self.last_rejection_reason = reason
            self.last_rejection_transcript = transcript

    def set_clipping(self, clipping: bool) -> None:
        with self._lock:
            self.clipping = clipping

    def set_stt_latency(self, ms: float) -> None:
        with self._lock:
            self.last_stt_latency_ms = ms

    def set_transcription_metrics(self, transcription) -> None:
        """transcription: app.providers.stt.base.Transcription (duck-typed)."""
        with self._lock:
            self.last_transcription_confidence = transcription.confidence
            segs = transcription.segments or []
            no_speech = [s.get("no_speech_prob") for s in segs if s.get("no_speech_prob") is not None]
            compression = [s.get("compression_ratio") for s in segs if s.get("compression_ratio") is not None]
            self.last_no_speech_prob = (sum(no_speech) / len(no_speech)) if no_speech else None
            self.last_compression_ratio = max(compression) if compression else None

    def set_restart_marker(self, ts: float, reason: str) -> None:
        with self._lock:
            self.last_restart_ts = ts
            self.last_restart_reason = reason

    def set_day_opening_state(self, state: str, *, error: str | None = None) -> None:
        with self._lock:
            self.day_opening_state = state
            if state in ("COMPLETED", "INTERRUPTED", "ERROR"):
                self.day_opening_last_ts = time.time()
            if error is not None:
                self.day_opening_last_error = error

    def log_action(self, action: str, result: dict) -> None:
        with self._lock:
            self._action_log.append({"ts": time.time(), "action": action, "result": result, "runtime_state": self.runtime_state})

    def recent_actions(self, n: int = 50) -> list[dict]:
        with self._lock:
            return list(self._action_log)[-n:]

    # ── event timeline (section 9) ──────────────────────────────────────────
    def record_event(self, component: str, event: str, *, turn_id: int | None = None,
                       payload_summary: str = "", duration_ms: float | None = None,
                       result: str = "") -> None:
        with self._lock:
            self._timeline.append(TimelineEvent(
                timestamp=time.time(), turn_id=turn_id, component=component, event=event,
                payload_summary=payload_summary, duration_ms=duration_ms, result=result,
            ))

    def recent_events(self, n: int = 200) -> list[dict]:
        with self._lock:
            events = list(self._timeline)[-n:]
        return [
            {
                "timestamp": e.timestamp, "turn_id": e.turn_id, "component": e.component,
                "event": e.event, "payload_summary": e.payload_summary,
                "duration_ms": e.duration_ms, "result": e.result,
            }
            for e in reversed(events)
        ]

    # ── semantic routing (production repair section 5, 2026-08-08) ─────────
    def set_route_decision(self, decision: dict) -> None:
        """Latest app.domain_router.RouteResult, as a plain dict — real
        per-turn routing truth for the Control Panel. Never fabricated: a
        domain with no real source shows status MISSING/UNKNOWN/ERROR exactly
        as domain_router determined it, not "loaded"."""
        with self._lock:
            self.last_route_decision = {**decision, "ts": time.time()}

    def runtime_summary(self) -> str:
        with self._lock:
            uptime_s = time.time() - self.start_time
            return (
                f"state={self.runtime_state} active_turn_id={self.active_turn_id} "
                f"active_owner={self.active_owner} playback_active={self.playback_active} "
                f"capture_active={self.capture_active} uptime_s={uptime_s:.0f} "
                f"last_error={self.last_error}"
            )


# ── process-wide singleton accessor ─────────────────────────────────────────
# One RuntimeControlState instance lives for the process lifetime (see module
# docstring). app.domain_router runs in the app/ layer, which does not
# otherwise import from service/ — this lets it reach the live control state
# for RUNTIME/DAY_OPENING domain retrieval without every intermediate layer
# (app/adapters/claude.py, app/config.py, app/context_builder.py) having to
# thread a new parameter through. Set once in service/merlin_service.py::main().
_global_control_state: "RuntimeControlState | None" = None


def set_global_control_state(cs: "RuntimeControlState") -> None:
    global _global_control_state
    _global_control_state = cs


def get_global_control_state() -> "RuntimeControlState | None":
    return _global_control_state
