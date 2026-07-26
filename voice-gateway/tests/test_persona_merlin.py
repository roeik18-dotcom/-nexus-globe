"""Tests for Merlin persona — prompt loading, config validation, and persona isolation."""

import pytest
from pydantic import ValidationError

from app.context_builder import PersonaLayer
from app.config import Settings


# ── Prompt file ────────────────────────────────────────────────────────────────

def test_merlin_prompt_is_non_empty():
    content = PersonaLayer("merlin").render()
    assert len(content.strip()) > 0


def test_merlin_prompt_contains_identity():
    content = PersonaLayer("merlin").render()
    assert "Merlin" in content


def test_merlin_prompt_contains_no_markdown_directive():
    content = PersonaLayer("merlin").render()
    assert "markdown" in content.lower()


def test_merlin_prompt_does_not_imitate_jarvis():
    merlin = PersonaLayer("merlin").render()
    jarvis = PersonaLayer("jarvis").render()
    assert merlin != jarvis


# ── Config validation ──────────────────────────────────────────────────────────

def test_merlin_is_accepted_as_persona():
    s = Settings(persona="merlin", anthropic_api_key="dummy")
    assert s.persona == "merlin"


def test_jarvis_still_accepted():
    s = Settings(persona="jarvis", anthropic_api_key="dummy")
    assert s.persona == "jarvis"


def test_philos_still_accepted():
    s = Settings(persona="philos", anthropic_api_key="dummy")
    assert s.persona == "philos"


def test_unknown_persona_fails():
    with pytest.raises(ValidationError):
        Settings(persona="skynet", anthropic_api_key="dummy")


def test_empty_persona_fails():
    with pytest.raises(ValidationError):
        Settings(persona="", anthropic_api_key="dummy")


# ── Persona isolation — jarvis and philos behavior unchanged ───────────────────

def test_jarvis_prompt_still_loads():
    content = PersonaLayer("jarvis").render()
    assert "Jarvis" in content


def test_philos_prompt_still_loads():
    content = PersonaLayer("philos").render()
    assert len(content.strip()) > 0


def test_three_personas_are_distinct():
    merlin = PersonaLayer("merlin").render()
    jarvis = PersonaLayer("jarvis").render()
    philos = PersonaLayer("philos").render()
    assert merlin != jarvis
    assert merlin != philos
    assert jarvis != philos


# ── System prompt assembly with merlin ────────────────────────────────────────

def test_merlin_system_prompt_includes_base_and_persona():
    from app.config import build_system_prompt
    prompt = build_system_prompt("merlin")
    assert "Merlin" in prompt
    assert len(prompt) > 100
