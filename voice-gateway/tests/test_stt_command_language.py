"""The command transcription call must pin model, language and script bias.

`language="he"` is only advisory on gpt-4o-transcribe.  Observed 2026-08-01 with
language="he" already being sent: a clean 3.07 s Hebrew capture (RMS −26 dBFS,
norm_gain ×1.00) transcribed as 'პოლოშერტ, ბლეკ პოლოშერტ.' — right phonetics,
Georgian script — while shorter captures returned 'こんにちは。' and 'Ebu.'.  The
wake path never drifted because it also passes a `prompt`.

These tests pin the three arguments that keep the command path on Hebrew, so a
future edit cannot quietly drop the bias and reintroduce the drift.
"""

import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import settings
from app.providers.stt.whisper import _HEBREW_PROMPT_BIAS

WAV = b"RIFF" + b"\x00" * 40


async def _call_kwargs():
    """Run one transcription against a mocked client and return the call kwargs."""
    from app.providers.stt.whisper import WhisperSTT

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value="שלום")
    with patch("app.providers.stt.whisper.AsyncOpenAI", return_value=mock_client):
        stt = WhisperSTT()
    await stt.transcribe(WAV)
    mock_client.audio.transcriptions.create.assert_awaited_once()
    return mock_client.audio.transcriptions.create.call_args.kwargs


@pytest.mark.asyncio
async def test_command_stt_uses_configured_model():
    kw = await _call_kwargs()
    assert kw["model"] == settings.stt_model


@pytest.mark.asyncio
async def test_command_stt_forces_hebrew_language():
    kw = await _call_kwargs()
    assert kw["language"] == "he"


@pytest.mark.asyncio
async def test_command_stt_sends_hebrew_prompt_bias():
    kw = await _call_kwargs()
    assert "prompt" in kw, "command path must send a prompt bias, like the wake path"
    assert kw["prompt"] == _HEBREW_PROMPT_BIAS


@pytest.mark.asyncio
async def test_prompt_bias_actually_contains_hebrew():
    """A prompt of pure Latin text would bias the wrong way."""
    assert any("֐" <= ch <= "׿" for ch in _HEBREW_PROMPT_BIAS)


@pytest.mark.asyncio
async def test_command_stt_decoding_stays_deterministic():
    """temperature=0 curbs the repetition/hallucination failure mode."""
    kw = await _call_kwargs()
    assert kw["temperature"] == 0


@pytest.mark.asyncio
async def test_production_call_requests_plain_text(monkeypatch):
    """Capture mode off → response_format="text" (unchanged production shape)."""
    monkeypatch.delenv("MERLIN_CAPTURE_WAV", raising=False)
    kw = await _call_kwargs()
    assert kw["response_format"] == "text"


@pytest.mark.asyncio
async def test_transcript_still_returned_unchanged():
    """The bias must not disturb the text extraction path."""
    from app.providers.stt.whisper import WhisperSTT

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value="  שלום עולם  ")
    with patch("app.providers.stt.whisper.AsyncOpenAI", return_value=mock_client):
        stt = WhisperSTT()
    assert await stt.transcribe(WAV) == "שלום עולם"


@pytest.mark.asyncio
async def test_command_and_wake_agree_on_language_and_temperature():
    """The two paths must not drift apart on the settings that caused this bug."""
    import re
    from pathlib import Path

    wake_src = (Path(__file__).resolve().parent.parent
                / "service" / "wake_trigger.py").read_text()
    # the wake path's create() kwargs
    assert re.search(r'language\s*=\s*"he"', wake_src)
    assert re.search(r"temperature\s*=\s*0", wake_src)
    assert re.search(r"prompt\s*=", wake_src)

    kw = await _call_kwargs()
    assert kw["language"] == "he"
    assert kw["temperature"] == 0
    assert "prompt" in kw
