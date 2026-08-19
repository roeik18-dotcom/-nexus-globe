"""Continuous Day-Opening playback pipeline (2026-08-10) — speak_canonical_text.

Proves: canonical chunk order unchanged, prefetch never exceeds 2, N+1 synthesis
overlaps N playback, an interrupted turn never plays a queued chunk, a stale turn
drops a synthesis result, and no orphan producer task remains.
"""
import asyncio
import time

import numpy as np
import pytest

import service.merlin_service as svc

# five sentence-terminated chunks; SentenceBuffer(first_min_chars=30) splits on '.'
TEXT = "משפט אחד ראשון כאן. משפט שני כאן. משפט שלישי כאן. משפט רביעי כאן. משפט חמישי כאן."
TURN_ID = 1


class FakeTTS:
    """Records synth order + timings; encodes the canonical index into the PCM
    so the player can prove play order == synth order. Optional per-index hook."""
    def __init__(self, delay=0.02, on_synth=None):
        self.delay = delay
        self.on_synth = on_synth or {}
        self.synth_order = []
        self.synth_start = {}
        self.synth_end = {}
        self._i = 0

    async def synthesize(self, text):
        i = self._i
        self._i += 1
        self.synth_order.append(i)
        self.synth_start[i] = time.monotonic()
        await asyncio.sleep(self.delay)
        self.synth_end[i] = time.monotonic()
        if i in self.on_synth:
            self.on_synth[i]()
        return np.full(200, i, dtype=np.int16).tobytes()


class FakePlayer:
    def __init__(self, tts, delay=0.08, barge_on=None):
        self.tts = tts
        self.delay = delay
        self.barge_on = barge_on
        self.play_order = []
        self.play_end = {}
        self.synth_count_at_play_start = {}

    async def play_with_barge_in(self, pcm, **kw):
        i = int(pcm[0])
        self.play_order.append(i)
        self.synth_count_at_play_start[i] = len(self.tts.synth_order)
        await asyncio.sleep(self.delay)
        self.play_end[i] = time.monotonic()
        return self.barge_on is not None and i == self.barge_on


class FakeTurnCtrl:
    def __init__(self):
        self._current = True
        self.cancelled = []
    def is_current(self, tid):
        return self._current
    def set_state(self, s, strict=False):
        pass
    def cancel(self, tid):
        self.cancelled.append(tid)
    def make_stale(self):
        self._current = False


async def _run(tts, player, turn_ctrl):
    before = len(asyncio.all_tasks())
    result = await svc.speak_canonical_text(TEXT, tts, player, turn_ctrl, TURN_ID, control_state=None)
    await asyncio.sleep(0)                       # let any cancelled task settle
    after_pending = [t for t in asyncio.all_tasks() if not t.done() and t is not asyncio.current_task()]
    return result, before, after_pending


@pytest.mark.asyncio
async def test_order_preserved_and_all_chunks_played():
    tts = FakeTTS(); player = FakePlayer(tts); tc = FakeTurnCtrl()
    (interrupted, spoken), _, pending = await _run(tts, player, tc)
    assert interrupted is False
    assert player.play_order == sorted(player.play_order)          # strictly increasing
    assert player.play_order == list(range(len(player.play_order)))  # 0,1,2,... canonical order
    assert len(player.play_order) == len(tts.synth_order)          # every synthesized chunk played
    assert pending == []                                           # NO ORPHAN producer task


@pytest.mark.asyncio
async def test_prefetch_never_exceeds_two():
    # fast synth, slow playback → producer races ahead but is capped at 2
    tts = FakeTTS(delay=0.005); player = FakePlayer(tts, delay=0.15); tc = FakeTurnCtrl()
    await _run(tts, player, tc)
    # when chunk i starts playing, at most i+3 synths have started (i played/playing
    # + up to 2 prefetched ahead) — never 3 ahead.
    for i, n in player.synth_count_at_play_start.items():
        assert n <= i + 1 + 2, f"chunk {i}: {n} synths started (>2 prefetched ahead)"


@pytest.mark.asyncio
async def test_next_synthesis_overlaps_current_playback():
    tts = FakeTTS(delay=0.02); player = FakePlayer(tts, delay=0.12); tc = FakeTurnCtrl()
    await _run(tts, player, tc)
    # synthesis of chunk 1 must START before playback of chunk 0 ENDS
    assert tts.synth_start[1] < player.play_end[0]


@pytest.mark.asyncio
async def test_barge_interrupts_and_no_queued_chunk_plays_after():
    tts = FakeTTS(delay=0.01); player = FakePlayer(tts, delay=0.05, barge_on=1); tc = FakeTurnCtrl()
    (interrupted, spoken), _, pending = await _run(tts, player, tc)
    assert interrupted is True
    assert max(player.play_order) == 1              # nothing past the barged chunk played
    assert all(i <= 1 for i in player.play_order)   # no prefetched chunk 2+ reached playback
    assert pending == []                            # producer cancelled cleanly, no orphan
    assert TURN_ID in tc.cancelled                  # turn was cancelled


@pytest.mark.asyncio
async def test_stale_turn_drops_synthesis_result():
    # go stale right after chunk 2 is synthesized → chunk 2's result must be
    # discarded (never enqueued/played), producer stops cleanly.
    tc = FakeTurnCtrl()
    tts = FakeTTS(delay=0.01, on_synth={2: tc.make_stale}); player = FakePlayer(tts, delay=0.03)
    (interrupted, spoken), _, pending = await _run(tts, player, tc)
    assert 2 not in player.play_order               # synthesized-after-stale chunk not played
    assert pending == []                            # no orphan producer task
