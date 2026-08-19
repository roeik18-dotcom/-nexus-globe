"""Offline unit tests for app.integrations.n8n.client — no network calls.

Live end-to-end behavior against the real n8n instance (timeout, bad auth,
duplicate dedup, accepted echo) is proven separately by
app/integrations/n8n/proof_echo_e2e.py, which requires a running local n8n
and is not part of this offline suite.
"""

import asyncio

from app.config import settings
from app.integrations.n8n.client import (
    ActionRequest,
    _parse_structured_result,
    _sha256_hex_compact_json,
    send_echo_action_request,
)


def test_inputs_hash_matches_compact_json_sha256():
    # Must match n8n's JS: sha256(JSON.stringify(inputs)) — compact, no spaces.
    import hashlib

    inputs = {"message": "hello n8n"}
    expected = hashlib.sha256(b'{"message":"hello n8n"}').hexdigest()
    assert _sha256_hex_compact_json(inputs) == expected


def test_inputs_hash_preserves_non_ascii_unescaped():
    # JS JSON.stringify does not \uXXXX-escape non-ASCII — Python's default
    # json.dumps does unless ensure_ascii=False is set. Regression guard.
    import hashlib

    inputs = {"message": "שלום"}
    expected = hashlib.sha256('{"message":"שלום"}'.encode("utf-8")).hexdigest()
    assert _sha256_hex_compact_json(inputs) == expected


def test_action_request_never_side_effecting():
    req = ActionRequest(
        schema_version="1.0",
        action_id="a1",
        correlation_id="c1",
        created_at="2026-01-01T00:00:00Z",
        expires_at="2026-01-01T00:01:00Z",
        inputs_hash="deadbeef",
        approval=None,
        side_effecting=False,
        approval_required=False,
        provenance={"source": "test"},
        inputs={},
    )
    body = req.to_json_body()
    assert body["side_effecting"] is False
    assert body["approval_required"] is False
    assert body["approval"] is None
    for f in (
        "schema_version", "action_id", "correlation_id", "created_at",
        "expires_at", "inputs_hash", "approval", "side_effecting",
        "approval_required", "provenance", "inputs",
    ):
        assert f in body, f"missing contract field: {f}"


def test_send_echo_action_request_has_no_side_effecting_parameter():
    import inspect

    params = inspect.signature(send_echo_action_request).parameters
    assert "side_effecting" not in params
    assert "approval" not in params


def test_parse_accepted_result():
    r = _parse_structured_result(
        http_status=200,
        raw_text='{"status":"accepted","code":"ok","action_id":"a1","result":{"echo":{"x":1},"correlation_id":"c1"}}',
        sent_action_id="a1",
    )
    assert r.status == "accepted"
    assert r.code == "ok"
    assert r.result == {"echo": {"x": 1}, "correlation_id": "c1"}


def test_parse_duplicate_result():
    r = _parse_structured_result(
        http_status=200,
        raw_text='{"status":"duplicate","code":"duplicate_action_id","action_id":"a1","result":{"correlation_id":"c1"}}',
        sent_action_id="a1",
    )
    assert r.status == "duplicate"


def test_parse_rejected_result():
    r = _parse_structured_result(
        http_status=400,
        raw_text='{"status":"rejected","code":"malformed_request","message":"missing field"}',
        sent_action_id="a1",
    )
    assert r.status == "rejected"
    assert r.code == "malformed_request"


def test_parse_non_json_body_is_error_not_exception():
    r = _parse_structured_result(
        http_status=403, raw_text="Authorization data is wrong!", sent_action_id="a1"
    )
    assert r.status == "error"
    assert r.code == "invalid_response"


def test_parse_non_object_json_is_error():
    r = _parse_structured_result(http_status=200, raw_text="[1,2,3]", sent_action_id="a1")
    assert r.status == "error"


def test_parse_unknown_status_is_error():
    r = _parse_structured_result(
        http_status=200, raw_text='{"status":"totally-made-up","code":"x"}', sent_action_id="a1"
    )
    assert r.status == "error"
    assert r.code == "invalid_response"


def test_parse_missing_required_shape_never_raises():
    for bad in ("{}", "null", "true", "42", '"just a string"', ""):
        r = _parse_structured_result(http_status=200, raw_text=bad, sent_action_id="a1")
        assert r.status == "error"


def test_send_without_configured_token_fails_closed():
    original = settings.n8n_webhook_token
    settings.n8n_webhook_token = None
    try:
        result = asyncio.run(send_echo_action_request({"x": 1}))
    finally:
        settings.n8n_webhook_token = original
    assert result.status == "error"
    assert result.code == "not_configured"
