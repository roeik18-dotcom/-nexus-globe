"""Tests for MerlinAdapter — Essence context injection, caching, and session isolation."""

import asyncio
from typing import AsyncIterator
from unittest.mock import patch

import pytest

from app.adapters.merlin import MerlinAdapter, VoiceSessionContext


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def adapter():
    """MerlinAdapter with the Anthropic client mocked out."""
    with patch("app.adapters.claude.anthropic.AsyncAnthropic"):
        return MerlinAdapter()


async def _collect(gen: AsyncIterator[str]) -> list[str]:
    return [c async for c in gen]


def _mock_claude_respond(*chunks: str):
    """Patch ClaudeAdapter.respond to yield the given text chunks."""
    async def _gen(self, text, session_id):
        for c in chunks:
            yield c
    return patch("app.adapters.claude.ClaudeAdapter.respond", _gen)


# ── 1. Essence block injected at first turn ───────────────────────────────────

@pytest.mark.anyio
async def test_essence_block_injected_at_first_turn(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    block = "Preferences: dark mode"

    with patch("app.adapters.merlin.fetch_essence_context", return_value=block) as mock_fetch, \
         _mock_claude_respond("hello"):
        await _collect(adapter.respond("hi", "s1"))

    mock_fetch.assert_called_once_with("u1")
    assert adapter._essence_extra.get("s1") == block


# ── 2. Fetch called exactly once per session ──────────────────────────────────

@pytest.mark.anyio
async def test_fetch_called_once_per_session(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    with patch("app.adapters.merlin.fetch_essence_context", return_value="block") as mock_fetch, \
         _mock_claude_respond("a"):
        await _collect(adapter.respond("first", "s1"))
        await _collect(adapter.respond("second", "s1"))

    assert mock_fetch.call_count == 1


# ── 3. Essence context not duplicated across turns ────────────────────────────

@pytest.mark.anyio
async def test_essence_context_not_duplicated_across_turns(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    block = "Language: Hebrew"

    with patch("app.adapters.merlin.fetch_essence_context", return_value=block), \
         _mock_claude_respond("x"):
        for _ in range(3):
            await _collect(adapter.respond("turn", "s1"))

    # _essence_extra[session] holds the block as a single string, never appended
    stored = adapter._essence_extra.get("s1", "")
    assert stored == block
    assert stored.count("Language: Hebrew") == 1


# ── 4. reset() clears cache — next respond() fetches fresh ───────────────────

@pytest.mark.anyio
async def test_reset_clears_cache_and_triggers_refetch(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    with patch("app.adapters.merlin.fetch_essence_context", return_value="block") as mock_fetch, \
         _mock_claude_respond("a"):
        await _collect(adapter.respond("turn1", "s1"))
        await adapter.reset("s1")
        await _collect(adapter.respond("turn2", "s1"))

    assert mock_fetch.call_count == 2


# ── 5. Graceful degradation when fetch returns "" ────────────────────────────

@pytest.mark.anyio
async def test_graceful_degradation_when_fetch_empty(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    with patch("app.adapters.merlin.fetch_essence_context", return_value=""), \
         _mock_claude_respond("response"):
        chunks = await _collect(adapter.respond("hello", "s1"))

    assert chunks == ["response"]
    # Empty block must not be stored in _essence_extra
    assert "s1" not in adapter._essence_extra


# ── 6. Missing profile_id degrades gracefully (no fetch) ─────────────────────

@pytest.mark.anyio
async def test_missing_profile_id_skips_fetch(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id=None)
    adapter.register_session(ctx)

    with patch("app.adapters.merlin.fetch_essence_context") as mock_fetch, \
         _mock_claude_respond("ok"):
        await _collect(adapter.respond("hi", "s1"))

    mock_fetch.assert_not_called()
    assert "s1" not in adapter._essence_extra


# ── 7. Session with no register_session call degrades gracefully ──────────────

@pytest.mark.anyio
async def test_no_registered_session_skips_fetch(adapter):
    with patch("app.adapters.merlin.fetch_essence_context") as mock_fetch, \
         _mock_claude_respond("ok"):
        chunks = await _collect(adapter.respond("hi", "s2"))

    mock_fetch.assert_not_called()
    assert chunks == ["ok"]


# ── 8. Session isolation — two concurrent sessions don't share context ────────

@pytest.mark.anyio
async def test_session_isolation_concurrent(adapter):
    ctx_a = VoiceSessionContext(session_id="a", profile_id="ua")
    ctx_b = VoiceSessionContext(session_id="b", profile_id="ub")
    adapter.register_session(ctx_a)
    adapter.register_session(ctx_b)

    async def fetch_side_effect(profile_id: str) -> str:
        return f"block-for-{profile_id}"

    with patch("app.adapters.merlin.fetch_essence_context", side_effect=fetch_side_effect), \
         _mock_claude_respond("x"):
        await asyncio.gather(
            _collect(adapter.respond("turn", "a")),
            _collect(adapter.respond("turn", "b")),
        )

    assert adapter._essence_cache["a"] == "block-for-ua"
    assert adapter._essence_cache["b"] == "block-for-ub"
    assert adapter._essence_extra["a"] == "block-for-ua"
    assert adapter._essence_extra["b"] == "block-for-ub"


# ── 9. unregister_session clears all per-session state ───────────────────────

@pytest.mark.anyio
async def test_unregister_session_clears_state(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    with patch("app.adapters.merlin.fetch_essence_context", return_value="block"), \
         _mock_claude_respond("a"):
        await _collect(adapter.respond("hi", "s1"))

    adapter.unregister_session("s1")

    assert "s1" not in adapter._session_contexts
    assert "s1" not in adapter._essence_cache
    assert "s1" not in adapter._essence_extra


# ── 10. Streaming contract — respond() yields chunks ─────────────────────────

@pytest.mark.anyio
async def test_respond_yields_chunks(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    with patch("app.adapters.merlin.fetch_essence_context", return_value=""), \
         _mock_claude_respond("hello", " ", "world"):
        chunks = await _collect(adapter.respond("hi", "s1"))

    assert chunks == ["hello", " ", "world"]


# ── 11. Disconnect mid-exception still clears state ──────────────────────────

@pytest.mark.anyio
async def test_cleanup_after_exception(adapter):
    ctx = VoiceSessionContext(session_id="s1", profile_id="u1")
    adapter.register_session(ctx)

    async def failing_gen(self, text, session_id):
        yield "partial"
        raise RuntimeError("simulated adapter failure")

    with patch("app.adapters.merlin.fetch_essence_context", return_value="block"), \
         patch("app.adapters.claude.ClaudeAdapter.respond", failing_gen):
        with pytest.raises(RuntimeError):
            await _collect(adapter.respond("hi", "s1"))

    # Cleanup should succeed regardless
    adapter.unregister_session("s1")
    assert "s1" not in adapter._essence_cache
