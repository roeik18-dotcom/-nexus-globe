"""SCHEDULED_AUTOMATION / CONDITION_WATCH engine.

`tick()` is the only entry point that ever fires an automation. It is NOT a
background loop/thread — this module starts nothing on import and owns no
timer. A caller (a cron-style invoker, a test, or later a dashboard/service)
calls `tick()` periodically; nothing here reaches into service/merlin_service.py
or any live voice/audio runtime (explicitly out of scope for this build).

Safety invariants (enforced in code, checked at both creation and every
fire — the registry can change between the two):
  - Only a READ_ONLY action_type may ever be scheduled or fired here. A
    side-effecting action_type is refused at creation; if a registered
    action_type's side_effect somehow flips to SIDE_EFFECTING after an
    automation already exists for it, tick() detects this and CANCELS the
    automation instead of firing it — it does not, and structurally cannot,
    fabricate an approval to keep going.
  - Every fire uses a deterministic, monotonically-advancing action_id
    (`auto-{id}-{fire_count+1}`), so the underlying capability pipeline's own
    idempotency guarantee (PURE/STRICT_DEDUP) still protects against a
    duplicate execution if tick() is ever called twice for the same window.
  - Automations expire (`expires_at`) and are never eligible to fire past it.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import Any, Optional

from app.automation.models import (
    Automation, AutomationStatus, NotificationRecord, TriggerType,
    dedup_key as _dedup_key, from_iso, to_iso, utc_now,
)
from app.automation.predicates import resolve_predicate
from app.automation.store import AutomationStore
from app.capabilities._framework import pipeline
from app.capabilities._framework.models import SideEffect
from app.capabilities._framework.registry import ActionRegistry

logger = logging.getLogger("merlin.automation.engine")

CONDITION_WATCH_POLL_S = 60.0


class AutomationError(Exception):
    code = "automation_error"


class NotReadOnlyError(AutomationError):
    code = "action_not_read_only"


class UnknownActionTypeError(AutomationError):
    code = "unknown_action_type"


class UnknownPredicateError(AutomationError):
    code = "unknown_predicate"


class InvalidTriggerError(AutomationError):
    code = "invalid_trigger"


class DuplicateAutomationError(AutomationError):
    code = "duplicate_automation"


def _assert_read_only(registry: ActionRegistry, action_type: str) -> None:
    spec = registry.get(action_type)
    if spec is None:
        raise UnknownActionTypeError(f"no registered action_type: {action_type!r}")
    if spec.side_effect is not SideEffect.READ_ONLY:
        raise NotReadOnlyError(
            f"{action_type} is side-effecting — standing automation may only run READ_ONLY actions"
        )


def create_automation(
    store: AutomationStore,
    registry: ActionRegistry,
    *,
    action_type: str,
    inputs: dict[str, Any],
    trigger_type: TriggerType,
    ttl_s: float,
    interval_s: Optional[float] = None,
    predicate_name: Optional[str] = None,
    automation_id: Optional[str] = None,
) -> Automation:
    """Create and persist a standing automation. Raises AutomationError
    (never a bare exception) on any policy violation."""
    _assert_read_only(registry, action_type)

    if trigger_type is TriggerType.SCHEDULED:
        if not isinstance(interval_s, (int, float)) or isinstance(interval_s, bool) or interval_s <= 0:
            raise InvalidTriggerError("SCHEDULED automation requires interval_s > 0")
        predicate_name = None
    elif trigger_type is TriggerType.CONDITION_WATCH:
        if not predicate_name or resolve_predicate(predicate_name) is None:
            raise UnknownPredicateError(f"no registered predicate: {predicate_name!r}")
        interval_s = None
    else:  # pragma: no cover — exhaustive by enum
        raise InvalidTriggerError(f"unknown trigger_type: {trigger_type!r}")

    if not isinstance(ttl_s, (int, float)) or isinstance(ttl_s, bool) or ttl_s <= 0:
        raise InvalidTriggerError("ttl_s must be > 0")

    dk = _dedup_key(action_type, inputs, trigger_type, interval_s, predicate_name)
    existing = store.find_by_dedup_key(dk)
    if existing is not None:
        raise DuplicateAutomationError(
            f"an active automation already exists for this action_type/inputs/trigger (id={existing.id})"
        )

    now = utc_now()
    automation = Automation(
        id=automation_id or f"auto-{uuid.uuid4()}",
        action_type=action_type, inputs=dict(inputs), trigger_type=trigger_type,
        dedup_key=dk, created_at=to_iso(now), expires_at=to_iso(now + timedelta(seconds=ttl_s)),
        next_check_at=to_iso(now), status=AutomationStatus.ACTIVE,
        interval_s=interval_s, predicate_name=predicate_name,
    )
    store.create(automation)
    logger.info("AUTOMATION_CREATED id=%s action_type=%s trigger=%s", automation.id, action_type, trigger_type.value)
    return automation


def _transition(store: AutomationStore, automation_id: str, *, frm: tuple, to: AutomationStatus) -> tuple[Automation, bool]:
    """Atomic, race-safe state transition: only moves `frm -> to` if the
    CURRENT (lock-held, freshly-read) status is one of `frm`; otherwise a
    genuine no-op (still returns the current automation, `changed=False`).
    This is the single choke point pause/resume/cancel go through, so two
    concurrent calls (e.g. cancel() racing resume()) can never both "win" —
    only the one that observes a matching `frm` under the lock applies."""
    def fn(a: Automation) -> bool:
        if a.status in frm:
            a.status = to
            return True
        return False
    try:
        changed = store.mutate(automation_id, fn)
    except KeyError:
        raise AutomationError(f"no such automation: {automation_id}") from None
    return store.get(automation_id), changed


def pause(store: AutomationStore, automation_id: str) -> tuple[Automation, bool]:
    return _transition(store, automation_id, frm=(AutomationStatus.ACTIVE,), to=AutomationStatus.PAUSED)


def resume(store: AutomationStore, automation_id: str) -> tuple[Automation, bool]:
    """Resumes a paused automation from where it left off — next_check_at is
    NOT reset, so if it was already due while paused it fires on the very
    next tick() rather than waiting a fresh full interval. Only legal from
    PAUSED (resuming an already-ACTIVE/terminal automation is a no-op, not
    an error, and — critically — can never "re-arm" a CANCELLED/EXPIRED one:
    those are not in `frm`, so the transition simply doesn't apply)."""
    return _transition(store, automation_id, frm=(AutomationStatus.PAUSED,), to=AutomationStatus.ACTIVE)


def cancel(store: AutomationStore, automation_id: str) -> tuple[Automation, bool]:
    return _transition(store, automation_id, frm=(AutomationStatus.ACTIVE, AutomationStatus.PAUSED),
                       to=AutomationStatus.CANCELLED)


def _claim(automation: Automation, *, now, registry: ActionRegistry) -> Optional[dict[str, Any]]:
    """Runs UNDER THE STORE'S LOCK (via store.mutate) — the single atomic
    decision point for "is this automation eligible to fire right now", and
    if so, RESERVES the fire (advances next_check_at / bumps fire_count)
    before any actual execution happens. This is what makes tick() race-safe
    against a concurrent pause/resume/cancel: by the time this function
    returns, either the claim (and its bookkeeping) is durably persisted, or
    nothing happened — there is no window where two callers could both
    decide to fire the same due window, and a status change made by another
    caller is never invisible to this check (it runs against the live,
    lock-held object, not a stale snapshot taken earlier in tick()'s loop).
    Returns None if not eligible; a firing package (action_id/action_type/
    inputs) if claimed. Only status/next_check_at/fire_count are touched
    here — never anything a pause/resume/cancel call also owns beyond
    status (and this function only ever reads status, an EXPIRED/CANCELLED
    transition here is the one exception — see inline)."""
    if automation.status is not AutomationStatus.ACTIVE:
        return None
    if now >= from_iso(automation.expires_at):
        automation.status = AutomationStatus.EXPIRED
        return None

    spec = registry.get(automation.action_type)
    if spec is None or spec.side_effect is not SideEffect.READ_ONLY:
        automation.status = AutomationStatus.CANCELLED
        logger.warning("AUTOMATION_CANCELLED id=%s reason=action_no_longer_read_only", automation.id)
        return None

    if automation.trigger_type is TriggerType.CONDITION_WATCH:
        pred = resolve_predicate(automation.predicate_name)
        if pred is None:
            automation.status = AutomationStatus.CANCELLED
            logger.warning("AUTOMATION_CANCELLED id=%s reason=predicate_missing", automation.id)
            return None
        if now < from_iso(automation.next_check_at):
            return None
        automation.next_check_at = to_iso(now + timedelta(seconds=CONDITION_WATCH_POLL_S))
        try:
            should_fire = bool(pred())
        except Exception:  # noqa: BLE001 — a raising predicate must never crash the tick
            logger.exception("AUTOMATION_PREDICATE_ERROR id=%s predicate=%s", automation.id, automation.predicate_name)
            should_fire = False
        if not should_fire:
            return None
    else:  # SCHEDULED
        if now < from_iso(automation.next_check_at):
            return None
        automation.next_check_at = to_iso(now + timedelta(seconds=automation.interval_s))

    automation.fire_count += 1  # reserved NOW, under the lock — this IS the claim
    action_id = f"auto-{automation.id}-{automation.fire_count}"
    return {"action_id": action_id, "action_type": automation.action_type, "inputs": dict(automation.inputs)}


def _record_fire_result(automation: Automation, *, sr, action_id: str, now) -> None:
    """Runs under the store's lock. Deliberately touches ONLY last_fired_at
    and notifications — never `status` — so a pause/resume/cancel that ran
    in the gap between _claim() and this call (while the actual
    pipeline.execute() awaited) is never clobbered. This is the fix for
    "cancel-after-trigger": the in-flight fire that was already claimed is
    still recorded (it did happen, and it was READ_ONLY so recording it is
    harmless), but the automation ends up in whatever status the concurrent
    cancel left it in, and — because _claim() already advanced
    next_check_at/fire_count before the cancel could have observed them —
    no further fire is possible once status is no longer ACTIVE."""
    automation.last_fired_at = to_iso(now)
    automation.record_notification(NotificationRecord(at=to_iso(now), status=sr.status, code=sr.code, action_id=action_id))


async def tick(store: AutomationStore, registry: ActionRegistry, *, now=None) -> list[dict[str, Any]]:
    """Advance every automation by one check. Returns one dict per automation
    actually fired this tick: {automation_id, action_type, action_id,
    status, code}. Never raises — a single automation's failure (unknown
    predicate, registry drift) cancels only that automation and is logged,
    the rest of the batch still runs.

    Race-safe by construction (see _claim/_record_fire_result): the
    eligibility check + reservation happens atomically under the store's
    lock BEFORE the (potentially slow, async) pipeline.execute() call, and
    the lock is never held across that await — only the two short,
    lock-scoped mutate() calls bracket it."""
    now = now or utc_now()
    fired: list[dict[str, Any]] = []

    for a in store.list():
        if a.status is not AutomationStatus.ACTIVE:
            continue  # cheap pre-filter; the real, authoritative check is inside _claim()

        try:
            claim = store.mutate(a.id, lambda cur: _claim(cur, now=now, registry=registry))
        except KeyError:
            continue  # deleted between list() and mutate() — nothing to do

        if claim is None:
            continue

        sr = await pipeline.execute(
            registry, claim["action_type"], claim["inputs"],
            action_id=claim["action_id"], provenance_source="automation",
        )

        try:
            store.mutate(a.id, lambda cur: _record_fire_result(cur, sr=sr, action_id=claim["action_id"], now=now))
        except KeyError:
            pass  # deleted mid-fire — the fire already happened (READ_ONLY) and was already dedup-safe

        logger.info("AUTOMATION_FIRED id=%s action_type=%s action_id=%s status=%s code=%s",
                    a.id, claim["action_type"], claim["action_id"], sr.status, sr.code)
        fired.append({"automation_id": a.id, "action_type": claim["action_type"],
                      "action_id": claim["action_id"], "status": sr.status, "code": sr.code})

    return fired
