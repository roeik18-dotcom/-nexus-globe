"""Unit tests for service.barge_detector.BargeInWindowDetector (PHASE 3 / PHASE 4).

All blocks are fixed-length numpy arrays; RMS of a constant-valued block equals
that constant, so tests can pass the desired RMS directly as the fill value —
no synthetic waveform generation needed.
"""

import numpy as np

from service.barge_detector import BargeInWindowDetector

THRESHOLD = 0.010
CONFIRM_FRAMES = 8
BLOCK = 320  # arbitrary fixed block length
_DEFAULT_SAMPLE_RATE = 48_000  # BargeInWindowDetector's own constructor default

# 2026-08-08: confirmation became TIME-based (accumulated `_run_seconds` vs
# `confirm_seconds`), replacing the old fixed callback-count trigger — see
# service/barge_detector.py's module docstring ("the old confirm_frames=8 ≈
# 160ms assumption... never fired on real ~350ms utterances"). These tests
# predate that change and still asserted against the removed frame-count
# trigger, so they failed against the current (intentional, hardware-evidence
# driven) behaviour without exercising any real bug. Fixed by deriving an
# explicit `confirm_seconds` from CONFIRM_FRAMES and the actual block
# duration at the sample rate each test uses, so "CONFIRM_FRAMES blocks"
# keeps meaning what these tests intend it to mean, through the real
# (time-based) mechanism instead of a no-longer-existent one. The `- 0.5`
# lands the boundary strictly between block N-1 and block N so confirmation
# fires on exactly the Nth block, matching the original assertions.
def _confirm_seconds_for(confirm_frames: int, *, sample_rate: int = _DEFAULT_SAMPLE_RATE, block: int = BLOCK) -> float:
    return (confirm_frames - 0.5) * (block / sample_rate)


CONFIRM_SECONDS = _confirm_seconds_for(CONFIRM_FRAMES)


def _block(rms: float) -> np.ndarray:
    return np.full(BLOCK, rms, dtype=np.float32)


def test_short_transient_does_not_confirm():
    """A click/cough: 2 blocks above threshold, then silence — must never confirm."""
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES)
    for _ in range(2):
        assert det.feed(_block(0.05), 0.05) is False
    for _ in range(20):
        assert det.feed(_block(0.0), 0.0) is False
    assert det.confirmed is False


def test_sustained_speech_confirms():
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES, confirm_seconds=CONFIRM_SECONDS)
    confirmed_at = None
    for i in range(CONFIRM_FRAMES + 2):
        if det.feed(_block(0.05), 0.05):
            confirmed_at = i
            break
    assert confirmed_at == CONFIRM_FRAMES - 1
    assert det.confirmed is True


def test_below_threshold_never_confirms_no_matter_how_long():
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES)
    for _ in range(500):
        assert det.feed(_block(0.001), 0.001) is False
    assert det.confirmed is False


def test_confirmed_chunks_include_preroll_onset():
    """Once confirmed, .chunks must include audio from BEFORE the gate opened —
    the interrupting utterance's onset must not be lost (PHASE 3/PHASE 9 test #7)."""
    _sr = BLOCK * 10
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES,
                                 preroll_s=0.02, sample_rate=_sr,  # ~0.2s preroll cap in blocks
                                 confirm_seconds=_confirm_seconds_for(CONFIRM_FRAMES, sample_rate=_sr))
    preroll_blocks = 3
    for _ in range(preroll_blocks):
        det.feed(_block(0.0), 0.0)  # silence, accumulates into the pre-roll ring
    for _ in range(CONFIRM_FRAMES):
        det.feed(_block(0.05), 0.05)
    assert det.confirmed is True
    assert len(det.chunks) > CONFIRM_FRAMES  # more than just the above-threshold run


def test_decay_tolerates_micro_pauses_between_syllables():
    """One below-threshold block between two above-threshold runs decays the
    count by 1 (not a hard reset to 0) — natural speech has micro-pauses
    between syllables/words that must not restart the whole confirm window."""
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES, confirm_seconds=CONFIRM_SECONDS)
    for _ in range(CONFIRM_FRAMES - 1):   # run_count -> 7
        det.feed(_block(0.05), 0.05)
    assert det.confirmed is False
    det.feed(_block(0.0), 0.0)            # micro-pause: run_count -> 6 (decay, not reset)
    assert det.confirmed is False
    assert det.feed(_block(0.05), 0.05) is False   # run_count -> 7
    assert det.feed(_block(0.05), 0.05) is True    # run_count -> 8: confirmed
    # A hard reset (0 after the dip) would have needed 8 more blocks here, not 2.


# ── 2026-08-08: dynamic-floor + correlation replacing the old scalar
# "must be louder than the speaker" echo_margin rule (live evidence: real
# speech at 0.011-0.028 RMS was rejected every time because it did not clear
# 1.5x the concurrent TTS output level). ──────────────────────────────────

def _sine(freq_cycles_over_block: float, amplitude: float, n: int = BLOCK) -> np.ndarray:
    t = np.arange(n, dtype=np.float64)
    return (amplitude * np.sin(2 * np.pi * freq_cycles_over_block * t / n)).astype(np.float32)


def test_correlated_leakage_never_confirms_even_when_above_threshold():
    """Mic block is a scaled COPY of the concurrent output (simulated speaker
    leakage) — RMS clears `threshold`, but correlation with the output
    reference must reject it, every block, forever."""
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES)
    output_block = _sine(4, 0.05)          # concurrent TTS output this callback
    leaked_mic = output_block * 0.8        # leakage: same waveform, scaled down
    leaked_rms = float(np.sqrt(np.mean(leaked_mic.astype(np.float64) ** 2)))
    output_rms = float(np.sqrt(np.mean(output_block.astype(np.float64) ** 2)))
    assert leaked_rms >= THRESHOLD  # would have passed a bare RMS-threshold check
    for _ in range(200):
        confirmed = det.feed(leaked_mic, leaked_rms, output_rms=output_rms, output_block=output_block)
        assert confirmed is False
    assert det.confirmed is False


def test_genuine_speech_quieter_than_tts_output_still_confirms():
    """Mic block is UNCORRELATED with the concurrent output and quieter than
    it (would have failed the old rms >= output_rms * 1.5 rule) — must still
    confirm once sustained. This is the exact live-reported failure mode:
    BARGE_SELECTED_RMS above threshold, but rejected only because it wasn't
    louder than Merlin's own voice."""
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES, confirm_seconds=CONFIRM_SECONDS)
    output_block = _sine(4, 0.05)                    # louder TTS output
    speech_block = _sine(17, 0.02)                   # different, quieter, near-orthogonal
    speech_rms = float(np.sqrt(np.mean(speech_block.astype(np.float64) ** 2)))
    output_rms = float(np.sqrt(np.mean(output_block.astype(np.float64) ** 2)))
    assert speech_rms < output_rms * 1.5  # would have failed the old echo_margin gate
    confirmed_at = None
    for i in range(CONFIRM_FRAMES + 2):
        if det.feed(speech_block, speech_rms, output_rms=output_rms, output_block=output_block):
            confirmed_at = i
            break
    assert confirmed_at == CONFIRM_FRAMES - 1
    assert det.confirmed is True


def test_silence_during_tts_does_not_falsely_barge():
    """No genuine near-field signal, TTS playing loudly — silence/room noise
    alone must never confirm (false-interrupt protection, spec TEST D)."""
    det = BargeInWindowDetector(threshold=THRESHOLD, confirm_frames=CONFIRM_FRAMES)
    output_block = _sine(4, 0.05)
    output_rms = float(np.sqrt(np.mean(output_block.astype(np.float64) ** 2)))
    quiet = _block(0.001)
    for _ in range(200):
        assert det.feed(quiet, 0.001, output_rms=output_rms, output_block=output_block) is False
    assert det.confirmed is False
