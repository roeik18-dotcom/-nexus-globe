"""LIST_AUTOMATIONS / PAUSE_AUTOMATION / RESUME_AUTOMATION / CANCEL_AUTOMATION
— registry-driven capabilities exposing the ALREADY-EXISTING
app.automation.engine operations (pause/resume/cancel, built and made
race-safe in app/automation/engine.py). No second automation engine, no new
persistence layer — this module is a thin ActionSpec wrapper.

Why LIST is READ_ONLY and PAUSE/RESUME/CANCEL are SIDE_EFFECTING+approval:
listing only reads store state. Pause/resume/cancel change whether a
standing automation will act at all in the future — that is a real control-
plane mutation (it can silence a monitor, or reactivate one), so each call
requires its own fresh, input-bound approval (ApprovalPolicy.BOUND): an
approval collected for pausing automation A can never be replayed to cancel
automation B, or reused a second time for A (STRICT_DEDUP + the pipeline's
own inputs_hash binding, both already enforced generically — nothing new
needed here).

"No old action approval becomes permission for future side effects": holds
structurally, the same way it holds for EMAIL_SEND — every call to
pipeline.execute() for one of these three action_types requires its OWN
approval object, bound to that call's own inputs_hash, checked fresh by the
already-existing pipeline approval gate. There is no cache or session concept
anywhere in this module that could let one approval cover a later call.

Cancelled/paused-then-never-resumed automations cannot execute: enforced one
layer down by app.automation.engine.tick(), not re-implemented here.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, CapabilityError, Executor, Idempotency,
    InputField, SideEffect, ValidationError,
)
from app.capabilities.automation_actions import _automation_summary


class AutomationNotFound(CapabilityError):
    code = "automation_not_found"


def _require_automation_id(inputs: Mapping[str, Any]) -> str:
    aid = inputs["automation_id"]
    if not isinstance(aid, str) or not aid.strip():
        raise ValidationError("automation_id must be a non-empty string")
    return aid.strip()


def list_automations_handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.automation.store import get_default_store

    status_filter = inputs.get("status_filter")
    if status_filter is not None and (not isinstance(status_filter, str) or not status_filter.strip()):
        raise ValidationError("status_filter must be a non-empty string when provided")

    store = get_default_store()
    items = store.list()
    if status_filter:
        items = [a for a in items if a.status.value == status_filter.strip()]
    summaries = [_automation_summary(a) for a in items]
    return {"automations": summaries, "count": len(summaries)}


def _control_handler(inputs: Mapping[str, Any], *, op) -> dict[str, Any]:
    from app.automation import engine
    from app.automation.store import get_default_store

    automation_id = _require_automation_id(inputs)
    store = get_default_store()
    try:
        automation, changed = op(store, automation_id)
    except engine.AutomationError as e:
        raise AutomationNotFound(str(e)) from e

    summary = _automation_summary(automation)
    summary["changed"] = changed
    return summary


def pause_automation_handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.automation import engine
    return _control_handler(inputs, op=engine.pause)


def resume_automation_handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.automation import engine
    return _control_handler(inputs, op=engine.resume)


def cancel_automation_handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.automation import engine
    return _control_handler(inputs, op=engine.cancel)


def _verify_list(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if "automations" not in result or "count" not in result:
        return False, "missing automations/count"
    if result["count"] != len(result["automations"]):
        return False, "count diverges from list length"
    return True, "listing shape consistent"


def _make_control_verify(expected_status: str):
    def _verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
        if result.get("automation_id") != inputs.get("automation_id"):
            return False, "result automation_id diverges from input"
        if "changed" not in result:
            return False, "missing changed flag"
        if result["changed"] and result.get("status") != expected_status:
            return False, f"changed=True but status is {result.get('status')!r}, expected {expected_status!r}"
        return True, f"status={result.get('status')!r} changed={result.get('changed')!r}"
    return _verify


LIST_AUTOMATIONS_SPEC = ActionSpec(
    action_type="LIST_AUTOMATIONS",
    capability="list_automations",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=2.0,
    max_retries=0,
    required_inputs=(InputField("status_filter", (str,), required=False),),
    output_fields=("automations", "count"),
    verification="listing_shape_consistent",
    provenance_requirements=("read_only_no_mutation",),
    intent_patterns=("list automations", "show automations", "רשימת אוטומציות"),
    handler=list_automations_handler,
    verifier=_verify_list,
)

PAUSE_AUTOMATION_SPEC = ActionSpec(
    action_type="PAUSE_AUTOMATION",
    capability="pause_automation",
    executor=Executor.LOCAL,
    side_effect=SideEffect.SIDE_EFFECTING,
    approval_policy=ApprovalPolicy.BOUND,
    idempotency=Idempotency.STRICT_DEDUP,
    timeout_s=2.0,
    max_retries=0,
    required_inputs=(InputField("automation_id", (str,)),),
    output_fields=("automation_id", "status", "changed"),
    verification="status_reflects_requested_transition",
    provenance_requirements=("explicit_automation_id", "bound_approval_required"),
    intent_patterns=(),  # deliberate — see PHASE 2 report: control ops are not free-text-dispatched this pass
    handler=pause_automation_handler,
    verifier=_make_control_verify("paused"),
)

RESUME_AUTOMATION_SPEC = ActionSpec(
    action_type="RESUME_AUTOMATION",
    capability="resume_automation",
    executor=Executor.LOCAL,
    side_effect=SideEffect.SIDE_EFFECTING,
    approval_policy=ApprovalPolicy.BOUND,
    idempotency=Idempotency.STRICT_DEDUP,
    timeout_s=2.0,
    max_retries=0,
    required_inputs=(InputField("automation_id", (str,)),),
    output_fields=("automation_id", "status", "changed"),
    verification="status_reflects_requested_transition",
    provenance_requirements=("explicit_automation_id", "bound_approval_required"),
    intent_patterns=(),
    handler=resume_automation_handler,
    verifier=_make_control_verify("active"),
)

CANCEL_AUTOMATION_SPEC = ActionSpec(
    action_type="CANCEL_AUTOMATION",
    capability="cancel_automation",
    executor=Executor.LOCAL,
    side_effect=SideEffect.SIDE_EFFECTING,
    approval_policy=ApprovalPolicy.BOUND,
    idempotency=Idempotency.STRICT_DEDUP,
    timeout_s=2.0,
    max_retries=0,
    required_inputs=(InputField("automation_id", (str,)),),
    output_fields=("automation_id", "status", "changed"),
    verification="status_reflects_requested_transition",
    provenance_requirements=("explicit_automation_id", "bound_approval_required"),
    intent_patterns=(),
    handler=cancel_automation_handler,
    verifier=_make_control_verify("cancelled"),
)
