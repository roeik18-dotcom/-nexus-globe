"""PHILOS_TRANSFER_EXECUTE — the ONLY path by which a Philos-originated
candidate_action can ever run through Merlin, and the concrete proof that
Philos's candidate never bypasses Merlin's own approval/execution-security
gates.

Boundary, stated precisely: PHILOS_ORIENTATION (philos_orientation.py) never
calls this — it has no import of pipeline.execute, no reference to this
module, no dispatch mechanism at all. A candidate_action returned by
PHILOS_ORIENTATION is inert data. Running it requires a SEPARATE, explicit
call into THIS ActionSpec, through the SAME generic pipeline every other
side-effecting capability (EMAIL_SEND, etc.) already goes through —
side_effect=SIDE_EFFECTING, approval_policy=BOUND_STRONG, both
registry-authoritative and structurally unreachable from `inputs` (see
FORBIDDEN_INPUT_KEYS, app/capabilities/_framework/models.py). Nothing in the
`transfer` dict this handler receives — however it was constructed, however
a compromised Philos instance might have shaped it — can set or influence
side_effect/approval_policy/network_scope/credential_scope/retry_policy:
those come from THIS ActionSpec's own declared fields, never from `inputs`,
nested or not. A field like `transfer["side_effecting"] = false` is simply
never read by anything in this file.

This module does NOT re-validate Philos's canon semantics (no re-derivation
of Matching/Transfer rules in Python — that would create a second, divergent
copy of canon logic this whole engagement's rules forbid). It trusts the
caller-supplied `transfer_valid`/`match_decision` flags as ALREADY-COMPUTED
facts from a real orientation call, and its OWN job is purely the
execution-security layer Merlin owns: approval, idempotency, and (once a
real backend exists) credentials/network/retry.

KNOWN, DISCLOSED GAP: no real melting-pot execution backend (n8n workflow,
external system, credential) exists yet this pass. The handler — reachable
ONLY after a valid, correctly-bound approval clears the pipeline's own gate —
returns a `not_yet_implemented` result rather than fabricating a fake
success. This proves the approval boundary concretely without pretending a
real transfer moved. Wiring a real backend is separate, future,
explicitly-approved work — same disclosure discipline as
predicates.py's "no real external signal source wired yet."
"""

from __future__ import annotations

import logging
from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

logger = logging.getLogger("merlin.capabilities.philos_transfer_execute")

ACTION_TYPE = "PHILOS_TRANSFER_EXECUTE"


def _s(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    transfer = inputs["transfer"]
    transfer_valid = inputs["transfer_valid"]
    match_decision = inputs["match_decision"]

    if not isinstance(transfer, dict) or not _s(transfer.get("action_id")):
        raise ValidationError("transfer must be an object with a non-empty action_id")
    if transfer_valid is not True:
        raise ValidationError("transfer_valid must be exactly true — Philos did not validate this candidate")
    if match_decision != "permitted":
        raise ValidationError("match_decision must be exactly 'permitted'")
    if transfer.get("mechanism_scope") != "melting_pot":
        raise ValidationError("transfer.mechanism_scope must be 'melting_pot'")
    if transfer.get("consent") is not True:
        raise ValidationError("transfer.consent must be exactly true")

    action_id = transfer["action_id"]
    logger.info("PHILOS_TRANSFER_EXECUTE reached (approval already cleared by the pipeline) transfer_action_id=%s",
                action_id)

    # No real execution backend wired this pass — disclosed, not faked.
    return {
        "execution_status": "not_yet_implemented",
        "transfer_action_id": action_id,
        "note": "approval + execution-security gates proven; no real melting-pot execution backend is wired this pass",
    }


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if result.get("execution_status") not in ("not_yet_implemented", "executed"):
        return False, f"unexpected execution_status={result.get('execution_status')!r}"
    if not result.get("transfer_action_id"):
        return False, "no transfer_action_id in result"
    return True, "reached the execution boundary with a real, approval-gated transfer_action_id"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="philos_transfer_execute",
    executor=Executor.LOCAL,
    side_effect=SideEffect.SIDE_EFFECTING,
    approval_policy=ApprovalPolicy.BOUND_STRONG,
    idempotency=Idempotency.STRICT_DEDUP,
    timeout_s=10.0,
    max_retries=0,
    required_inputs=(
        InputField("transfer", (dict,)),
        InputField("transfer_valid", (bool,)),
        InputField("match_decision", (str,)),
    ),
    output_fields=("execution_status", "transfer_action_id", "note"),
    verification="approval_gated_transfer_reached_execution_boundary",
    provenance_requirements=("transfer_action_id",),
    intent_patterns=(),  # never voice-reachable — side-effecting actions are never auto-resolved from free text
    handler=handler,
    verifier=verify,
)
