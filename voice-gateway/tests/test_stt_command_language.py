"""The command transcription call must pin model, language and temperature — and
must send NO prompt, while the wake path keeps its own.

`language="he"` is only advisory on gpt-4o-transcribe, so a prompt was added to the
command path to bias the script.  Both forms tried on 2026-08-01 were emitted AS the
transcript rather than biasing it:

  prose  "שיחה בעברית עם מרלין."      → returned verbatim on 5/5 cycles (18:33–18:38),
                                         byte-identical across pre_norm_peak 0.058–0.303
  tokens "עברית, רועי, מרלין, שעה, …" → returned complete on the cleanest capture of
                                         the run (18:52:34, peak=1.011, gain=×1.00,
                                         voiced=2.16s); every other transcript in that
                                         run was a single token lifted from it

The echo tracks GOOD audio, not weak audio.  So the command path now runs with no
prompt at all, and these tests keep it that way — while asserting the wake path,
which has never shown the drift, still passes its keyword prompt.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import settings

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


# --- the command path ---------------------------------------------------------

@pytest.mark.asyncio
async def test_command_stt_uses_configured_model():
    kw = await _call_kwargs()
    assert kw["model"] == settings.stt_model


@pytest.mark.asyncio
async def test_command_stt_forces_hebrew_language():
    kw = await _call_kwargs()
    assert kw["language"] == "he"


@pytest.mark.asyncio
async def test_command_stt_sends_no_prompt():
    """The regression this file exists for: any prompt here gets echoed back."""
    kw = await _call_kwargs()
    assert "prompt" not in kw, (
        "command path must send no prompt — both prose and token-list biases were "
        f"returned as the transcript; got {kw.get('prompt')!r}"
    )


@pytest.mark.asyncio
async def test_no_prompt_constant_left_behind():
    """A dormant constant invites the next edit to wire it back in."""
    import app.providers.stt.whisper as whisper_mod

    assert not hasattr(whisper_mod, "_HEBREW_PROMPT_BIAS")


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
    """Removing the prompt must not disturb the text extraction path."""
    from app.providers.stt.whisper import WhisperSTT

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value="  שלום עולם  ")
    with patch("app.providers.stt.whisper.AsyncOpenAI", return_value=mock_client):
        stt = WhisperSTT()
    assert await stt.transcribe(WAV) == "שלום עולם"


# --- the wake path must NOT be changed with it --------------------------------

def _wake_src() -> str:
    from pathlib import Path

    return (Path(__file__).resolve().parent.parent
            / "service" / "wake_trigger.py").read_text()


def test_wake_path_still_sends_its_prompt():
    """Removing the command prompt must not strip the wake keyword bias."""
    import re

    src = _wake_src()
    assert re.search(r'prompt\s*=\s*"[^"]*מרלין[^"]*"', src), (
        "wake path must keep its keyword prompt"
    )


def test_wake_path_keeps_language_and_temperature():
    import re

    src = _wake_src()
    assert re.search(r'language\s*=\s*"he"', src)
    assert re.search(r"temperature\s*=\s*0", src)


@pytest.mark.asyncio
async def test_command_and_wake_agree_on_language_and_temperature():
    """The two paths share language/temperature and differ ONLY on the prompt."""
    kw = await _call_kwargs()
    assert kw["language"] == "he"
    assert kw["temperature"] == 0
    assert "prompt" not in kw          # command: no bias
    assert "prompt=" in _wake_src()    # wake: keyword bias retained
