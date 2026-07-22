"""Build STT, TTS, and adapter instances from config."""

import logging

from app.adapters.base import VoiceAdapter
from app.config import settings

logger = logging.getLogger(__name__)


def _missing_key(key: str | None) -> bool:
    """True when a key is absent, placeholder, or clearly invalid."""
    return not key or "REPLACE" in key or len(key) < 20


def _valid_anthropic_key(key: str | None) -> bool:
    return bool(key and key.startswith("sk-ant-") and len(key) > 50)


def build_adapter() -> VoiceAdapter:
    name = settings.adapter
    if name == "echo":
        from app.adapters.echo import EchoAdapter
        return EchoAdapter()
    if name == "claude":
        if not _valid_anthropic_key(settings.anthropic_api_key):
            raise ValueError(
                "ANTHROPIC_API_KEY is missing or invalid "
                "(must start with 'sk-ant-' and be >50 chars)"
            )
        from app.adapters.claude import ClaudeAdapter
        return ClaudeAdapter()
    raise ValueError(f"Unknown adapter: {name!r}")


def build_stt():
    name = settings.stt_provider
    if name == "whisper":
        if _missing_key(settings.openai_api_key):
            logger.warning("OPENAI_API_KEY not set — falling back to MockSTT (latency only)")
            from app.providers.stt.mock import MockSTT
            return MockSTT()
        from app.providers.stt.whisper import WhisperSTT
        return WhisperSTT()
    if name == "mock":
        from app.providers.stt.mock import MockSTT
        return MockSTT()
    raise ValueError(f"Unknown STT provider: {name!r}")


def build_tts():
    name = settings.tts_provider
    if name == "openai":
        if _missing_key(settings.openai_api_key):
            logger.warning("OPENAI_API_KEY not set — falling back to MockTTS (latency only)")
            from app.providers.tts.mock import MockTTS
            return MockTTS()
        from app.providers.tts.openai_tts import OpenAITTS
        return OpenAITTS()
    if name == "system":
        from app.providers.tts.system_tts import SystemTTS
        return SystemTTS()
    if name == "mock":
        from app.providers.tts.mock import MockTTS
        return MockTTS()
    raise ValueError(f"Unknown TTS provider: {name!r}")
