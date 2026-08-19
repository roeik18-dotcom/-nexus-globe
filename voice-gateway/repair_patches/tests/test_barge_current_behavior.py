"""Barge-in TIME-BASED confirmation tests (against the real on-disk detector).

Proves the turn_id=22 fix: confirmation is ~200 ms of real voiced audio, computed
from frames/samplerate, INDEPENDENT of callback block size — not a fixed 8-block count
(which at 3072 frames @ 44100 Hz = 69.66 ms/block wrongly needed ~557 ms).

Run: cd voice-gateway && .venv/bin/python -m pytest repair_patches/tests/test_barge_current_behavior.py -q
"""
import json
import pathlib
import numpy as np

from service.barge_detector import BargeInWindowDetector

CONFIRM_S = 0.20


def _noise(frames, rms, seed):
    rng = np.random.default_rng(seed)
    x = rng.standard_normal(frames).astype(np.float32)
    x *= rms / (np.sqrt(np.mean(x**2)) + 1e-12)
    return x


def _rms(x):
    return float(np.sqrt(np.mean(x.astype(np.float32) ** 2)))


def _det(sr):
    d = BargeInWindowDetector(threshold=0.010, confirm_frames=8, confirm_seconds=CONFIRM_S, sample_rate=sr)
    return d


def _feed_speech(d, sr, frames, n_blocks, seed0=0):
    """Feed n_blocks of independent above-floor speech; return block index that confirmed (or None)."""
    for i in range(n_blocks):
        blk = _noise(frames, 0.12, seed0 + i)
        if d.feed(blk, _rms(blk)):
            return i
    return None


def test_1_confirmation_is_about_200ms_regardless_of_block_size():
    # 10ms blocks @48k and 69.66ms blocks @44100 must both confirm at ~0.2s of speech.
    for sr, frames in [(48_000, 480), (44_100, 3072), (16_000, 512)]:
        d = _det(sr)
        idx = _feed_speech(d, sr, frames, n_blocks=200, seed0=sr)
        assert idx is not None, (sr, frames)
        confirmed_s = (idx + 1) * frames / sr
        # within one block of the 200ms target
        assert CONFIRM_S <= confirmed_s <= CONFIRM_S + frames / sr + 1e-6, (sr, frames, confirmed_s)


def test_2_3072_at_44100_interrupts_near_200ms_not_557ms():
    sr, frames = 44_100, 3072
    d = _det(sr)
    idx = _feed_speech(d, sr, frames, n_blocks=50, seed0=42)
    confirmed_s = (idx + 1) * frames / sr
    assert idx is not None
    assert confirmed_s < 0.30, confirmed_s          # not the old ~0.557 s
    assert confirmed_s >= 0.20                        # met the intended duration


def test_3_short_transient_click_does_not_interrupt():
    sr, frames = 44_100, 3072
    d = _det(sr)
    loud = _noise(frames, 0.2, 7)                      # one ~70ms loud block
    assert d.feed(loud, _rms(loud)) is False          # < 200ms → no trigger
    for s in range(6):                                 # decays back down
        q = _noise(frames, 0.002, 700 + s)
        d.feed(q, _rms(q))
    assert d.confirmed is False


def test_4_self_echo_correlated_output_never_confirms():
    sr, frames = 44_100, 3072
    d = _det(sr)
    for i in range(50):
        out = _noise(frames, 0.2, 800 + i)
        mic = (0.6 * out).astype(np.float32)          # loud but correlated leakage
        d.feed(mic, _rms(mic), output_rms=_rms(out), output_block=out)
    assert d.confirmed is False


def test_5_prefill_onset_preserved_after_confirm():
    sr, frames = 44_100, 3072
    d = _det(sr)
    _feed_speech(d, sr, frames, n_blocks=50, seed0=900)
    assert d.confirmed is True
    assert len(d.chunks) >= 1                          # onset chunks retained for command prefill


def test_6_config_and_runtime_report_interruptions_consistently():
    vg = pathlib.Path(__file__).resolve().parents[2]
    cfg = json.loads((vg / "config" / "merlin_control.json").read_text(encoding="utf-8"))
    assert cfg["turn_control"]["interruptions_enabled"] is True
    src = (vg / "service" / "merlin_service.py").read_text(encoding="utf-8")
    assert "BARGE_IN_ENABLED = True" in src            # config now matches live capability
