"""Unit tests for DelegationBus v1 and the keyword rule engine."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.delegation.bus import DelegationBus, DelegationRequest, DelegationResult
from app.delegation.rules import should_delegate


# ---------------------------------------------------------------------------
# Stub adapters
# ---------------------------------------------------------------------------

class _YieldAdapter:
    """Adapter that yields a fixed sequence of chunks."""
    def __init__(self, *chunks: str) -> None:
        self._chunks = chunks

    async def respond(self, text: str, session_id: str):
        for chunk in self._chunks:
            yield chunk

    async def reset(self, session_id: str) -> None:
        pass

    @property
    def name(self) -> str:
        return "yield"


class _ErrorAdapter:
    """Adapter that raises on the first iteration."""
    async def respond(self, text: str, session_id: str):
        raise RuntimeError("adapter failure")
        yield  # makes this an async generator

    async def reset(self, session_id: str) -> None:
        pass

    @property
    def name(self) -> str:
        return "error"


# ---------------------------------------------------------------------------
# DelegationRequest / DelegationResult
# ---------------------------------------------------------------------------

def test_delegation_request_fields():
    req = DelegationRequest(target="philos", purpose="deep_analysis", prompt="why?")
    assert req.target == "philos"
    assert req.purpose == "deep_analysis"
    assert req.prompt == "why?"
    assert req.context == {}


def test_delegation_request_context():
    req = DelegationRequest(
        target="philos", purpose="test", prompt="hi",
        context={"parent_session": "sess-1"},
    )
    assert req.context["parent_session"] == "sess-1"


def test_delegation_result_fields():
    r = DelegationResult(agent="philos", content="deep thoughts")
    assert r.agent == "philos"
    assert r.content == "deep thoughts"
    assert r.error is None
    assert r.metadata == {}


def test_delegation_result_error():
    r = DelegationResult(agent="philos", content="", error="oops")
    assert r.error == "oops"


# ---------------------------------------------------------------------------
# DelegationBus
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bus_registered_adapter_returns_content():
    bus = DelegationBus()
    bus.register("philos", _YieldAdapter("deep ", "insight"))
    req = DelegationRequest(target="philos", purpose="analysis", prompt="why?")
    result = await bus.call(req)
    assert result.agent == "philos"
    assert result.content == "deep insight"
    assert result.error is None


@pytest.mark.asyncio
async def test_bus_collects_single_chunk():
    bus = DelegationBus()
    bus.register("philos", _YieldAdapter("answer"))
    req = DelegationRequest(target="philos", purpose="test", prompt="hi")
    result = await bus.call(req)
    assert result.content == "answer"


@pytest.mark.asyncio
async def test_bus_metadata_includes_purpose():
    bus = DelegationBus()
    bus.register("philos", _YieldAdapter("ok"))
    req = DelegationRequest(target="philos", purpose="deep_analysis", prompt="test")
    result = await bus.call(req)
    assert result.metadata.get("purpose") == "deep_analysis"


@pytest.mark.asyncio
async def test_bus_unregistered_target_returns_error():
    bus = DelegationBus()
    req = DelegationRequest(target="unknown", purpose="test", prompt="hi")
    result = await bus.call(req)
    assert result.error is not None
    assert "unknown" in result.error
    assert result.content == ""


@pytest.mark.asyncio
async def test_bus_adapter_exception_returns_error():
    bus = DelegationBus()
    bus.register("philos", _ErrorAdapter())
    req = DelegationRequest(target="philos", purpose="test", prompt="hi")
    result = await bus.call(req)
    assert result.error is not None
    assert result.content == ""


@pytest.mark.asyncio
async def test_bus_session_id_uses_parent_session():
    """Delegation session is scoped to the parent session, not a random uuid."""
    recorded: list[str] = []

    class _RecordingAdapter:
        async def respond(self, text: str, session_id: str):
            recorded.append(session_id)
            yield "ok"
        async def reset(self, session_id: str): pass
        @property
        def name(self): return "recording"

    bus = DelegationBus()
    bus.register("philos", _RecordingAdapter())
    req = DelegationRequest(
        target="philos", purpose="analysis", prompt="hi",
        context={"parent_session": "sess-abc"},
    )
    await bus.call(req)
    assert "sess-abc" in recorded[0]


# ---------------------------------------------------------------------------
# Rule engine
# ---------------------------------------------------------------------------

def test_should_delegate_english_analyze():
    assert should_delegate("Can you analyze this approach?") == "philos"


def test_should_delegate_english_theory():
    assert should_delegate("What is the theory behind attention?") == "philos"


def test_should_delegate_english_philosophy():
    assert should_delegate("philosophy of mind is complex") == "philos"


def test_should_delegate_english_implications():
    assert should_delegate("What are the implications of this?") == "philos"


def test_should_delegate_hebrew_analyze():
    assert should_delegate("לנתח את הבעיה") == "philos"


def test_should_delegate_hebrew_why():
    assert should_delegate("למה זה קורה?") == "philos"


def test_should_delegate_simple_returns_none():
    assert should_delegate("What time is it?") is None
    assert should_delegate("Remind me to call the doctor at noon.") is None
    assert should_delegate("What are my tasks for today?") is None


def test_should_delegate_case_insensitive():
    assert should_delegate("ANALYZE this please") == "philos"
    assert should_delegate("PHILOSOPHY of science") == "philos"
