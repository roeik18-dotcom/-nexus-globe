"""Tests for service.day_opening_runner — orchestration + persistence.
Uses the same FakeDuplexStream pattern as tests/test_turn_taking.py so this
runs without real audio hardware, but exercises the REAL speak_canonical_text()
in service/merlin_service.py, not a mock of it.
"""

from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

import service.merlin_service as svc
from service.control_state import RuntimeControlState
from service.turn_state import TurnController

SESSION = "test-day-opening-session"


class FakeDuplexStream:
    rms_sequence: list[float] = []
    block_frames: int = 240
    max_calls: int = 20_000

    def __init__(self, *, samplerate, channels, dtype, callback, finished_callback=None):
        self.channels = channels
        self.callback = callback
        self.finished_callback = finished_callback
        self.calls = 0

    def start(self):
        import threading
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
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

    def stop(self): pass
    def close(self): pass


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


def _tts_double():
    tts = MagicMock(spec=["synthesize"])
    tts.synthesize = AsyncMock(return_value=np.zeros(int(0.5 * svc._TTS_SR), dtype=np.int16).tobytes())
    return tts


@pytest.mark.asyncio
async def test_run_day_opening_never_calls_the_llm(monkeypatch, tmp_path):
    """Critical content rule: canonical briefing text must never go through
    adapter.respond() — it's built entirely by collect/plan/render."""
    from service.day_opening_runner import run_day_opening
    monkeypatch.setattr("service.day_opening_runner._STATE_PATH", tmp_path / "day_opening_state.json")

    adapter = MagicMock()
    adapter.respond = MagicMock(side_effect=AssertionError("must never call the LLM for Day Opening"))
    tts = _tts_double()
    player = svc.AudioPlayer()
    turn_ctrl = TurnController()
    control_state = RuntimeControlState()

    result = await run_day_opening(adapter, tts, player, turn_ctrl, control_state, SESSION)

    assert result["ok"] is True
    adapter.respond.assert_not_called()


@pytest.mark.asyncio
async def test_run_day_opening_sets_lifecycle_states(monkeypatch, tmp_path):
    from service.day_opening_runner import run_day_opening
    monkeypatch.setattr("service.day_opening_runner._STATE_PATH", tmp_path / "day_opening_state.json")

    adapter = MagicMock()
    tts = _tts_double()
    player = svc.AudioPlayer()
    turn_ctrl = TurnController()
    control_state = RuntimeControlState()

    assert control_state.day_opening_state == "IDLE"
    await run_day_opening(adapter, tts, player, turn_ctrl, control_state, SESSION)
    assert control_state.day_opening_state == "COMPLETED"
    assert control_state.day_opening_last_ts is not None


@pytest.mark.asyncio
async def test_run_day_opening_interrupted_by_real_barge_in(monkeypatch, tmp_path):
    monkeypatch.setattr("service.day_opening_runner._STATE_PATH", tmp_path / "day_opening_state.json")
    FakeDuplexStream.rms_sequence = [0.05] * (svc.BARGE_IN_FRAMES + 4)

    from service.day_opening_runner import run_day_opening
    adapter = MagicMock()
    tts = _tts_double()
    player = svc.AudioPlayer()
    turn_ctrl = TurnController()
    control_state = RuntimeControlState()

    result = await run_day_opening(adapter, tts, player, turn_ctrl, control_state, SESSION)

    assert result["interrupted"] is True
    assert control_state.day_opening_state == "INTERRUPTED"
    assert turn_ctrl.is_current(result["turn_id"]) is False


@pytest.mark.asyncio
async def test_run_day_opening_persists_planned_vs_spoken_distinction(monkeypatch, tmp_path):
    state_path = tmp_path / "day_opening_state.json"
    monkeypatch.setattr("service.day_opening_runner._STATE_PATH", state_path)
    FakeDuplexStream.rms_sequence = [0.05] * (svc.BARGE_IN_FRAMES + 4)

    from service.day_opening_runner import run_day_opening
    adapter = MagicMock()
    tts = _tts_double()
    player = svc.AudioPlayer()
    turn_ctrl = TurnController()
    control_state = RuntimeControlState()

    await run_day_opening(adapter, tts, player, turn_ctrl, control_state, SESSION)

    import json
    persisted = json.loads(state_path.read_text(encoding="utf-8"))
    assert persisted["interrupted"] is True
    # An interrupted run must NOT be marked as fully spoken — "selected
    # priority" != "completed" (section 8).
    assert persisted["fully_spoken"] is False


@pytest.mark.asyncio
async def test_run_day_opening_rejects_concurrent_start(monkeypatch, tmp_path):
    monkeypatch.setattr("service.day_opening_runner._STATE_PATH", tmp_path / "day_opening_state.json")
    from service.control_panel import ControlPanel

    turn_ctrl = TurnController()
    player = MagicMock(spec=["interrupt", "play", "play_with_barge_in"])
    adapter = MagicMock(spec=["reset"])
    store = MagicMock()
    control_state = RuntimeControlState()
    control_state.day_opening_state = "PLAYING"   # already running

    from fastapi.testclient import TestClient
    cp = ControlPanel(
        turn_ctrl=turn_ctrl, player=player, adapter=adapter, store=store,
        session_id=SESSION, control_state=control_state, tts=_tts_double(),
    )
    client = TestClient(cp.app)
    r = client.post("/api/day_opening/start")
    assert r.status_code == 409
