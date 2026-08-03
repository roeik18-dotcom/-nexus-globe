"""Wake-lane admission control.

These tests encode the failure measured in service.log on 2026-08-01/02: 6 820
VAD flushes produced, 500 reaching Whisper, 456 of those matching the keyword.
The lane was starved by an unbounded queue, not by a weak recogniser.
"""
from __future__ import annotations

import queue

import numpy as np
import pytest

from service.wake_gate import (
    MAX_PENDING,
    Admission,
    DropOldestQueue,
    admit,
    leading_window,
)

SR = 16_000


def _audio(seconds: float) -> np.ndarray:
    return np.zeros(int(SR * seconds), dtype=np.float32)


# ── leading_window ───────────────────────────────────────────────────────────

def test_leading_window_truncates_long_audio():
    out = leading_window(_audio(10.0), SR, window_s=2.5)
    assert len(out) == int(SR * 2.5)


def test_leading_window_leaves_short_audio_untouched():
    src = _audio(1.2)
    out = leading_window(src, SR, window_s=2.5)
    assert out is src


def test_leading_window_bounds_the_pathological_795s_flush():
    """A stuck VAD once buffered 795 s. The payload must stay bounded."""
    out = leading_window(_audio(795.0), SR, window_s=2.5)
    assert len(out) == int(SR * 2.5)


@pytest.mark.parametrize("window_s, sample_rate", [(0, SR), (-1.0, SR), (2.5, 0)])
def test_leading_window_never_empties_audio_on_degenerate_params(window_s, sample_rate):
    """Disabling truncation must pass audio through, never drop it all."""
    src = _audio(5.0)
    assert leading_window(src, sample_rate, window_s=window_s) is src


# ── admit ────────────────────────────────────────────────────────────────────

def test_admit_rejects_utterance_too_short_to_hold_the_keyword():
    _, decision = admit(_audio(0.2), SR)
    assert decision == Admission(False, "too_short", pytest.approx(0.2), 0.0, False)


def test_admit_accepts_the_shortest_measured_wake_hit():
    """0.91 s was the shortest real hit in the log — it must survive the gate."""
    payload, decision = admit(_audio(0.91), SR)
    assert decision.admit and not decision.truncated
    assert len(payload) == int(SR * 0.91)


def test_admit_truncates_but_still_admits_a_long_run_on_sentence():
    """'מרלין, do X' in one breath: the keyword is at the start, so admit and trim."""
    payload, decision = admit(_audio(20.0), SR)
    assert decision.admit
    assert decision.truncated
    assert decision.duration_s == pytest.approx(20.0)
    assert decision.sent_s == pytest.approx(2.5)
    assert len(payload) == int(SR * 2.5)


# ── DropOldestQueue ──────────────────────────────────────────────────────────

def test_queue_evicts_oldest_and_serves_freshest():
    q = DropOldestQueue(maxsize=2)
    for item in ("a", "b", "c", "d"):
        q.put(item)
    assert [q.get(), q.get()] == ["c", "d"]
    assert q.qsize() == 0


def test_queue_counts_every_eviction():
    q = DropOldestQueue(maxsize=1)
    assert q.put("a") == 0
    assert q.put("b") == 1
    assert q.drops == 1


def test_queue_never_blocks_the_audio_callback():
    """The producer is the PortAudio thread — put() must always return."""
    q = DropOldestQueue(maxsize=MAX_PENDING)
    for i in range(1000):
        q.put(i)
    assert q.qsize() == MAX_PENDING
    assert q.drops == 1000 - MAX_PENDING


def test_queue_get_nowait_signals_empty_for_the_backoff_drain():
    q = DropOldestQueue(maxsize=2)
    q.put("a")
    assert q.get_nowait() == "a"
    with pytest.raises(queue.Empty):
        q.get_nowait()


def test_queue_maxsize_is_clamped_to_at_least_one():
    q = DropOldestQueue(maxsize=0)
    q.put("a")
    q.put("b")
    assert q.qsize() == 1
    assert q.get() == "b"
