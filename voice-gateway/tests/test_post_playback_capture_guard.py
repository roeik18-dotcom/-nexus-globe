"""Post-playback / overlapping-TTS capture guard — the self-capture regression
guard for record_utterance()'s OWN VAD loop (service/merlin_service.py).

Live incident (2026-08-09): trace_id=T0007-barge transcribed Merlin's own
Day-Opening sentence ('לא מומצא תוכן כדי...') as candidate user speech. It was
only stopped by turn_guard's probabilistic STT-confidence rejection, not by
any structural guarantee — the exact class of gap this guard closes.

Root cause: _CommandCapture.feed() classified every block by RMS alone,
regardless of whether Merlin's own TTS was concurrently producing output.
Unlike service/barge_detector.py's duplex-callback path (which has the
concurrent output waveform for correlation), record_utterance's plain
InputStream callback has no such signal — but it DOES have something
better for this specific case: capture_guard.TtsState.is_active(), a
deterministic fact (we control our own playback via mark_started()/
mark_ended()), not an RMS guess or a hallucination heuristic.

Fix: _CommandCapture.feed(..., tts_active=...) rejects any block fed while
tts_active is True, BEFORE it can enter either `_preroll` or `chunks` — so it
can never leak into a later capture via the preroll-flush-on-speech path
(the same class of leak already closed in barge_detector.py's
_push_preroll(correlated=...)). No cooldown/delay is added: the very next
block, once tts_active is false again, is evaluated normally — real fast
user speech immediately after Merlin stops is not penalized.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np

sys.modules.setdefault("sounddevice", MagicMock())
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import service.merlin_service as merlin_service  # noqa: E402

SR      = 44_100
BLOCK   = 3072
BLOCK_S = BLOCK / SR

LOUD  = 0.05   # well above the command gate — Merlin's own voice is typically loud
QUIET = 0.001  # measured noise floor


def _cap(max_initial_silence=8.0):
    return merlin_service._CommandCapture(
        threshold           = merlin_service.COMMAND_RMS_THRESHOLD if hasattr(
            merlin_service, "COMMAND_RMS_THRESHOLD") else merlin_service.SILENCE_RMS,
        min_speech_s        = merlin_service.COMMAND_MIN_SPEECH_S,
        silence_s           = merlin_service.SILENCE_S,
        max_record_s        = merlin_service.MAX_RECORD_S,
        max_initial_silence = max_initial_silence,
        sample_rate         = SR,
    )


class _Driver:
    """Feeds blocks and advances a synthetic clock, like PortAudio would.

    Starts `now` past COMMAND_START_GUARD_S (0.35s) so the speech gate is
    actually eligible to open — mirrors real record_utterance() calls, which
    are always at least that far past t_start by the time meaningful speech
    arrives.
    """

    def __init__(self, cap, t0=100.0):
        self.cap = cap
        self.t0 = t0
        self.now = t0 + merlin_service.COMMAND_START_GUARD_S + 0.01

    def run(self, amplitude, blocks, *, tts_active=False, stop_on=("done",)):
        last = None
        for _ in range(blocks):
            blk = np.full(BLOCK, amplitude, dtype=np.float32)
            rms = float(np.sqrt(np.mean(blk ** 2)))
            last = self.cap.feed(blk, rms, self.now, self.now - self.t0, tts_active=tts_active)
            self.now += BLOCK_S
            if last in stop_on:
                return last
        return last


# --- A. output-active block never enters preroll or chunks --------------------

def test_output_active_block_rejected_before_speech_gate():
    cap = _cap()
    d = _Driver(cap)

    # Merlin's own (loud) output — arrives while tts_active=True.
    state = d.run(LOUD, 5, tts_active=True, stop_on=())
    assert state == "output_rejected"
    assert cap.chunks == []
    assert cap.preroll_samples == 0          # never entered the preroll ring either
    assert cap.speech_on is False
    assert cap.output_rejected_samples == 5 * BLOCK


def test_output_active_block_mid_recording_excluded_not_appended():
    """An overlapping turn's TTS starting mid-recording must not get spliced
    into the buffer that will be sent to STT."""
    cap = _cap()
    d = _Driver(cap)

    assert d.run(LOUD, 2, tts_active=False, stop_on=("speech_start", "recording")) in (
        "speech_start", "recording",
    )
    frames_before = sum(len(c) for c in cap.chunks)

    # A different/overlapping turn's TTS becomes active mid-utterance.
    assert d.run(LOUD, 3, tts_active=True, stop_on=("output_rejected",)) == "output_rejected"
    assert sum(len(c) for c in cap.chunks) == frames_before   # nothing appended

    # Real speech resumes once TTS stops.
    d.run(LOUD, 2, tts_active=False, stop_on=("recording",))
    assert sum(len(c) for c in cap.chunks) > frames_before


# --- B. real independent user speech immediately after playback is accepted ---

def test_real_user_speech_accepted_immediately_when_tts_not_active():
    """The guard adds zero delay once tts_active flips back to False — this is
    provenance discrimination, not a cooldown sleep."""
    cap = _cap()
    d = _Driver(cap)

    state = d.run(LOUD, 1, tts_active=False, stop_on=("speech_start",))
    assert state == "speech_start"
    assert cap.speech_on is True
    assert sum(len(c) for c in cap.chunks) == BLOCK
    assert cap.output_rejected_samples == 0
    assert cap.user_accepted_samples == BLOCK


# --- C. silence after playback produces no phantom STT turn -------------------

def test_silence_during_and_after_tts_active_never_opens_gate():
    cap = _cap(max_initial_silence=1.0)
    d = _Driver(cap)

    # Quiet blocks while Merlin is (notionally) still active, then quiet after.
    d.run(QUIET, 10, tts_active=True, stop_on=())
    d.run(QUIET, 10, tts_active=False, stop_on=())

    assert cap.speech_on is False
    assert cap.chunks == []
    assert cap.audio().size == 0            # nothing would ever reach STT


# --- D. existing barge-in prefill path is unaffected ---------------------------

def test_prefill_replay_default_not_rejected():
    """record_utterance's prefill-replay loop calls feed() without tts_active
    (defaults to False) — already-confirmed-clean barge/wake prefill audio
    must keep working exactly as before this guard existed.

    Prod feeds prefill chunks near-instantly after t_start (elapsed_s well
    under COMMAND_START_GUARD_S — see the `_t0 - t_start` call site), so they
    route through the preroll ring, not directly into `chunks` — exactly like
    a real wake/barge prefill. This guard must not reject them (tts_active
    defaults to False) and must not disturb that existing preroll-then-flush
    behavior.
    """
    cap = _cap()
    t0 = 100.0

    prefill_chunks = [np.full(BLOCK, LOUD, dtype=np.float32) for _ in range(3)]
    for chunk in prefill_chunks:
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        # elapsed_s=0.0, no tts_active kwarg — same call site as prod's
        # prefill-replay loop (`cap.feed(_chunk.copy(), _rms, _t0, _t0 - t_start)`)
        state = cap.feed(chunk, rms, t0, 0.0)
        assert state == "listening"
    assert cap.output_rejected_samples == 0
    assert cap.preroll_samples == 3 * BLOCK
    assert cap.chunks == []          # not flushed into chunks yet — still pending

    # First real post-prefill block (past the start guard) opens the gate and
    # flushes the prefill-derived preroll into chunks, unaffected by this fix.
    real_block = np.full(BLOCK, LOUD, dtype=np.float32)
    real_rms = float(np.sqrt(np.mean(real_block ** 2)))
    elapsed = merlin_service.COMMAND_START_GUARD_S + 0.01
    state = cap.feed(real_block, real_rms, t0 + elapsed, elapsed)
    assert state == "speech_start"
    assert sum(len(c) for c in cap.chunks) == 4 * BLOCK   # 3 prefill + 1 real
