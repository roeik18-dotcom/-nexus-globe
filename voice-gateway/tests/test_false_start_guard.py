"""Tests for _CommandCapture — the command-path speech state machine.

Observed 2026-08-01 after the wake/command threshold split (service.log, PID
41280): turns triggered VAD at rms 0.0114–0.0138 — well clear of the 0.006 gate,
so not the noise floor — and closed at `total=0.84s` with 0.00 s of voiced audio,
shipping ~0.9 s of speaker bleed to Whisper as 'はい。' / '。'.  The guard discards
such a capture and keeps listening on the original initial-silence budget.

These drive the real class rather than a re-implementation of its rule, so a
change to the state machine cannot pass by leaving the test's copy untouched.

A 1000 Hz sample rate and 100-sample blocks make one block exactly 0.1 s, so
frame counts read directly as seconds.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np

# Stub sounddevice before importing the service module — CI may not have
# PortAudio, and a real import here would defeat the sys.modules.setdefault stub
# that test_clap_detection.py relies on.
sys.modules.setdefault("sounddevice", MagicMock())

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import service.merlin_service as merlin_service  # noqa: E402
from service.merlin_service import _CommandCapture  # noqa: E402

SR       = 1000
BLOCK    = 100          # 0.1 s per block
BLOCK_S  = BLOCK / SR
LOUD     = 0.05         # comfortably over the gate
QUIET    = 0.0001       # comfortably under it

QUIET_BLOCK = np.full(BLOCK, QUIET, dtype=np.float32)
LOUD_BLOCK  = np.full(BLOCK, LOUD, dtype=np.float32)


def _cap(**kw):
    opts = dict(
        threshold=0.006,
        min_speech_s=0.30,
        silence_s=0.8,
        max_record_s=30.0,
        max_initial_silence=8.0,
        preroll_s=0.30,
        sample_rate=SR,
    )
    opts.update(kw)
    return _CommandCapture(**opts)


def _feed(cap, block, rms, t, elapsed=None):
    return cap.feed(block, rms, t, elapsed if elapsed is not None else t)


# --- the constant ------------------------------------------------------------

def test_min_speech_constant_is_sane():
    assert 0.0 < merlin_service.COMMAND_MIN_SPEECH_S < 1.0


# --- basic states -------------------------------------------------------------

def test_silence_stays_listening_and_buffers_nothing():
    cap = _cap()
    for i in range(5):
        assert _feed(cap, QUIET_BLOCK, QUIET, i * BLOCK_S) == "listening"
    assert cap.chunks == []
    assert cap.audio().size == 0


def test_gate_opening_flushes_preroll_so_first_phoneme_survives():
    cap = _cap()
    _feed(cap, QUIET_BLOCK, QUIET, 0.0)
    _feed(cap, QUIET_BLOCK, QUIET, 0.1)
    assert _feed(cap, LOUD_BLOCK, LOUD, 0.2) == "speech_start"
    # two pre-roll blocks + the triggering block
    assert cap.audio().size == 3 * BLOCK


def test_preroll_ring_is_bounded():
    """A long silence must not grow the buffer — that is what the ring is for."""
    cap = _cap()
    for i in range(100):                       # 10 s of quiet
        _feed(cap, QUIET_BLOCK, QUIET, i * BLOCK_S)
    assert cap.preroll_samples <= int(cap.preroll_s * SR) + BLOCK


def test_sustained_speech_records_then_completes():
    cap = _cap()
    t = 0.0
    assert _feed(cap, LOUD_BLOCK, LOUD, t) == "speech_start"
    for _ in range(8):                          # 0.8 s of voiced audio
        t += BLOCK_S
        assert _feed(cap, LOUD_BLOCK, LOUD, t) == "recording"
    t += 0.9                                    # trailing silence closes it
    assert _feed(cap, QUIET_BLOCK, QUIET, t) == "done"
    assert cap.voiced_s >= merlin_service.COMMAND_MIN_SPEECH_S
    assert cap.false_starts == 0


# --- the observed failure ------------------------------------------------------

def test_brief_transient_is_a_false_start():
    """One loud block then quiet — the 2026-08-01 bleed signature."""
    cap = _cap()
    assert _feed(cap, LOUD_BLOCK, LOUD, 0.0) == "speech_start"
    assert _feed(cap, QUIET_BLOCK, QUIET, 0.9) == "false_start"
    assert cap.false_starts == 1


def test_false_start_discards_the_buffer():
    cap = _cap()
    _feed(cap, LOUD_BLOCK, LOUD, 0.0)
    _feed(cap, QUIET_BLOCK, QUIET, 0.9)
    assert cap.audio().size == 0
    assert cap.preroll_samples == 0
    assert cap.speech_on is False
    assert cap.voiced_s == 0.0


def test_silence_after_a_false_start_cannot_pad_the_next_capture():
    """The rule the class docstring exists to enforce.

    A false start followed by six seconds of quiet, then real speech: the capture
    must hold the pre-roll plus the speech, never the intervening silence.
    """
    cap = _cap()
    _feed(cap, LOUD_BLOCK, LOUD, 0.0)
    _feed(cap, QUIET_BLOCK, QUIET, 0.9)          # false start
    t = 1.0
    for _ in range(60):                          # 6 s of quiet
        _feed(cap, QUIET_BLOCK, QUIET, t)
        t += BLOCK_S
    assert _feed(cap, LOUD_BLOCK, LOUD, t) == "speech_start"
    for _ in range(5):
        t += BLOCK_S
        _feed(cap, LOUD_BLOCK, LOUD, t)
    # pre-roll is capped at 0.30 s → at most 3 lead-in blocks + 6 voiced blocks
    assert cap.audio().size <= (3 + 6) * BLOCK


def test_false_start_then_real_speech_still_completes():
    cap = _cap()
    _feed(cap, LOUD_BLOCK, LOUD, 0.0)
    _feed(cap, QUIET_BLOCK, QUIET, 0.9)          # false start
    t = 1.0
    assert _feed(cap, LOUD_BLOCK, LOUD, t) == "speech_start"
    for _ in range(8):
        t += BLOCK_S
        _feed(cap, LOUD_BLOCK, LOUD, t)
    t += 0.9
    assert _feed(cap, QUIET_BLOCK, QUIET, t) == "done"
    assert cap.false_starts == 1
    assert cap.audio().size > 0


# --- fail-open guarantees ------------------------------------------------------

def test_unknown_sample_rate_fails_open():
    """Before the stream reports its rate, behaviour must be unchanged."""
    cap = _cap(sample_rate=0)
    assert cap.voiced_s is None
    _feed(cap, LOUD_BLOCK, LOUD, 0.0)
    assert _feed(cap, QUIET_BLOCK, QUIET, 0.9) == "done"
    assert cap.false_starts == 0


def test_spent_budget_fails_open():
    """Past max_initial_silence there is no budget left to keep listening."""
    cap = _cap()
    _feed(cap, LOUD_BLOCK, LOUD, 0.0, elapsed=7.0)
    assert _feed(cap, QUIET_BLOCK, QUIET, 0.9, elapsed=8.5) == "done"
    assert cap.false_starts == 0


def test_no_initial_silence_budget_fails_open():
    """Follow-up turns without a budget must not loop forever."""
    cap = _cap(max_initial_silence=None)
    _feed(cap, LOUD_BLOCK, LOUD, 0.0)
    assert _feed(cap, QUIET_BLOCK, QUIET, 0.9) == "done"
    assert cap.false_starts == 0


def test_hard_record_cap_is_never_discarded():
    """At max_record_s the capture is returned regardless of voiced content."""
    cap = _cap(max_record_s=1.0)
    _feed(cap, LOUD_BLOCK, LOUD, 0.0)
    assert _feed(cap, QUIET_BLOCK, QUIET, 1.5) == "done"
    assert cap.false_starts == 0
