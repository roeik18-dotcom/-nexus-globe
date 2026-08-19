"""Regression tests for the 2026-08-07 control-surface consistency fix:

/api/runtime/interrupt on dashboard/runtime_server.py ("Control Center",
port 8799) used to hardcode a 501 "unsupported" response, and the config
schema used to unconditionally reject turn_control.interruptions_enabled=true
— both citing a stale BARGE_IN_ENABLED=False that predates this session's
real barge-in implementation. These tests prove the fix reflects real,
current runtime capability rather than a fake/stub response, in either
direction (supported / not supported).

Scope note: this does NOT test that /api/runtime/interrupt actually executes
a live interrupt — it never did and still doesn't; this console has no IPC
channel to the running merlin_service.py process. It only tests that the
response no longer lies about capability. See dashboard/runtime_server.py's
runtime_interrupt() docstring/comment for why that's the correct fix.
"""

from fastapi.testclient import TestClient

import dashboard.runtime_server as rs

client = TestClient(rs.app)


def test_interrupt_returns_501_when_runtime_lacks_barge_in(monkeypatch):
    monkeypatch.setattr(rs, "live_barge_in_supported", lambda: False)
    r = client.post("/api/runtime/interrupt")
    assert r.status_code == 501
    assert r.json()["status"] == "unsupported"


def test_interrupt_no_longer_fakes_501_when_runtime_supports_barge_in(monkeypatch):
    monkeypatch.setattr(rs, "live_barge_in_supported", lambda: True)
    r = client.post("/api/runtime/interrupt")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] != "unsupported"
    assert "BARGE_IN_ENABLED=True" in body["reason"]


def test_interrupt_does_not_claim_to_have_executed_anything(monkeypatch):
    """This console has no live control channel — the fix must not overclaim
    an executed interrupt just because the capability exists."""
    monkeypatch.setattr(rs, "live_barge_in_supported", lambda: True)
    r = client.post("/api/runtime/interrupt")
    body = r.json()
    assert body["status"] == "capability_confirmed_not_executed"
    assert "control_panel" in body["reason"] or "stop_speaking" in body["reason"]


def test_capabilities_map_reflects_active_when_supported(monkeypatch):
    monkeypatch.setattr(rs, "live_barge_in_supported", lambda: True)
    caps = rs._capabilities_snapshot()
    assert caps["turn_control.interruptions_enabled"]["status"] == "ACTIVE"


def test_capabilities_map_reflects_not_implemented_when_unsupported(monkeypatch):
    monkeypatch.setattr(rs, "live_barge_in_supported", lambda: False)
    caps = rs._capabilities_snapshot()
    assert caps["turn_control.interruptions_enabled"]["status"] == "NOT_IMPLEMENTED"


def test_get_control_endpoint_uses_the_live_capabilities_snapshot(monkeypatch):
    """GET /api/control is read-only here — only the capability computation is
    mocked, real on-disk config is read as-is."""
    monkeypatch.setattr(rs, "live_barge_in_supported", lambda: True)
    r = client.get("/api/control")
    assert r.status_code == 200
    assert r.json()["capabilities"]["turn_control.interruptions_enabled"]["status"] == "ACTIVE"
