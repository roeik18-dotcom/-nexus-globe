"""Bounded acoustic-lag leakage rejection (2026-08-10) — the Day-Opening
self-barge fix. Delayed speaker->mic leakage defeats zero-lag correlation but is
caught by the bounded lag search; independent user speech is NOT false-caught, so
real barge-in is preserved.
"""
import numpy as np

from service.barge_detector import BargeInWindowDetector, CORRELATION_THRESHOLD

SR = 48_000
N = 3072                                  # ~64 ms duplex block


def sig(seed, amp=0.3):
    """Speech-like band-limited signal; different seeds are independent."""
    rng = np.random.default_rng(seed)
    x = np.convolve(rng.standard_normal(N + 40), np.ones(40) / 40, mode="same")[:N]
    return (x / (np.abs(x).max() + 1e-9) * amp).astype(np.float32)


def delayed_leak(out, lag_samples, atten=0.12, noise=0.002, seed=7):
    rng = np.random.default_rng(seed)
    d = np.concatenate([np.zeros(lag_samples, dtype=np.float32), out])[:N]
    return (atten * d + noise * rng.standard_normal(N)).astype(np.float32)


def rms(x):
    return float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))


def _det():
    return BargeInWindowDetector(threshold=0.004, confirm_frames=4, confirm_seconds=0.20, sample_rate=SR)


def test_delayed_leakage_rejected_by_maxlag_but_missed_by_zerolag():
    out = sig(1)
    leak = delayed_leak(out, int(0.010 * SR))          # 10 ms acoustic delay
    d = _det()
    for _ in range(4):                                  # prime the bounded output history
        d.feed(leak, rms(leak), output_rms=rms(out), output_block=out)
    assert d.last_reject_reason == "correlated_with_output"     # rejected as leakage
    assert abs(d.last_correlation) >= CORRELATION_THRESHOLD      # max-lag caught it
    assert abs(d.last_correlation_zero) < CORRELATION_THRESHOLD  # zero-lag would have MISSED it
    assert d.last_correlation_lag_ms > 0.0                       # non-zero acoustic lag


def test_independent_speech_over_output_is_accepted():
    out = sig(1)
    user = (0.12 * sig(99)).astype(np.float32)          # independent utterance
    d = _det()
    for _ in range(4):                                  # prime history with the output
        d.feed(user, rms(user), output_rms=rms(out), output_block=out)
    assert d.last_reject_reason is None                         # accepted as speech
    assert abs(d.last_correlation) < CORRELATION_THRESHOLD       # NOT false-caught


def test_sustained_delayed_leakage_never_self_confirms():
    out = sig(1)
    d = _det()
    confirmed = False
    for k in range(25):
        leak = delayed_leak(out, int(0.010 * SR), seed=100 + k)
        if d.feed(leak, rms(leak), output_rms=rms(out), output_block=out):
            confirmed = True
            break
    assert confirmed is False                                    # SELF-BARGE eliminated


def test_real_user_speech_still_confirms_barge_over_playback():
    out = sig(1)
    d = _det()
    confirmed = False
    for k in range(10):
        user = (0.15 * sig(1000 + k)).astype(np.float32)         # sustained independent speech
        if d.feed(user, rms(user), output_rms=rms(out), output_block=out):
            confirmed = True
            break
    assert confirmed is True                                     # real barge-in preserved


# ── reverb-tail gate (2026-08-10 self-barge fix) ─────────────────────────────

def test_reverb_tail_after_output_rejected_within_bounded_window():
    out = sig(1)
    d = _det()
    for _ in range(6):                                   # active LOUD output, AEC-clean quiet mic
        d.feed((0.001 * sig(50)).astype(np.float32), 0.001, output_rms=rms(out), output_block=out)
    tail = (0.08 * sig(7)).astype(np.float32)            # mic tail ~0.008 in the gap right after
    # Inside REVERB_TAIL_MS (~300 ms ≈ the first few duplex blocks after output
    # drops to near-silent) the tail is rejected as Merlin's own decay and never
    # confirms. The gate is BOUNDED on purpose — sustained energy BEYOND the
    # window is (correctly) treated as real, left to the energy/correlation gates.
    for _ in range(3):
        got = d.feed(tail, rms(tail), output_rms=0.0005, output_block=np.zeros(N, dtype=np.float32))
        assert got is False
        assert d.last_reject_reason == "reverb_tail"     # SELF-BARGE from reverb tail eliminated


def test_user_speech_during_active_output_not_reverb_gated():
    out = sig(1)
    d = _det()
    for _ in range(6):
        d.feed(np.zeros(N, dtype=np.float32), 0.0, output_rms=rms(out), output_block=out)
    user = (0.15 * sig(999)).astype(np.float32)          # user over LOUD output
    d.feed(user, rms(user), output_rms=rms(out), output_block=out)
    assert d.last_reject_reason is None                  # accepted — reverb gate needs QUIET current output


def test_user_speech_during_genuine_silence_accepted():
    d = _det()
    user = (0.15 * sig(999)).astype(np.float32)          # Merlin silent, no recent output
    d.feed(user, rms(user), output_rms=0.0, output_block=np.zeros(N, dtype=np.float32))
    assert d.last_reject_reason != "reverb_tail"


# ── user TEST-FIRST list: coverage the above suites did not yet assert ────────

def test_delay_spanning_callback_boundary_rejected():
    """Leakage delayed ~90 ms — MORE than one 64 ms duplex block, so the aligned
    output lives in a PREVIOUS callback and ONLY the cross-boundary output
    history can recover it. Zero-lag and single-block correlation both miss it."""
    rng = np.random.default_rng(3)
    long_out = np.convolve(rng.standard_normal(N * 5 + 40), np.ones(40) / 40, mode="same")[:N * 5]
    long_out = (long_out / (np.abs(long_out).max() + 1e-9) * 0.3).astype(np.float32)
    blocks = [long_out[i * N:(i + 1) * N] for i in range(5)]
    lag = int(0.090 * SR)                                # 90 ms > 64 ms block
    d = _det()
    for b in blocks[:3]:                                 # prime history with CONTINUOUS output
        d.feed((0.001 * sig(9)).astype(np.float32), 0.001, output_rms=rms(b), output_block=b)
    cur = blocks[3]
    seg = long_out[3 * N - lag: 3 * N - lag + N]         # output 90 ms before the current block
    leak = (0.12 * seg + 0.002 * rng.standard_normal(N)).astype(np.float32)
    d.feed(leak, rms(leak), output_rms=rms(cur), output_block=cur)
    assert d.last_reject_reason == "correlated_with_output"
    assert d.last_correlation_lag_ms >= 60.0             # matched a PREVIOUS block (spans the boundary)


def test_unrelated_sinusoid_not_falsely_rejected_by_partial_window():
    """The partial-window regression (requirement #3): a narrowband tone could
    spuriously self-correlate at large lags on a SHRINKING window. Full-length
    history windows must keep an independent tone's correlation low -> accepted."""
    t = np.arange(N) / SR
    out = (0.30 * np.sin(2 * np.pi * 300.0 * t)).astype(np.float32)   # 300 Hz output
    mic = (0.15 * np.sin(2 * np.pi * 440.0 * t)).astype(np.float32)   # independent 440 Hz
    d = _det()
    for _ in range(3):                                   # prime full-length history
        d.feed((0.001 * sig(1)).astype(np.float32), 0.001, output_rms=rms(out), output_block=out)
    d.feed(mic, rms(mic), output_rms=rms(out), output_block=out)
    assert d.last_reject_reason is None                  # NOT rejected as leakage
    assert abs(d.last_correlation) < CORRELATION_THRESHOLD


def test_low_energy_genuine_speech_confirms_over_playback():
    """Quiet real speech (mic ~0.006, in the 0.004-0.008 band the user must be
    able to interrupt at) over loud playback still confirms — the fix must not
    raise the effective bar for genuine quiet speech."""
    out = sig(1)
    d = _det()
    confirmed = False
    for k in range(6):
        q = (0.05 * sig(2000 + k)).astype(np.float32)    # rms ~0.006 (independent of output)
        assert 0.004 <= rms(q) <= 0.009                  # in-band by construction
        if d.feed(q, rms(q), output_rms=rms(out), output_block=out):
            confirmed = True
            break
    assert confirmed is True


def test_single_block_transient_does_not_confirm():
    """A one-block click/cough spikes then decays; it can never accumulate the
    0.20 s of continuous voiced energy required to confirm."""
    out = sig(1)
    d = _det()
    confirmed = False
    for k in range(10):
        blk = (0.20 * sig(77)) if k == 3 else (0.0005 * sig(k))   # single loud click at k=3
        blk = blk.astype(np.float32)
        if d.feed(blk, rms(blk), output_rms=rms(out), output_block=out):
            confirmed = True
            break
    assert confirmed is False
