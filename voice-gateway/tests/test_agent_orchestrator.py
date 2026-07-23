"""Tests for AgentOrchestrator."""

import asyncio
from typing import AsyncIterator

import pytest

from app.adapters.base import VoiceAdapter
from app.agents.definition import AgentDefinition
from app.agents.orchestrator import AgentOrchestrator
from app.agents.registry import AgentRegistry
from app.agents.router import RuleBasedRouter


# --- Stub adapter ---

class StubAdapter(VoiceAdapter):
    def __init__(self, response: str) -> None:
        self._response = response
        self.calls: list[tuple[str, str]] = []  # (text, session_id)
        self.resets: list[str] = []

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        self.calls.append((text, session_id))
        yield self._response

    async def reset(self, session_id: str) -> None:
        self.resets.append(session_id)

    @property
    def name(self) -> str:
        return f"stub:{self._response}"


def _run(coro):
    return asyncio.run(coro)


async def _collect(gen) -> list[str]:
    return [c async for c in gen]


# --- Fixtures ---

@pytest.fixture
def registry():
    reg = AgentRegistry()
    reg.register(AgentDefinition("jarvis", "jarvis", "Personal assistant", ["tasks"]))
    reg.register(AgentDefinition("philos", "philos", "Philosopher", ["analysis"]))
    return reg


@pytest.fixture
def jarvis_adapter():
    return StubAdapter("Jarvis here.")


@pytest.fixture
def philos_adapter():
    return StubAdapter("Philos here.")


@pytest.fixture
def adapters(jarvis_adapter, philos_adapter):
    return {"jarvis": jarvis_adapter, "philos": philos_adapter}


@pytest.fixture
def orchestrator(registry, adapters):
    return AgentOrchestrator(registry, RuleBasedRouter(), adapters)


# --- routing ---

def test_routes_to_jarvis_by_default(orchestrator, jarvis_adapter):
    _run(_collect(orchestrator.respond("Hello", "s1")))
    assert len(jarvis_adapter.calls) == 1


def test_routes_to_philos_on_philosophy_keyword(orchestrator, philos_adapter):
    _run(_collect(orchestrator.respond("What is the meaning of existence?", "s1")))
    assert len(philos_adapter.calls) == 1


def test_routes_to_philos_on_analysis_keyword(orchestrator, philos_adapter):
    _run(_collect(orchestrator.respond("Can you analyze this?", "s1")))
    assert len(philos_adapter.calls) == 1


def test_non_triggered_query_does_not_call_philos(orchestrator, philos_adapter):
    _run(_collect(orchestrator.respond("Set a reminder", "s1")))
    assert len(philos_adapter.calls) == 0


# --- streaming ---

def test_streams_response_chunks(orchestrator):
    chunks = _run(_collect(orchestrator.respond("Hello", "s1")))
    assert chunks == ["Jarvis here."]


def test_philos_response_streamed(orchestrator):
    chunks = _run(_collect(orchestrator.respond("What is consciousness?", "s1")))
    assert chunks == ["Philos here."]


# --- session pass-through ---

def test_session_id_passed_to_adapter(orchestrator, jarvis_adapter):
    _run(_collect(orchestrator.respond("Hi", "session-42")))
    assert jarvis_adapter.calls[0][1] == "session-42"


def test_transcript_passed_to_adapter(orchestrator, jarvis_adapter):
    _run(_collect(orchestrator.respond("What time is it?", "s1")))
    assert jarvis_adapter.calls[0][0] == "What time is it?"


# --- reset ---

def test_reset_calls_all_adapters(orchestrator, jarvis_adapter, philos_adapter):
    _run(orchestrator.reset("s1"))
    assert "s1" in jarvis_adapter.resets
    assert "s1" in philos_adapter.resets


def test_reset_passes_session_id(orchestrator, jarvis_adapter):
    _run(orchestrator.reset("my-session"))
    assert "my-session" in jarvis_adapter.resets


# --- name ---

def test_orchestrator_name_is_orchestrator(orchestrator):
    assert orchestrator.name == "orchestrator"


# --- fallback on unknown agent ---

def test_fallback_to_first_adapter_when_router_returns_unknown(registry, adapters):
    class BrokenRouter(RuleBasedRouter):
        async def route(self, transcript, agents):
            return "nonexistent-agent"

    orch = AgentOrchestrator(registry, BrokenRouter(), adapters)
    chunks = _run(_collect(orch.respond("Hello", "s1")))
    # Should not raise; falls back to first adapter (jarvis)
    assert chunks == ["Jarvis here."]


# --- no adapters ---

def test_no_adapters_raises_on_respond():
    reg = AgentRegistry()
    reg.register(AgentDefinition("jarvis", "jarvis", "test"))
    orch = AgentOrchestrator(reg, RuleBasedRouter(), {})
    with pytest.raises(RuntimeError):
        _run(_collect(orch.respond("Hello", "s1")))


# --- single agent ---

def test_single_agent_always_called(registry, jarvis_adapter):
    single_reg = AgentRegistry()
    single_reg.register(AgentDefinition("jarvis", "jarvis", "desc"))
    orch = AgentOrchestrator(single_reg, RuleBasedRouter(), {"jarvis": jarvis_adapter})
    _run(_collect(orch.respond("What is consciousness?", "s1")))
    assert len(jarvis_adapter.calls) == 1


# --- multiple turns ---

def test_consecutive_turns_routed_independently(orchestrator, jarvis_adapter, philos_adapter):
    _run(_collect(orchestrator.respond("Set a reminder", "s1")))        # → jarvis
    _run(_collect(orchestrator.respond("Analyze this concept", "s1")))  # → philos
    _run(_collect(orchestrator.respond("What time is it?", "s1")))      # → jarvis
    assert len(jarvis_adapter.calls) == 2
    assert len(philos_adapter.calls) == 1
