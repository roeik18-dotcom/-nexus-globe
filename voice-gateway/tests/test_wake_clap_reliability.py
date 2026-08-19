"""Regression + reliability tests for service.wake_trigger.ClapDetector —
the double-clap detector actually running in the live supervised
com.merlin.voice service (distinct from client/voice.py's ClapDetector,
covered separately by tests/test_clap_detection.py).

Background (2026-08-15 live investigation): live double-claps were firing
intermittently (2/5 in a supervised human test) despite audible mic input.
Root cause traced to service log evidence: three [wake] wrote snapshots this
session recorded peak=1.000000 (full-scale) events that never registered as
an RMS-crossing burst at all. CLAP_THRESHOLD gates on RMS averaged over one
whole ~70ms callback block (3072 samples @ 44.1kHz observed in production).
A hand clap's actual acoustic energy is often far shorter than 70ms, so a
loud, genuine clap dilutes to a frame-RMS below CLAP_THRESHOLD purely
depending on how much silence shares its block — same physical loudness,
different luck with block alignment.

test_dilution_regression_* below reproduces this numerically: a frame with
enough full-scale samples to be an unambiguous clap by ear, diluted by
silence to sit just under CLAP_THRESHOLD on RMS alone, while its peak stays
at 1.0. It documents why RMS-only detection misses it and proves the
peak-OR-rms fix (service/wake_trigger.py's ClapDetector.feed) catches it.
"""
from __future__ import annotations

import numpy as np
import pytest

from service.wake_trigger import (
    CLAP_GAP_MIN_S,
    CLAP_MAX_S,
    CLAP_PEAK_THRESHOLD,
    CLAP_THRESHOLD,
    DOUBLE_CLAP_WINDOW_S,
    ClapDetector,
)

FRAME_SAMPLES = 3072  # observed production callback block size (44.1kHz)


def _frame_rms_peak(arr: np.ndarray) -> tuple[float, float]:
    """Compute (rms, peak) exactly as service.wake_trigger's _callback does."""
    return float(np.sqrt(np.mean(arr ** 2))), float(np.max(np.abs(arr)))


def _diluted_clap(spike_samples: int, spike_amplitude: float = 1.0,
                   frame_samples: int = FRAME_SAMPLES) -> tuple[float, float]:
    """A `spike_samples`-long full-scale-ish impulse inside an otherwise-silent
    frame — models a real clap's transient landing partly (or briefly) inside
    one analysis block, diluted by the surrounding silence in the same block."""
    arr = np.zeros(frame_samples, dtype=np.float64)
    arr[:spike_samples] = spike_amplitude
    return _frame_rms_peak(arr)


def _make_detector() -> tuple[ClapDetector, list]:
    import threading
    event = threading.Event()
    det = ClapDetector(on_double_clap=event)
    return det, event


def _do_clap(det: ClapDetector, rms: float, peak: float, t0: float, dt: float = 0.0697) -> float:
    """Feed one clap-shaped burst (above-threshold frame sandwiched by silence)
    starting at t0. Returns the CLOSE time — the timestamp of the post-silence
    feed that actually closes the burst and (on the second clap) is compared
    against DOUBLE_CLAP_WINDOW_S. Callers computing an inter-clap gap must
    measure it close-to-close (see _next_clap_start), not call-to-call —
    each _do_clap call itself consumes 2*dt getting from its own start to its
    own close."""
    t = t0
    det.feed(0.0005, 0.001, t); t += dt          # pre-silence
    det.feed(rms, peak, t); t += dt              # the clap frame itself
    det.feed(0.0005, 0.001, t)                   # post-silence — closes the burst AT t
    return t


def _next_clap_start(prev_close: float, desired_gap: float, dt: float = 0.0697) -> float:
    """t0 for a second _do_clap call such that its CLOSE time is exactly
    prev_close + desired_gap (what DOUBLE_CLAP_WINDOW_S actually gates on)."""
    return prev_close + desired_gap - 2 * dt


# ── Regression: RMS-dilution miss, now caught by the peak OR-gate ──────────

def test_dilution_regression_rms_alone_would_miss_this_clap():
    """A ~0.68ms full-scale click inside a 69.7ms (3072-sample) frame is an
    unambiguous real clap (peak=1.0) but dilutes to rms just under
    CLAP_THRESHOLD — this is the exact failure mode found in production logs
    (peak=1.000000 snapshots that never opened a burst). Confirms the RMS
    gate alone would NOT have caught it, so the peak gate is load-bearing,
    not redundant."""
    rms, peak = _diluted_clap(spike_samples=30)
    assert rms < CLAP_THRESHOLD, (
        f"fixture invalid — expected RMS-diluted-below-threshold, got rms={rms:.4f}"
    )
    assert peak > CLAP_PEAK_THRESHOLD, (
        f"fixture invalid — expected peak above CLAP_PEAK_THRESHOLD, got peak={peak:.4f}"
    )


def test_dilution_regression_peak_gate_catches_it():
    """The same diluted-but-genuinely-loud clap, fed twice within the double-
    clap window, must fire wake — proving the fix, not just the fixture."""
    rms, peak = _diluted_clap(spike_samples=30)
    det, event = _make_detector()

    t = _do_clap(det, rms, peak, t0=0.0)
    gap = (CLAP_GAP_MIN_S + DOUBLE_CLAP_WINDOW_S) / 2
    _do_clap(det, rms, peak, t0=_next_clap_start(t, gap))

    assert event.is_set(), "diluted-but-loud double-clap must fire wake"


def test_dilution_regression_rms_only_gate_would_have_missed_it():
    """Sanity check on the OLD behavior: with peak forced to 0 (i.e. the
    pre-fix RMS-only gate), the same clap sequence must NOT fire — this is
    what made live claps intermittent before the fix."""
    rms, _peak = _diluted_clap(spike_samples=30)
    det, event = _make_detector()

    t = _do_clap(det, rms, 0.0, t0=0.0)   # peak=0.0 simulates "no peak gate"
    gap = (CLAP_GAP_MIN_S + DOUBLE_CLAP_WINDOW_S) / 2
    _do_clap(det, rms, 0.0, t0=_next_clap_start(t, gap))

    assert not event.is_set(), "RMS-only gate should miss this clap (documents the old bug)"


# ── Standard double-clap state machine (burst duration / gap / window) ─────

def test_valid_double_clap_fires():
    det, event = _make_detector()
    t = _do_clap(det, 0.5, 0.9, t0=0.0)
    gap = (CLAP_GAP_MIN_S + DOUBLE_CLAP_WINDOW_S) / 2
    _do_clap(det, 0.5, 0.9, t0=_next_clap_start(t, gap))
    assert event.is_set()


def test_single_clap_does_not_fire():
    det, event = _make_detector()
    _do_clap(det, 0.5, 0.9, t0=0.0)
    assert not event.is_set()


def test_claps_too_far_apart_do_not_fire():
    det, event = _make_detector()
    t = _do_clap(det, 0.5, 0.9, t0=0.0)
    _do_clap(det, 0.5, 0.9, t0=t + DOUBLE_CLAP_WINDOW_S + 0.5)
    assert not event.is_set()


def test_claps_too_close_together_do_not_fire():
    """Gap below CLAP_GAP_MIN_S — e.g. a single long clap misclassified as
    two — must not fire on the pair itself."""
    det, event = _make_detector()
    t = _do_clap(det, 0.5, 0.9, t0=0.0, dt=0.01)
    _do_clap(det, 0.5, 0.9, t0=_next_clap_start(t, CLAP_GAP_MIN_S / 2, dt=0.01), dt=0.01)
    assert not event.is_set()


def test_sustained_loud_burst_rejected_as_not_a_clap():
    """A burst held above threshold for longer than CLAP_MAX_S (e.g. loud
    sustained speech/music, not a clap) must be rejected outright — proves
    the peak-OR-rms fix did not turn sustained loud sound into a false clap."""
    det, event = _make_detector()
    dt = 0.0697
    t = 0.0
    det.feed(0.0005, 0.001, t); t += dt
    n_frames = int(CLAP_MAX_S / dt) + 5   # comfortably longer than CLAP_MAX_S
    for _ in range(n_frames):
        det.feed(0.5, 0.9, t); t += dt
    det.feed(0.0005, 0.001, t)            # closes the (too-long) burst AT t

    gap = (CLAP_GAP_MIN_S + DOUBLE_CLAP_WINDOW_S) / 2
    _do_clap(det, 0.5, 0.9, t0=_next_clap_start(t, gap))   # a real second clap afterward
    assert not event.is_set(), "sustained loud burst + one real clap must not equal a double-clap"


# ── Automated reliability suite (item 10: synthetic, no live mic needed) ───

# 20 representative valid double-claps, varying impulse duration (dilution
# severity), amplitude, and inter-clap gap across the accepted range.
_VALID_CLAP_PARAMS = [
    # (spike_samples, amplitude, gap_fraction_of_window)
    (30, 1.0, 0.10), (30, 1.0, 0.30), (30, 1.0, 0.50), (30, 1.0, 0.70), (30, 1.0, 0.90),
    (50, 0.9, 0.10), (50, 0.9, 0.30), (50, 0.9, 0.50), (50, 0.9, 0.70), (50, 0.9, 0.90),
    (100, 0.8, 0.10), (100, 0.8, 0.30), (100, 0.8, 0.50), (100, 0.8, 0.70), (100, 0.8, 0.90),
    (500, 0.6, 0.10), (500, 0.6, 0.30), (500, 0.6, 0.50), (500, 0.6, 0.70), (500, 0.6, 0.90),
]
assert len(_VALID_CLAP_PARAMS) == 20


@pytest.mark.parametrize("spike_samples,amplitude,gap_fraction", _VALID_CLAP_PARAMS)
def test_synthetic_valid_double_clap_detected(spike_samples, amplitude, gap_fraction):
    rms, peak = _diluted_clap(spike_samples=spike_samples, spike_amplitude=amplitude)
    det, event = _make_detector()
    gap = CLAP_GAP_MIN_S + gap_fraction * (DOUBLE_CLAP_WINDOW_S - CLAP_GAP_MIN_S)
    t = _do_clap(det, rms, peak, t0=0.0)
    _do_clap(det, rms, peak, t0=_next_clap_start(t, gap))
    assert event.is_set(), (
        f"missed synthetic clap: spike_samples={spike_samples} amplitude={amplitude} "
        f"gap={gap:.3f}s rms={rms:.4f} peak={peak:.4f}"
    )


def test_synthetic_valid_double_clap_20_of_20():
    """Aggregate acceptance count, matching the 20/20 acceptance criterion."""
    fired = 0
    for spike_samples, amplitude, gap_fraction in _VALID_CLAP_PARAMS:
        rms, peak = _diluted_clap(spike_samples=spike_samples, spike_amplitude=amplitude)
        det, event = _make_detector()
        gap = CLAP_GAP_MIN_S + gap_fraction * (DOUBLE_CLAP_WINDOW_S - CLAP_GAP_MIN_S)
        t = _do_clap(det, rms, peak, t0=0.0)
        _do_clap(det, rms, peak, t0=_next_clap_start(t, gap))
        fired += int(event.is_set())
    assert fired == 20, f"expected 20/20 synthetic double-claps detected, got {fired}/20"


# Representative ambient/noise samples — values are the ACTUAL measured
# session statistics from ~/Library/Logs/Merlin/service.log (2026-08-14/15):
# idle room rms~0.0003-0.001 peak~0.001-0.02; elevated speech/movement peak
# up to ~0.14 sustained; the highest non-clap 2s-window peak observed all
# session was 0.777 (treated here as a single spike, borderline case) with
# everything else under 0.36. None of these may produce a wake.
_AMBIENT_SAMPLES = [
    # (description, rms, peak, sustained_frames)
    ("idle_room", 0.0004, 0.003, 1),
    ("idle_room_loud_moment", 0.0009, 0.019, 1),
    ("quiet_speech", 0.004, 0.03, 20),
    ("moderate_speech", 0.008, 0.09, 20),
    ("loud_speech_movement", 0.013, 0.14, 20),
    ("single_loud_spike_under_gate", 0.03, 0.34, 1),  # just under CLAP_PEAK_THRESHOLD
    ("rare_loud_moment_sustained", 0.02, 0.777, 40),   # loud but NOT clap-shaped (sustained)
]


@pytest.mark.parametrize("desc,rms,peak,sustained_frames", _AMBIENT_SAMPLES)
def test_ambient_noise_never_fires_wake(desc, rms, peak, sustained_frames):
    det, event = _make_detector()
    dt = 0.0697
    t = 0.0
    det.feed(0.0004, 0.003, t); t += dt
    for _ in range(sustained_frames):
        det.feed(rms, peak, t); t += dt
    det.feed(0.0004, 0.003, t); t += dt
    assert not event.is_set(), f"false wake on ambient sample {desc!r} (rms={rms} peak={peak})"


def test_ambient_noise_0_false_wakes_across_all_samples():
    """Aggregate false-positive count, matching the 0-false-wakes criterion."""
    false_wakes = 0
    for desc, rms, peak, sustained_frames in _AMBIENT_SAMPLES:
        det, event = _make_detector()
        dt = 0.0697
        t = 0.0
        det.feed(0.0004, 0.003, t); t += dt
        for _ in range(sustained_frames):
            det.feed(rms, peak, t); t += dt
        det.feed(0.0004, 0.003, t); t += dt
        if event.is_set():
            false_wakes += 1
    assert false_wakes == 0, f"expected 0 false wakes, got {false_wakes}/{len(_AMBIENT_SAMPLES)}"
