"""Barge-in prefill purity — the echo -> phantom-STT regression guard.

Invariant: the prefill handed to the next record_utterance() after a confirmed
barge-in contains USER-mic-eligible frames ONLY. Blocks the detector rejected
as `correlated_with_output` (Merlin's own playback leaking into the mic) must
never be reintroduced into detector.chunks at confirmation.

Before the fix, confirmation did `self.chunks = list(self._preroll) + self.chunks`
and `_preroll` held every rejected block, INCLUDING the correlated ones — so
Merlin's echo was forwarded as the next user turn's prefill.
"""
import numpy as np

from service.barge_detector import BargeInWindowDetector


SR = 16_000
BLK = 512  # 0.032 s per block


def _sine(freq: float, amp: float, n: int = BLK) -> np.ndarray:
    return (np.sin(2 * np.pi * freq * np.linspace(0, 1, n, endpoint=False)) * amp).astype(np.float32)


def _contains_block(chunks, target) -> bool:
    return any(c.shape == target.shape and np.array_equal(c, target) for c in chunks)


def _fresh_detector():
    # confirm after ~0.05 s of sustained user speech (2 blocks of 0.032 s).
    return BargeInWindowDetector(
        threshold=0.01, confirm_frames=1, confirm_seconds=0.05,
        sample_rate=SR, preroll_s=0.30,
    )


def test_output_correlated_frames_never_reach_prefill():
    d = _fresh_detector()
    merlin = _sine(3.0, 1.0)           # loud, identical to the output reference

    # 1) Several output-correlated (Merlin leakage) blocks — must be rejected
    #    and DROPPED, never buffered for prefill.
    for _ in range(4):
        assert d.feed(merlin.copy(), rms=0.707, output_rms=0.707,
                      output_block=merlin.copy()) is False
    assert d.last_reject_reason == "correlated_with_output"
    assert d._preroll_dropped_correlated_samples == 4 * BLK
    assert d._preroll_user_samples == 0           # nothing user-eligible yet

    # 2) Genuine user speech (uncorrelated; Merlin now silent) to confirm.
    user1 = _sine(7.0, 0.30)
    user2 = _sine(11.0, 0.30)
    assert d.feed(user1.copy(), rms=0.30, output_rms=0.0) is False   # run building
    confirmed = d.feed(user2.copy(), rms=0.30, output_rms=0.0)       # crosses 0.05 s
    assert confirmed is True and d.confirmed is True

    # Acceptance -----------------------------------------------------------
    # correlated Merlin frames absent from the forwarded prefill
    assert not _contains_block(d.chunks, merlin), "Merlin-output frame leaked into prefill"
    # genuine user onset preserved
    assert _contains_block(d.chunks, user1), "user onset lost from prefill"
    # zero contamination by the detector's own accounting
    assert d._correlated_appended == 0
    # final prefill is exactly the two clean user run blocks (no preroll junk here)
    assert sum(len(c) for c in d.chunks) == 2 * BLK


def test_clean_user_onset_preroll_is_preserved():
    """Non-correlated below-floor onset ramp (the start of the interruption,
    just before it crosses threshold) IS kept and prepended — we do not throw
    the whole preroll away."""
    d = _fresh_detector()
    onset = _sine(6.0, 0.005)          # below threshold -> rejected below_floor, NOT correlated

    d.feed(onset.copy(), rms=0.005, output_rms=0.0)   # -> user_preroll
    assert d._preroll_user_samples == BLK
    assert d._preroll_dropped_correlated_samples == 0

    user1 = _sine(7.0, 0.30)
    user2 = _sine(11.0, 0.30)
    d.feed(user1.copy(), rms=0.30, output_rms=0.0)
    assert d.feed(user2.copy(), rms=0.30, output_rms=0.0) is True
    # onset preroll prepended before the run
    assert _contains_block(d.chunks, onset)
    assert _contains_block(d.chunks, user1)


def test_normal_barge_still_confirms_no_regression():
    """No correlated blocks at all — ordinary interruption must still confirm."""
    d = _fresh_detector()
    a = _sine(7.0, 0.30)
    b = _sine(9.0, 0.30)
    assert d.feed(a.copy(), rms=0.30, output_rms=0.0) is False
    assert d.feed(b.copy(), rms=0.30, output_rms=0.0) is True
    assert d.confirmed is True
    assert d._correlated_appended == 0
