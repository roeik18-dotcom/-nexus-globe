"""
Wake-lane admission control — keeps the single Whisper inference lane fed with
FRESH, PLAUSIBLE wake candidates instead of a stale backlog.

WHY (measured, service.log 2026-08-01 → 2026-08-02, not a design hunch):
  • 6 820 VAD flushes were produced; only 500 ever reached Whisper.
  • The other 93 % died in bulk queue purges: an unbounded `queue.Queue` absorbed
    every ambient utterance in the room, the serialized network lane fell behind,
    OpenAI rate-limited it (670 transcription retries), the 3-consecutive-error
    backstop tripped 112 times, and each trip DROPPED THE WHOLE QUEUE.
  • Of the 500 that did get through, 456 matched the wake word. The recogniser is
    not the problem — starvation is. 2026-08-02 ended with 15 wake matches.
  • One flush reported speech_duration=795 s: continuous above-threshold input
    never leaves the `_in_speech` branch, so its buffer grew without bound.

THREE MECHANISMS, all local, no new dependencies, no model change:

  1. LEADING WINDOW — a wake word only ever occurs at the START of a wake
     utterance, so only the first `WAKE_WINDOW_S` is worth transcribing. Bounds
     every request's payload regardless of how long the speaker ran on, and keeps
     recall for "מרלין, do X" said in one breath (measured hits reach 158 s).
  2. DROP-OLDEST QUEUE — a shallow queue that evicts the OLDEST pending
     utterance. Under load the lane now serves the most recent speech; it can no
     longer accumulate a backlog that goes stale and gets purged wholesale.
  3. MIN DURATION — utterances below `MIN_CANDIDATE_S` cannot contain the keyword
     (shortest measured hit: 0.91 s) and are not worth a network round-trip.

Everything here is pure and injectable so it is testable without a microphone,
a network, or the audio stack.
"""
from __future__ import annotations

import queue
import threading
from dataclasses import dataclass

import numpy as np

# ── Tunables ─────────────────────────────────────────────────────────────────
# Only the leading part of an utterance can hold the wake word. p50 of measured
# wake hits is 1.46 s; 2.5 s leaves margin for a slow "מרלין" plus the pre-roll.
WAKE_WINDOW_S: float = 2.5

# Shortest measured wake hit was 0.91 s. 0.45 s keeps a wide safety margin while
# still rejecting the sub-half-second bursts a marginal mic fragments into.
MIN_CANDIDATE_S: float = 0.45

# Pending utterances allowed to wait for the lane. Deliberately shallow: with a
# ~1-2 s round-trip, anything deeper is already stale by the time it is served.
MAX_PENDING: int = 2


@dataclass(frozen=True)
class Admission:
    """Outcome of the pre-network gate for one flushed utterance."""

    admit: bool
    reason: str            # admit | too_short
    duration_s: float      # duration of the ORIGINAL utterance
    sent_s: float          # duration actually forwarded (after the leading window)
    truncated: bool


def leading_window(audio: np.ndarray, sample_rate: int, window_s: float = WAKE_WINDOW_S) -> np.ndarray:
    """Return at most the first `window_s` of `audio`.

    Returns the array unchanged when it is already short enough, so the common
    case does not copy. A non-positive `window_s` or `sample_rate` disables
    truncation rather than emptying the buffer — never silently drop all audio.
    """
    if window_s <= 0 or sample_rate <= 0:
        return audio
    limit = int(sample_rate * window_s)
    if limit <= 0 or len(audio) <= limit:
        return audio
    return audio[:limit]


def admit(
    audio: np.ndarray,
    sample_rate: int,
    *,
    window_s: float = WAKE_WINDOW_S,
    min_s: float = MIN_CANDIDATE_S,
) -> tuple[np.ndarray, Admission]:
    """Decide whether `audio` is worth one Whisper call, and trim it if so.

    Returns `(payload, decision)`. When `decision.admit` is False the payload is
    the (unused) original — callers must check `admit` and skip the network.
    """
    duration_s = len(audio) / sample_rate if sample_rate > 0 else 0.0
    if duration_s < min_s:
        return audio, Admission(False, "too_short", duration_s, 0.0, False)

    payload = leading_window(audio, sample_rate, window_s)
    sent_s = len(payload) / sample_rate if sample_rate > 0 else 0.0
    return payload, Admission(True, "admit", duration_s, sent_s, len(payload) < len(audio))


class DropOldestQueue:
    """A bounded queue that evicts the OLDEST item when full.

    `queue.Queue(maxsize=n)` blocks the producer instead — unacceptable here, the
    producer is the PortAudio callback thread and must never block. Dropping the
    oldest keeps the inference lane serving the freshest speech, which is the one
    the user is most likely waiting on.

    `drops` counts evictions so the caller can report starvation honestly.
    """

    def __init__(self, maxsize: int = MAX_PENDING) -> None:
        self._q: queue.Queue = queue.Queue()
        self._maxsize = max(1, maxsize)
        self._lock = threading.Lock()
        self.drops = 0

    def put(self, item) -> int:
        """Enqueue `item`, evicting oldest entries past the cap. Returns how many
        were dropped by THIS call (0 in the healthy case). Never blocks."""
        dropped = 0
        with self._lock:
            self._q.put(item)
            while self._q.qsize() > self._maxsize:
                try:
                    self._q.get_nowait()
                except queue.Empty:  # pragma: no cover - drained concurrently
                    break
                dropped += 1
                self.drops += 1
        return dropped

    def get(self):
        """Block until an item is available (the inference thread's wait point)."""
        return self._q.get()

    def get_nowait(self):
        """Non-blocking pop; raises `queue.Empty` when nothing is pending.

        Used by the inference backstop's post-backoff drain. With a bounded queue
        that drain is now near-trivial (at most `maxsize` items) rather than the
        wholesale purge of thousands that starved the lane.
        """
        return self._q.get_nowait()

    def qsize(self) -> int:
        return self._q.qsize()
