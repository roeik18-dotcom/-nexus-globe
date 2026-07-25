"""Integration tests for the streaming adapter → SentenceBuffer → TTS pipeline.

Verifies that:
- A multi-sentence streaming adapter produces multiple audio chunks (one per sentence)
- first_token_ms and first_audio_ms timing fields are captured
- first_audio_ms >= first_token_ms (audio cannot precede first token)
- The full text is preserved across chunked delivery
- A single-sentence response produces at least one audio chunk via flush
- An empty adapter response produces no audio and no first_token_ms
- first_sentence_ready_ms is captured before TTS synthesis
- 400ms timeout flush fires when no sentence boundary arrives in time
"""

import asyncio
import time
from typing import AsyncIterator

import pytest

from app.adapters.base import VoiceAdapter
from app.audio.sentence import SentenceBuffer
from app.providers.tts.mock import MockTTS


class _MultiSentenceAdapter(VoiceAdapter):
    """Yields three complete sentences in separate token bursts."""

    @property
    def name(self) -> str:
        return "multi_sentence_test"

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        for sentence in [
            "Hello, this is the first sentence. ",
            "And here comes the second one. ",
            "Finally, a third to round it off.",
        ]:
            yield sentence
            await asyncio.sleep(0)

    async def reset(self, session_id: str) -> None:
        pass


class _EmptyAdapter(VoiceAdapter):
    """Yields nothing — simulates an adapter that produces no output."""

    @property
    def name(self) -> str:
        return "empty_test"

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        return
        yield  # makes this an async generator

    async def reset(self, session_id: str) -> None:
        pass


class _SlowFirstSentenceAdapter(VoiceAdapter):
    """Yields tokens without punctuation for 300ms, then yields a sentence.

    Simulates a model that starts generating but takes a while to reach the
    first sentence boundary — used to test the 400ms timeout flush.
    """

    @property
    def name(self) -> str:
        return "slow_first_sentence_test"

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        # Short tokens with no sentence boundary, delivered over ~200ms
        for word in ["Hello", " there", " from", " the"]:
            yield word
            await asyncio.sleep(0.05)
        # Long pause — timeout should fire before this
        await asyncio.sleep(0.6)
        yield " world."

    async def reset(self, session_id: str) -> None:
        pass


async def _run_pipeline(
    adapter: VoiceAdapter,
    text: str = "test",
    first_min_chars: int | None = None,
    timeout_ms: int | None = None,
) -> dict:
    """Replicate the _handle_turn streaming pipeline; return timing + chunk count."""
    tts = MockTTS()
    buf = SentenceBuffer(first_min_chars=first_min_chars)
    full_text_parts: list[str] = []
    audio_chunk_count = 0
    first_token_ms: int | None = None
    first_sentence_ready_ms: int | None = None
    first_audio_ms: int | None = None
    _first_sentence_sent = False

    t_start = time.perf_counter()

    async def _tts_send(sentence: str) -> None:
        nonlocal first_sentence_ready_ms, first_audio_ms, audio_chunk_count, _first_sentence_sent
        if not sentence:
            return
        if first_sentence_ready_ms is None:
            first_sentence_ready_ms = round((time.perf_counter() - t_start) * 1000)
        _first_sentence_sent = True
        audio = await tts.synthesize(sentence)
        if audio:
            if first_audio_ms is None:
                first_audio_ms = round((time.perf_counter() - t_start) * 1000)
            audio_chunk_count += 1

    async def _maybe_timeout_flush() -> None:
        nonlocal _first_sentence_sent
        delay = (timeout_ms or 400) / 1000
        await asyncio.sleep(delay)
        if not _first_sentence_sent:
            forced = buf.flush()
            if forced:
                await _tts_send(forced)

    _timeout_task: asyncio.Task | None = None
    try:
        async for chunk in adapter.respond(text, "test_session"):
            if first_token_ms is None:
                first_token_ms = round((time.perf_counter() - t_start) * 1000)
                if timeout_ms is not None:
                    _timeout_task = asyncio.create_task(_maybe_timeout_flush())
            full_text_parts.append(chunk)
            sentence = buf.push(chunk)
            if sentence:
                await _tts_send(sentence)

        tail = buf.flush()
        if tail:
            await _tts_send(tail)
    finally:
        if _timeout_task and not _timeout_task.done():
            _timeout_task.cancel()
            try:
                await _timeout_task
            except asyncio.CancelledError:
                pass

    return {
        "first_token_ms":         first_token_ms,
        "first_sentence_ready_ms": first_sentence_ready_ms,
        "first_audio_ms":         first_audio_ms,
        "audio_chunk_count":      audio_chunk_count,
        "full_text":              "".join(full_text_parts),
    }


def test_multi_sentence_produces_multiple_audio_chunks():
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert result["audio_chunk_count"] >= 2


def test_first_token_ms_is_captured():
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert result["first_token_ms"] is not None
    assert result["first_token_ms"] >= 0


def test_first_audio_ms_is_captured():
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert result["first_audio_ms"] is not None
    assert result["first_audio_ms"] >= 0


def test_first_audio_ms_not_before_first_token_ms():
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert result["first_audio_ms"] >= result["first_token_ms"]


def test_full_text_is_preserved():
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert "Hello" in result["full_text"]
    assert "second" in result["full_text"]
    assert "third" in result["full_text"]


def test_echo_adapter_produces_audio():
    from app.adapters.echo import EchoAdapter

    # Echo yields a single short chunk — SentenceBuffer buffers it until flush
    result = asyncio.run(_run_pipeline(EchoAdapter(), text="Hello world, how are you today?"))
    assert result["audio_chunk_count"] >= 1
    assert result["first_token_ms"] is not None


def test_empty_adapter_no_audio_no_first_token():
    result = asyncio.run(_run_pipeline(_EmptyAdapter()))
    assert result["first_token_ms"] is None
    assert result["first_audio_ms"] is None
    assert result["audio_chunk_count"] == 0


def test_single_sentence_gets_flushed():
    from app.adapters.echo import EchoAdapter

    # No sentence-ending punctuation mid-stream — all text lands in flush()
    result = asyncio.run(_run_pipeline(EchoAdapter(), text="Just one chunk of text here"))
    assert result["audio_chunk_count"] == 1
    assert result["full_text"] == "Just one chunk of text here"


# ── first_sentence_ready_ms tests ─────────────────────────────────────────────

def test_first_sentence_ready_ms_is_captured():
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert result["first_sentence_ready_ms"] is not None
    assert result["first_sentence_ready_ms"] >= 0


def test_first_sentence_ready_ms_not_after_first_audio_ms():
    # first_sentence_ready_ms is set BEFORE TTS is called, so it must be <= first_audio_ms
    result = asyncio.run(_run_pipeline(_MultiSentenceAdapter()))
    assert result["first_sentence_ready_ms"] <= result["first_audio_ms"]


def test_first_sentence_ready_ms_none_for_empty_adapter():
    result = asyncio.run(_run_pipeline(_EmptyAdapter()))
    assert result["first_sentence_ready_ms"] is None


# ── timeout flush tests ────────────────────────────────────────────────────────

def test_timeout_flush_fires_when_no_sentence_boundary():
    # SlowFirstSentenceAdapter pauses 600ms before yielding a sentence-ending token.
    # With a 300ms timeout, the flush should fire before the natural boundary.
    result = asyncio.run(
        _run_pipeline(_SlowFirstSentenceAdapter(), timeout_ms=300)
    )
    # Audio should arrive before the 600ms natural boundary pause ends
    assert result["audio_chunk_count"] >= 1
    assert result["first_audio_ms"] is not None
    # The timeout fired at ~300ms; first audio should be well before 600ms
    assert result["first_audio_ms"] < 550


def test_timeout_flush_does_not_double_send_when_natural_sentence_arrives():
    # With a generous timeout (longer than the natural sentence boundary),
    # the natural boundary should fire and the timeout should be a no-op.
    result = asyncio.run(
        _run_pipeline(_MultiSentenceAdapter(), timeout_ms=5000)
    )
    # Should still have >= 2 audio chunks from natural boundaries
    assert result["audio_chunk_count"] >= 2


def test_timeout_no_op_when_no_tokens():
    # Empty adapter — no tokens, no timeout needed, no audio
    result = asyncio.run(_run_pipeline(_EmptyAdapter(), timeout_ms=50))
    assert result["audio_chunk_count"] == 0
    assert result["first_audio_ms"] is None
