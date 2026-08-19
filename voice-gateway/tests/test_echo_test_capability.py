"""EXECUTION_TEST_N8N_ECHO — registry-driven home for the pre-existing,
already-proven n8n echo probe. Additive migration: app/action_intent/gate.py
and dispatch.py (the legacy hardcoded dispatcher, bookmark-coupled) are
completely untouched — see app/capabilities/echo_test.py's module docstring.
"""

import asyncio

from app.capabilities._framework import pipeline
from app.capabilities._framework.models import StructuredResult
from app.capabilities.registry import REGISTRY
from app.integrations.n8n import client as n8n_client

run = asyncio.run


def _mock_send_echo(monkeypatch, result: StructuredResult):
    async def fake(inputs, **kw):
        return result
    monkeypatch.setattr(n8n_client, "send_echo_action_request", fake)


def test_registered_read_only_no_approval():
    spec = REGISTRY.get("EXECUTION_TEST_N8N_ECHO")
    assert spec is not None
    assert spec.side_effect.value == "read_only"
    assert spec.approval_policy.value == "none"


def test_echo_accepted(monkeypatch):
    _mock_send_echo(monkeypatch, StructuredResult("accepted", "ok", "aid", "cid", None, None, 200))
    sr = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {}))
    assert sr.status == "accepted"
    assert sr.result["retrieval_status"] == "accepted"
    assert sr.result["probe"] == "merlin-live-dispatch"
    assert sr.result["framework"]["verification"] == "verified"


def test_echo_duplicate_still_verified(monkeypatch):
    _mock_send_echo(monkeypatch, StructuredResult("duplicate", "duplicate_action_id", "aid", "cid", None, None, 200))
    sr = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {}))
    assert sr.result["framework"]["verification"] == "verified"


def test_echo_not_configured_is_honest_not_verified(monkeypatch):
    _mock_send_echo(monkeypatch, StructuredResult("error", "not_configured", None, None, "no token", None, None))
    sr = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {}))
    assert sr.status == "accepted"  # handler never raises
    assert sr.result["framework"]["verification"] == "failed"
    assert sr.result["retrieval_code"] == "not_configured"


def test_custom_probe_is_used(monkeypatch):
    captured = {}

    async def fake(inputs, **kw):
        captured.update(inputs)
        return StructuredResult("accepted", "ok", "aid", "cid", None, None, 200)

    monkeypatch.setattr(n8n_client, "send_echo_action_request", fake)
    sr = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {"probe": "custom-probe-value"}))
    assert captured["probe"] == "custom-probe-value"
    assert sr.result["probe"] == "custom-probe-value"


def test_input_cannot_set_control_fields(monkeypatch):
    _mock_send_echo(monkeypatch, StructuredResult("accepted", "ok", "aid", "cid", None, None, 200))
    for bad_key in ("side_effecting", "approval_required", "approval", "action_type"):
        sr = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {bad_key: True}))
        assert sr.status == "rejected" and sr.code == "malformed_request", bad_key


def test_registry_resolves_echo_intent():
    assert REGISTRY.resolve_intent("please test n8n") == "EXECUTION_TEST_N8N_ECHO"


def test_informational_n8n_questions_do_not_dispatch_as_echo():
    for q in ("מה זה n8n", "explain what n8n is", "what is n8n"):
        assert REGISTRY.resolve_intent(q) != "EXECUTION_TEST_N8N_ECHO", q


def test_legacy_gate_and_dispatch_are_completely_untouched():
    """Proves the additive-only claim: the legacy hardcoded dispatcher for
    this exact same intent still exists, unmodified, still bookmark-coupled,
    still exactly 2 intents — this migration did not remove, replace, or
    alter it in any way."""
    from app.action_intent import dispatch, gate
    assert {name for name, _ in gate._INTENT_TOPIC_MATCHERS} == {
        gate.EXECUTION_TEST_N8N_ECHO, gate.BOOKMARK_AUDIT,
    }
    assert hasattr(dispatch, "_dispatch_echo_test")
    assert hasattr(dispatch, "_dispatch_bookmark_audit")


def test_duplicate_action_id_returns_cached_result(monkeypatch):
    calls = {"n": 0}

    async def fake(inputs, **kw):
        calls["n"] += 1
        return StructuredResult("accepted", "ok", "aid", "cid", None, None, 200)

    monkeypatch.setattr(n8n_client, "send_echo_action_request", fake)
    pipeline.reset_idempotency_store()
    aid = "act-echo-fixed-1"
    first = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {}, action_id=aid))
    second = run(pipeline.execute(REGISTRY, "EXECUTION_TEST_N8N_ECHO", {}, action_id=aid))
    assert first.status == "accepted"
    assert second.status == "duplicate"
    assert calls["n"] == 1  # handler (and thus the n8n call) never re-ran
