"""Default-deny proof: a manifest that omits access grants NONE."""

from agent_os import AgentManifest, Authority, Domain, Status


def _min():
    # the smallest legal manifest: identity + primary domain only
    return AgentManifest.from_dict({
        "agent_id": "d1", "agent_class": "specialist", "name": "D1",
        "role": "worker", "primary_domain": "GENERAL",
    })


def test_missing_memory_scope_is_deny_all():
    m = _min()
    assert m.memory_scope.read == frozenset()
    assert m.memory_scope.write == frozenset()


def test_missing_tool_scope_is_deny_all():
    m = _min()
    assert m.allowed_tools == frozenset()
    assert m.denied_tools == frozenset()


def test_missing_capabilities_is_empty():
    assert _min().capabilities == frozenset()


def test_missing_authority_is_none():
    assert _min().authority is Authority.NONE


def test_cross_domain_absent_unless_declared():
    m = _min()
    # only the primary domain; no MUSIC/HUMAN_CONFIG/PHILOS/STUDIO/SYSTEM leaked in
    assert m.allowed_domains == frozenset({Domain.GENERAL})
    assert m.knowledge_sources == frozenset()


def test_system_not_reachable_by_defaults():
    m = _min()
    assert Domain.SYSTEM not in m.allowed_domains
    assert m.authority is not Authority.SYSTEM


def test_missing_channels_deny_all():
    m = _min()
    assert m.input_channels == frozenset()
    assert m.output_channels == frozenset()


def test_status_defaults_disabled():
    assert _min().status is Status.DISABLED
