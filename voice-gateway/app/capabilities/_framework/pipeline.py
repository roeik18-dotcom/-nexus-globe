"""The single generic execution pipeline. Every capability — local or n8n —
flows through here. No per-capability branching lives in this module; behaviour
is driven entirely by the ActionSpec read from the registry.

Guarantees:
  - Never raises. Every failure becomes a controlled StructuredResult.
  - side_effecting / approval_required come from the SPEC, never from inputs
    (a capability input, or untrusted content flattened into inputs, cannot
    escalate an action to side-effecting or self-approve).
  - Logs action_type/action_id/correlation_id/status only — never inputs,
    result content, tokens, or approval material.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import uuid
from datetime import timedelta
from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ApprovalPolicy, CapabilityError, CapabilityRequest, FORBIDDEN_INPUT_KEYS,
    Idempotency, InputField, MissingInputError, SCHEMA_VERSION, StructuredResult,
    ValidationError, ActionSpec, VerificationPolicy, inputs_hash as _inputs_hash,
    to_iso, utc_now,
)
from app.capabilities._framework.registry import ActionRegistry

logger = logging.getLogger("merlin.capabilities.pipeline")

# In-memory idempotency store: action_id -> StructuredResult. Sufficient for
# PURE/STRICT_DEDUP within a process and for the acceptance here; a production
# STRICT_DEDUP (side-effecting) path delegates dedup to n8n, which persists it.
_IDEM: dict[str, StructuredResult] = {}


def _result(status: str, code: str, action_id: str, correlation_id: str,
            *, message: Optional[str] = None,
            result: Optional[dict[str, Any]] = None) -> StructuredResult:
    return StructuredResult(
        status=status, code=code, action_id=action_id, correlation_id=correlation_id,
        message=message, result=result, http_status=None,
    )


def _validate_inputs(spec: ActionSpec, inputs: Mapping[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for f in spec.required_inputs:
        if f.name not in inputs:
            if f.required:
                raise MissingInputError(f"missing required input: {f.name}")
            continue
        val = inputs[f.name]
        # bool is a subtype of int in Python — reject it where a number is expected
        if bool not in f.types and isinstance(val, bool):
            raise ValidationError(f"input {f.name} has wrong type (got bool)")
        if not isinstance(val, f.types):
            want = "|".join(t.__name__ for t in f.types)
            raise ValidationError(f"input {f.name} must be {want}")
        clean[f.name] = val
    # carry through any non-required extra fields the capability declared elsewhere
    declared = {f.name for f in spec.required_inputs}
    for k, v in inputs.items():
        if k not in declared:
            clean[k] = v
    return clean


def _check_approval(spec: ActionSpec, approval: Optional[dict], ih: str, now) -> Optional[tuple[str, str, str]]:
    """Return (status, code, message) to reject, or None to allow. Approval must
    exist, be marked approved, and be bound to THIS inputs_hash; a changed input
    yields a different ih and thus fails the binding check."""
    if not isinstance(approval, dict) or approval.get("approved") is not True:
        return ("rejected", "approval_missing", "side-effecting action requires an explicit approval")
    bound = approval.get("bound_inputs_hash") or approval.get("inputs_hash")
    if bound != ih:
        return ("rejected", "approval_inputs_mismatch", "approval is not bound to the exact inputs")
    # BOUND_STRONG (e.g. EMAIL_SEND, DELETE) requires an approval explicitly
    # minted for that policy — a BOUND approval collected for a lesser action
    # can never be replayed to satisfy a BOUND_STRONG one, even if it happens
    # to carry a matching inputs_hash.
    if spec.approval_policy is ApprovalPolicy.BOUND_STRONG and approval.get("policy") != "bound_strong":
        return ("rejected", "approval_policy_mismatch", "action requires an explicit bound_strong approval")
    exp = approval.get("expires_at")
    if isinstance(exp, str):
        try:
            from datetime import datetime
            if datetime.fromisoformat(exp.replace("Z", "+00:00")) <= now:
                return ("rejected", "approval_expired", "approval has expired")
        except ValueError:
            return ("rejected", "approval_invalid", "approval expires_at is not a valid timestamp")
    else:
        return ("rejected", "approval_invalid", "approval missing expires_at")
    return None


async def execute(
    registry: ActionRegistry,
    action_type: str,
    inputs: Mapping[str, Any],
    *,
    approval: Optional[dict[str, Any]] = None,
    action_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    provenance_source: str = "merlin",
) -> StructuredResult:
    correlation_id = correlation_id or f"corr-{uuid.uuid4()}"
    action_id = action_id or f"act-{uuid.uuid4()}"

    spec = registry.get(action_type)
    if spec is None:
        logger.info("CAPABILITY_REJECT action_type=%s action_id=%s correlation_id=%s code=unknown_action_type",
                    action_type, action_id, correlation_id)
        return _result("rejected", "unknown_action_type", action_id, correlation_id,
                       message=f"no registered action_type: {action_type!r}")

    if not isinstance(inputs, Mapping):
        return _result("rejected", "malformed_request", action_id, correlation_id,
                       message="inputs must be an object")

    # ANTI-ESCALATION: inputs may never carry control fields.
    intruders = FORBIDDEN_INPUT_KEYS & set(inputs)
    if intruders:
        logger.info("CAPABILITY_REJECT action_type=%s action_id=%s code=control_field_in_inputs fields=%s",
                    action_type, action_id, sorted(intruders))
        return _result("rejected", "malformed_request", action_id, correlation_id,
                       message=f"inputs may not set control fields: {sorted(intruders)}")

    try:
        clean = _validate_inputs(spec, inputs)
    except CapabilityError as e:
        return _result("rejected", e.code, action_id, correlation_id, message=str(e))

    ih = _inputs_hash(clean)

    # AUTHORIZATION — driven by the spec, not the inputs.
    if spec.is_side_effecting and spec.approval_policy is not ApprovalPolicy.NONE:
        rej = _check_approval(spec, approval, ih, utc_now())
        if rej is not None:
            logger.info("CAPABILITY_REJECT action_type=%s action_id=%s correlation_id=%s code=%s",
                        action_type, action_id, correlation_id, rej[1])
            return _result(rej[0], rej[1], action_id, correlation_id, message=rej[2])

    # IDEMPOTENCY — same action_id never re-executes; returns the first result.
    if spec.idempotency in (Idempotency.PURE, Idempotency.STRICT_DEDUP):
        cached = _IDEM.get(action_id)
        if cached is not None:
            logger.info("CAPABILITY_DUPLICATE action_type=%s action_id=%s correlation_id=%s",
                        action_type, action_id, correlation_id)
            return StructuredResult(
                status="duplicate", code="duplicate_action_id", action_id=action_id,
                correlation_id=correlation_id, message="already executed",
                result=cached.result, http_status=None,
            )

    # Build the request record (authoritative side_effecting from the spec). This
    # is passed to the handler so capabilities that call out (e.g. to n8n) can
    # thread the same action_id/correlation_id end-to-end.
    now = utc_now()
    # Request TTL must outlive the call itself or a remote executor rejects it as
    # already-expired. Generic rule (reusable by every capability): at least 60s,
    # and always comfortably longer than the action's own timeout.
    ttl_s = max(60.0, spec.timeout_s * 2)
    request = CapabilityRequest(
        schema_version=SCHEMA_VERSION, action_type=action_type, capability=spec.capability,
        action_id=action_id, correlation_id=correlation_id, created_at=to_iso(now),
        expires_at=to_iso(now + timedelta(seconds=ttl_s)), inputs=clean, inputs_hash=ih, approval=approval,
        side_effecting=spec.is_side_effecting,
        approval_required=(spec.approval_policy is not ApprovalPolicy.NONE and spec.is_side_effecting),
        provenance={"source": provenance_source, "capability": spec.capability},
    )

    # EXECUTE — handler(inputs, request); pure handlers simply ignore `request`.
    try:
        if spec.handler is None:
            return _result("error", "no_handler", action_id, correlation_id,
                           message="capability has no local handler wired")
        out = spec.handler(clean, request)
        if inspect.isawaitable(out):
            # timeout_s is registry-authoritative and enforced HERE, not left to
            # each handler to remember — a handler cannot silently outlive its
            # declared ceiling regardless of what a downstream call does.
            out = await asyncio.wait_for(out, timeout=spec.timeout_s)
        if not isinstance(out, Mapping):
            return _result("error", "invalid_capability_output", action_id, correlation_id,
                           message="handler did not return an object")
        out = dict(out)
    except CapabilityError as e:
        return _result("rejected", e.code, action_id, correlation_id, message=str(e))
    except asyncio.TimeoutError:
        logger.info("CAPABILITY_TIMEOUT action_type=%s action_id=%s timeout_s=%s",
                    action_type, action_id, spec.timeout_s)
        return _result("error", "timeout", action_id, correlation_id,
                       message=f"capability exceeded its {spec.timeout_s}s timeout")
    except Exception:  # noqa: BLE001 — controlled: never leak a raw exception
        logger.exception("CAPABILITY_EXECUTION_ERROR action_type=%s action_id=%s", action_type, action_id)
        return _result("error", "execution_error", action_id, correlation_id,
                       message="capability execution failed")

    # VERIFY
    verification_status = "unverified"
    verification_detail = ""
    if spec.verifier is not None:
        try:
            ok, verification_detail = spec.verifier(clean, out)
            verification_status = "verified" if ok else "failed"
        except Exception:  # noqa: BLE001
            verification_status = "failed"
            verification_detail = "verifier raised"

    # Capability output is preserved VERBATIM (a capability may legitimately have
    # its own `verification_status`, e.g. TABLE_REPORT's data-completeness). The
    # framework's own execution-level verification lives under a namespaced key so
    # it can never clobber a capability output field.
    payload = dict(out)
    payload["framework"] = {
        "verification": verification_status,       # verified | failed | unverified
        "verification_detail": verification_detail,
    }
    payload["provenance"] = {
        "capability": spec.capability, "action_type": action_type,
        "executor": spec.executor.value, "inputs_hash": ih,
        "required": list(spec.provenance_requirements),
    }

    # verification_policy is registry-authoritative (see ActionSpec docstring):
    # OPTIONAL (default, all pre-existing capabilities) never changes the
    # outcome, matching behaviour before this field existed. REQUIRED/
    # REQUIRED_STRICT exist for actions where "maybe it worked" must never be
    # allowed to read as a plain success — e.g. EMAIL_SEND must never claim
    # "accepted" without independently-verified provider evidence.
    if verification_status != "verified" and spec.verification_policy is not VerificationPolicy.OPTIONAL:
        if spec.verification_policy is VerificationPolicy.REQUIRED_STRICT:
            logger.info("CAPABILITY_REJECT action_type=%s action_id=%s code=verification_%s",
                        action_type, action_id, verification_status)
            return _result("rejected", f"verification_{verification_status}", action_id, correlation_id,
                           message=verification_detail or "result failed required verification",
                           result=payload)
        sr = _result("unverified", f"verification_{verification_status}", action_id, correlation_id,
                     message=verification_detail or "result did not pass required verification",
                     result=payload)
        if spec.idempotency in (Idempotency.PURE, Idempotency.STRICT_DEDUP):
            _IDEM[action_id] = sr
        logger.info(
            "CAPABILITY_RESULT action_type=%s action_id=%s correlation_id=%s status=%s verification=%s",
            action_type, action_id, correlation_id, sr.status, verification_status,
        )
        return sr

    sr = _result("accepted", "ok", action_id, correlation_id, result=payload)

    if spec.idempotency in (Idempotency.PURE, Idempotency.STRICT_DEDUP):
        _IDEM[action_id] = sr

    logger.info(
        "CAPABILITY_RESULT action_type=%s action_id=%s correlation_id=%s status=%s verification=%s",
        action_type, action_id, correlation_id, sr.status, verification_status,
    )
    return sr


def reset_idempotency_store() -> None:
    """Test-only: clear the in-memory dedup store."""
    _IDEM.clear()
