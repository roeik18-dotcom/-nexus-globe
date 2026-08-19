"""
Integration tests: the capture guard wired into push_to_talk.py.

These exercise the testable seams the integration added — ``try_start_recording``,
``block_message`` and ``play_audio``'s TTS marks — with the guard's decision mocked.
No microphone, no keyboard listener, no audio device is touched. push_to_talk and the
guard share the same ``client.capture_guard`` module instance, so ``set_default_guard``
and monkeypatching propagate into the client's calls.
"""
import math

from client import capture_guard as cg
from client import push_to_talk as pt


class FakeClock:
    def __init__(self, t: float = 0.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


def _result(allow: bool, reason: str) -> "cg.GuardResult":
    return cg.GuardResult(
        allow=allow, reason=reason, mic_rms=math.nan,
        tts_active=False, cooldown_active=False, system_audio_active=False,
    )


class FakeProc:
    """Stands in for the afplay subprocess.Popen so playback is testable without audio."""

    def __init__(self, alive: bool = True) -> None:
        self._alive = alive
        self.terminated = False

    def poll(self):
        return None if self._alive else 0

    def terminate(self) -> None:
        self.terminated = True
        self._alive = False

    def wait(self):
        return 0


# ── the gate decides whether the mic ever opens ──────────────────────────────

def test_blocked_capture_never_starts_recording(monkeypatch):
    monkeypatch.setattr(pt, "pre_capture_check", lambda override=False: _result(False, "mic_not_quiet"))
    started, msgs = [], []
    ok = pt.try_start_recording(False, start_fn=lambda: started.append(1), notify=msgs.append)
    assert ok is False
    assert started == []                         # record_until_release path never entered
    assert "Background or speaker sound" in msgs[0]


def test_allowed_capture_starts_recording(monkeypatch):
    monkeypatch.setattr(pt, "pre_capture_check", lambda override=False: _result(True, "allow"))
    started = []
    ok = pt.try_start_recording(False, start_fn=lambda: started.append(1), notify=lambda _m: None)
    assert ok is True
    assert started == [1]


def test_override_bypasses_block(monkeypatch):
    seen = {}

    def fake_check(override=False):
        seen["override"] = override
        return _result(True, "override") if override else _result(False, "mic_not_quiet")

    monkeypatch.setattr(pt, "pre_capture_check", fake_check)
    started = []
    ok = pt.try_start_recording(True, start_fn=lambda: started.append(1), notify=lambda _m: None)
    assert ok is True
    assert started == [1]
    assert seen["override"] is True


# ── honest messages ──────────────────────────────────────────────────────────

def test_block_messages_are_honest():
    assert pt.block_message("system_audio_active") == "System audio detected — pause music/video before speaking."
    assert pt.block_message("mic_not_quiet") == "Background or speaker sound detected — wait for quiet or use override."
    assert pt.block_message("tts_active") == "Merlin is still speaking — one moment."
    assert pt.block_message("tts_cooldown") == "Merlin is still speaking — one moment."
    assert pt.block_message("mic_unavailable") == "Microphone unavailable — check the input device."
    # mic_not_quiet must NOT claim proven system audio (rule #5)
    assert "system audio" not in pt.block_message("mic_not_quiet").lower()


# ── TTS marks + cooldown around play_audio ───────────────────────────────────

def test_tts_marks_clear_in_finally_even_when_afplay_missing(monkeypatch):
    clock = FakeClock()
    guard = cg.CaptureGuard(
        config=cg.GuardConfig(tts_cooldown_ms=400),
        tts=cg.TtsState(clock=clock),
        mic_sampler=lambda: [0.001] * 8,
        clock=clock,
    )
    cg.set_default_guard(guard)
    try:
        def _no_afplay(*_a, **_k):
            raise FileNotFoundError("afplay")

        monkeypatch.setattr(pt.subprocess, "Popen", _no_afplay)
        pt.play_audio(b"FORM" + b"\x00" * 32)          # AIFF path → no numpy needed; afplay "missing"
        assert guard.tts.is_active() is False           # cleared in finally despite the failure
        assert guard.tts.cooldown_active(400) is True   # post-TTS cooldown is armed
    finally:
        cg.set_default_guard(cg.CaptureGuard())


# ── barge-in: ESC stops Merlin mid-sentence ──────────────────────────────────

def test_stop_playback_interrupts_active_playback():
    proc = FakeProc(alive=True)
    pt._playback_proc = proc
    try:
        assert pt.stop_playback() is True
        assert proc.terminated is True
    finally:
        pt._playback_proc = None


def test_stop_playback_is_noop_when_nothing_playing():
    pt._playback_proc = None
    assert pt.stop_playback() is False


def test_stop_playback_is_noop_when_already_finished():
    pt._playback_proc = FakeProc(alive=False)
    try:
        assert pt.stop_playback() is False
    finally:
        pt._playback_proc = None


def test_play_audio_registers_then_clears_the_process(monkeypatch):
    proc = FakeProc(alive=True)
    monkeypatch.setattr(pt.subprocess, "Popen", lambda *_a, **_k: proc)
    cg.set_default_guard(cg.CaptureGuard(mic_sampler=lambda: [0.001] * 8))
    try:
        pt.play_audio(b"FORM" + b"\x00" * 32)
        assert pt._playback_proc is None   # registered during wait(), cleared in finally
    finally:
        pt._playback_proc = None
        cg.set_default_guard(cg.CaptureGuard())


def test_cooldown_blocks_immediate_recapture_then_allows():
    clock = FakeClock()
    guard = cg.CaptureGuard(
        config=cg.GuardConfig(tts_cooldown_ms=400),
        tts=cg.TtsState(clock=clock),
        mic_sampler=lambda: [0.001] * 8,
        clock=clock,
    )
    guard.tts.mark_started()
    guard.tts.mark_ended()                 # cooldown armed at t=0
    clock.advance(0.2)                     # 200 ms < 400 ms
    assert guard.pre_capture_check().reason == "tts_cooldown"
    clock.advance(0.3)                     # 500 ms total > 400 ms
    assert guard.pre_capture_check().allow is True


# ── existing surface unchanged ───────────────────────────────────────────────

def test_existing_entrypoints_still_present():
    # The integration must not remove or rename the public capture/playback surface.
    for name in ("record_until_release", "play_audio", "run", "main"):
        assert hasattr(pt, name)
