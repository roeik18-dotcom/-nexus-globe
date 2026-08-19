"""Acceptance tests for the Control Center's output-language gate.

Covers acceptance criteria 1, 2, 3 from the Control Center task:
  1. "Ahem" (short English interjection) does not flag an otherwise-Hebrew response.
  2. "Hello" alone does not flag/switch language.
  3. A mostly-English response is rejected (not sent onward) when Hebrew-only is active.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.language_gate import HEBREW_FALLBACK_MESSAGE, looks_non_target_language


# ── pure heuristic tests (no mocking, no API) ──────────────────────────────

def test_short_english_interjection_inside_hebrew_not_flagged():
    text = "אה, Ahem, סליחה — בוא נמשיך."
    assert looks_non_target_language(text, ["he"]) is False


def test_hello_alone_not_flagged_as_language_switch():
    # A short greeting-length fragment, well under the flagging threshold.
    text = "Hello"
    assert looks_non_target_language(text, ["he"]) is False


def test_technical_terms_inside_hebrew_not_flagged():
    text = "פתח את VSCode ותריץ git status בטרמינל."
    assert looks_non_target_language(text, ["he"]) is False


def test_mostly_english_response_is_flagged_when_hebrew_only():
    text = "Sure, here is a detailed explanation of how this works in English."
    assert looks_non_target_language(text, ["he"]) is True


def test_mostly_english_not_flagged_when_english_allowed():
    text = "Sure, here is a detailed explanation of how this works in English."
    assert looks_non_target_language(text, ["he", "en"]) is False


def test_pure_hebrew_response_never_flagged():
    text = "התשובה שלך מוכנה, הנה כל הפרטים החשובים שביקשת עליהם."
    assert looks_non_target_language(text, ["he"]) is False


# ── integration: the gate actually wired into ClaudeAdapter.respond() ──────

WAV_SESSION = "test-lang-gate-session"


@pytest.mark.asyncio
async def test_respond_retries_and_falls_back_when_english_disabled(tmp_path, monkeypatch):
    """A mostly-English draft, with Hebrew-only policy active, must never reach
    the caller unmodified — it is retried once, and if the retry also fails,
    replaced with the Hebrew fallback message. Neither draft nor bad retry is
    ever yielded to the caller."""
    from app.adapters.claude import ClaudeAdapter

    # Isolate the control config to a Hebrew-only policy for this test.
    from config.merlin_control_schema import default_config, save
    cfg_path = tmp_path / "merlin_control.json"
    monkeypatch.setattr("config.merlin_control_schema.DEFAULT_CONFIG_PATH", cfg_path)
    monkeypatch.setattr("config.merlin_control_schema.LAST_KNOWN_GOOD_PATH", tmp_path / "lkg.json")
    ok, errors = save(default_config().to_dict(), path=cfg_path)
    assert ok, errors

    adapter = ClaudeAdapter(persona="merlin")

    # Mock the streaming call to yield an English draft.
    async def _fake_text_stream():
        for chunk in ["This ", "is ", "an ", "English ", "draft ", "response."]:
            yield chunk

    fake_stream_cm = MagicMock()
    fake_stream_cm.__aenter__ = AsyncMock(return_value=MagicMock(text_stream=_fake_text_stream()))
    fake_stream_cm.__aexit__ = AsyncMock(return_value=False)
    adapter._client.messages.stream = MagicMock(return_value=fake_stream_cm)

    # Mock the retry call to also fail (still English) — forces the fallback path.
    fake_block = MagicMock(type="text", text="Still English after retry.")
    fake_retry_response = MagicMock(content=[fake_block])
    adapter._client.messages.create = AsyncMock(return_value=fake_retry_response)

    chunks = [c async for c in adapter.respond("Hello, tell me something.", WAV_SESSION)]
    full = "".join(chunks)

    assert full == HEBREW_FALLBACK_MESSAGE
    adapter._client.messages.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_respond_accepts_successful_hebrew_retry(tmp_path, monkeypatch):
    from app.adapters.claude import ClaudeAdapter
    from config.merlin_control_schema import default_config, save
    cfg_path = tmp_path / "merlin_control.json"
    monkeypatch.setattr("config.merlin_control_schema.DEFAULT_CONFIG_PATH", cfg_path)
    monkeypatch.setattr("config.merlin_control_schema.LAST_KNOWN_GOOD_PATH", tmp_path / "lkg.json")
    save(default_config().to_dict(), path=cfg_path)

    adapter = ClaudeAdapter(persona="merlin")

    async def _fake_text_stream():
        for chunk in ["This ", "is ", "clearly ", "an ", "English ", "draft ", "response."]:
            yield chunk

    fake_stream_cm = MagicMock()
    fake_stream_cm.__aenter__ = AsyncMock(return_value=MagicMock(text_stream=_fake_text_stream()))
    fake_stream_cm.__aexit__ = AsyncMock(return_value=False)
    adapter._client.messages.stream = MagicMock(return_value=fake_stream_cm)

    fake_block = MagicMock(type="text", text="זו תשובה בעברית תקנית.")
    adapter._client.messages.create = AsyncMock(return_value=MagicMock(content=[fake_block]))

    chunks = [c async for c in adapter.respond("Hello", WAV_SESSION + "-2")]
    full = "".join(chunks)

    assert full == "זו תשובה בעברית תקנית."
    adapter._client.messages.create.assert_awaited_once()


@pytest.mark.asyncio
async def test_respond_untouched_for_non_merlin_persona(monkeypatch):
    """jarvis/philos must be byte-identical to before this feature — the gate
    must never activate outside persona=='merlin'."""
    from app.adapters.claude import ClaudeAdapter

    adapter = ClaudeAdapter(persona="jarvis")

    async def _fake_text_stream():
        yield "This is English and should pass through untouched for jarvis."

    fake_stream_cm = MagicMock()
    fake_stream_cm.__aenter__ = AsyncMock(return_value=MagicMock(text_stream=_fake_text_stream()))
    fake_stream_cm.__aexit__ = AsyncMock(return_value=False)
    adapter._client.messages.stream = MagicMock(return_value=fake_stream_cm)
    adapter._client.messages.create = AsyncMock(side_effect=AssertionError("must not be called for jarvis"))

    chunks = [c async for c in adapter.respond("Hello", WAV_SESSION + "-jarvis")]
    assert "".join(chunks) == "This is English and should pass through untouched for jarvis."
    adapter._client.messages.create.assert_not_called()
