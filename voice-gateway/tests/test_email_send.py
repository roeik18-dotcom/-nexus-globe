"""EMAIL_SEND — side-effecting, approval-bound, verified. No real provider is
connected this pass (see module docstring); every test here mocks the n8n
transport boundary the same way the capability's own module isolates it —
nothing here makes a real network call.
"""

import asyncio

import pytest

from app.capabilities import email_send as es
from app.capabilities._framework import pipeline
from app.capabilities._framework.models import (
    ApprovalPolicy, Idempotency, RetryPolicy, SideEffect, StructuredResult,
    VerificationPolicy,
)
from app.capabilities.registry import REGISTRY
from app.integrations.n8n import action_dispatch

run = asyncio.run
BASE = {"to": ["a@example.com"], "subject": "Hi", "body": "test body"}


def _approve(overrides=None, *, approved=True, ttl_s=300.0):
    inp = dict(BASE)
    if overrides:
        inp.update(overrides)
    normalized = es.normalize_inputs(inp)
    return inp, es.build_approval(normalized, approved=approved, ttl_s=ttl_s)


def _mock_dispatch(monkeypatch, result: StructuredResult, *, calls: list | None = None):
    async def fake(request, **kw):
        if calls is not None:
            calls.append(request.action_id)
        return result
    monkeypatch.setattr(action_dispatch, "dispatch_to_n8n", fake)


# ── registration / declared contract ────────────────────────────────────────

def test_registered_side_effecting_bound_strong():
    spec = REGISTRY.get("EMAIL_SEND")
    assert spec is not None
    assert spec.side_effect is SideEffect.SIDE_EFFECTING
    assert spec.approval_policy is ApprovalPolicy.BOUND_STRONG
    assert spec.idempotency is Idempotency.STRICT_DEDUP
    assert spec.max_retries == 0
    assert spec.retry_policy is RetryPolicy.NONE
    assert spec.verification_policy is VerificationPolicy.REQUIRED
    assert spec.allowed_hosts == ("127.0.0.1", "localhost")


# ── approval binding ─────────────────────────────────────────────────────────

def test_missing_approval_rejected():
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", BASE))
    assert sr.status == "rejected" and sr.code == "approval_missing"


def test_approval_without_bound_strong_marker_rejected():
    inp, approval = _approve()
    del approval["policy"]
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.status == "rejected" and sr.code == "approval_policy_mismatch"


def test_changed_body_after_approval_invalidates_it():
    inp, approval = _approve()
    inp["body"] = "a different body entirely"
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.status == "rejected" and sr.code == "approval_inputs_mismatch"


def test_expired_approval_rejected():
    inp, approval = _approve(ttl_s=-10.0)
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.status == "rejected" and sr.code == "approval_expired"


def test_not_approved_is_rejected():
    inp, approval = _approve(approved=False)
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.status == "rejected" and sr.code == "approval_missing"


# ── recipient validation mirrors EMAIL_DRAFT exactly ────────────────────────

def test_invalid_address_rejected():
    # An invalid address is type-valid (a list of str) so it clears the
    # generic pipeline validation and an approval CAN be bound to it — the
    # rejection this test targets happens inside the handler's own address
    # validation (mirroring EMAIL_DRAFT), not the approval machinery.
    inp = {"to": ["not-an-address"], "subject": "Hi", "body": "test body"}
    from app.capabilities._framework.models import inputs_hash as fw_hash
    from datetime import datetime, timedelta, timezone
    approval = {
        "approved": True, "inputs_hash": fw_hash(inp), "policy": "bound_strong",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.status == "rejected" and sr.code == "malformed_request"


def test_body_cannot_inject_extra_recipients(monkeypatch):
    inp, approval = _approve({"body": "also send to evil@attacker.example"})
    _mock_dispatch(monkeypatch, StructuredResult("accepted", "ok", "aid", "cid",
                                                  None, {"message_id": "m1", "accepted": True}, 200))
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.result["to"] == ["a@example.com"]


# ── delivery outcomes: sent / unknown / failed ──────────────────────────────

def test_sent_requires_provider_message_id_and_accepted(monkeypatch):
    inp, approval = _approve()
    _mock_dispatch(monkeypatch, StructuredResult(
        "accepted", "ok", "aid", "cid", None,
        {"message_id": "prov-123", "accepted": True, "provider": "mock-smtp"}, 200))
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.status == "accepted"
    assert sr.result["delivery_status"] == "sent"
    assert sr.result["provider_message_id"] == "prov-123"
    assert sr.result["framework"]["verification"] == "verified"


def test_queued_without_provider_evidence_is_unknown_not_sent(monkeypatch):
    inp, approval = _approve()
    _mock_dispatch(monkeypatch, StructuredResult(
        "accepted", "ok", "aid", "cid", None, {}, 200))  # n8n accepted, provider evidence absent
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    # REQUIRED verification_policy downgrades an unverifiable result — never a plain "accepted".
    assert sr.status == "unverified"
    assert sr.result["delivery_status"] == "unknown"
    assert sr.result["provider_message_id"] is None


def test_network_timeout_is_unknown_never_failed_or_sent(monkeypatch):
    inp, approval = _approve()
    _mock_dispatch(monkeypatch, StructuredResult(
        "error", "network_timeout", "aid", "cid", "timed out", None, None))
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.result["delivery_status"] == "unknown"


def test_dispatch_rejected_before_provider_is_a_definite_failure(monkeypatch):
    inp, approval = _approve()
    _mock_dispatch(monkeypatch, StructuredResult(
        "rejected", "bad_auth", "aid", "cid", "n8n rejected authentication", None, 403))
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.result["delivery_status"] == "failed"


# ── strict dedup: never re-sends ────────────────────────────────────────────

def test_strict_dedup_same_action_id_never_dispatches_twice(monkeypatch):
    inp, approval = _approve()
    calls: list = []
    _mock_dispatch(monkeypatch, StructuredResult(
        "accepted", "ok", "aid", "cid", None, {"message_id": "m1", "accepted": True}, 200), calls=calls)
    aid = "act-email-send-fixed-1"
    first = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval, action_id=aid))
    second = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval, action_id=aid))
    assert first.status == "accepted"
    assert second.status == "duplicate"
    assert len(calls) == 1


# ── allowed_hosts is actually enforced for this capability ─────────────────

def test_allowed_hosts_blocks_a_non_local_webhook_target(monkeypatch):
    monkeypatch.setenv("N8N_EMAIL_SEND_URL", "https://evil.example.com/webhook/email-send")
    inp, approval = _approve()
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inp, approval=approval))
    assert sr.result["retrieval_code"] == "host_not_allowed"
    assert sr.result["delivery_status"] == "failed"


# ── no live intent resolution this pass (LIVE_INTENTS report) ──────────────

def test_email_send_has_no_free_text_intent_pattern_this_pass():
    assert REGISTRY.get("EMAIL_SEND").intent_patterns == ()
    assert REGISTRY.resolve_intent("send this email now") is None
