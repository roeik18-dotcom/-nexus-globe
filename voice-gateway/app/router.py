"""Build STT, TTS, and adapter instances from config."""

import logging

from app.adapters.base import VoiceAdapter
from app.config import settings

logger = logging.getLogger(__name__)


def build_adapter() -> VoiceAdapter:
    name = settings.adapter
    if name == "claude":
        from app.adapters.claude import ClaudeAdapter
        return ClaudeAdapter()
    # Phase 2: JARVIS adapter
    # if name == "jarvis":
    #     from app.adapters.jarvis import JarvisAdapter
    #     return JarvisAdapter()
    # Phase 3: Philos adapter
    # if name == "philos":
    #     from app.adapters.philos import PhilosAdapter
    #     return PhilosAdapter()
    raise ValueError(f"Unknown adapter: {name!r}")


def build_stt():
    name = settings.stt_provider
    if name == "whisper":
        from app.providers.stt.whisper import WhisperSTT
        return WhisperSTT()
    raise ValueError(f"Unknown STT provider: {name!r}")


def build_tts():
    name = settings.tts_provider
    if name == "openai":
        from app.providers.tts.openai_tts import OpenAITTS
        return OpenAITTS()
    if name == "system":
        from app.providers.tts.system_tts import SystemTTS
        return SystemTTS()
    raise ValueError(f"Unknown TTS provider: {name!r}")
