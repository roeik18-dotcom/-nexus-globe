"""SCHEDULE_REPORT / CONDITION_WATCH — registry-driven capabilities that
create standing automations (app/automation/engine.py) through the SAME
generic pipeline every other capability uses. No new dispatch mechanism:
these are ordinary READ_ONLY, LOCAL ActionSpecs whose handler calls into
`app.automation.engine.create_automation`.

Why READ_ONLY: creating/managing an automation only ever writes LOCAL
persistent scheduling state (app/automation/store.py, atomic JSON write) —
it never itself sends anything, spends anything, or performs a real-world
mutation. This mirrors the existing precedent in this codebase (bookmark
snapshot writes, MemoryStore writes) of not treating local-state persistence
as the same class of "side effect" the SIDE_EFFECTING/approval machinery
exists to gate.

The real safety boundary is enforced one layer down, in
`app.automation.engine`, and holds regardless of what these two ActionSpecs
declare:
  - `create_automation` refuses (raises AutomationError) any target
    action_type whose spec.side_effect is not READ_ONLY — SCHEDULE_REPORT/
    CONDITION_WATCH cannot be used to stand up automatic execution of
    EMAIL_SEND or any other side-effecting capability, full stop. There is
    no "attach an approval later" path in this build — a side-effecting
    action can only ever run through a direct, human-approved
    `pipeline.execute(..., approval=...)` call, never through a standing
    trigger. This is the strictest reading of "side-effecting requires a
    fresh, trigger-time, input-bound approval — old approval is never
    standing permission": there is no code path where a stored/cached
    approval could be reused across fires, because there is no code path
    where a side-effecting target auto-fires at all.
  - `engine.tick()` re-checks this at every fire (not just creation), so
    registry drift after creation cancels the automation rather than firing it.
  - Untrusted trigger data (a condition-watch predicate's own return value,
    or whatever a scheduled report retrieval later contains) is a bool/data
    payload only — it is never read as an action_type, policy, or approval.
    The action_type/target_inputs a fire executes are exactly what was
    validated and hashed into the automation at creation time; nothing at
    fire time can change them.
  - No retry loop exists anywhere in this chain (pipeline.execute has none;
    engine.tick fires each due automation at most once per tick, gated by
    next_check_at); a duplicate tick() call for the same window is a no-op
    at the underlying capability's own idempotency layer (deterministic
    `auto-{id}-{fire_count+1}` action_id).
"""

from __future__ import annotations

import json
from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, CapabilityError, Executor, Idempotency,
    InputField, SideEffect, ValidationError,
)

_NUM = (int, float)


class AutomationRejected(CapabilityError):
    """Wraps an app.automation.engine.AutomationError, preserving its
    specific code (action_not_read_only, duplicate_automation,
    unknown_action_type, unknown_predicate, invalid_trigger) instead of
    collapsing everything to a generic malformed_request."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _num(v: Any, name: str) -> float:
    if isinstance(v, bool) or not isinstance(v, _NUM):
        raise ValidationError(f"{name} must be a number")
    if v <= 0:
        raise ValidationError(f"{name} must be > 0")
    return float(v)


def _target_inputs(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValidationError("target_inputs must be an object")
    try:
        json.dumps(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError("target_inputs must be JSON-serializable") from exc
    return raw


def _target_action_type(raw: Any) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError("target_action_type must be a non-empty string")
    return raw.strip()


def _automation_summary(automation) -> dict[str, Any]:
    return {
        "automation_id": automation.id,
        "target_action_type": automation.action_type,
        "trigger_type": automation.trigger_type.value,
        "status": automation.status.value,
        "created_at": automation.created_at,
        "expires_at": automation.expires_at,
        "next_check_at": automation.next_check_at,
        "interval_s": automation.interval_s,
        "predicate_name": automation.predicate_name,
    }


def schedule_report_handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.automation import engine
    from app.automation.models import TriggerType
    from app.automation.store import get_default_store
    from app.capabilities.registry import REGISTRY  # local import: registry.py imports this module

    target_action_type = _target_action_type(inputs["target_action_type"])
    target_inputs = _target_inputs(inputs["target_inputs"])
    interval_s = _num(inputs["interval_s"], "interval_s")
    ttl_s = _num(inputs["ttl_s"], "ttl_s")

    try:
        automation = engine.create_automation(
            get_default_store(), REGISTRY, action_type=target_action_type, inputs=target_inputs,
            trigger_type=TriggerType.SCHEDULED, ttl_s=ttl_s, interval_s=interval_s,
        )
    except engine.AutomationError as e:
        raise AutomationRejected(e.code, str(e)) from e

    return _automation_summary(automation)


def condition_watch_handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.automation import engine
    from app.automation.models import TriggerType
    from app.automation.store import get_default_store
    from app.capabilities.registry import REGISTRY

    target_action_type = _target_action_type(inputs["target_action_type"])
    target_inputs = _target_inputs(inputs["target_inputs"])
    predicate_name = inputs["predicate_name"]
    if not isinstance(predicate_name, str) or not predicate_name.strip():
        raise ValidationError("predicate_name must be a non-empty string")
    ttl_s = _num(inputs["ttl_s"], "ttl_s")

    try:
        automation = engine.create_automation(
            get_default_store(), REGISTRY, action_type=target_action_type, inputs=target_inputs,
            trigger_type=TriggerType.CONDITION_WATCH, ttl_s=ttl_s, predicate_name=predicate_name.strip(),
        )
    except engine.AutomationError as e:
        raise AutomationRejected(e.code, str(e)) from e

    return _automation_summary(automation)


def _verify_created(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if not result.get("automation_id"):
        return False, "no automation_id in result"
    if result.get("status") != "active":
        return False, f"unexpected status={result.get('status')!r} for a freshly created automation"
    if result.get("target_action_type") != inputs.get("target_action_type"):
        return False, "result target_action_type diverges from input"
    return True, "automation created with a persistent id and active status"


SCHEDULE_REPORT_SPEC = ActionSpec(
    action_type="SCHEDULE_REPORT",
    capability="schedule_report",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=2.0,
    max_retries=0,
    required_inputs=(
        InputField("target_action_type", (str,)),
        InputField("target_inputs", (dict,)),
        InputField("interval_s", _NUM),
        InputField("ttl_s", _NUM),
    ),
    output_fields=("automation_id", "target_action_type", "trigger_type", "status",
                   "next_check_at", "expires_at"),
    verification="automation_created_active_with_persistent_id",
    provenance_requirements=("target_must_be_read_only", "persisted_automation_id"),
    intent_patterns=("schedule a report", "schedule report", "תזמן דוח"),
    handler=schedule_report_handler,
    verifier=_verify_created,
)

CONDITION_WATCH_SPEC = ActionSpec(
    action_type="CONDITION_WATCH",
    capability="condition_watch",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=2.0,
    max_retries=0,
    required_inputs=(
        InputField("target_action_type", (str,)),
        InputField("target_inputs", (dict,)),
        InputField("predicate_name", (str,)),
        InputField("ttl_s", _NUM),
    ),
    output_fields=("automation_id", "target_action_type", "trigger_type", "status",
                   "predicate_name", "expires_at"),
    verification="automation_created_active_with_persistent_id",
    provenance_requirements=("target_must_be_read_only", "predicate_must_be_registered", "persisted_automation_id"),
    intent_patterns=("watch for", "condition watch", "עקוב אחרי תנאי"),
    handler=condition_watch_handler,
    verifier=_verify_created,
)
