"""Manifest schema + invariant tests (closed vocab, interface != system)."""

import dataclasses

import pytest

from agent_os import (
    AgentClass, Authority, Domain, AgentManifest,
    ManifestValidationError, DomainError, CapabilityError,
)


def _base(**over):
    d = {
        "agent_id": "a1", "agent_class": "specialist", "name": "A1",
        "role": "worker", "primary_domain": "GENERAL",
    }
    d.update(over)
    return d


def test_valid_minimal_manifest_loads():
    m = AgentManifest.from_dict(_base())
    assert m.agent_id == "a1"
    assert m.primary_domain is Domain.GENERAL
    assert m.agent_class is AgentClass.SPECIALIST


def test_unknown_domain_fails():
    with pytest.raises(DomainError):
        AgentManifest.from_dict(_base(primary_domain="ATLANTIS"))


def test_unknown_domain_in_allowed_fails():
    with pytest.raises(ManifestValidationError):
        AgentManifest.from_dict(_base(allowed_domains=["GENERAL", "NOPE"]))


def test_unknown_capability_fails():
    with pytest.raises(CapabilityError):
        AgentManifest.from_dict(_base(capabilities=["mind_control"]))


def test_known_capability_ok():
    m = AgentManifest.from_dict(_base(capabilities=["network"]))
    assert any(c.value == "network" for c in m.capabilities)


def test_interface_cannot_have_system_authority():
    with pytest.raises(ManifestValidationError):
        AgentManifest.from_dict(_base(agent_class="interface", authority="system"))


def test_interface_cannot_access_system_domain():
    with pytest.raises(DomainError):
        AgentManifest.from_dict(
            _base(agent_class="interface", primary_domain="GENERAL",
                  allowed_domains=["GENERAL", "SYSTEM"])
        )


def test_system_domain_requires_system_class_and_elevated_authority():
    # specialist cannot reach SYSTEM
    with pytest.raises(DomainError):
        AgentManifest.from_dict(_base(agent_class="specialist", allowed_domains=["GENERAL", "SYSTEM"]))
    # system class but authority too low
    with pytest.raises(DomainError):
        AgentManifest.from_dict(
            _base(agent_class="system", authority="standard",
                  primary_domain="SYSTEM", allowed_domains=["SYSTEM"])
        )
    # correct: system class + elevated authority
    m = AgentManifest.from_dict(
        _base(agent_class="system", authority="elevated",
              primary_domain="SYSTEM", allowed_domains=["SYSTEM"])
    )
    assert Domain.SYSTEM in m.allowed_domains


def test_primary_domain_always_in_allowed():
    m = AgentManifest.from_dict(_base(primary_domain="PHILOS", allowed_domains=["GENERAL"]))
    assert Domain.PHILOS in m.allowed_domains  # auto-added


def test_manifest_is_frozen():
    m = AgentManifest.from_dict(_base())
    with pytest.raises(dataclasses.FrozenInstanceError):
        m.authority = Authority.SYSTEM  # type: ignore[misc]


def test_max_concurrency_must_be_positive():
    with pytest.raises(ManifestValidationError):
        AgentManifest.from_dict(_base(runtime_limits={"max_concurrency": 0}))
