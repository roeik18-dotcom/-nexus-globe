"""Post-barge continuation / phantom-STT structural rule.

Rule under test: a preserved barge prefill must NOT, by itself, authorize an STT
turn. Only after FRESH post-playback user speech crosses the normal VAD/false-
start gate (cap.speech_on) may the prefill be prepended and sent to STT.

These exercise the pure decision function `_resolve_post_barge_capture`, which is
exactly the boundary that used to leak Merlin's echo into the next transcript.
The `_CommandCapture` gate itself (fresh-speech confirmation) is covered by the
existing record_utterance command-capture tests; here we assume its `speech_on`
result and prove the prefill is honored/discarded correctly around it.
"""
import numpy as np

from service.merlin_service import _resolve_post_barge_capture, _CommandCapture


def _blk(v, n=256):
    return np.full(n, v, dtype=np.float32)


# A. prefill + NO fresh speech => no STT (None returned, prefill dropped)
def test_A_prefill_no_fresh_speech_blocks_stt():
    prefill = [_blk(0.4), _blk(0.4)]
    out, ev = _resolve_post_barge_capture(False, prefill, np.zeros(0, dtype=np.float32))
    assert out is None
    assert ev == "DISCARDED_NO_FRESH_SPEECH"


# B. prefill + fresh independent user speech => STT gets prefill ++ fresh audio
def test_B_prefill_plus_fresh_speech_attaches_both():
    prefill = [_blk(0.4, 100), _blk(0.5, 100)]     # 200 frames of interruption onset
    fresh = np.full(300, 0.6, dtype=np.float32)     # 300 frames captured live
    out, ev = _resolve_post_barge_capture(True, prefill, fresh)
    assert ev == "ATTACHED"
    assert out.shape[0] == 200 + 300               # both present, nothing dropped
    assert np.array_equal(out[:200], np.concatenate(prefill))   # prefill first
    assert np.array_equal(out[200:], fresh)                     # fresh after


# C. silence after barge => standby, zero phantom turn (same as A, explicit)
def test_C_silence_after_barge_returns_standby():
    out, ev = _resolve_post_barge_capture(False, [_blk(0.4)], np.zeros(0, dtype=np.float32))
    assert out is None and ev == "DISCARDED_NO_FRESH_SPEECH"


# D. genuine fast interruption onset preserved (prefix is exactly the prefill)
def test_D_fast_interruption_onset_preserved():
    onset = [_blk(0.45, 64)]                        # a very short onset fragment
    fresh = np.full(500, 0.5, dtype=np.float32)
    out, _ = _resolve_post_barge_capture(True, onset, fresh)
    assert np.array_equal(out[:64], onset[0])       # first phoneme survives
    assert out.shape[0] == 64 + 500


# E. normal NON-barge path unchanged: no prefill => audio returned verbatim
def test_E_non_barge_capture_unchanged():
    fresh = np.full(400, 0.5, dtype=np.float32)
    out, ev = _resolve_post_barge_capture(True, None, fresh)
    assert ev == "ATTACHED"
    assert np.array_equal(out, fresh)               # identical, no mutation
    # and _CommandCapture still opens its gate on genuine speech (device-free)
    cap = _CommandCapture(threshold=0.05, min_speech_s=0.0, silence_s=0.3,
                          max_record_s=10.0, max_initial_silence=5.0, sample_rate=16000)
    st = cap.feed(_blk(0.4), rms=0.4, now=1.0, elapsed_s=1.0)   # past start-guard
    assert st == "speech_start" and cap.speech_on is True


# F. existing barge STOP path untouched: this fix lives entirely after playback
#    termination (record_utterance), never in the detector/playback stop path.
def test_F_barge_stop_path_not_referenced_here():
    import inspect
    import service.barge_detector as bd
    # the fix must not have reached into the stop/confirm detector logic
    src = inspect.getsource(_resolve_post_barge_capture)
    assert "feed(" not in src and "BargeInWindowDetector" not in src
    # detector confirmation contract still present (stop path intact)
    assert hasattr(bd.BargeInWindowDetector, "feed")
