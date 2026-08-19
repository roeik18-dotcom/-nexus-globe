"""Merlin Control Panel — real operator control for the LIVE running voice
pipeline, embedded in merlin_service.py's own asyncio event loop (not a
second process, not a mock — see main() for how this is started).

Every endpoint here acts directly on the same objects the voice pipeline
itself uses (TurnController, AudioPlayer, ClaudeAdapter, RuntimeControlState)
— there is no IPC boundary to a separate Merlin process, because this server
*is* the Merlin process. Binds to 127.0.0.1 only.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from service.turn_guard import evaluate_transcription_confidence

logger = logging.getLogger("merlin.control_panel")

_ROOT = Path(__file__).parent.parent
_SERVICE_PATH = Path(__file__).parent / "merlin_service.py"
_SERVICE_MARKER = "service/merlin_service.py"


# Module-level, not nested inside ControlPanel._register_routes(): with
# `from __future__ import annotations` active, FastAPI resolves a route's
# body-model annotation via get_type_hints() against the function's
# __globals__ — a Pydantic model class defined *locally* inside a method is
# not reachable that way, so FastAPI silently falls back to treating the
# parameter as a query param (a real bug hit and fixed during this task's own
# test run: send_as_user/force_channel both 422'd with "field required:
# query.body" until these moved up here).
class SendAsUserBody(BaseModel):
    text: str


class ForceChannelBody(BaseModel):
    channel: int | None = None   # None = AUTO


class DoubleClapConfigBody(BaseModel):
    enabled: bool


class ControlPanel:
    """Owns the FastAPI app. Constructed once in main() with live references
    to the running pipeline's objects."""

    def __init__(self, *, turn_ctrl, player, adapter, store, session_id, control_state, stt=None, tts=None):
        self.turn_ctrl = turn_ctrl
        self.player = player
        self.adapter = adapter
        self.store = store
        self.session_id = session_id
        self.state = control_state
        self.stt = stt   # optional — enables real transcription in /api/mic_test (section 7)
        self.tts = tts   # optional — enables /api/day_opening/start
        self.own_pid = os.getpid()
        self.app = FastAPI(title="Merlin Control Panel")
        self._ws_clients: set[WebSocket] = set()
        self._register_routes()

    # ── process identity (mirrors dashboard/runtime_server.py's own
    #    self-match-safe PID discovery, reimplemented locally — this module
    #    intentionally does not import from dashboard/, per scope) ──────────
    @staticmethod
    def _find_live_merlin_pids() -> list[int]:
        try:
            proc = subprocess.run(
                ["pgrep", "-f", _SERVICE_MARKER], capture_output=True, text=True, timeout=5,
            )
            out = proc.stdout
            if proc.returncode not in (0, 1):   # 1 = "no matches", not an error
                logger.warning("pgrep rc=%s stderr=%r", proc.returncode, proc.stderr)
        except Exception as exc:
            logger.warning("_find_live_merlin_pids: pgrep failed: %s", exc)
            return []
        pids = []
        for tok in out.split():
            try:
                pid = int(tok)
            except ValueError:
                continue
            cmd = subprocess.run(
                ["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True, timeout=5,
            ).stdout
            if _SERVICE_MARKER in cmd and "pgrep" not in cmd and " ps " not in f" {cmd} ":
                pids.append(pid)
        return pids

    async def _broadcast_status(self) -> None:
        if not self._ws_clients:
            return
        payload = self._status_payload()
        dead = []
        for ws in list(self._ws_clients):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._ws_clients.discard(ws)

    @staticmethod
    def _last_event(events: list[dict], *, component: str = None, event: str = None) -> dict | None:
        """events is already newest-first (state.recent_events()'s own order)."""
        for e in events:
            if component is not None and e.get("component") != component:
                continue
            if event is not None and e.get("event") != event:
                continue
            return e
        return None

    def _console_status(self) -> dict:
        """Console-only status fields (2026-08-10, operator console build):
        every value here is either read directly from live control_state /
        turn_ctrl, or a documented derivation from them, or a static,
        read-only inspection of already-loaded config/module constants.
        Nothing here is invented — a value with no real backing is reported
        as None and the UI must render it as NOT EXPOSED, never a guess."""
        events = self.state.recent_events(500)   # newest-first

        # ── wake / voice ─────────────────────────────────────────────────
        # WakeTrigger._wait_blocking() opens its InputStream only while the
        # main loop is blocked in `await trigger.wait()`, which happens
        # exactly when runtime_state=="IDLE" (service/merlin_service.py's
        # main loop sets IDLE immediately before calling trigger.wait(), and
        # nothing else sets IDLE) — see wake_trigger.py's own docstring:
        # "The stream is closed between activations." Not read from a live
        # WakeTrigger reference (none is wired into ControlPanel; per this
        # task's frozen-file list, wake_trigger.py is not touched).
        wake_stream_open = self.state.runtime_state == "IDLE"

        try:
            from service import wake_trigger as _wt
            oww_ok = bool(_wt.MERLIN_OWW_MODEL_PATH) and os.path.exists(_wt.MERLIN_OWW_MODEL_PATH)
            kw_ok = bool(_wt.PORCUPINE_ACCESS_KEY) and bool(_wt.PORCUPINE_KEYWORD_PATH) and os.path.exists(_wt.PORCUPINE_KEYWORD_PATH)
            keyword_backend = "openwakeword" if oww_ok else ("porcupine" if kw_ok else "none")
            keyword_wake_configured = oww_ok or kw_ok
        except Exception:
            keyword_backend, keyword_wake_configured = None, None

        last_wake = self._last_event(events, component="wake_trigger", event="WAKE")
        last_wake_source = None
        if last_wake:
            summary = last_wake.get("payload_summary") or ""
            if "source=" in summary:
                last_wake_source = summary.split("source=", 1)[1].strip()

        mic_device_name = None
        try:
            import sounddevice as _sd
            mic_device_name = _sd.query_devices(kind="input").get("name")
        except Exception:
            pass

        # ── barge-in ─────────────────────────────────────────────────────
        try:
            from service import merlin_service as _svc   # local import — avoids a cycle at module load
            barge_in_threshold = _svc.BARGE_IN_RMS
            barge_in_confirm_s = _svc.BARGE_IN_CONFIRM_S
        except Exception:
            barge_in_threshold, barge_in_confirm_s = None, None
        last_interruption = self._last_event(events, component="player", event="BARGE-IN")

        # ── turn / conversation ──────────────────────────────────────────
        # TurnController exposes no public `.state` accessor (turn_state.py
        # is on this task's frozen-file list, so none was added) — read the
        # internal attribute defensively; None if it's ever renamed/removed.
        turn_state_name = None
        _ts = getattr(self.turn_ctrl, "_state", None)
        if _ts is not None:
            turn_state_name = getattr(_ts, "name", str(_ts))

        # ── network / provider activity (derived from the event timeline —
        # no live reachability probe exists, so "reachable" itself is not
        # exposed; only the last time each stage's event was recorded) ────
        last_stt = self._last_event(events, component="STT", event="STT_RESULT")
        last_llm = self._last_event(events, component="adapter", event="LLM_END")
        last_tts = self._last_event(events, component="tts", event="TTS_START")

        return {
            "control_panel_port": int(os.environ.get("MERLIN_CONTROL_PANEL_PORT", "8802")),
            "wake_stream_open": wake_stream_open,
            "keyword_wake_configured": keyword_wake_configured,
            "keyword_wake_backend": keyword_backend,
            # Structural fact, not a live read: ClapDetector is constructed
            # unconditionally in WakeTrigger._wait_blocking() regardless of
            # keyword-backend availability — see wake_trigger.py.
            "double_clap_wake_enabled": True,
            "last_wake_source": last_wake_source,
            "last_wake_ts": last_wake.get("timestamp") if last_wake else None,
            "mic_input_device_name": mic_device_name,
            "barge_in_threshold": barge_in_threshold,
            "barge_in_confirm_s": barge_in_confirm_s,
            "last_interruption_ts": last_interruption.get("timestamp") if last_interruption else None,
            "turn_controller_state": turn_state_name,
            "continuous_conversation_active": (turn_state_name is not None and turn_state_name != "STANDBY"),
            "last_stt_success_ts": last_stt.get("timestamp") if last_stt else None,
            "last_llm_end_ts": last_llm.get("timestamp") if last_llm else None,
            "last_tts_start_ts": last_tts.get("timestamp") if last_tts else None,
        }

    def _status_payload(self) -> dict:
        snap = self.state.snapshot()
        # WAKE TRUTH (product recovery, 2026-08-17): three separate wake
        # paths, each reported by its REAL configuration state — never
        # "wake active" when only clap is armed. Computed from the same
        # env/file checks service/wake_trigger.py itself performs.
        _pp_key = (os.environ.get("PICOVOICE_ACCESS_KEY") or os.environ.get("PORCUPINE_ACCESS_KEY") or "").strip()
        _pp_ppn = os.environ.get("PORCUPINE_KEYWORD_PATH", "").strip()
        _oww = os.environ.get("MERLIN_OWW_MODEL_PATH", "").strip()
        if _oww and os.path.exists(_oww):
            _kw = "ACTIVE (openwakeword)"
        elif _pp_key and _pp_ppn and os.path.exists(_pp_ppn):
            _kw = "ACTIVE (porcupine)"
        else:
            _missing = []
            if not _pp_key: _missing.append("no access key")
            if not (_pp_ppn and os.path.exists(_pp_ppn)): _missing.append("no keyword model file")
            if not _oww: _missing.append("no OWW model")
            _kw = "UNAVAILABLE (" + ", ".join(_missing) + ")"
        snap["keyword_wake_status"] = _kw
        snap["double_clap_status"] = "ACTIVE"   # ClapDetector runs whenever the wake trigger is armed (clap-diag in log)
        snap["panel_wake_status"] = "ACTIVE"    # /api/wake + SEND AS USER manual_wake
        # Five explicit, non-contradictory wake-truth facts (2026-08-17):
        _kw_configured = _kw.startswith("ACTIVE")
        snap["keyword_model_configured"] = _kw_configured
        # a local keyword detector is instantiated iff its config exists —
        # WAKE_KEYWORD_CONFIG_MISSING in the log is the inactive proof
        snap["keyword_detector_active"] = _kw_configured
        snap["double_clap_active"] = True
        snap["panel_wake_active"] = True
        # This process IS the Merlin service (the control panel is embedded,
        # not a second process) — self-identity is always os.getpid(), not a
        # pgrep round-trip. pgrep -f was observed, in this environment, to
        # NOT reliably match a process searching for its own command line
        # (reproduced in isolation: a fresh process searching for a
        # DIFFERENT already-running one succeeds every time; a process
        # searching for ITSELF returns no match, consistently, regardless of
        # foreground/background/sandbox settings) — so pgrep here is used
        # only to detect *extra, unexpected* processes, with self-identity
        # normalized in explicitly rather than trusted from pgrep's output.
        pids = set(self._find_live_merlin_pids())
        pids.add(self.own_pid)
        snap["service_running"] = True
        snap["service_pid"] = self.own_pid
        snap["service_pid_count"] = len(pids)
        snap["cancelled_turn_ids"] = self.turn_ctrl.cancelled_turn_ids
        try:
            snap.update(self._console_status())
        except Exception as exc:
            logger.warning("_console_status failed: %s", exc)
        return snap

    def _log_and_result(self, action: str, result: dict) -> dict:
        self.state.log_action(action, result)
        return result

    # ── routes ───────────────────────────────────────────────────────────
    def _register_routes(self) -> None:
        app = self.app

        @app.get("/", response_class=HTMLResponse)
        def index():
            html_path = Path(__file__).parent / "control_panel.html"
            return html_path.read_text(encoding="utf-8")

        @app.get("/api/status")
        def get_status():
            return self._status_payload()

        @app.get("/api/actions")
        def get_actions():
            return {"actions": self.state.recent_actions()}

        # section 3 — truth view: mic capture / STT / TURN_INPUT / LLM_INPUT /
        # LLM_OUTPUT / TTS text, always as distinct fields.
        @app.get("/api/turn")
        def get_turn():
            return self.state.turn_truth_view()

        # section 6/7 — audio + STT diagnostics panel.
        @app.get("/api/audio")
        def get_audio():
            return self.state.audio_diagnostics()

        # section 11 — semantic routing (production repair section 5,
        # 2026-08-08): static per-domain source status (FOUND/MISSING/DRAFT,
        # never fabricated LOADED) plus the most recent live ROUTE_DECISION,
        # if any turn has been routed yet this session.
        @app.get("/api/knowledge_sources")
        def get_knowledge_sources():
            from app.domain_router import knowledge_source_status
            return {
                "sources": knowledge_source_status(),
                "last_route_decision": self.state.last_route_decision,
            }

        # section 12 — REAL config coverage (2026-08-10). Per-domain COMPLETE/
        # PARTIAL/MISSING/UNMAPPED/UNKNOWN computed from the actual master files
        # (service/config_coverage.py), plus the exact Hebrew lines the Day
        # Opening speaks. Never a hardcoded "complete".
        @app.get("/api/config_coverage")
        def get_config_coverage():
            from service.config_coverage import all_coverage, coverage_lines_he
            return {"domains": all_coverage(), "spoken_lines": coverage_lines_he()}

        # section 9 — pipeline event timeline (WAKE/LISTEN/STT/TURN CREATED/
        # LLM START/LLM END/TTS START/PLAYBACK START/BARGE-IN/CANCEL/ERROR/RESET).
        @app.get("/api/events")
        def get_events(n: int = 200):
            return {"events": self.state.recent_events(n)}

        # section 8 — real component map only (no invented agents). This
        # process's own persona is "merlin" (app/adapters/merlin.py ==
        # ClaudeAdapter subclass), not a multi-agent orchestrator — that
        # orchestration path (app/router.py::build_orchestrator, name=="claude")
        # exists in the codebase but is NOT what ADAPTER=merlin in .env
        # selects, so it is reported DISABLED here, honestly, rather than
        # invented as an active "agent". mos/* (mos/intent_bridge.py etc.) is
        # real code that exists but is shadow-only by design (see
        # merlin_service.py::_mos_shadow) — DISABLED unless
        # MERLIN_MOS_BRIDGE=1 is actually set.
        @app.get("/api/components")
        def get_components():
            import os as _os
            snap = self._status_payload()
            mos_enabled = _os.environ.get("MERLIN_MOS_BRIDGE") == "1"
            return {
                "components": [
                    {"id": "wake_trigger", "role": "Wake word ('merlin') + double-clap detection",
                     "state": "ACTIVE" if snap["runtime_state"] in ("IDLE",) else "WAITING",
                     "file": "service/wake_trigger.py"},
                    {"id": "record_utterance", "role": "VAD + command audio capture",
                     "state": "ACTIVE" if snap["capture_active"] else "IDLE",
                     "file": "service/merlin_service.py"},
                    {"id": "whisper_stt", "role": "Speech-to-text (OpenAI Whisper)",
                     "state": "ACTIVE" if snap["runtime_state"] == "THINKING" and snap["capture_active"] is False else "IDLE",
                     "file": "app/providers/stt/whisper.py"},
                    {"id": "merlin_adapter", "role": "MerlinAdapter -> ClaudeAdapter (persona=merlin), language gate",
                     "state": "ACTIVE" if snap["runtime_state"] in ("THINKING", "SPEAKING") else "IDLE",
                     "file": "app/adapters/merlin.py"},
                    {"id": "openai_tts", "role": "Text-to-speech (OpenAI TTS)",
                     "state": "ACTIVE" if snap["playback_active"] else "IDLE",
                     "file": "app/providers/tts/openai_tts.py"},
                    {"id": "audio_player", "role": "Full-duplex playback + barge-in detection",
                     "state": "ACTIVE" if snap["playback_active"] else "IDLE",
                     "file": "service/merlin_service.py::AudioPlayer"},
                    {"id": "turn_controller", "role": "Single source of truth for current_turn_id",
                     "state": "ACTIVE", "file": "service/turn_state.py"},
                    {"id": "multi_agent_orchestrator", "role": "jarvis/philos router (app/router.py, name=='claude')",
                     "state": "DISABLED", "note": "ADAPTER=merlin in .env selects MerlinAdapter directly, not this path"},
                    {"id": "mos_platform_bus", "role": "Shadow event bus (intent/cognition/planner/executor)",
                     "state": "ACTIVE" if mos_enabled else "DISABLED",
                     "note": "shadow-only by design even when enabled — never affects live output" if mos_enabled
                             else "MERLIN_MOS_BRIDGE not set — real code, not currently running"},
                ],
                "hierarchy_note": (
                    "No APEX/NEXUS layer exists in this codebase (voice-gateway) — "
                    "searched and not found. If that hierarchy exists, it is in a "
                    "different subsystem outside voice-gateway, not reachable from here."
                ),
                # Orb/module-ring view: named business-facing modules. Every
                # state here is derived from real checks — a module with no
                # real capability in this codebase reports NOT_IMPLEMENTED,
                # never a fabricated ACTIVE/idle. Inspected before writing
                # this: no research/calendar/mail integration exists anywhere
                # in voice-gateway; searched app/, service/, mos/.
                "modules": [
                    {"id": "voice", "label": "Voice", "state":
                        "working" if (snap["playback_active"] or snap["capture_active"]) else
                        ("idle" if snap["service_running"] else "offline"),
                     "current_operation": snap["runtime_state"], "last_result": snap["current_response"][:80],
                     "latency_ms": self.state.last_stt_latency_ms},
                    {"id": "memory", "label": "Memory", "state": "idle" if self.store is not None else "offline",
                     "current_operation": "relationship memory store (app/memory)",
                     "last_result": f"{len(self.store.all())} memories" if hasattr(self.store, "all") else "UNKNOWN"},
                    {"id": "philos", "label": "Philos", "state": "offline",
                     "current_operation": "not active", "last_result": None,
                     "note": "philos exists as a persona/sub-agent in app/router.py's name=='claude' orchestrator path — "
                             "not selected while ADAPTER=merlin (this runtime's actual .env setting)"},
                    {"id": "research", "label": "Research", "state": "not_implemented",
                     "current_operation": None, "last_result": None,
                     "note": "no research agent/tool exists in this codebase — not invented"},
                    {"id": "calendar", "label": "Calendar", "state": "not_implemented",
                     "current_operation": None, "last_result": None,
                     "note": "no calendar integration exists in this codebase — not invented"},
                    {"id": "mail", "label": "Mail", "state": "not_implemented",
                     "current_operation": None, "last_result": None,
                     "note": "no mail integration exists in this codebase — not invented"},
                    {"id": "system", "label": "System", "state": "working" if snap["service_running"] else "offline",
                     "current_operation": f"pid {snap['service_pid']}, uptime {int(snap['uptime_seconds'])}s",
                     "last_result": snap["last_error"] or "no errors"},
                    {"id": "developer", "label": "Developer / Diagnostics", "state": "idle",
                     "current_operation": "audio/STT diagnostics + event timeline (this console)",
                     "last_result": f"clipping={snap['clipping']}"},
                ],
            }

        @app.websocket("/ws/status")
        async def ws_status(ws: WebSocket):
            await ws.accept()
            self._ws_clients.add(ws)
            try:
                while True:
                    await ws.send_json(self._status_payload())
                    await asyncio.sleep(0.3)
            except WebSocketDisconnect:
                pass
            finally:
                self._ws_clients.discard(ws)

        # 1. STOP SPEAKING
        @app.post("/api/stop_speaking")
        def stop_speaking():
            # 2026-08-08: this used to call ONLY player.interrupt() — stopping
            # the current audio chunk but leaving the turn/generation live, so
            # the streaming response loop could immediately start speaking the
            # NEXT sentence (turn_ctrl.is_current() was never made false).
            # Live-verified on the actual production process: after
            # stop_speaking, playback_active stayed True and the next TTS
            # chunk played anyway — exactly the "old generation resumes"
            # failure the production-repair spec calls out for "עצור".
            # cancel_turn (below) already got this right; stop_speaking must
            # do the same, not a weaker version of it.
            turn_id = self.turn_ctrl.cancel_current()
            self.player.interrupt()
            return self._log_and_result("stop_speaking", {"ok": True, "cancelled_turn_id": turn_id})

        # 2/3. MUTE / UNMUTE
        @app.post("/api/mute")
        def mute():
            self.state.muted = True
            return self._log_and_result("mute", {"ok": True, "muted": True})

        @app.post("/api/unmute")
        def unmute():
            self.state.muted = False
            return self._log_and_result("unmute", {"ok": True, "muted": False})

        # 4. START LISTENING
        @app.post("/api/start_listening")
        def start_listening():
            self.state.manual_wake.set()
            return self._log_and_result("start_listening", {"ok": True})

        # 5. STOP LISTENING
        @app.post("/api/stop_listening")
        def stop_listening():
            self.state.force_stop_capture.set()
            return self._log_and_result("stop_listening", {"ok": True})

        # PAUSE/RESUME LISTENING — same underlying mechanism as
        # start/stop_listening; separate route names because an operator
        # console reasonably expects both verbs to exist and be equivalent,
        # not a second parallel implementation.
        @app.post("/api/pause_listening")
        def pause_listening():
            self.state.force_stop_capture.set()
            return self._log_and_result("pause_listening", {"ok": True})

        @app.post("/api/resume_listening")
        def resume_listening():
            self.state.manual_wake.set()
            return self._log_and_result("resume_listening", {"ok": True})

        # 6. CANCEL CURRENT TURN
        @app.post("/api/cancel_turn")
        def cancel_turn():
            turn_id = self.turn_ctrl.cancel_current()
            self.player.interrupt()
            return self._log_and_result("cancel_turn", {"ok": True, "cancelled_turn_id": turn_id})

        # 7. CLEAR QUEUE — this architecture has no separate persistent audio
        # queue (SentenceBuffer processes inline, gated by turn_ctrl.is_current
        # before every synthesize/play call — see stream_response._speak()).
        # Cancelling the current turn IS clearing the queue: every pending
        # sentence's is_current() check will fail immediately afterward.
        @app.post("/api/clear_queue")
        def clear_queue():
            turn_id = self.turn_ctrl.cancel_current()
            self.player.interrupt()
            return self._log_and_result(
                "clear_queue",
                {"ok": True, "cancelled_turn_id": turn_id,
                 "note": "no separate queue exists; turn cancellation prevents all pending TTS/playback"},
            )

        # 2b/3. MUTE INPUT / UNMUTE INPUT
        @app.post("/api/mute_input")
        def mute_input():
            self.state.input_muted = True
            return self._log_and_result("mute_input", {"ok": True, "input_muted": True})

        @app.post("/api/unmute_input")
        def unmute_input():
            self.state.input_muted = False
            return self._log_and_result("unmute_input", {"ok": True, "input_muted": False})

        # 8a. RESET TURN STATE — turn_ctrl only, conversation history untouched.
        @app.post("/api/reset_turn")
        def reset_turn():
            self.player.interrupt()
            self.turn_ctrl.reset()
            self.state.active_turn_id = None
            self.state.set_state("IDLE")
            self.state.record_event("control_panel", "RESET", payload_summary="reset_turn")
            return self._log_and_result("reset_turn", {"ok": True})

        # 8b. CLEAR CONVERSATION — adapter/session history only, turn numbering untouched.
        @app.post("/api/clear_conversation")
        async def clear_conversation():
            await self.adapter.reset(self.session_id)
            self.state.current_transcript = ""
            self.state.current_turn_input = ""
            self.state.current_llm_input = ""
            self.state.current_response = ""
            self.state.record_event("control_panel", "RESET", payload_summary="clear_conversation")
            return self._log_and_result("clear_conversation", {"ok": True})

        # 8c. RESET SESSION — full reset: both of the above together.
        @app.post("/api/reset_session")
        async def reset_session():
            self.player.interrupt()
            self.turn_ctrl.reset()
            await self.adapter.reset(self.session_id)
            self.state.current_transcript = ""
            self.state.current_turn_input = ""
            self.state.current_llm_input = ""
            self.state.current_response = ""
            self.state.active_turn_id = None
            self.state.set_error(None)
            self.state.set_state("IDLE")
            self.state.record_event("control_panel", "RESET", payload_summary="reset_session (full)")
            return self._log_and_result("reset_session", {"ok": True})

        # DAY OPENING — one shared backend action for both the manual button
        # here and a (optional) double-clap trigger (service/day_opening_runner.py
        # ::run_day_opening). Never two separate playback implementations.
        @app.post("/api/day_opening/start")
        async def day_opening_start():
            if self.state.day_opening_state in ("COLLECTING", "PLAYING"):
                return JSONResponse(status_code=409, content={"ok": False, "error": "Day Opening already running"})
            # Real incident (2026-08-07): the wake/conversation loop in main()
            # runs concurrently with this handler on the same event loop. Without
            # this guard, a Day Opening triggered while a real conversation turn
            # is already in flight collides with it — TurnController correctly
            # kills the older turn (STALE_TURN_DROPPED), but that is NOT the
            # acoustic BargeInWindowDetector path and must not be reported as a
            # proven barge-in. runtime_state is "IDLE" only when main()'s wake
            # loop is genuinely parked at `trigger.wait()`.
            if self.state.runtime_state != "IDLE":
                return JSONResponse(
                    status_code=409,
                    content={"ok": False, "error": f"Merlin is busy (runtime_state={self.state.runtime_state}); try again once idle"},
                )
            if self.tts is None:
                return JSONResponse(status_code=503, content={"ok": False, "error": "TTS provider not wired into this ControlPanel instance"})
            from service.day_opening_runner import run_day_opening
            result = await run_day_opening(
                self.adapter, self.tts, self.player, self.turn_ctrl, self.state, self.session_id,
            )
            return self._log_and_result("day_opening_start", result)

        @app.get("/api/day_opening/status")
        def day_opening_status():
            from service.day_opening_runner import load_last_state
            lr = load_last_state() or {}
            planned = lr.get("full_text_he") or ""
            spoken = lr.get("spoken_text") or ""
            sections = lr.get("domains") or []
            planned_chars, spoken_chars = len(planned), len(spoken)
            # Backend source-of-truth progress (NOT computed in JS). current_section /
            # section_index / turn_id / completed_at are not tracked live by the runner
            # yet -> reported as None, never faked.
            return {
                "state": self.state.day_opening_state,
                "last_ts": self.state.day_opening_last_ts,
                "last_error": self.state.day_opening_last_error,
                "double_clap_enabled": self.state.day_opening_double_clap_enabled,
                "section_total": len(sections),
                "section_index": None,        # not tracked live by the runner
                "current_section": None,      # not tracked live by the runner
                "turn_id": None,              # not persisted per-run
                "started_at": lr.get("generated_at"),
                "completed_at": None,         # not persisted
                "interrupted": lr.get("interrupted"),
                "fully_spoken": lr.get("fully_spoken"),
                "planned_chars": planned_chars,
                "spoken_chars": spoken_chars,
                "progress": (round(spoken_chars / planned_chars, 4) if planned_chars else None),
                "spoken_text": spoken,
                "last_run": lr,
            }

        @app.post("/api/day_opening/double_clap")
        def day_opening_double_clap(body: DoubleClapConfigBody):
            self.state.day_opening_double_clap_enabled = body.enabled
            return self._log_and_result(
                "day_opening_double_clap", {"ok": True, "enabled": body.enabled},
            )

        # 9. RESTART MERLIN SERVICE
        # async def, not def: Starlette runs sync `def` routes in a worker
        # thread (run_in_threadpool), where asyncio.get_running_loop() below
        # would raise "no running event loop" — async def keeps this on the
        # actual server event loop, where call_later() is valid.
        #
        # Real incident (2026-08-14): the old unconditional path here spawned a
        # brand-new merlin_service.py via subprocess.Popen(start_new_session=True)
        # — a process launchd knows nothing about — then self-exited. But the
        # exiting process IS the job launchd supervises as com.merlin.voice
        # (KeepAlive=true), so launchd immediately spawned ITS OWN replacement
        # too. Two independent, unrelated processes came up within milliseconds
        # and raced for :8802 (confirmed in service.log: three consecutive
        # "address already in use" cycles). launchd must own the entire
        # stop/start cycle as a single job identity — never spawn a competing
        # instance outside its supervision when this process IS that job.
        _LAUNCHD_LABEL = "com.merlin.voice"

        def _is_launchd_supervised(own_pid: int) -> bool:
            try:
                chk = subprocess.run(
                    ["launchctl", "print", f"gui/{os.getuid()}/{_LAUNCHD_LABEL}"],
                    capture_output=True, text=True, timeout=5,
                )
            except Exception as exc:
                logger.warning("restart_service: launchd supervision check failed: %s", exc)
                return False
            return chk.returncode == 0 and f"pid = {own_pid}" in chk.stdout

        @app.post("/api/restart_service")
        async def restart_service():
            pids_before = sorted(set(self._find_live_merlin_pids()) | {self.own_pid})
            self.player.interrupt()

            if _is_launchd_supervised(self.own_pid):
                # Let launchd do the whole kill+respawn as one job — no second
                # process, nothing for it to race against.
                try:
                    subprocess.Popen(
                        ["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/{_LAUNCHD_LABEL}"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    )
                except Exception as exc:
                    return self._log_and_result("restart_service", {"ok": False, "error": str(exc)})
                return self._log_and_result(
                    "restart_service",
                    {"ok": True, "old_pids": pids_before, "method": "launchctl_kickstart",
                     "note": "launchd is restarting the single supervised job in place "
                             "(launchctl kickstart -k) — this process will be terminated by "
                             "that command, not by self-exit; no second process is spawned"},
                )

            # Not launchd-supervised (e.g. a manual dev run) — original behavior,
            # unchanged: self-spawn is safe here precisely because nothing else
            # will notice or react to this process exiting.
            try:
                _env = dict(os.environ)
                _env["MERLIN_RESTARTED_BY_PANEL"] = "1"
                _env["MERLIN_RESTARTED_BY_PANEL_TS"] = str(time.time())
                proc = subprocess.Popen(
                    [sys.executable, str(_SERVICE_PATH)],
                    cwd=str(_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    start_new_session=True,   # survives this process exiting
                    env=_env,
                )
            except Exception as exc:
                return self._log_and_result("restart_service", {"ok": False, "error": str(exc)})
            result = self._log_and_result(
                "restart_service",
                {"ok": True, "old_pids": pids_before, "new_pid": proc.pid, "method": "self_spawn",
                 "note": "old process exiting now to release the audio device before the new one starts"},
            )

            def _exit_self():
                os._exit(0)

            asyncio.get_running_loop().call_later(0.3, _exit_self)
            return result

        # 10. EMERGENCY KILL — idempotent: safe to call with nothing active.
        @app.post("/api/emergency_kill")
        def emergency_kill():
            self.player.interrupt()
            turn_id = self.turn_ctrl.cancel_current()
            self.state.force_stop_capture.set()
            return self._log_and_result(
                "emergency_kill",
                {"ok": True, "cancelled_turn_id": turn_id, "playback_interrupted": True, "capture_stop_requested": True},
            )

        # 11. SEND AS USER
        @app.post("/api/send_as_user")
        def send_as_user(body: SendAsUserBody):
            text = body.text.strip()
            if not text:
                return JSONResponse(status_code=422, content={"ok": False, "error": "empty text"})
            self.state.inject_text(text)
            self.state.manual_wake.set()   # wake the session if currently in STANDBY
            return self._log_and_result("send_as_user", {"ok": True, "queued_text": text})

        # channel control
        @app.post("/api/force_channel")
        def force_channel(body: ForceChannelBody):
            self.state.forced_mic_channel = body.channel
            return self._log_and_result(
                "force_channel",
                {"ok": True, "forced_mic_channel": body.channel, "mode": "AUTO" if body.channel is None else "FORCED"},
            )

        # TEST MIC (section 7 — "RECORD 5 SECOND MIC TEST") — real, input-only
        # measurement PLUS a real STT transcription of the exact same audio,
        # entirely independent of the voice pipeline's own streams and NEVER
        # touching turn_ctrl / adapter history / conversation state — no
        # turn is minted, _process_turn() is never called. Only safe to run
        # while nothing else has the device open (the pipeline is idle
        # between turns most of the time); if the device is busy this fails
        # loudly, it does not fake a result.
        @app.post("/api/test_mic")
        async def test_mic(duration_s: float = 5.0):
            import io as _io
            import numpy as np
            import sounddevice as sd
            from scipy.io import wavfile as _wavfile

            loop = asyncio.get_running_loop()

            def _measure():
                dev = sd.query_devices(kind="input")
                in_channels = max(1, int(dev.get("max_input_channels", 1)))
                native_sr = int(dev.get("default_samplerate") or 44100)
                frames_total = int(native_sr * duration_s)
                recorded = sd.rec(frames_total, samplerate=native_sr, channels=in_channels, dtype="float32")
                sd.wait()
                arr = recorded.astype(np.float32)
                per_ch_rms = {int(c): float(np.sqrt(np.mean(arr[:, c] ** 2))) for c in range(in_channels)}
                per_ch_peak = {int(c): float(np.max(np.abs(arr[:, c]))) for c in range(in_channels)}
                loudest = max(per_ch_rms, key=per_ch_rms.get)
                mono = arr[:, loudest]
                # cheap waveform preview for the UI: 200-point envelope, not the raw signal
                n_points = 200
                chunk = max(1, len(mono) // n_points)
                envelope = [float(np.max(np.abs(mono[i:i + chunk]))) for i in range(0, len(mono), chunk)][:n_points]
                wav_buf = _io.BytesIO()
                _wavfile.write(wav_buf, native_sr, (np.clip(mono, -1, 1) * 32767).astype(np.int16))
                return {
                    "device": dev.get("name"), "samplerate": native_sr, "channels": in_channels,
                    "per_channel_rms": per_ch_rms, "per_channel_peak": per_ch_peak,
                    "loudest_channel": loudest, "waveform_envelope": envelope,
                    "noise_floor_estimate": min(per_ch_rms.values()) if per_ch_rms else None,
                }, wav_buf.getvalue()

            try:
                result, wav_bytes = await loop.run_in_executor(None, _measure)
                result["ok"] = True
                if self.stt is not None:
                    t0 = time.time()
                    transcription = await self.stt.transcribe_detailed(wav_bytes)
                    result["transcription"] = transcription.text
                    result["confidence"] = transcription.confidence
                    result["segments"] = transcription.segments
                    result["stt_model"] = transcription.model
                    result["stt_latency_ms"] = round((time.time() - t0) * 1000, 1)
                    accepted, reason = evaluate_transcription_confidence(transcription)
                    result["would_be_accepted"] = accepted
                    result["rejection_reason"] = reason
                    result["sent_to_conversation"] = False   # explicit, not implicit
                else:
                    result["transcription"] = None
                    result["note"] = "STT provider not wired into this ControlPanel instance"
            except Exception as exc:
                result = {"ok": False, "error": str(exc)}
            return self._log_and_result("test_mic", result)

        # ── Merlin Product Recovery (2026-08-17) ─────────────────────────
        # PHILOS live status for the panel's PHILOS block. Read-only; the
        # same client the Day Opening collectors and the PHILOS-domain
        # router branch use. Failure renders as connected=false — no fake.
        @app.get("/api/philos")
        async def philos_status():
            loop = asyncio.get_running_loop()
            def _fetch():
                from app.philos_shared_state import fetch_shared_state
                return fetch_shared_state()
            try:
                res = await loop.run_in_executor(None, _fetch)
            except Exception as exc:
                return {"connected": False, "error": str(exc)}
            if not res.connected or not res.data:
                return {"connected": False, "error": res.error, "http_status": res.http_status}
            d = res.data
            ol = d.get("open_loops") or {}
            brain = d.get("brain") or {}
            cm = d.get("community_marketplace") or {}
            human = d.get("human") or {}
            music = d.get("music") or {}
            hm = d.get("human_master") or {}
            mm = d.get("music_master") or {}
            return {
                "connected": True,
                # CONFIG COMPLETENESS SEMANTICS: master availability vs
                # runtime activation vs live state — three separate facts.
                "human_master_count": hm.get("row_count"),
                "music_master_count": mm.get("row_count"),
                "subject": d.get("subject_id"),
                "as_of": d.get("asOf"),
                "human_state": "UNKNOWN" if not (human.get("current_state") or []) else "OBSERVED",
                "music_state": "UNKNOWN" if not (music.get("current_state") or []) else "OBSERVED",
                "human_config_refs": len(human.get("source_refs") or []),
                "music_config_refs": len(music.get("source_refs") or []),
                "open_loops": ol,
                "open_needs": len(cm.get("open_needs") or []),
                "open_offers": len(cm.get("open_offers") or []),
                "unknown": (brain.get("unknown") or [])[:3],
                "next_hint": ((brain.get("changes") or [{}])[0] or {}).get("what_changed"),
                "next_action_label": ((brain.get("next_action") or {}) or {}).get("label") or "אין פעולה נגזרת — UNKNOWN",
                "today_hint": (lambda obs, day: (
                    f"{len([o for o in obs if str(o.get('observed_at',''))[:10]==day])} תצפיות · " +
                    f"{len([a for a in (d.get('actions') or []) if str(a.get('recorded_at',''))[:10]==day])} פעולות היום"
                ))(d.get("observations") or [], str(d.get("asOf",""))[:10]),
                # PHILOS has no project record type — honest UNKNOWN, stated.
                "projects": "UNKNOWN — אין רשומת פרויקט ב-PHILOS",
            }

        # PROJECT ORIENTATION — normalized read-only rows for the panel.
        @app.get("/api/projects")
        async def projects():
            loop = asyncio.get_running_loop()
            def _fetch():
                from app.project_orientation import project_orientation_payload
                return project_orientation_payload()
            try:
                return await loop.run_in_executor(None, _fetch)
            except Exception as exc:
                return {"error": str(exc), "philos_connected": False, "music_projects": []}

        # Manual WAKE — the same real path /api/send_as_user already uses
        # (manual_wake event); wakes the session from STANDBY/IDLE without
        # minting a turn or faking a wake-word detection.
        @app.post("/api/wake")
        def manual_wake():
            self.state.manual_wake.set()
            return self._log_and_result("wake", {"ok": True, "note": "manual_wake set"})

        # TEST TTS — real synthesis + playback of one fixed phrase, refused
        # while the pipeline is busy (single-owner invariant, same posture
        # as /api/test_mic). No turn is minted; conversation state untouched.
        @app.post("/api/test_tts")
        async def test_tts():
            if self.tts is None:
                return self._log_and_result("test_tts", {"ok": False, "error": "TTS provider not wired"})
            snap = self.state.snapshot()
            if snap.get("playback_active") or snap.get("capture_active"):
                return self._log_and_result("test_tts", {"ok": False, "error": "pipeline busy — refusing to overlap audio"})
            try:
                t0 = time.time()
                audio = await self.tts.synthesize("בדיקת דיבור של מרלין. אחת, שתיים, שלוש.")
                await self.player.play(audio)
                return self._log_and_result("test_tts", {"ok": True, "latency_ms": round((time.time() - t0) * 1000, 1), "bytes": len(audio)})
            except Exception as exc:
                return self._log_and_result("test_tts", {"ok": False, "error": str(exc)})
