"""Tests for the Merlin Control Panel (service/control_panel.py,
service/control_state.py) — every mandatory operator control.

Two layers:
  - HTTP-endpoint layer: FastAPI TestClient against a ControlPanel wired to
    lightweight fakes for turn_ctrl/player/adapter/store (no real audio).
  - Pipeline layer: the REAL stream_response()/_process_turn() from
    service.merlin_service, driven with the same FakeDuplexStream pattern as
    tests/test_turn_taking.py, proving mute/cancel actually change what the
    real turn-taking pipeline does — not just that a flag got set.
"""

from __future__ import annotations

import sys
import threading
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest
from fastapi.testclient import TestClient

import service.merlin_service as svc
from service.control_panel import ControlPanel
from service.control_state import RuntimeControlState
from service.turn_state import TurnController

SESSION = "test-control-panel-session"


# ── HTTP-endpoint layer ──────────────────────────────────────────────────

def _panel(turn_ctrl=None):
    turn_ctrl = turn_ctrl or TurnController()
    player = MagicMock(spec=["interrupt", "play", "play_with_barge_in"])
    adapter = MagicMock(spec=["reset"])
    adapter.reset = AsyncMock()
    store = MagicMock()
    control_state = RuntimeControlState()
    cp = ControlPanel(
        turn_ctrl=turn_ctrl, player=player, adapter=adapter, store=store,
        session_id=SESSION, control_state=control_state,
    )
    return cp, TestClient(cp.app)


def test_stop_speaking_calls_player_interrupt():
    cp, client = _panel()
    r = client.post("/api/stop_speaking")
    assert r.status_code == 200
    cp.player.interrupt.assert_called_once()


def test_stop_speaking_also_cancels_the_turn_not_just_the_audio_chunk():
    """2026-08-08 live-verified regression: stop_speaking used to call ONLY
    player.interrupt(), leaving the turn/generation live — the streaming
    response loop would start speaking the NEXT sentence right after
    'stopping' (playback_active stayed True on the real production process).
    'עצור' must behave like cancel_turn: no old generation may resume."""
    turn_ctrl = TurnController()
    active_id = turn_ctrl.new_turn()
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/stop_speaking")
    assert r.status_code == 200
    assert r.json()["cancelled_turn_id"] == active_id
    assert turn_ctrl.is_current(active_id) is False


def test_mute_then_unmute_toggles_state_flag():
    cp, client = _panel()
    r = client.post("/api/mute")
    assert r.json() == {"ok": True, "muted": True}
    assert cp.state.muted is True
    r = client.post("/api/unmute")
    assert r.json() == {"ok": True, "muted": False}
    assert cp.state.muted is False


def test_start_listening_sets_manual_wake():
    cp, client = _panel()
    assert cp.state.manual_wake.is_set() is False
    client.post("/api/start_listening")
    assert cp.state.manual_wake.is_set() is True


def test_stop_listening_sets_force_stop_capture():
    cp, client = _panel()
    assert cp.state.force_stop_capture.is_set() is False
    client.post("/api/stop_listening")
    assert cp.state.force_stop_capture.is_set() is True


def test_cancel_turn_cancels_current_and_interrupts_player():
    turn_ctrl = TurnController()
    turn_ctrl.new_turn()
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/cancel_turn")
    assert r.json()["cancelled_turn_id"] == 1
    assert turn_ctrl.is_current(1) is False
    cp.player.interrupt.assert_called_once()


def test_cancel_turn_with_no_active_turn_is_a_safe_noop():
    cp, client = _panel()
    r = client.post("/api/cancel_turn")
    assert r.status_code == 200
    assert r.json()["cancelled_turn_id"] is None


def test_clear_queue_has_same_invalidation_effect_as_cancel():
    turn_ctrl = TurnController()
    turn_ctrl.new_turn()
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/clear_queue")
    assert r.status_code == 200
    assert turn_ctrl.is_current(1) is False
    cp.player.interrupt.assert_called_once()


def test_reset_session_resets_turn_controller_and_calls_adapter_reset():
    turn_ctrl = TurnController()
    t1 = turn_ctrl.new_turn()
    turn_ctrl.cancel(t1)
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/reset_session")
    assert r.status_code == 200
    assert turn_ctrl.current_turn_id == 0
    assert turn_ctrl.is_cancelled(t1) is False   # cancelled-set cleared too
    cp.adapter.reset.assert_awaited_once_with(SESSION)


def test_send_as_user_queues_text_and_wakes():
    cp, client = _panel()
    r = client.post("/api/send_as_user", json={"text": "מה השעה"})
    assert r.status_code == 200
    assert cp.state.manual_wake.is_set() is True
    assert cp.state.try_pop_injection() == "מה השעה"


def test_send_as_user_rejects_empty_text():
    cp, client = _panel()
    r = client.post("/api/send_as_user", json={"text": "   "})
    assert r.status_code == 422


def test_emergency_kill_is_idempotent():
    turn_ctrl = TurnController()
    turn_ctrl.new_turn()
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r1 = client.post("/api/emergency_kill")
    r2 = client.post("/api/emergency_kill")   # nothing left active — must not error
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert cp.player.interrupt.call_count == 2
    assert cp.state.force_stop_capture.is_set() is True


def test_force_channel_forced_then_auto():
    cp, client = _panel()
    client.post("/api/force_channel", json={"channel": 3})
    assert cp.state.forced_mic_channel == 3
    client.post("/api/force_channel", json={"channel": None})
    assert cp.state.forced_mic_channel is None


def test_status_reports_own_pid_and_flags_extra_processes(monkeypatch):
    # The control panel is embedded IN the Merlin process — self-identity is
    # always os.getpid(), never dependent on pgrep finding itself (which was
    # observed to be unreliable for self-search in this environment; see
    # _status_payload's comment). An extra pgrep match (a genuinely different
    # PID) bumps service_pid_count above 1, flagging a real duplicate.
    cp, client = _panel()
    monkeypatch.setattr(cp, "_find_live_merlin_pids", lambda: [55555])
    data = client.get("/api/status").json()
    assert data["service_running"] is True
    assert data["service_pid"] == cp.own_pid
    assert data["service_pid_count"] == 2   # cp.own_pid + the unexpected 55555


def test_status_reports_running_with_only_self_when_pgrep_finds_nothing_extra(monkeypatch):
    cp, client = _panel()
    monkeypatch.setattr(cp, "_find_live_merlin_pids", lambda: [])
    data = client.get("/api/status").json()
    assert data["service_running"] is True
    assert data["service_pid"] == cp.own_pid
    assert data["service_pid_count"] == 1


def test_actions_log_records_every_control_call():
    cp, client = _panel()
    client.post("/api/mute")
    client.post("/api/stop_speaking")
    actions = client.get("/api/actions").json()["actions"]
    names = [a["action"] for a in actions]
    assert "mute" in names
    assert "stop_speaking" in names


# ── restart: does not create a duplicate process ────────────────────────

def test_restart_service_spawns_new_process_and_reports_old_pids(monkeypatch):
    cp, client = _panel()
    monkeypatch.setattr(cp, "_find_live_merlin_pids", lambda: [11111])

    class _FakeProc:
        pid = 22222

    popen_calls = []

    def _fake_popen(args, **kwargs):
        popen_calls.append((args, kwargs))
        return _FakeProc()

    monkeypatch.setattr("service.control_panel.subprocess.Popen", _fake_popen)
    # os._exit(0) would kill the whole pytest process if it ever actually
    # fired — neutralize it (it's scheduled 0.3s out; the test asserts on
    # the immediate HTTP response, well before that delay elapses either way).
    exit_calls = []
    monkeypatch.setattr("service.control_panel.os._exit", lambda code: exit_calls.append(code))

    r = client.post("/api/restart_service")
    data = r.json()
    assert data["ok"] is True
    # old_pids always includes cp.own_pid (self-identity is normalized in,
    # not trusted from pgrep alone — see _status_payload's own comment) plus
    # whatever pgrep reported (here mocked to [11111]).
    assert 11111 in data["old_pids"]
    assert cp.own_pid in data["old_pids"]
    assert data["new_pid"] == 22222
    assert data["new_pid"] not in data["old_pids"]   # never the same PID — a real second process
    assert len(popen_calls) == 1
    spawned_args = popen_calls[0][0]
    assert spawned_args[0] == sys.executable
    assert spawned_args[1].endswith("merlin_service.py")


# ── pipeline layer: proves mute/cancel actually change real behavior ────

class FakeDuplexStream:
    rms_sequence: list[float] = []
    block_frames: int = 240
    max_calls: int = 20_000

    def __init__(self, *, samplerate, channels, dtype, callback, finished_callback=None):
        self.channels = channels
        self.callback = callback
        self.finished_callback = finished_callback
        self.calls = 0

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        in_ch = self.channels[0] if isinstance(self.channels, tuple) else 1
        frames = self.block_frames
        try:
            while self.calls < self.max_calls:
                rms = self.rms_sequence[self.calls] if self.calls < len(self.rms_sequence) else 0.0
                indata = np.full((frames, in_ch), rms, dtype=np.float32)
                outdata = np.zeros((frames, 1), dtype=np.float32)
                self.calls += 1
                self.callback(indata, outdata, frames, None, None)
        except svc.sd.CallbackStop:
            pass
        finally:
            if self.finished_callback:
                self.finished_callback()

    def stop(self) -> None: pass
    def close(self) -> None: pass


def _pcm_bytes(seconds: float = 1.0) -> bytes:
    return np.zeros(int(seconds * svc._TTS_SR), dtype=np.int16).tobytes()


@pytest.fixture(autouse=True)
def _fake_hw(monkeypatch):
    FakeDuplexStream.rms_sequence = []
    monkeypatch.setattr(svc, "BARGE_IN_GRACE", 0.0)
    monkeypatch.setattr(svc.sd, "Stream", FakeDuplexStream)
    monkeypatch.setattr(
        svc.sd, "query_devices",
        lambda kind=None: {"max_input_channels": 2, "default_samplerate": svc._TTS_SR},
    )
    yield


def _make_adapter_with_draft(draft_text: str):
    from app.adapters.claude import ClaudeAdapter
    adapter = ClaudeAdapter(persona="merlin")

    async def _fake_text_stream():
        yield draft_text

    fake_stream_cm = MagicMock()
    fake_stream_cm.__aenter__ = AsyncMock(return_value=MagicMock(text_stream=_fake_text_stream()))
    fake_stream_cm.__aexit__ = AsyncMock(return_value=False)
    adapter._client.messages.stream = MagicMock(return_value=fake_stream_cm)
    adapter._client.messages.create = AsyncMock(side_effect=AssertionError("must not retry"))
    return adapter


@pytest.fixture(autouse=True)
def _hebrew_only_control_config(tmp_path, monkeypatch):
    from config.merlin_control_schema import default_config, save
    cfg_path = tmp_path / "merlin_control.json"
    monkeypatch.setattr("config.merlin_control_schema.DEFAULT_CONFIG_PATH", cfg_path)
    monkeypatch.setattr("config.merlin_control_schema.LAST_KNOWN_GOOD_PATH", tmp_path / "lkg.json")
    ok, errors = save(default_config().to_dict(), path=cfg_path)
    assert ok, errors
    yield


def _tts_double():
    tts = MagicMock(spec=["synthesize"])
    tts.synthesize = AsyncMock(return_value=_pcm_bytes())
    return tts


@pytest.mark.asyncio
async def test_mute_prevents_subsequent_playback_in_real_pipeline():
    tts = _tts_double()
    player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("תשובה שלא אמורה להישמע כי מרלין מושתק.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()
    control_state = RuntimeControlState()
    control_state.muted = True

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, player, "טקסט", SESSION, turn_ctrl, turn_id, control_state=control_state,
    )

    assert interrupted is False
    tts.synthesize.assert_not_awaited()   # muted: never even synthesized, let alone played


@pytest.mark.asyncio
async def test_unmute_restores_playback_in_real_pipeline():
    tts = _tts_double()
    player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("תשובה שכן אמורה להישמע כי מרלין לא מושתק.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()
    control_state = RuntimeControlState()
    control_state.muted = True
    control_state.muted = False   # operator unmutes before this turn starts

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, player, "טקסט", SESSION, turn_ctrl, turn_id, control_state=control_state,
    )

    assert interrupted is False
    tts.synthesize.assert_awaited()   # unmuted: real synthesis/playback happened


@pytest.mark.asyncio
async def test_cancel_turn_via_panel_prevents_stale_response_playback():
    tts = _tts_double()
    player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("תשובה ישנה שלא אמורה להישמע אחרי ביטול.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    cp, client = _panel(turn_ctrl=turn_ctrl)
    client.post("/api/cancel_turn")   # operator cancels BEFORE stream_response ever runs for turn_id

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, player, "טקסט", SESSION, turn_ctrl, turn_id,
    )

    assert interrupted is True
    tts.synthesize.assert_not_awaited()   # cancelled before it started — zero stale playback


@pytest.mark.asyncio
async def test_emergency_kill_leaves_system_idle_and_silent():
    tts = _tts_double()
    real_player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("תשובה שאמורה להיקטע על ידי הריגה חירום.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()
    control_state = RuntimeControlState()

    # Simulate an operator hitting EMERGENCY KILL mid-turn: cancel + interrupt
    # BEFORE the turn's own stream_response call ever gets to run (worst-case
    # timing — kill lands before anything was spoken).
    turn_ctrl.cancel_current()
    real_player.interrupt()

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, real_player, "טקסט", SESSION, turn_ctrl, turn_id, control_state=control_state,
    )

    assert interrupted is True
    tts.synthesize.assert_not_awaited()
    assert turn_ctrl.is_current(turn_id) is False


@pytest.mark.asyncio
async def test_send_as_user_reaches_exact_turn_input_and_llm_input():
    tts = _tts_double()
    player = svc.AudioPlayer()
    exact_text = "עצור, אני רוצה לדעת רק על מאדים"
    adapter = _make_adapter_with_draft("מאדים הוא הכוכב הרביעי.")
    turn_ctrl = TurnController()

    interrupted, prefill = await svc._process_turn(
        exact_text, adapter, tts, player, MagicMock(), SESSION, turn_ctrl, control_state=None,
    )

    history = adapter._history[SESSION]
    user_entries = [m for m in history if m["role"] == "user"]
    assert user_entries[-1]["content"] == exact_text


# ── Operator Console extension (section 13 required tests) ──────────────

def test_reset_turn_resets_turn_state_only_not_conversation():
    turn_ctrl = TurnController()
    t1 = turn_ctrl.new_turn()
    turn_ctrl.cancel(t1)
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/reset_turn")
    assert r.status_code == 200
    assert turn_ctrl.current_turn_id == 0
    assert turn_ctrl.is_cancelled(t1) is False
    cp.adapter.reset.assert_not_awaited()   # conversation untouched — that's clear_conversation's job


def test_clear_conversation_resets_history_only_not_turn_numbering():
    turn_ctrl = TurnController()
    turn_ctrl.new_turn()
    turn_ctrl.new_turn()
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/clear_conversation")
    assert r.status_code == 200
    cp.adapter.reset.assert_awaited_once_with(SESSION)
    assert turn_ctrl.current_turn_id == 2   # turn numbering NOT reset


def test_reset_session_does_both_turn_and_conversation_reset():
    turn_ctrl = TurnController()
    turn_ctrl.new_turn()
    cp, client = _panel(turn_ctrl=turn_ctrl)
    r = client.post("/api/reset_session")
    assert r.status_code == 200
    assert turn_ctrl.current_turn_id == 0
    cp.adapter.reset.assert_awaited_once_with(SESSION)


def test_mute_input_then_unmute_input_toggles_flag():
    cp, client = _panel()
    r = client.post("/api/mute_input")
    assert r.json() == {"ok": True, "input_muted": True}
    assert cp.state.input_muted is True
    r = client.post("/api/unmute_input")
    assert r.json() == {"ok": True, "input_muted": False}
    assert cp.state.input_muted is False


@pytest.mark.asyncio
async def test_mute_input_discards_transcript_without_reaching_llm():
    tts = _tts_double()
    player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("לא אמור להיווצר בכלל.")
    turn_ctrl = TurnController()
    control_state = RuntimeControlState()
    control_state.input_muted = True

    interrupted, prefill = await svc._process_turn(
        "טקסט כלשהו שנתפס במיקרופון", adapter, tts, player, MagicMock(), SESSION, turn_ctrl,
        control_state=control_state,
    )

    assert turn_ctrl.current_turn_id == 0   # no turn was ever minted
    assert SESSION not in adapter._history   # never reached ClaudeAdapter.respond() at all


def test_auto_channel_state_is_visible_via_audio_endpoint():
    cp, client = _panel()
    data = client.get("/api/audio").json()
    assert data["channel_mode"] == "AUTO"
    assert data["forced_mic_channel"] is None
    client.post("/api/force_channel", json={"channel": 2})
    data = client.get("/api/audio").json()
    assert data["channel_mode"] == "FORCED"
    assert data["forced_mic_channel"] == 2


def test_audio_endpoint_reports_hardware_gain_unavailable_honestly():
    cp, client = _panel()
    data = client.get("/api/audio").json()
    assert data["hardware_gain_control"] == "HARDWARE_CONTROL_UNAVAILABLE"


@pytest.mark.asyncio
async def test_mic_test_never_enters_conversation_history(monkeypatch):
    cp, client = _panel()
    from app.providers.stt.base import Transcription
    fake_stt = MagicMock(spec=["transcribe_detailed"])
    fake_stt.transcribe_detailed = AsyncMock(
        return_value=Transcription(text="זה מבחן מיקרופון בלבד", provider="fake", model="whisper-1")
    )
    cp.stt = fake_stt

    import numpy as _np
    import service.control_panel as cpmod

    class _FakeSD:
        @staticmethod
        def query_devices(kind=None):
            return {"name": "fake", "max_input_channels": 2, "default_samplerate": 16000}

        @staticmethod
        def rec(frames, samplerate, channels, dtype):
            return _np.zeros((frames, channels), dtype="float32")

        @staticmethod
        def wait():
            pass

    monkeypatch.setattr("sounddevice.query_devices", _FakeSD.query_devices)
    monkeypatch.setattr("sounddevice.rec", _FakeSD.rec)
    monkeypatch.setattr("sounddevice.wait", _FakeSD.wait)

    r = client.post("/api/test_mic", params={"duration_s": 0.05})
    data = r.json()
    assert data["ok"] is True
    assert data["transcription"] == "זה מבחן מיקרופון בלבד"
    assert data["sent_to_conversation"] is False
    fake_stt.transcribe_detailed.assert_awaited_once()
    # No turn was ever minted, no history entry created, for this transcript:
    assert cp.turn_ctrl.current_turn_id == 0
    cp.adapter.reset.assert_not_awaited()


def test_event_timeline_records_turn_ownership_correctly():
    cs = RuntimeControlState()
    cs.record_event("wake_trigger", "WAKE")
    cs.record_event("turn_state", "TURN_CREATED", turn_id=1)
    cs.record_event("adapter", "LLM_START", turn_id=1)
    cs.record_event("turn_state", "TURN_CREATED", turn_id=2)
    cs.record_event("adapter", "LLM_START", turn_id=2)

    events = cs.recent_events()
    turn1_events = [e for e in events if e["turn_id"] == 1]
    turn2_events = [e for e in events if e["turn_id"] == 2]
    assert len(turn1_events) == 2
    assert len(turn2_events) == 2
    assert all(e["turn_id"] != 2 for e in turn1_events)   # turn 1's events never carry turn 2's id


@pytest.mark.asyncio
async def test_cancelled_turn_cannot_emit_subsequent_tts_via_cancel_endpoint():
    """Same guarantee as test_cancel_turn_via_panel_prevents_stale_response_playback,
    phrased to match section 13's exact required-test wording."""
    tts = _tts_double()
    player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("תגובה שלא אמורה להישמע אחרי ביטול מהקונסולה.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    cp, client = _panel(turn_ctrl=turn_ctrl)
    client.post("/api/cancel_turn")

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, player, "טקסט", SESSION, turn_ctrl, turn_id,
    )

    assert interrupted is True
    tts.synthesize.assert_not_awaited()


def test_invariant_violations_field_present_and_empty_by_default():
    cp, client = _panel()
    data = client.get("/api/status").json()
    assert data["invariant_violations"] == []


def test_status_reports_uptime_and_session_id():
    cp, client = _panel()
    cp.state.session_id = SESSION
    data = client.get("/api/status").json()
    assert data["session_id"] == SESSION
    assert data["uptime_seconds"] >= 0


def test_turn_truth_view_never_collapses_fields():
    cs = RuntimeControlState()
    cs.begin_turn(1, "מיקרופון קלט", "מיקרופון קלט", "מיקרופון קלט")
    cs.update_turn_response(1, "פלט LLM גולמי", "completed", tts_text="מה שבאמת נאמר")
    view = cs.turn_truth_view()
    assert view["mic_capture_text"] == "מיקרופון קלט"
    assert view["stt_result"] == "מיקרופון קלט"
    assert view["turn_input"] == "מיקרופון קלט"
    assert view["llm_input"] == "מיקרופון קלט"
    assert view["llm_output"] == "פלט LLM גולמי"
    assert view["tts_text"] == "מה שבאמת נאמר"   # distinct from llm_output — proves no collapsing


def test_components_endpoint_reports_only_real_components_no_invented_agents():
    cp, client = _panel()
    data = client.get("/api/components").json()
    ids = {c["id"] for c in data["components"]}
    # Real components that genuinely exist in this codebase:
    assert {"wake_trigger", "record_utterance", "whisper_stt", "merlin_adapter",
            "openai_tts", "audio_player", "turn_controller"}.issubset(ids)
    # No invented business-function agents:
    invented = {"marketing_agent", "sales_agent", "research_agent", "apex", "nexus"}
    assert invented.isdisjoint(ids)
    assert "APEX/NEXUS" in data["hierarchy_note"]


def test_modules_report_not_implemented_honestly_for_missing_capabilities():
    cp, client = _panel()
    data = client.get("/api/components").json()
    modules = {m["id"]: m for m in data["modules"]}
    assert modules["research"]["state"] == "not_implemented"
    assert modules["calendar"]["state"] == "not_implemented"
    assert modules["mail"]["state"] == "not_implemented"
    assert modules["philos"]["state"] == "offline"
    assert {"voice", "memory", "system", "developer"}.issubset(modules.keys())


def test_pause_resume_listening_aliases_map_to_same_mechanism():
    cp, client = _panel()
    client.post("/api/pause_listening")
    assert cp.state.force_stop_capture.is_set() is True
    cp.state.force_stop_capture.clear()
    client.post("/api/resume_listening")
    assert cp.state.manual_wake.is_set() is True


def test_cancelled_turn_ids_visible_in_status():
    turn_ctrl = TurnController()
    t1 = turn_ctrl.new_turn()
    turn_ctrl.new_turn()
    turn_ctrl.cancel(t1)
    cp, client = _panel(turn_ctrl=turn_ctrl)
    data = client.get("/api/status").json()
    assert data["cancelled_turn_ids"] == [t1]


@pytest.mark.asyncio
async def test_rejected_transcript_reports_reason_and_never_reaches_llm():
    tts = _tts_double()
    player = svc.AudioPlayer()
    adapter = _make_adapter_with_draft("לא אמור להיווצר.")
    turn_ctrl = TurnController()
    control_state = RuntimeControlState()

    interrupted, prefill = await svc._process_turn(
        "Ahem", adapter, tts, player, MagicMock(), SESSION, turn_ctrl, control_state=control_state,
    )

    assert turn_ctrl.current_turn_id == 0
    assert SESSION not in adapter._history
    assert control_state.last_rejection_reason == "empty_or_filler"
    assert control_state.last_rejection_transcript == "Ahem"


def test_audio_diagnostics_is_honest_about_no_speech_prob_unavailability():
    cp, client = _panel()
    # Default fixture never sets control_state.stt_model — matches "unknown /
    # not whisper-1" rather than fabricating availability.
    data = client.get("/api/audio").json()
    assert data["no_speech_prob_available"] is False
    assert "does not expose verbose_json" in data["no_speech_prob_note"]


def test_audio_diagnostics_reports_no_speech_prob_available_for_whisper1():
    cp, client = _panel()
    cp.state.stt_model = "whisper-1"
    data = client.get("/api/audio").json()
    assert data["no_speech_prob_available"] is True
    assert "whisper-1" in data["no_speech_prob_note"]


# ── Day Opening endpoints ────────────────────────────────────────────────

def test_day_opening_start_requires_tts_wired():
    cp, client = _panel()   # _panel() doesn't pass tts= -> None
    r = client.post("/api/day_opening/start")
    assert r.status_code == 503


def test_day_opening_status_reports_idle_by_default():
    cp, client = _panel()
    data = client.get("/api/day_opening/status").json()
    assert data["state"] == "IDLE"
    assert data["double_clap_enabled"] is False


def test_day_opening_double_clap_toggle():
    cp, client = _panel()
    r = client.post("/api/day_opening/double_clap", json={"enabled": True})
    assert r.json() == {"ok": True, "enabled": True}
    assert cp.state.day_opening_double_clap_enabled is True
    data = client.get("/api/day_opening/status").json()
    assert data["double_clap_enabled"] is True

    client.post("/api/day_opening/double_clap", json={"enabled": False})
    assert cp.state.day_opening_double_clap_enabled is False


def test_day_opening_start_rejects_while_already_running():
    cp, client = _panel()
    cp.tts = MagicMock(spec=["synthesize"])
    cp.state.day_opening_state = "PLAYING"
    r = client.post("/api/day_opening/start")
    assert r.status_code == 409


def test_day_opening_start_rejects_while_main_loop_is_busy():
    """Real incident (2026-08-07): the always-on wake/conversation loop and
    this handler run concurrently on the same event loop. Triggering Day
    Opening while a real conversation turn is in flight (runtime_state !=
    IDLE) must be rejected, not silently collide via TurnController's
    stale-turn mechanism."""
    cp, client = _panel()
    cp.tts = MagicMock(spec=["synthesize"])
    cp.state.set_state("THINKING")
    r = client.post("/api/day_opening/start")
    assert r.status_code == 409
    assert "busy" in r.json()["error"]


# ── section 11: semantic routing / knowledge-source status (2026-08-08) ────

def test_knowledge_sources_endpoint_reports_real_runtime_masters_as_primary():
    """The panel must report the REAL runtime masters (the Dropbox xlsx that
    domain_router/master_config actually retrieve from) as PRIMARY — with their
    absolute path, resolved-unit count and honest reachability — and demote the
    profiles/*.yaml stubs to FALLBACK ONLY. It must never claim a Master is
    loaded when it is not: LOADED must coincide with a real successful read."""
    cp, client = _panel()
    r = client.get("/api/knowledge_sources")
    assert r.status_code == 200
    sources = r.json()["sources"]

    # PRIMARY runtime masters are present and clearly marked primary.
    for key in ("human_master", "music_master"):
        m = sources[key]
        assert m["role"].startswith("PRIMARY")
        # Honesty invariant: LOADED iff the workbook was actually read.
        assert (m["status"] == "LOADED") == bool(m["reachable"])
        if m["reachable"]:
            # a real master carries the Dropbox path + a positive resolved count
            assert "Dropbox" in (m["path"] or "")
            assert isinstance(m["item_count"], int) and m["item_count"] > 0

    # FALLBACK stubs are present, demoted, and NEVER claimed LOADED.
    for key in ("human_fallback", "music_fallback"):
        f = sources[key]
        assert f["role"] == "FALLBACK ONLY"
        assert f["status"] in ("FOUND", "MISSING")
        assert f["status"] != "LOADED"
        assert "profiles/" in (f["path"] or "")

    assert r.json()["last_route_decision"] is None  # no turn routed yet in this fresh panel


def test_status_surfaces_the_last_route_decision_once_recorded():
    cp, client = _panel()
    cp.state.set_route_decision({
        "domain": "music_config", "query": "מה אתה יודע על המוזיקה שלי?",
        "confidence": 1.0, "sources": [], "retrieved_unit_ids": [],
        "fallback_reason": "", "context_chars": 42, "latency_ms": 0.5,
    })
    r = client.get("/api/status")
    assert r.status_code == 200
    rd = r.json()["last_route_decision"]
    assert rd["domain"] == "music_config"
    assert rd["query"] == "מה אתה יודע על המוזיקה שלי?"
