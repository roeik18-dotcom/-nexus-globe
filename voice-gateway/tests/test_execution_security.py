"""EXECUTION SECURITY CONTRACT — registry-authoritative fields, anti-escalation,
timeout enforcement, verification_policy enforcement, and BOUND_STRONG approval
binding. Extends the existing framework acceptance suite
(tests/test_capability_framework.py); does not touch any registered capability.
"""

import asyncio

import pytest

from app.capabilities._framework import pipeline
from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, DataTrust, Executor, Idempotency, InputField,
    NetworkScope, RetryPolicy, SideEffect, VerificationPolicy,
)
from app.capabilities._framework.registry import ActionRegistry
from app.capabilities.registry import REGISTRY
from app.integrations.n8n.action_dispatch import _host_allowed

run = asyncio.run


# ── derived defaults on the 8 pre-existing (unmodified) capabilities ────────

def test_local_capability_gets_truthful_derived_defaults():
    spec = REGISTRY.get("MONTHLY_PAYMENT")
    assert spec.network_scope is NetworkScope.NONE
    assert spec.credential_scope == "none"
    assert spec.data_trust is DataTrust.INTERNAL
    assert spec.retry_policy is RetryPolicy.NONE
    assert spec.verification_policy is VerificationPolicy.OPTIONAL  # unchanged behaviour


def test_n8n_capability_gets_truthful_derived_defaults():
    spec = REGISTRY.get("WEB_RESEARCH")
    assert spec.network_scope is NetworkScope.N8N_ONLY
    assert spec.credential_scope == "n8n_webhook_token"
    assert spec.data_trust is DataTrust.EXTERNAL_UNTRUSTED
    assert spec.retry_policy is RetryPolicy.LIMITED  # max_retries=2


def test_retry_policy_none_requires_zero_max_retries():
    with pytest.raises(ValueError):
        ActionSpec(
            action_type="X", capability="x", executor=Executor.LOCAL,
            side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
            idempotency=Idempotency.PURE, timeout_s=1.0, max_retries=3,
            required_inputs=(), output_fields=(), verification="v",
            provenance_requirements=(), retry_policy=RetryPolicy.NONE,
        )


def test_side_effecting_action_cannot_have_approval_none():
    with pytest.raises(ValueError):
        ActionSpec(
            action_type="X", capability="x", executor=Executor.LOCAL,
            side_effect=SideEffect.SIDE_EFFECTING, approval_policy=ApprovalPolicy.NONE,
            idempotency=Idempotency.STRICT_DEDUP, timeout_s=1.0, max_retries=0,
            required_inputs=(), output_fields=(), verification="v",
            provenance_requirements=(),
        )


# ── inputs can never set the new control fields either ─────────────────────

def test_inputs_cannot_set_execution_security_fields():
    for bad_key in ("network_scope", "allowed_hosts", "credential_scope", "data_trust",
                     "retry_policy", "verification_policy"):
        inputs = {"price": 1, "down_payment": 0, "apr": 0, "term_months": 1,
                  "fees": [], "currency": "USD", bad_key: "anything"}
        sr = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", inputs))
        assert sr.status == "rejected" and sr.code == "malformed_request", bad_key


# ── timeout enforcement (registry-authoritative, actually enforced) ────────

def _slow_handler(inputs, request=None):
    async def _inner():
        await asyncio.sleep(0.2)
        return {"ok": True}
    return _inner()


def test_timeout_s_is_enforced_for_async_handlers():
    reg = ActionRegistry()
    reg.register(ActionSpec(
        action_type="SLOW", capability="slow", executor=Executor.LOCAL,
        side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
        idempotency=Idempotency.PURE, timeout_s=0.01, max_retries=0,
        required_inputs=(), output_fields=(), verification="v",
        provenance_requirements=(), handler=_slow_handler,
    ))
    sr = run(pipeline.execute(reg, "SLOW", {}))
    assert sr.status == "error" and sr.code == "timeout"


# ── verification_policy enforcement ─────────────────────────────────────────

def _handler_ok(inputs, request=None):
    return {"value": inputs.get("value")}


def _verifier_fail(inputs, result):
    return False, "always fails for this test"


def _make_registry(verification_policy):
    reg = ActionRegistry()
    reg.register(ActionSpec(
        action_type="STRICT", capability="strict", executor=Executor.LOCAL,
        side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
        idempotency=Idempotency.PURE, timeout_s=1.0, max_retries=0,
        required_inputs=(InputField("value", (int,), required=False),),
        output_fields=("value",), verification="always_fails",
        provenance_requirements=(), handler=_handler_ok, verifier=_verifier_fail,
        verification_policy=verification_policy,
    ))
    return reg


def test_verification_policy_optional_still_accepts_on_failed_verify():
    reg = _make_registry(VerificationPolicy.OPTIONAL)
    sr = run(pipeline.execute(reg, "STRICT", {"value": 1}))
    assert sr.status == "accepted"
    assert sr.result["framework"]["verification"] == "failed"


def test_verification_policy_required_downgrades_to_unverified():
    reg = _make_registry(VerificationPolicy.REQUIRED)
    sr = run(pipeline.execute(reg, "STRICT", {"value": 1}))
    assert sr.status == "unverified"
    assert sr.code == "verification_failed"


def test_verification_policy_required_strict_rejects():
    reg = _make_registry(VerificationPolicy.REQUIRED_STRICT)
    sr = run(pipeline.execute(reg, "STRICT", {"value": 1}))
    assert sr.status == "rejected"
    assert sr.code == "verification_failed"


# ── BOUND_STRONG approval binding cannot be satisfied by a plain BOUND approval ──

def _side_effecting_handler(inputs, request=None):
    return {"done": True}


def test_bound_strong_rejects_approval_without_explicit_policy_marker():
    reg = ActionRegistry()
    reg.register(ActionSpec(
        action_type="STRONG", capability="strong", executor=Executor.LOCAL,
        side_effect=SideEffect.SIDE_EFFECTING, approval_policy=ApprovalPolicy.BOUND_STRONG,
        idempotency=Idempotency.STRICT_DEDUP, timeout_s=1.0, max_retries=0,
        required_inputs=(), output_fields=(), verification="v",
        provenance_requirements=(), handler=_side_effecting_handler,
    ))
    ih = pipeline._inputs_hash({})
    from datetime import datetime, timedelta, timezone
    expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
    weak_approval = {"approved": True, "inputs_hash": ih, "expires_at": expires}  # no policy marker
    sr = run(pipeline.execute(reg, "STRONG", {}, approval=weak_approval))
    assert sr.status == "rejected" and sr.code == "approval_policy_mismatch"

    strong_approval = dict(weak_approval, policy="bound_strong")
    sr2 = run(pipeline.execute(reg, "STRONG", {}, approval=strong_approval))
    assert sr2.status == "accepted"


def test_approval_without_expires_at_is_rejected():
    reg = ActionRegistry()
    reg.register(ActionSpec(
        action_type="BOUND1", capability="bound1", executor=Executor.LOCAL,
        side_effect=SideEffect.SIDE_EFFECTING, approval_policy=ApprovalPolicy.BOUND,
        idempotency=Idempotency.STRICT_DEDUP, timeout_s=1.0, max_retries=0,
        required_inputs=(), output_fields=(), verification="v",
        provenance_requirements=(), handler=_side_effecting_handler,
    ))
    ih = pipeline._inputs_hash({})
    sr = run(pipeline.execute(reg, "BOUND1", {}, approval={"approved": True, "inputs_hash": ih}))
    assert sr.status == "rejected" and sr.code == "approval_invalid"


# ── allowed_hosts enforcement (opt-in; existing 5 N8N capabilities unaffected) ──

def test_host_allowlist_helper():
    assert _host_allowed("http://127.0.0.1:5678/webhook/x", ("127.0.0.1",)) is True
    assert _host_allowed("http://evil.example.com/webhook/x", ("127.0.0.1",)) is False


def test_existing_n8n_capabilities_declare_no_forced_allowlist():
    # Opt-in only: pre-existing capabilities are untouched by this contract,
    # so their allowed_hosts stays empty (= not enforced), preserving exact
    # pre-Phase-2 behaviour.
    for at in ("WEB_RESEARCH", "MARKET_DATA", "SHOP_SEARCH", "PRICE_COMPARE", "PRODUCT_COMPARE"):
        assert REGISTRY.get(at).allowed_hosts == ()
