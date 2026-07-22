"""Unit tests for audio validation — no API keys required."""

import pytest


def test_empty_audio_rejected():
    from app.audio.utils import validate_audio
    with pytest.raises(ValueError, match="Empty"):
        validate_audio(b"")


def test_oversized_audio_rejected(monkeypatch):
    from app.audio import utils as audio_utils
    monkeypatch.setattr(audio_utils.settings, "max_audio_size_bytes", 100)
    with pytest.raises(ValueError, match="too large"):
        audio_utils.validate_audio(b"x" * 200)


def test_valid_wav_passes():
    from app.audio.utils import validate_audio
    # Minimal RIFF WAV header (44 bytes) — valid signature
    header = b"RIFF" + b"\x24\x00\x00\x00" + b"WAVE" + b"fmt " + b"\x10\x00\x00\x00"
    header += b"\x01\x00\x01\x00" + b"\x80\x3e\x00\x00" + b"\x00\x7d\x00\x00"
    header += b"\x02\x00\x10\x00" + b"data" + b"\x00\x00\x00\x00"
    validate_audio(header)  # should not raise


def test_audio_to_file_like():
    from app.audio.utils import audio_to_file_like
    data = b"RIFF" + b"\x00" * 40
    buf = audio_to_file_like(data, "test.wav")
    assert buf.name == "test.wav"
    assert buf.read() == data
