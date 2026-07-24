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


def build_orchestrator() -> VoiceAdapter:
    """Build a multi-agent orchestrator (claude) or single adapter (echo)."""
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
        from app.agents.definition import AgentDefinition
        from app.agents.orchestrator import AgentOrchestrator
        from app.agents.registry import AgentRegistry
        from app.agents.router import RuleBasedRouter

        registry = AgentRegistry()
        registry.register(AgentDefinition(
            name="jarvis",
            persona="jarvis",
            description="Personal AI assistant for tasks, scheduling, preferences, and daily life",
            capabilities=["tasks", "preferences", "scheduling", "personal", "answers"],
        ))
        registry.register(AgentDefinition(
            name="philos",
            persona="philos",
            description="Philosophical AI for deep analysis, abstract thinking, and reasoning",
            capabilities=["analysis", "philosophy", "reasoning", "concepts", "ethics"],
        ))

        adapters: dict[str, VoiceAdapter] = {
            "jarvis": ClaudeAdapter(persona="jarvis"),
            "philos": ClaudeAdapter(persona="philos"),
        }
        router = RuleBasedRouter(default_agent=settings.persona)
        return AgentOrchestrator(registry, router, adapters)
    raise ValueError(f"Unknown adapter: {name!r}")


def build_jarvis_with_delegation() -> VoiceAdapter:
    """Jarvis adapter with Philos wired as a synchronous delegation target.

    Jarvis handles every turn; when the rule engine detects a deep-analysis
    request it calls Philos in-process, then synthesizes a unified response.
    No routing — the user always talks to Jarvis.
    """
    if not _valid_anthropic_key(settings.anthropic_api_key):
        raise ValueError(
            "ANTHROPIC_API_KEY is missing or invalid — required for delegation"
        )
    from app.adapters.claude import ClaudeAdapter
    from app.delegation.bus import DelegationBus

    bus = DelegationBus()
    bus.register("philos", ClaudeAdapter(persona="philos"))
    return ClaudeAdapter(persona="jarvis", bus=bus)


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
