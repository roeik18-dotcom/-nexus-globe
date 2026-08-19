"""
Tests for the pre-capture audio-conflict guard (client/capture_guard.py).

Imported as a namespace-package submodule (`from client import capture_guard`), the
same import root existing tests use (`from app...`). All audio and timing are injected
— a fake sampler returns per-block RMS, a fake clock drives the cooldown — so no
microphone and no audio libraries are needed.
"""
import math

from client import capture_guard as cg


class FakeClock:
    def __init__(self, t: float = 0.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


class FlagProvider:
    """A settable system-audio provider (stands in for a future real backend)."""

    def __init__(self, active: bool = False) -> None:
        self.active = active

    def is_active(self) -> bool:
        return self.active


# per-block RMS windows (8 × 50 ms = 400 ms), well under / over the 0.02 threshold
QUIET = [0.001] * 8
LOUD = [0.20] * 8


def make_guard(sampler, *, clock=None, provider=None, config=None):
    clock = clock or FakeClock()
    guard = cg.CaptureGuard(
        config=config or cg.GuardConfig(),
        tts=cg.TtsState(clock=clock),
        mic_sampler=sampler,
        system_audio_provider=provider or cg.NullSystemAudioProvider(),
        clock=clock,
    )
    return guard, clock


def test_blocked_during_merlin_tts():
    guard, _ = make_guard(lambda: QUIET)
    guard.tts.mark_started()
    r = guard.pre_capture_check()
    assert r.allow is False
    assert r.reason == "tts_active"
    assert r.tts_active is True
    assert math.isnan(r.mic_rms)  # mic not sampled while TTS blocks


def test_blocked_during_post_tts_cooldown():
    clock = FakeClock()
    guard, _ = make_guard(lambda: QUIET, clock=clock, config=cg.GuardConfig(tts_cooldown_ms=400))
    guard.tts.mark_started()
    guard.tts.mark_ended()  # cooldown starts now
    clock.advance(0.2)      # 200 ms < 400 ms
    r = guard.pre_capture_check()
    assert r.allow is False
    assert r.reason == "tts_cooldown"
    assert r.cooldown_active is True


def test_allowed_after_cooldown_and_quiet():
    clock = FakeClock()
    guard, _ = make_guard(lambda: QUIET, clock=clock, config=cg.GuardConfig(tts_cooldown_ms=400))
    guard.tts.mark_started()
    guard.tts.mark_ended()
    clock.advance(0.5)  # 500 ms > 400 ms
    r = guard.pre_capture_check()
    assert r.allow is True
    assert r.reason == "allow"
    assert r.cooldown_active is False


def test_blocked_when_system_audio_flag_active():
    guard, _ = make_guard(lambda: QUIET, provider=FlagProvider(active=True))
    r = guard.pre_capture_check()
    assert r.allow is False
    assert r.reason == "system_audio_active"
    assert r.system_audio_active is True


def test_capture_allowed_after_quiet_window():
    guard, _ = make_guard(lambda: QUIET)
    r = guard.pre_capture_check()
    assert r.allow is True
    assert r.reason == "allow"
    assert r.mic_rms < guard.config.rms_threshold


def test_blocked_when_mic_not_quiet():
    guard, _ = make_guard(lambda: LOUD)
    r = guard.pre_capture_check()
    assert r.allow is False
    assert r.reason == "mic_not_quiet"
    assert r.mic_rms >= guard.config.rms_threshold


def test_manual_override_forces_allow_even_during_tts():
    guard, _ = make_guard(lambda: LOUD)
    guard.tts.mark_started()  # would otherwise block
    r = guard.pre_capture_check(override=True)
    assert r.allow is True
    assert r.reason == "override"
    assert r.tts_active is True  # true state still reported, not hidden


def test_microphone_only_speech_still_works():
    # No TTS, no system audio, quiet pre-window → the normal capture path is allowed.
    guard, _ = make_guard(lambda: QUIET)
    assert guard.pre_capture_check().allow is True


def test_default_system_audio_never_fakes_detection():
    # The core honesty guarantee: with no real backend, output detection is False.
    assert cg.NullSystemAudioProvider().is_active() is False


def test_mic_unavailable_blocks_and_does_not_fake_quiet():
    guard, _ = make_guard(lambda: [])  # sampler returns no data
    r = guard.pre_capture_check()
    assert r.allow is False
    assert r.reason == "mic_unavailable"
    assert math.isnan(r.mic_rms)


def test_result_has_all_six_fields():
    r = make_guard(lambda: QUIET)[0].pre_capture_check()
    for field in ("allow", "reason", "mic_rms", "tts_active", "cooldown_active", "system_audio_active"):
        assert hasattr(r, field)


def test_only_the_trailing_quiet_window_is_required():
    # loud key-press at the start, quiet tail → allowed (tail = min_quiet_ms)
    cfg = cg.GuardConfig(quiet_window_ms=350, min_quiet_ms=150, block_ms=50)  # tail = 3 blocks
    noisy_then_quiet = [0.5, 0.5, 0.5, 0.5, 0.001, 0.001, 0.001]
    assert make_guard(lambda: noisy_then_quiet, config=cfg)[0].pre_capture_check().allow is True
    # quiet lead-in but noisy tail → blocked
    quiet_then_noisy = [0.001, 0.001, 0.001, 0.001, 0.5, 0.5, 0.5]
    assert make_guard(lambda: quiet_then_noisy, config=cfg)[0].pre_capture_check().reason == "mic_not_quiet"


def test_configurable_threshold_via_env():
    cfg = cg.GuardConfig.from_env({"MERLIN_GUARD_RMS_THRESHOLD": "0.5", "MERLIN_GUARD_TTS_COOLDOWN_MS": "700"})
    assert cfg.rms_threshold == 0.5
    assert cfg.tts_cooldown_ms == 700
    # with a permissive threshold, the previously-"loud" window is now quiet
    assert make_guard(lambda: LOUD, config=cfg)[0].pre_capture_check().allow is True


def test_module_level_api_uses_the_default_guard():
    guard, _ = make_guard(lambda: QUIET)
    cg.set_default_guard(guard)
    try:
        assert cg.pre_capture_check().allow is True
    finally:
        cg.set_default_guard(cg.CaptureGuard())  # reset for other tests
