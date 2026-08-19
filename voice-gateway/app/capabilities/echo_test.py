"""EXECUTION_TEST_N8N_ECHO — registry-driven home for the already-proven n8n
echo probe (`app.integrations.n8n.client.send_echo_action_request`).

Context: this intent has existed since before the capability framework, as a
hardcoded branch in `app/action_intent/gate.py` + `dispatch.py`. That module
is left COMPLETELY UNTOUCHED here — it also serves BOOKMARK_AUDIT (DO NOT
TOUCH: bookmark implementation), and editing a shared file for a near-zero-
risk, purely additive migration isn't a good trade. Instead, this is the
ADDITIVE registry-driven path the intent consolidation calls for: the SAME
underlying, already-proven send/receive function now also has a proper
ActionSpec, reachable via REGISTRY.resolve_intent()/pipeline.execute() like
every other capability in this framework. The legacy gate.py/dispatch.py
path for this same intent is untouched and keeps working exactly as before;
retiring it in favor of this one is a follow-up for whoever owns that file.

`client.py`'s own docstring explicitly anticipated this: "[send_echo_...] is
meant to be called INTO by Merlin's domain/reasoning layer in a later
phase — this phase only proves the adapter works, standalone." This module
is that later phase's callsite.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, DataTrust, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

ACTION_TYPE = "EXECUTION_TEST_N8N_ECHO"
_DEFAULT_PROBE = "merlin-live-dispatch"
_MAX_PROBE_LEN = 200


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.integrations.n8n.client import send_echo_action_request

    probe = inputs.get("probe", _DEFAULT_PROBE)
    if not isinstance(probe, str) or not probe.strip():
        raise ValidationError("probe must be a non-empty string when provided")
    if len(probe) > _MAX_PROBE_LEN:
        raise ValidationError(f"probe exceeds max {_MAX_PROBE_LEN} chars")

    action_id = getattr(request, "action_id", None) if request is not None else None
    result = await send_echo_action_request(
        {"probe": probe.strip()}, action_id=action_id, provenance_source="merlin-registry",
    )
    return {
        "probe": probe.strip(),
        "retrieval_status": result.status,
        "retrieval_code": result.code,
        "n8n_action_id": result.action_id,
        "n8n_correlation_id": result.correlation_id,
    }


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    status = result.get("retrieval_status")
    if status not in ("accepted", "duplicate"):
        return False, f"echo not confirmed by n8n: retrieval_status={status!r} code={result.get('retrieval_code')!r}"
    return True, f"n8n confirmed the echo (status={status!r})"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="echo_test",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=5.0,
    max_retries=0,
    required_inputs=(InputField("probe", (str,), required=False),),
    output_fields=("probe", "retrieval_status", "retrieval_code", "n8n_action_id", "n8n_correlation_id"),
    verification="n8n_confirms_echo_accepted_or_duplicate",
    provenance_requirements=("n8n_action_id", "n8n_correlation_id"),
    intent_patterns=("test n8n", "run n8n echo", "n8n echo test", "בדיקת n8n"),
    handler=handler,
    verifier=verify,
    # Same disclosed gap as GOV_IL_RESEARCH (see that module's docstring):
    # this LOCAL-executor handler makes a real outbound call (inside
    # send_echo_action_request), which NetworkScope has no accurate member
    # for yet (NONE | N8N_ONLY only). Left at its honest-but-imperfect
    # LOCAL-inferred default (NONE) rather than the also-inaccurate N8N_ONLY.
    data_trust=DataTrust.EXTERNAL_UNTRUSTED,
)
