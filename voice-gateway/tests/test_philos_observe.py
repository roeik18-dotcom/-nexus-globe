"""PHILOS_OBSERVE — the only path Merlin ever uses to write a canon
Observation. No test here makes a real network call (matching this
codebase's established convention for external providers); every test uses
a mocked httpx transport. Real, live network behaviour against the actual
PHILOS server is demonstrated separately (see the phase report).
"""

import asyncio

import httpx
import pytest

from app.capabilities import philos_observe as po
from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

run = asyncio.run

VALID_INPUTS = {
    "subject": "person_e2e",
    "domain": "E",
    "frame": "I",
    "level": -0.3,
    "stability": 0.5,
    "deficit_type": "RELATIVE",
    "context": "evening_session",
    "reference": "self_goal:baseline_energy",
    "confidence": 0.8,
    "expiry_days": 90,
}


def _mock_client(monkeypatch, responder):
    transport = httpx.MockTransport(responder)
    real_init = httpx.AsyncClient.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)


def test_registered_read_only_no_approval_no_free_text_intent():
    spec = REGISTRY.get("PHILOS_OBSERVE")
    assert spec is not None
    assert spec.side_effect.value == "read_only"
    assert spec.approval_policy.value == "none"
    assert spec.idempotency.value == "pure"
    assert spec.intent_patterns == ()


def test_deterministic_canon_event_id_same_evidence_same_id():
    id1 = po.deterministic_canon_event_id(VALID_INPUTS)
    id2 = po.deterministic_canon_event_id(dict(VALID_INPUTS))
    assert id1 == id2
    assert id1.startswith("canon_evt_merlin_")


def test_deterministic_canon_event_id_different_evidence_different_id():
    other = dict(VALID_INPUTS, level=-0.9)
    assert po.deterministic_canon_event_id(VALID_INPUTS) != po.deterministic_canon_event_id(other)


def test_no_token_makes_no_network_call(monkeypatch):
    monkeypatch.delenv("PHILOS_CANON_INGEST_TOKEN", raising=False)
    called = {"n": 0}

    def responder(request):
        called["n"] += 1
        return httpx.Response(201, json={"event": {}})

    _mock_client(monkeypatch, responder)
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", VALID_INPUTS))
    assert sr.result["ingested"] is False
    assert sr.result["error"] == "not_configured"
    assert called["n"] == 0


def test_success_201(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    captured = {}

    def responder(request):
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(201, json={"event": {}})

    _mock_client(monkeypatch, responder)
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", VALID_INPUTS))
    assert sr.status == "accepted"
    assert sr.result["ingested"] is True
    assert sr.result["duplicate"] is False
    assert sr.result["canon_event_id"] == po.deterministic_canon_event_id(VALID_INPUTS)
    assert captured["url"].endswith("/api/canon/observations")
    assert captured["auth"] == "Bearer test-secret"


def test_409_duplicate_is_treated_as_success_not_error(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    _mock_client(monkeypatch, lambda r: httpx.Response(409, json={"error": "append_rejected"}))
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", VALID_INPUTS))
    assert sr.result["ingested"] is True
    assert sr.result["duplicate"] is True
    assert sr.result["canon_event_id"] == po.deterministic_canon_event_id(VALID_INPUTS)


def test_401_unauthorized_honest(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "wrong")
    _mock_client(monkeypatch, lambda r: httpx.Response(401, json={"error": "unauthorized"}))
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", VALID_INPUTS))
    assert sr.result["ingested"] is False
    assert sr.result["error"] == "unauthorized"
    assert sr.result["canon_event_id"] is None


def test_400_invalid_observation_honest(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    _mock_client(monkeypatch, lambda r: httpx.Response(400, json={"error": "invalid_observation"}))
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", VALID_INPUTS))
    assert sr.result["ingested"] is False
    assert sr.result["error"] == "invalid_observation"


def test_network_error_never_fakes_success(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")

    def responder(request):
        raise httpx.ConnectError("down", request=request)

    _mock_client(monkeypatch, responder)
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", VALID_INPUTS))
    assert sr.result["ingested"] is False
    assert sr.result["error"] == "network_error"


# ── never-invent-a-default proofs ───────────────────────────────────────────

def test_missing_required_fields_rejected_before_any_call(monkeypatch):
    called = {"n": 0}
    _mock_client(monkeypatch, lambda r: (called.__setitem__("n", called["n"] + 1), httpx.Response(201, json={}))[1])
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    incomplete = {k: v for k, v in VALID_INPUTS.items() if k != "level"}
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", incomplete))
    assert sr.status == "rejected" and sr.code == "missing_input"
    assert called["n"] == 0


@pytest.mark.parametrize("field,bad_value", [
    ("domain", "X"), ("frame", "Q"), ("deficit_type", "NOPE"), ("confidence", 1.5), ("expiry_days", -1),
])
def test_invalid_field_values_rejected(field, bad_value, monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    bad = dict(VALID_INPUTS, **{field: bad_value})
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", bad))
    assert sr.status == "rejected" and sr.code == "malformed_request"


def test_systemic_channel_required_when_frame_is_S():
    bad = dict(VALID_INPUTS, frame="S")
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", bad))
    assert sr.status == "rejected" and sr.code == "malformed_request"


def test_systemic_channel_accepted_when_frame_is_S(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    _mock_client(monkeypatch, lambda r: httpx.Response(201, json={"event": {}}))
    good = dict(VALID_INPUTS, frame="S", systemic_channel="economic")
    sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", good))
    assert sr.status == "accepted"


def test_input_cannot_set_control_fields():
    for bad_key in ("side_effecting", "approval_required", "approval", "action_type"):
        sr = run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", dict(VALID_INPUTS, **{bad_key: True})))
        assert sr.status == "rejected" and sr.code == "malformed_request", bad_key


def test_provenance_is_always_self_reported_never_caller_supplied(monkeypatch):
    """provenance is not an input at all — this test proves it structurally:
    supplying it does nothing (framework strips unknown inputs), and the
    handler always sends 'self_reported' regardless."""
    monkeypatch.setenv("PHILOS_CANON_INGEST_TOKEN", "test-secret")
    captured = {}

    def responder(request):
        import json
        captured["body"] = json.loads(request.content)
        return httpx.Response(201, json={"event": {}})

    _mock_client(monkeypatch, responder)
    run(pipeline.execute(REGISTRY, "PHILOS_OBSERVE", dict(VALID_INPUTS, provenance="third_party")))
    assert captured["body"]["observation"]["provenance"] == "self_reported"


def test_never_imports_action_registry_execution_of_transfer():
    """AST-based, not substring search — this module's own docstring
    legitimately DISCUSSES philos_transfer_execute/pipeline.execute in
    prose; only an actual import or call expression should fail this check."""
    import ast
    import inspect
    tree = ast.parse(inspect.getsource(po))
    imported = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.append(node.module)
        elif isinstance(node, ast.Call):
            func = node.func
            name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
            assert name != "execute", ast.dump(node)
    assert not any("philos_transfer_execute" in m for m in imported), imported
