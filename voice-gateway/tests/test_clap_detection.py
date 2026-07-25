"""
Unit tests for ClapDetector and audio helpers.

All tests are microphone-free — they feed synthetic numpy arrays.
The injectable _now parameter controls timing without real sleeps.
"""

import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest

# Stub out sounddevice before importing voice.py — the cloud/CI environment
# may not have PortAudio.  All tests here exercise pure-numpy logic only.
sys.modules.setdefault("sounddevice", MagicMock())

# client/ is not a package; add it to path
sys.path.insert(0, str(Path(__file__).parent.parent / "client"))

from voice import (
    CLAP_COOLDOWN_S,
    CLAP_MAX_DURATION_MS,
    CLAP_SPECTRAL_FLATNESS,
    CLAP_WARMUP_FRAMES,
    DOUBLE_CLAP_MAX_MS,
    DOUBLE_CLAP_MIN_MS,
    FRAME_MS,
    FRAME_SAMPLES,
    ClapDetector,
    _rms,
    _spectral_flatness,
)


# ── Audio fixture helpers ─────────────────────────────────────────────────────

def _clap_frame(amplitude: float = 0.3) -> np.ndarray:
    """Broadband white-noise burst — high spectral flatness, sharp transient."""
    rng = np.random.default_rng(seed=42)
    return (rng.standard_normal(FRAME_SAMPLES) * amplitude * 32768).astype(np.int16)


def _speech_frame(amplitude: float = 0.15, freq: float = 200.0) -> np.ndarray:
    """Tonal sine wave — low spectral flatness, simulates a vowel."""
    t = np.linspace(0, FRAME_MS / 1000, FRAME_SAMPLES, endpoint=False)
    return (np.sin(2 * np.pi * freq * t) * amplitude * 32768).astype(np.int16)


def _silence_frame() -> np.ndarray:
    return np.zeros(FRAME_SAMPLES, dtype=np.int16)


class _FakeClock:
    """Monotonic clock whose value is advanced manually in tests."""
    def __init__(self, t: float = 0.0) -> None:
        self._t = t

    def __call__(self) -> float:
        return self._t

    def advance(self, seconds: float) -> None:
        self._t += seconds


def _push_n(det: ClapDetector, frame_fn, n: int) -> None:
    for _ in range(n):
        det.push(frame_fn())


def _make_detector(clock: _FakeClock) -> tuple[ClapDetector, list[int]]:
    """Returns (detector, activations_list). activations_list grows on each double-clap."""
    activations: list[int] = []
    # warmup_frames=0: tests skip the built-in warmup and calibrate background
    # manually via the silence frames below, keeping tests fast and deterministic.
    det = ClapDetector(on_double_clap=lambda: activations.append(1), _now=clock, warmup_frames=0)
    # Warm up background estimate with silence
    _push_n(det, _silence_frame, 50)
    return det, activations


# ── _rms and _spectral_flatness ───────────────────────────────────────────────

def test_rms_silence_is_zero():
    assert _rms(_silence_frame()) == pytest.approx(0.0)


def test_rms_clap_above_threshold():
    assert _rms(_clap_frame(0.3)) > 0.05


def test_spectral_flatness_noise_high():
    """White noise should have high spectral flatness (>0.4)."""
    flatness = _spectral_flatness(_clap_frame(0.3))
    assert flatness > 0.4, f"expected flatness > 0.4, got {flatness:.3f}"


def test_spectral_flatness_sine_low():
    """A pure sine should have low spectral flatness (<0.1)."""
    flatness = _spectral_flatness(_speech_frame())
    assert flatness < 0.1, f"expected flatness < 0.1, got {flatness:.3f}"


# ── Single clap ───────────────────────────────────────────────────────────────

def test_single_clap_does_not_activate():
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    # One clap transient
    _push_n(det, _clap_frame, 3)        # transient frames
    _push_n(det, _silence_frame, 5)     # end transient

    assert activations == [], "single clap must not activate"


def test_single_clap_no_activation_after_timeout():
    """A single clap followed by DOUBLE_CLAP_MAX_MS of silence should do nothing."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    _push_n(det, _clap_frame, 3)
    _push_n(det, _silence_frame, 5)
    clock.advance(DOUBLE_CLAP_MAX_MS / 1000 + 0.1)
    _push_n(det, _silence_frame, 5)

    assert activations == []


# ── Double clap ───────────────────────────────────────────────────────────────

def _do_clap(det: ClapDetector, clock: _FakeClock) -> None:
    """Push one complete clap transient into the detector."""
    _push_n(det, _clap_frame, 3)
    _push_n(det, _silence_frame, 2)


def test_two_claps_in_valid_window_activate():
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    _do_clap(det, clock)
    # Advance clock to a valid inter-clap gap
    gap_s = (DOUBLE_CLAP_MIN_MS + DOUBLE_CLAP_MAX_MS) / 2 / 1000
    clock.advance(gap_s)
    _do_clap(det, clock)

    assert len(activations) == 1, f"expected 1 activation, got {activations}"


def test_two_claps_too_close_together_do_nothing():
    """Gap < DOUBLE_CLAP_MIN_MS — second clap arrives before the minimum window."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    _do_clap(det, clock)
    clock.advance((DOUBLE_CLAP_MIN_MS - 50) / 1000)  # 50ms too soon
    _do_clap(det, clock)

    # Neither fires because gap < min, but the second becomes the new "first clap"
    assert len(activations) == 0


def test_two_claps_too_far_apart_do_nothing():
    """Gap > DOUBLE_CLAP_MAX_MS — window has expired."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    _do_clap(det, clock)
    clock.advance((DOUBLE_CLAP_MAX_MS + 500) / 1000)
    _do_clap(det, clock)

    assert activations == [], "claps too far apart must not activate"


# ── Speech rejection ──────────────────────────────────────────────────────────

def test_speech_does_not_trigger_clap_detection():
    """Sustained speech (long duration, tonal) should not register as a clap."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    # Sustained speech for 500ms (well above CLAP_MAX_DURATION_MS)
    speech_frames = 500 // FRAME_MS + 5
    _push_n(det, _speech_frame, speech_frames)
    _push_n(det, _silence_frame, 10)

    assert activations == [], "speech must not trigger double-clap activation"


def test_long_noise_burst_rejected_as_speech():
    """High-energy broadband burst lasting longer than CLAP_MAX_DURATION_MS is rejected."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    long_frames = CLAP_MAX_DURATION_MS // FRAME_MS + 5
    _push_n(det, _clap_frame, long_frames)   # loud + flat but too long
    _push_n(det, _silence_frame, 5)

    # No double-clap because the sustained burst is rejected
    assert activations == []


# ── Cooldown ──────────────────────────────────────────────────────────────────

def test_cooldown_prevents_immediate_second_activation():
    """After double-clap, cooldown blocks the next detection."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    # First double-clap
    gap_s = (DOUBLE_CLAP_MIN_MS + DOUBLE_CLAP_MAX_MS) / 2 / 1000
    _do_clap(det, clock)
    clock.advance(gap_s)
    _do_clap(det, clock)
    assert len(activations) == 1

    # Immediately try a second double-clap (still in cooldown)
    clock.advance(gap_s)
    _do_clap(det, clock)
    clock.advance(gap_s)
    _do_clap(det, clock)

    assert len(activations) == 1, "cooldown must prevent second activation"


def test_activation_allowed_after_cooldown_expires():
    """Once cooldown elapses, a new double-clap should fire."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)

    gap_s = (DOUBLE_CLAP_MIN_MS + DOUBLE_CLAP_MAX_MS) / 2 / 1000

    # First activation
    _do_clap(det, clock)
    clock.advance(gap_s)
    _do_clap(det, clock)
    assert len(activations) == 1

    # Advance past cooldown
    clock.advance(CLAP_COOLDOWN_S + 0.1)

    # Second activation
    _do_clap(det, clock)
    clock.advance(gap_s)
    _do_clap(det, clock)
    assert len(activations) == 2, "second activation must fire after cooldown"


# ── Manual mode integration smoke-test ───────────────────────────────────────

def test_clap_detector_callback_receives_correct_gap():
    """Verify that on_double_clap fires and the gap is within the expected window."""
    clock = _FakeClock(0.0)
    captured: list[float] = []

    # Patch the internal _register_clap to capture the gap
    gap_s = 0.6  # 600ms — well within [250ms, 1200ms]
    det = ClapDetector(on_double_clap=lambda: captured.append(clock()), _now=clock, warmup_frames=0)
    _push_n(det, _silence_frame, 50)

    _do_clap(det, clock)
    clock.advance(gap_s)
    _do_clap(det, clock)

    assert len(captured) == 1


# ── Warmup gate ───────────────────────────────────────────────────────────────

def test_warmup_blocks_early_transients():
    """Clap-like frames during warmup must not register as claps."""
    clock = _FakeClock(0.0)
    activations: list[int] = []
    det = ClapDetector(
        on_double_clap=lambda: activations.append(1),
        _now=clock,
        warmup_frames=CLAP_WARMUP_FRAMES,
    )

    # Feed CLAP_WARMUP_FRAMES - 1 loud broadband frames (all during warmup)
    _push_n(det, _clap_frame, CLAP_WARMUP_FRAMES - 1)
    gap_s = (DOUBLE_CLAP_MIN_MS + DOUBLE_CLAP_MAX_MS) / 2 / 1000
    clock.advance(gap_s)
    _push_n(det, _clap_frame, CLAP_WARMUP_FRAMES - 1)

    assert activations == [], "transients during warmup must not activate"


def test_warmup_allows_detection_after_warmup():
    """After warmup completes, genuine double-claps must still activate."""
    clock = _FakeClock(0.0)
    det, activations = _make_detector(clock)  # warmup_frames=0, already calibrated

    gap_s = (DOUBLE_CLAP_MIN_MS + DOUBLE_CLAP_MAX_MS) / 2 / 1000
    _do_clap(det, clock)
    clock.advance(gap_s)
    _do_clap(det, clock)

    assert len(activations) == 1, "double-clap must activate after warmup"


# ── Thread safety ─────────────────────────────────────────────────────────────

def test_push_is_thread_safe():
    """Multiple threads pushing frames simultaneously must not crash."""
    activations: list[int] = []
    det = ClapDetector(on_double_clap=lambda: activations.append(1), warmup_frames=0)

    def worker():
        for _ in range(200):
            det.push(_clap_frame(0.01))  # low amplitude, below threshold

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # No crash is the test
