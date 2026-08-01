"""Tests for _CommandCapture — what audio actually reaches STT.

The defect these pin (observed 2026-08-01, service.log 14:57:47): the callback
appended every frame unconditionally, so after a false start cleared `chunks`,
the ~6 s of silence before the real utterance was buffered anyway.  Whisper got
`dur=7.31s` containing `voiced=0.49s` and returned the garbled 'Maireni.'.

Unlike test_false_start_guard.py, which mirrors the decision rule, these drive
the real _CommandCapture object — the same one record_utterance uses.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest

sys.modules.setdefault("sounddevice", MagicMock())
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import service.merlin_service as merlin_service  # noqa: E402

SR       = 44_100
BLOCK    = 3072                  # what the Babyface delivers; ~69.7 ms
BLOCK_S  = BLOCK / SR
THRESH   = merlin_service.COMMAND_RMS_THRESHOLD if hasattr(
    merlin_service, "COMMAND_RMS_THRESHOLD") else merlin_service.SILENCE_RMS
MIN_SPEECH = merlin_service.COMMAND_MIN_SPEECH_S
PREROLL    = merlin_service.COMMAND_PREROLL_S

LOUD  = 0.02      # well above the 0.006 command gate
QUIET = 0.001     # the measured noise floor, well below it


def _cap(max_initial_silence=8.0):
    c = merlin_service._CommandCapture(
        threshold           = THRESH,
        min_speech_s        = MIN_SPEECH,
        silence_s           = merlin_service.SILENCE_S,
        max_record_s        = merlin_service.MAX_RECORD_S,
        max_initial_silence = max_initial_silence,
        sample_rate         = SR,
    )
    return c


class _Driver:
    """Feeds blocks and advances a synthetic clock, like PortAudio would."""

    def __init__(self, cap, t0=100.0):
        self.cap  = cap
        self.now  = t0
        self.t0   = t0
        self.seen = []

    def run(self, amplitude, blocks, stop_on=("done",)):
        for _ in range(blocks):
            blk   = np.full(BLOCK, amplitude, dtype=np.float32)
            rms   = float(np.sqrt(np.mean(blk ** 2)))
            state = self.cap.feed(blk, rms, self.now, self.now - self.t0)
            self.seen.append(state)
            self.now += BLOCK_S
            if state in stop_on:
                return state
        return self.seen[-1] if self.seen else None


def _leading_silence_s(audio):
    """Seconds of sub-threshold audio before the first voiced sample."""
    if audio.size == 0:
        return 0.0
    voiced = np.abs(audio) >= THRESH
    if not voiced.any():
        return audio.size / SR
    return int(np.argmax(voiced)) / SR


# --- 1. false start followed by silence ---------------------------------------

def test_false_start_then_silence_buffers_nothing():
    cap = _cap()
    d   = _Driver(cap)

    assert d.run(LOUD, 1) == "speech_start"
    assert d.run(QUIET, 20, stop_on=("false_start",)) == "false_start"

    # ...and then nothing but silence for six seconds
    d.run(QUIET, 90, stop_on=("speech_start", "done"))

    assert cap.false_starts == 1
    assert cap.speech_on is False
    assert cap.chunks == []
    assert cap.audio().size == 0
    # the pre-roll ring must stay bounded no matter how long the silence runs
    assert cap.preroll_samples <= PREROLL * SR + BLOCK


# --- 2. false start followed by real speech -----------------------------------

def test_false_start_then_real_speech_captures_only_the_speech():
    cap = _cap()
    d   = _Driver(cap)

    assert d.run(LOUD, 1) == "speech_start"
    assert d.run(QUIET, 20, stop_on=("false_start",)) == "false_start"
    d.run(QUIET, 86, stop_on=("speech_start",))          # ~6 s of quiet

    assert cap.chunks == [], "silence must not accumulate between captures"

    assert d.run(LOUD, 1) == "speech_start"
    d.run(LOUD, 20, stop_on=("done",))                    # ~1.4 s of speech
    assert d.run(QUIET, 20, stop_on=("done",)) == "done"

    audio = cap.audio()
    dur   = audio.size / SR

    assert cap.false_starts == 1
    # speech (~1.46 s) + pre-roll (≤0.30 s) + trailing silence (~0.84 s) ≈ 2.6 s.
    # The pre-fix behaviour buffered the 6 s gap too and produced ~7.3 s.
    assert dur < 3.5, f"capture carried dead air: {dur:.2f}s"
    assert dur > 1.4, f"capture lost real speech: {dur:.2f}s"
    voiced_s = float(np.count_nonzero(np.abs(audio) >= THRESH)) / SR
    assert voiced_s > MIN_SPEECH


def test_preroll_is_kept_so_the_first_phoneme_survives():
    """Requirement 2: the capture must start before the gate opened."""
    cap = _cap()
    d   = _Driver(cap)

    d.run(QUIET, 10)                       # fills the pre-roll ring
    assert d.run(LOUD, 1) == "speech_start"

    # one loud block is 3072 samples; the capture must hold more than that
    assert cap.audio().size > BLOCK, "pre-roll was not prepended"
    assert cap.audio().size <= BLOCK + PREROLL * SR + BLOCK


# --- 3. no long silent prefix in the final buffer ------------------------------

def test_no_long_silent_prefix_in_final_audio():
    cap = _cap()
    d   = _Driver(cap)

    assert d.run(LOUD, 1) == "speech_start"
    assert d.run(QUIET, 20, stop_on=("false_start",)) == "false_start"
    d.run(QUIET, 86, stop_on=("speech_start",))
    assert d.run(LOUD, 1) == "speech_start"
    d.run(LOUD, 20, stop_on=("done",))
    assert d.run(QUIET, 20, stop_on=("done",)) == "done"

    lead = _leading_silence_s(cap.audio())
    assert lead <= PREROLL + BLOCK_S, f"silent prefix {lead:.2f}s exceeds pre-roll"


def test_clean_capture_has_no_silent_prefix_beyond_preroll():
    """The same guarantee without any false start in the way."""
    cap = _cap()
    d   = _Driver(cap)

    d.run(QUIET, 40)                       # long wait before the user speaks
    assert d.run(LOUD, 1) == "speech_start"
    d.run(LOUD, 15, stop_on=("done",))
    assert d.run(QUIET, 20, stop_on=("done",)) == "done"

    lead = _leading_silence_s(cap.audio())
    assert lead <= PREROLL + BLOCK_S
    assert cap.audio().size / SR < 2.6


# --- fail-open behaviour is preserved -----------------------------------------

def test_unknown_sample_rate_never_false_starts():
    cap = merlin_service._CommandCapture(
        threshold           = THRESH,
        min_speech_s        = MIN_SPEECH,
        silence_s           = merlin_service.SILENCE_S,
        max_record_s        = merlin_service.MAX_RECORD_S,
        max_initial_silence = 8.0,
        sample_rate         = 0,          # stream has not reported yet
    )
    assert cap.voiced_s is None
    d = _Driver(cap)
    assert d.run(LOUD, 1) == "speech_start"
    assert d.run(QUIET, 20, stop_on=("done", "false_start")) == "done"
    assert cap.false_starts == 0


def test_discard_resets_every_piece_of_state():
    cap = _cap()
    d   = _Driver(cap)
    d.run(LOUD, 3)
    cap.discard()
    assert cap.chunks == []
    assert cap.preroll_samples == 0
    assert cap.speech_on is False
    assert cap.voiced_frames == 0
