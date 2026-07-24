"""Integration tests for the streaming adapter → SentenceBuffer → TTS pipeline.

Verifies that:
- A multi-sentence streaming adapter produces multiple audio chunks (one per sentence)
- first_token_ms and first_audio_ms timing fields are captured
- first_audio_ms >= first_token_ms (audio cannot precede first token)
- The full text is preserved across chunked delivery
- A single-sentence response produces at least one audio chunk via flush
- An empty adapter response produces no audio and no first_token_ms
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


async def _run_pipeline(adapter: VoiceAdapter, text: str = "test") -> dict:
    """Replicate the _handle_turn streaming pipeline; return timing + chunk count."""
    tts = MockTTS()
    buf = SentenceBuffer()
    full_text_parts: list[str] = []
    audio_chunk_count = 0
    first_token_ms: int | None = None
    first_audio_ms: int | None = None

    t_start = time.perf_counter()

    async for chunk in adapter.respond(text, "test_session"):
        if first_token_ms is None:
            first_token_ms = round((time.perf_counter() - t_start) * 1000)
        full_text_parts.append(chunk)
        sentence = buf.push(chunk)
        if sentence:
            audio = await tts.synthesize(sentence)
            if audio:
                if first_audio_ms is None:
                    first_audio_ms = round((time.perf_counter() - t_start) * 1000)
                audio_chunk_count += 1

    tail = buf.flush()
    if tail:
        audio = await tts.synthesize(tail)
        if audio:
            if first_audio_ms is None:
                first_audio_ms = round((time.perf_counter() - t_start) * 1000)
            audio_chunk_count += 1

    return {
        "first_token_ms": first_token_ms,
        "first_audio_ms": first_audio_ms,
        "audio_chunk_count": audio_chunk_count,
        "full_text": "".join(full_text_parts),
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
