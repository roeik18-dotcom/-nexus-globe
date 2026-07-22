"""Verify router builds correct types from config."""

import pytest
from unittest.mock import patch


def test_build_adapter_claude(monkeypatch):
    from app import router as r
    monkeypatch.setattr(r.settings, "adapter", "claude")
    from app.adapters.claude import ClaudeAdapter
    adapter = r.build_adapter()
    assert isinstance(adapter, ClaudeAdapter)


def test_build_adapter_unknown(monkeypatch):
    from app import router as r
    monkeypatch.setattr(r.settings, "adapter", "unknown")
    with pytest.raises(ValueError, match="Unknown adapter"):
        r.build_adapter()


def test_build_stt_whisper(monkeypatch):
    from app import router as r
    monkeypatch.setattr(r.settings, "stt_provider", "whisper")
    from app.providers.stt.whisper import WhisperSTT
    stt = r.build_stt()
    assert isinstance(stt, WhisperSTT)


def test_build_tts_openai(monkeypatch):
    from app import router as r
    monkeypatch.setattr(r.settings, "tts_provider", "openai")
    from app.providers.tts.openai_tts import OpenAITTS
    tts = r.build_tts()
    assert isinstance(tts, OpenAITTS)


def test_build_tts_system(monkeypatch):
    from app import router as r
    monkeypatch.setattr(r.settings, "tts_provider", "system")
    from app.providers.tts.system_tts import SystemTTS
    tts = r.build_tts()
    assert isinstance(tts, SystemTTS)
