"""Tests for STTProvider base class, WhisperSTT, and MockSTT."""

import io
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.providers.stt.base import STTProvider
from app.providers.stt.mock import MockSTT


# --- STTProvider ABC ---

def test_stt_provider_is_abstract():
    with pytest.raises(TypeError):
        STTProvider()  # type: ignore[abstract]


def test_stt_provider_name_default():
    class ConcreteSTT(STTProvider):
        async def transcribe(self, audio_bytes: bytes) -> str:
            return ""

    stt = ConcreteSTT()
    assert stt.name == "concretestt"


def test_stt_provider_name_can_be_overridden():
    class CustomSTT(STTProvider):
        @property
        def name(self) -> str:
            return "custom"

        async def transcribe(self, audio_bytes: bytes) -> str:
            return ""

    assert CustomSTT().name == "custom"


# --- MockSTT ---

def test_mock_stt_is_stt_provider():
    assert isinstance(MockSTT(), STTProvider)


def test_mock_stt_name():
    assert MockSTT().name == "mock"


@pytest.mark.asyncio
async def test_mock_stt_returns_fixed_transcript():
    stt = MockSTT()
    result = await stt.transcribe(b"fake audio")
    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_mock_stt_ignores_audio_content():
    stt = MockSTT()
    result_a = await stt.transcribe(b"audio_a")
    result_b = await stt.transcribe(b"audio_b")
    assert result_a == result_b


# --- WhisperSTT ---

def test_whisper_stt_is_stt_provider():
    from app.providers.stt.whisper import WhisperSTT
    with patch("app.providers.stt.whisper.AsyncOpenAI"):
        stt = WhisperSTT()
    assert isinstance(stt, STTProvider)


def test_whisper_stt_name():
    from app.providers.stt.whisper import WhisperSTT
    with patch("app.providers.stt.whisper.AsyncOpenAI"):
        stt = WhisperSTT()
    assert stt.name == "whisper"


@pytest.mark.asyncio
async def test_whisper_stt_transcribe_calls_openai():
    from app.providers.stt.whisper import WhisperSTT

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value="שלום עולם")

    with patch("app.providers.stt.whisper.AsyncOpenAI", return_value=mock_client):
        stt = WhisperSTT()

    wav_header = b"RIFF" + b"\x00" * 40
    result = await stt.transcribe(wav_header)

    assert result == "שלום עולם"
    mock_client.audio.transcriptions.create.assert_awaited_once()
    call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
    assert call_kwargs["model"] == "whisper-1"
    assert call_kwargs["response_format"] == "text"


@pytest.mark.asyncio
async def test_whisper_stt_strips_whitespace():
    from app.providers.stt.whisper import WhisperSTT

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value="  hello world  ")

    with patch("app.providers.stt.whisper.AsyncOpenAI", return_value=mock_client):
        stt = WhisperSTT()

    wav_header = b"RIFF" + b"\x00" * 40
    result = await stt.transcribe(wav_header)
    assert result == "hello world"


@pytest.mark.asyncio
async def test_whisper_stt_rejects_empty_audio():
    from app.providers.stt.whisper import WhisperSTT

    with patch("app.providers.stt.whisper.AsyncOpenAI"):
        stt = WhisperSTT()

    with pytest.raises(ValueError, match="Empty audio"):
        await stt.transcribe(b"")


@pytest.mark.asyncio
async def test_whisper_stt_rejects_oversized_audio(monkeypatch):
    from app.providers.stt.whisper import WhisperSTT
    from app.audio import utils as au

    monkeypatch.setattr(au.settings, "max_audio_size_bytes", 10)

    with patch("app.providers.stt.whisper.AsyncOpenAI"):
        stt = WhisperSTT()

    with pytest.raises(ValueError, match="Audio too large"):
        await stt.transcribe(b"RIFF" + b"\x00" * 40)


@pytest.mark.asyncio
async def test_whisper_stt_passes_file_object_with_name():
    from app.providers.stt.whisper import WhisperSTT

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value="ok")

    with patch("app.providers.stt.whisper.AsyncOpenAI", return_value=mock_client):
        stt = WhisperSTT()

    wav_header = b"RIFF" + b"\x00" * 40
    await stt.transcribe(wav_header)

    call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
    file_arg = call_kwargs["file"]
    assert hasattr(file_arg, "name")
    assert isinstance(file_arg, io.BytesIO)
