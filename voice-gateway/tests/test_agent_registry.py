"""Tests for AgentRegistry."""

import pytest

from app.agents.definition import AgentDefinition
from app.agents.registry import AgentRegistry


def _agent(name: str, persona: str = "", desc: str = "") -> AgentDefinition:
    return AgentDefinition(name=name, persona=persona or name, description=desc)


@pytest.fixture
def reg() -> AgentRegistry:
    return AgentRegistry()


# --- register ---

def test_register_adds_agent(reg):
    reg.register(_agent("jarvis"))
    assert reg.get("jarvis") is not None


def test_register_preserves_insertion_order(reg):
    reg.register(_agent("jarvis"))
    reg.register(_agent("philos"))
    reg.register(_agent("research"))
    assert reg.names() == ["jarvis", "philos", "research"]


def test_register_overwrites_on_duplicate_name(reg):
    reg.register(_agent("jarvis", desc="v1"))
    reg.register(AgentDefinition("jarvis", "jarvis", "v2"))
    assert reg.get("jarvis").description == "v2"


def test_register_duplicate_does_not_change_order(reg):
    reg.register(_agent("jarvis"))
    reg.register(_agent("philos"))
    reg.register(_agent("jarvis"))  # re-register
    assert reg.names() == ["jarvis", "philos"]


# --- get ---

def test_get_returns_none_for_unknown(reg):
    assert reg.get("ghost") is None


def test_get_returns_correct_agent(reg):
    reg.register(_agent("philos", persona="philos-v2"))
    assert reg.get("philos").persona == "philos-v2"


# --- list ---

def test_list_empty_when_no_agents(reg):
    assert reg.list() == []


def test_list_returns_all_agents(reg):
    reg.register(_agent("jarvis"))
    reg.register(_agent("philos"))
    names = [a.name for a in reg.list()]
    assert names == ["jarvis", "philos"]


def test_list_returns_copies(reg):
    reg.register(_agent("jarvis"))
    items = reg.list()
    items.clear()
    assert len(reg.list()) == 1


# --- names ---

def test_names_returns_ordered_list(reg):
    reg.register(_agent("a"))
    reg.register(_agent("b"))
    reg.register(_agent("c"))
    assert reg.names() == ["a", "b", "c"]


def test_names_empty_when_no_agents(reg):
    assert reg.names() == []


# --- agent fields ---

def test_agent_capabilities_stored(reg):
    reg.register(AgentDefinition("jarvis", "jarvis", "desc", capabilities=["tasks", "calendar"]))
    assert reg.get("jarvis").capabilities == ["tasks", "calendar"]


def test_agent_description_stored(reg):
    reg.register(AgentDefinition("jarvis", "jarvis", "Personal assistant"))
    assert reg.get("jarvis").description == "Personal assistant"
