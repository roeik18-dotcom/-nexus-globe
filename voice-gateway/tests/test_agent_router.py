"""Tests for AgentRouter and RuleBasedRouter."""

import asyncio

import pytest

from app.agents.definition import AgentDefinition
from app.agents.router import RuleBasedRouter


def _agent(name: str) -> AgentDefinition:
    return AgentDefinition(name=name, persona=name, description=f"{name} agent")


def _agents(*names: str) -> list[AgentDefinition]:
    return [_agent(n) for n in names]


def route(router, transcript: str, *agent_names: str) -> str:
    agents = _agents(*agent_names)
    return asyncio.run(router.route(transcript, agents))


@pytest.fixture
def router() -> RuleBasedRouter:
    return RuleBasedRouter()


# --- empty agent list ---

def test_empty_agents_raises(router):
    with pytest.raises(ValueError):
        asyncio.run(router.route("hello", []))


# --- single agent always wins ---

def test_single_agent_always_routes_to_it(router):
    assert route(router, "What is the meaning of life?", "jarvis") == "jarvis"


def test_single_agent_regardless_of_keywords(router):
    assert route(router, "analyze consciousness", "jarvis") == "jarvis"


# --- philos triggers ---

def test_philosophy_keyword_routes_to_philos(router):
    assert route(router, "Let's talk about philosophy", "jarvis", "philos") == "philos"


def test_analysis_keyword_routes_to_philos(router):
    assert route(router, "Can you analyze this for me?", "jarvis", "philos") == "philos"


def test_ethics_keyword_routes_to_philos(router):
    assert route(router, "What is the ethics behind this?", "jarvis", "philos") == "philos"


def test_consciousness_routes_to_philos(router):
    assert route(router, "What is consciousness?", "jarvis", "philos") == "philos"


def test_meaning_of_routes_to_philos(router):
    assert route(router, "What is the meaning of existence?", "jarvis", "philos") == "philos"


def test_existence_keyword_routes_to_philos(router):
    assert route(router, "Talk about existence and being", "jarvis", "philos") == "philos"


def test_thought_experiment_routes_to_philos(router):
    assert route(router, "Here is a thought experiment for you", "jarvis", "philos") == "philos"


def test_moral_keyword_routes_to_philos(router):
    assert route(router, "Is this morally justified?", "jarvis", "philos") == "philos"


def test_theory_keyword_routes_to_philos(router):
    assert route(router, "Explain the theory of knowledge", "jarvis", "philos") == "philos"


# --- non-philos queries default to first agent (jarvis) ---

def test_casual_greeting_routes_to_jarvis(router):
    assert route(router, "Hello, how are you?", "jarvis", "philos") == "jarvis"


def test_task_query_routes_to_jarvis(router):
    assert route(router, "Set a reminder for tomorrow", "jarvis", "philos") == "jarvis"


def test_weather_query_routes_to_jarvis(router):
    assert route(router, "What is the weather today?", "jarvis", "philos") == "jarvis"


def test_scheduling_routes_to_jarvis(router):
    assert route(router, "Add a meeting at 3pm", "jarvis", "philos") == "jarvis"


# --- default_agent override ---

def test_default_agent_used_when_no_trigger(router):
    r = RuleBasedRouter(default_agent="philos")
    assert route(r, "What time is it?", "jarvis", "philos") == "philos"


def test_default_agent_ignored_if_not_registered():
    r = RuleBasedRouter(default_agent="research")
    # "research" not in agents → falls back to first
    assert route(r, "Hello", "jarvis", "philos") == "jarvis"


def test_default_agent_overrides_first_when_valid():
    r = RuleBasedRouter(default_agent="philos")
    result = route(r, "Remind me to call mom", "jarvis", "philos")
    assert result == "philos"


# --- philos not available → default to first ---

def test_philos_keywords_without_philos_routes_to_default(router):
    # philos not in agents → router can't route there
    result = route(router, "What is the meaning of life?", "jarvis", "research")
    assert result == "jarvis"


# --- case insensitivity ---

def test_keyword_routing_is_case_insensitive(router):
    assert route(router, "Let's ANALYZE this deeply", "jarvis", "philos") == "philos"
    assert route(router, "PHILOSOPHY of mind", "jarvis", "philos") == "philos"
