"""Registry: create_agent, duplicate protection, deterministic list/get, health."""

import pytest

from agent_os import AgentManifest, AgentRegistry, DuplicateAgentError, HealthState


def _mk(agent_id, primary="GENERAL"):
    return AgentManifest.from_dict({
        "agent_id": agent_id, "agent_class": "specialist", "name": agent_id.upper(),
        "role": "worker", "primary_domain": primary,
    })


def test_create_agent_registers_and_returns_record():
    reg = AgentRegistry()
    rec = reg.create_agent(_mk("x"))
    assert rec.agent_id == "x"
    assert reg.has("x")
    assert reg.get("x") is rec
    assert len(reg) == 1


def test_duplicate_id_fails():
    reg = AgentRegistry()
    reg.create_agent(_mk("dup"))
    with pytest.raises(DuplicateAgentError):
        reg.create_agent(_mk("dup"))
    assert len(reg) == 1  # unchanged


def test_list_and_ids_are_deterministic_insertion_order():
    reg = AgentRegistry()
    for aid in ["c", "a", "b"]:
        reg.create_agent(_mk(aid))
    assert reg.ids() == ["c", "a", "b"]
    assert [r.agent_id for r in reg.list()] == ["c", "a", "b"]


def test_health_defaults_unknown_no_runtime():
    reg = AgentRegistry()
    rec = reg.create_agent(_mk("h"))
    assert rec.health is HealthState.UNKNOWN  # P0 invents no runtime health
