"""SCHEDULED_AUTOMATION / CONDITION_WATCH — persistence, expiration, dedup,
wait/resume, notification, and the READ_ONLY-only firing guarantee.

Every test uses its own tmp_path-backed AutomationStore — never the default
state/capability_automations.json path — so nothing here touches real repo
state or collides with other in-progress work.
"""

import asyncio
from datetime import timedelta

import pytest

from app.automation import engine
from app.automation.models import AutomationStatus, TriggerType, utc_now
from app.automation.predicates import register_predicate, resolve_predicate
from app.automation.store import AutomationStore
from app.capabilities._framework import pipeline
from app.capabilities._framework.models import ActionSpec, ApprovalPolicy, Executor, Idempotency, SideEffect
from app.capabilities._framework.registry import ActionRegistry

run = asyncio.run


@pytest.fixture
def store(tmp_path):
    return AutomationStore(path=tmp_path / "automations.json")


@pytest.fixture
def registry():
    reg = ActionRegistry()
    calls = {"n": 0}

    def ro_handler(inputs, request=None):
        calls["n"] += 1
        return {"n": calls["n"]}

    def se_handler(inputs, request=None):
        return {"done": True}

    reg.register(ActionSpec(
        action_type="RO_PING", capability="ro_ping", executor=Executor.LOCAL,
        side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
        idempotency=Idempotency.PURE, timeout_s=1.0, max_retries=0,
        required_inputs=(), output_fields=("n",), verification="v",
        provenance_requirements=(), handler=ro_handler,
    ))
    reg.register(ActionSpec(
        action_type="SE_DO", capability="se_do", executor=Executor.LOCAL,
        side_effect=SideEffect.SIDE_EFFECTING, approval_policy=ApprovalPolicy.BOUND,
        idempotency=Idempotency.STRICT_DEDUP, timeout_s=1.0, max_retries=0,
        required_inputs=(), output_fields=("done",), verification="v",
        provenance_requirements=(), handler=se_handler,
    ))
    reg._calls = calls  # test-only introspection
    return reg


# ── creation guardrails ──────────────────────────────────────────────────────

def test_cannot_schedule_a_side_effecting_action(store, registry):
    with pytest.raises(engine.NotReadOnlyError):
        engine.create_automation(store, registry, action_type="SE_DO", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)


def test_cannot_schedule_unknown_action_type(store, registry):
    with pytest.raises(engine.UnknownActionTypeError):
        engine.create_automation(store, registry, action_type="NOPE", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)


def test_condition_watch_requires_known_predicate(store, registry):
    with pytest.raises(engine.UnknownPredicateError):
        engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.CONDITION_WATCH, ttl_s=3600,
                                 predicate_name="does_not_exist")


def test_scheduled_requires_positive_interval(store, registry):
    with pytest.raises(engine.InvalidTriggerError):
        engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=0)


# ── persistence ──────────────────────────────────────────────────────────────

def test_automation_persists_across_store_instances(store, registry, tmp_path):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)
    reloaded = AutomationStore(path=tmp_path / "automations.json")
    got = reloaded.get(a.id)
    assert got is not None
    assert got.action_type == "RO_PING"
    assert got.status is AutomationStatus.ACTIVE


# ── dedup ────────────────────────────────────────────────────────────────────

def test_duplicate_automation_rejected(store, registry):
    engine.create_automation(store, registry, action_type="RO_PING", inputs={"x": 1},
                             trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)
    with pytest.raises(engine.DuplicateAutomationError):
        engine.create_automation(store, registry, action_type="RO_PING", inputs={"x": 1},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)


def test_different_inputs_are_not_duplicates(store, registry):
    engine.create_automation(store, registry, action_type="RO_PING", inputs={"x": 1},
                             trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)
    a2 = engine.create_automation(store, registry, action_type="RO_PING", inputs={"x": 2},
                                  trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)
    assert a2 is not None


# ── expiration ───────────────────────────────────────────────────────────────

def test_automation_expires_and_never_fires_again(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=1, interval_s=1)
    later = utc_now() + timedelta(seconds=5)
    fired = run(engine.tick(store, registry, now=later))
    assert fired == []
    assert store.get(a.id).status is AutomationStatus.EXPIRED


# ── scheduled firing + wait/resume ──────────────────────────────────────────

def test_scheduled_fires_when_due_then_waits(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=100)
    now = utc_now()
    first = run(engine.tick(store, registry, now=now))
    assert len(first) == 1 and first[0]["status"] == "accepted"
    # not due again immediately
    second = run(engine.tick(store, registry, now=now + timedelta(seconds=5)))
    assert second == []
    # due again after the interval
    third = run(engine.tick(store, registry, now=now + timedelta(seconds=101)))
    assert len(third) == 1
    assert store.get(a.id).fire_count == 2


def test_pause_stops_firing_resume_continues(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    now = utc_now()
    engine.pause(store, a.id)
    fired = run(engine.tick(store, registry, now=now + timedelta(seconds=20)))
    assert fired == []  # paused: due but never fires
    engine.resume(store, a.id)
    fired2 = run(engine.tick(store, registry, now=now + timedelta(seconds=21)))
    assert len(fired2) == 1  # resumes from where it left off, fires immediately since already due


def test_cancel_is_terminal(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    engine.cancel(store, a.id)
    fired = run(engine.tick(store, registry, now=utc_now() + timedelta(seconds=100)))
    assert fired == []
    assert store.get(a.id).status is AutomationStatus.CANCELLED


def test_resume_only_applies_from_paused_never_reactivates_terminal_states(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    engine.cancel(store, a.id)
    automation, changed = engine.resume(store, a.id)
    assert changed is False
    assert automation.status is AutomationStatus.CANCELLED  # never re-armed


def test_pause_resume_cancel_report_changed_flag(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    _, changed1 = engine.pause(store, a.id)
    assert changed1 is True
    _, changed2 = engine.pause(store, a.id)  # already paused: no-op
    assert changed2 is False
    _, changed3 = engine.resume(store, a.id)
    assert changed3 is True
    _, changed4 = engine.cancel(store, a.id)
    assert changed4 is True
    _, changed5 = engine.cancel(store, a.id)  # already cancelled: no-op
    assert changed5 is False


def test_cancel_after_trigger_does_not_get_clobbered_by_the_in_flight_fires_write(store, registry, monkeypatch):
    """Simulates the exact race the atomic claim/record split closes: a
    cancel() call lands WHILE a fire is in flight (between _claim reserving
    the fire and _record_fire_result persisting its bookkeeping). Before the
    fix, tick()'s post-fire store.update(a) used its stale in-memory copy
    and would silently overwrite status back to ACTIVE, resurrecting a
    cancelled automation. After the fix, the fire's own write only ever
    touches last_fired_at/notifications — never status — so the concurrent
    cancel is preserved."""
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)

    real_execute = pipeline.execute

    async def slow_execute(*args, **kwargs):
        # cancel arrives HERE — after this automation's fire was already
        # claimed (fire_count bumped, next_check_at advanced) but before the
        # fire's result is recorded.
        engine.cancel(store, a.id)
        return await real_execute(*args, **kwargs)

    monkeypatch.setattr(pipeline, "execute", slow_execute)
    fired = run(engine.tick(store, registry, now=utc_now()))
    assert len(fired) == 1  # the already-claimed fire still completes and is reported

    final = store.get(a.id)
    assert final.status is AutomationStatus.CANCELLED  # cancel is NOT clobbered
    assert final.fire_count == 1                        # the claim's bookkeeping survives too
    assert len(final.notifications) == 1                # and the fire's own result is still recorded

    # and critically: no further fire is possible now that status is terminal
    fired2 = run(engine.tick(store, registry, now=utc_now() + timedelta(seconds=100)))
    assert fired2 == []


# ── store.mutate() — the atomic primitive everything above relies on ───────

def test_store_mutate_persists_and_returns_fn_result(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    result = store.mutate(a.id, lambda auto: (setattr(auto, "fire_count", 7), "sentinel")[1])
    assert result == "sentinel"
    assert store.get(a.id).fire_count == 7


def test_store_mutate_unknown_id_raises_keyerror(store):
    with pytest.raises(KeyError):
        store.mutate("no-such-id", lambda auto: None)


# ── condition_watch ──────────────────────────────────────────────────────────

def test_condition_watch_fires_only_when_predicate_true(store, registry):
    flag = {"on": False}
    register_predicate("test_flag", lambda: flag["on"])
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.CONDITION_WATCH, ttl_s=3600,
                                 predicate_name="test_flag")
    now = utc_now()
    assert run(engine.tick(store, registry, now=now)) == []
    flag["on"] = True
    # first tick advanced next_check_at by the condition-watch poll interval
    fired = run(engine.tick(store, registry, now=now + timedelta(seconds=engine.CONDITION_WATCH_POLL_S + 1)))
    assert len(fired) == 1


def test_predicate_that_raises_never_crashes_tick(store, registry):
    def boom():
        raise RuntimeError("nope")
    register_predicate("test_boom", boom)
    engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                             trigger_type=TriggerType.CONDITION_WATCH, ttl_s=3600,
                             predicate_name="test_boom")
    fired = run(engine.tick(store, registry, now=utc_now()))
    assert fired == []  # treated as "did not fire", not a crash


# ── notification ─────────────────────────────────────────────────────────────

def test_notification_recorded_on_fire(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    run(engine.tick(store, registry, now=utc_now()))
    reloaded = store.get(a.id)
    assert len(reloaded.notifications) == 1
    assert reloaded.notifications[0].status == "accepted"


# ── registry drift: an action that stops being READ_ONLY gets cancelled, not fired ──

def test_automation_cancelled_if_action_becomes_side_effecting(store, registry):
    a = engine.create_automation(store, registry, action_type="RO_PING", inputs={},
                                 trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=10)
    # simulate registry drift: re-register the same action_type as side-effecting
    # in a fresh registry object standing in for "the registry changed under us"
    drifted = ActionRegistry()
    drifted.register(ActionSpec(
        action_type="RO_PING", capability="ro_ping", executor=Executor.LOCAL,
        side_effect=SideEffect.SIDE_EFFECTING, approval_policy=ApprovalPolicy.BOUND,
        idempotency=Idempotency.STRICT_DEDUP, timeout_s=1.0, max_retries=0,
        required_inputs=(), output_fields=(), verification="v",
        provenance_requirements=(), handler=lambda i, r=None: {"done": True},
    ))
    fired = run(engine.tick(store, drifted, now=utc_now() + timedelta(seconds=20)))
    assert fired == []
    assert store.get(a.id).status is AutomationStatus.CANCELLED
