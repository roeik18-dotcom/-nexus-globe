"""Wake-path buffering: bounded retention, one inference per speech run.

Covers the two defects the 2026-08-01/02 service log exposed:
  • continuous above-threshold input never left the `_in_speech` branch, so the
    buffer grew without bound (one flush reported speech_duration=795 s);
  • the flush queue was unbounded, so a slow network lane accumulated a stale
    backlog that was then purged wholesale.
"""
from __future__ import annotations

import numpy as np
import pytest

from service import wake_trigger
from service.wake_gate import MAX_PENDING
from service.wake_trigger import MAX_BUFFER_S, SILENCE_END_S, VAD_THRESHOLD, KeywordBuffer

SR = 16_000
BLOCK = 320  # 20 ms


@pytest.fixture
def detector():
    """A detector whose inference thread exits immediately (invalid key), so the
    queue can be inspected without any network call."""
    det = KeywordBuffer(trigger=__import__("threading").Event(), openai_api_key="", mic_sr=SR)
    return det


def _speech_block() -> np.ndarray:
    return np.full(BLOCK, VAD_THRESHOLD * 10, dtype=np.float32)


def _silent_block() -> np.ndarray:
    return np.zeros(BLOCK, dtype=np.float32)


def _feed(det, block, count, clock):
    """Feed `count` blocks, advancing the monotonic clock by 20 ms each."""
    rms = float(np.sqrt(np.mean(block ** 2)))
    for _ in range(count):
        det.feed(block, rms)
        clock.advance(0.02)


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def advance(self, dt):
        self.t += dt

    def __call__(self):
        return self.t


@pytest.fixture
def clock(monkeypatch):
    c = _Clock()
    monkeypatch.setattr(wake_trigger.time, "monotonic", c)
    return c


def test_buffer_is_bounded_during_unbroken_speech(detector, clock):
    """30 s of continuous speech must not retain 30 s of audio."""
    _feed(detector, _speech_block(), int(30 / 0.02), clock)
    assert detector._buffered <= int(SR * MAX_BUFFER_S)


def test_unbroken_speech_costs_exactly_one_inference(detector, clock):
    """Previously a stuck stream produced one giant flush; it must not now produce
    one flush per block either."""
    _feed(detector, _speech_block(), int(30 / 0.02), clock)
    assert detector._inq.qsize() + detector._inq.drops == 1


def test_early_flush_does_not_wait_for_silence(detector, clock):
    """The keyword is at the start, so inference fires at the retention cap —
    it no longer waits out the rest of the sentence plus SILENCE_END_S."""
    _feed(detector, _speech_block(), int((MAX_BUFFER_S + 0.5) / 0.02), clock)
    assert detector._inq.qsize() == 1, "expected an inference before any silence"
    assert detector._run_flushed


def test_normal_utterance_flushes_once_on_silence(detector, clock):
    _feed(detector, _speech_block(), int(1.5 / 0.02), clock)
    assert detector._inq.qsize() == 0, "must not infer mid-utterance"
    _feed(detector, _silent_block(), int((SILENCE_END_S + 0.1) / 0.02), clock)
    assert detector._inq.qsize() == 1
    assert not detector._in_speech


def test_capped_run_is_not_flushed_twice_when_silence_finally_arrives(detector, clock):
    _feed(detector, _speech_block(), int((MAX_BUFFER_S + 0.5) / 0.02), clock)
    assert detector._inq.qsize() == 1
    _feed(detector, _silent_block(), int((SILENCE_END_S + 0.1) / 0.02), clock)
    assert detector._inq.qsize() == 1, "cap-flushed run must not flush again on close"
    assert not detector._in_speech


def test_too_short_utterance_never_reaches_the_queue(detector, clock):
    _feed(detector, _speech_block(), 3, clock)  # 60 ms
    _feed(detector, _silent_block(), int((SILENCE_END_S + 0.1) / 0.02), clock)
    assert detector._inq.qsize() == 0
    assert detector._buffered == 0


def test_queue_depth_stays_bounded_under_sustained_load(detector, clock):
    """The starvation mode: many utterances, a lane that never drains. Depth must
    stay at the cap instead of growing an unservable backlog."""
    for _ in range(50):
        _feed(detector, _speech_block(), int(1.5 / 0.02), clock)
        _feed(detector, _silent_block(), int((SILENCE_END_S + 0.1) / 0.02), clock)
    assert detector._inq.qsize() <= MAX_PENDING


def test_drain_pending_releases_the_buffer(detector, clock):
    _feed(detector, _speech_block(), int(1.0 / 0.02), clock)
    assert detector._buffered > 0
    chunks = detector.drain_pending()
    assert chunks
    assert detector._buffered == 0
    assert not detector._in_speech
    assert not detector._run_flushed
