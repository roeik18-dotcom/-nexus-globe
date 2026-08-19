"""LIST_AUTOMATIONS / PAUSE_AUTOMATION / RESUME_AUTOMATION / CANCEL_AUTOMATION
— registry-driven capability wrappers around the existing (and now
race-safe) app.automation.engine operations. LIST is read-only; the other
three are side-effecting and approval-bound.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.automation import engine
from app.automation.models import TriggerType
from app.automation.store import AutomationStore, set_default_store_for_testing
from app.capabilities._framework import pipeline
from app.capabilities._framework.models import inputs_hash as fw_hash
from app.capabilities.registry import REGISTRY

run = asyncio.run


@pytest.fixture(autouse=True)
def isolated_store(tmp_path):
    store = AutomationStore(path=tmp_path / "automations.json")
    set_default_store_for_testing(store)
    yield store
    set_default_store_for_testing(None)


def _create(store, **overrides):
    kw = dict(action_type="MONTHLY_PAYMENT", inputs={}, trigger_type=TriggerType.SCHEDULED,
              ttl_s=3600, interval_s=60)
    kw.update(overrides)
    return engine.create_automation(store, REGISTRY, **kw)


def _bound_approval(inputs: dict) -> dict:
    return {
        "approved": True, "inputs_hash": fw_hash(inputs),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }


# ── LIST_AUTOMATIONS ─────────────────────────────────────────────────────────

def test_list_automations_is_read_only_no_approval_needed(isolated_store):
    _create(isolated_store)
    sr = run(pipeline.execute(REGISTRY, "LIST_AUTOMATIONS", {}))
    assert sr.status == "accepted"
    assert sr.result["count"] == 1


def test_list_automations_status_filter(isolated_store):
    a = _create(isolated_store)
    engine.pause(isolated_store, a.id)
    sr = run(pipeline.execute(REGISTRY, "LIST_AUTOMATIONS", {"status_filter": "paused"}))
    assert sr.result["count"] == 1
    sr2 = run(pipeline.execute(REGISTRY, "LIST_AUTOMATIONS", {"status_filter": "active"}))
    assert sr2.result["count"] == 0


# ── control ops require approval ────────────────────────────────────────────

def test_pause_without_approval_rejected(isolated_store):
    a = _create(isolated_store)
    sr = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", {"automation_id": a.id}))
    assert sr.status == "rejected" and sr.code == "approval_missing"


def test_pause_with_bound_approval_succeeds(isolated_store):
    a = _create(isolated_store)
    inputs = {"automation_id": a.id}
    sr = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    assert sr.status == "accepted"
    assert sr.result["status"] == "paused"
    assert sr.result["changed"] is True


def test_approval_bound_to_one_automation_id_cannot_pause_another(isolated_store):
    a = _create(isolated_store)
    b = _create(isolated_store, inputs={"x": 1})
    approval_for_a = _bound_approval({"automation_id": a.id})
    sr = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", {"automation_id": b.id}, approval=approval_for_a))
    assert sr.status == "rejected" and sr.code == "approval_inputs_mismatch"
    assert isolated_store.get(b.id).status.value == "active"  # untouched


def test_approval_is_single_use_strict_dedup(isolated_store):
    a = _create(isolated_store)
    inputs = {"automation_id": a.id}
    approval = _bound_approval(inputs)
    aid = "act-pause-fixed-1"
    first = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=approval, action_id=aid))
    assert first.status == "accepted"
    second = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=approval, action_id=aid))
    assert second.status == "duplicate"


def test_expired_approval_rejected(isolated_store):
    a = _create(isolated_store)
    inputs = {"automation_id": a.id}
    approval = {"approved": True, "inputs_hash": fw_hash(inputs),
               "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")}
    sr = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=approval))
    assert sr.status == "rejected" and sr.code == "approval_expired"


# ── unknown automation_id is controlled, not a crash ────────────────────────

def test_unknown_automation_id_controlled(isolated_store):
    inputs = {"automation_id": "no-such-automation"}
    sr = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    assert sr.status == "rejected" and sr.code == "automation_not_found"


# ── cancelled/paused automation cannot execute ──────────────────────────────

def test_paused_automation_does_not_fire(isolated_store):
    from app.automation.models import utc_now
    a = _create(isolated_store)
    inputs = {"automation_id": a.id}
    run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    fired = run(engine.tick(isolated_store, REGISTRY, now=utc_now() + timedelta(seconds=100)))
    assert fired == []


def test_cancelled_automation_does_not_fire(isolated_store):
    from app.automation.models import utc_now
    a = _create(isolated_store)
    inputs = {"automation_id": a.id}
    run(pipeline.execute(REGISTRY, "CANCEL_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    fired = run(engine.tick(isolated_store, REGISTRY, now=utc_now() + timedelta(seconds=100)))
    assert fired == []


# ── resume does not duplicate pending execution ─────────────────────────────

def test_resume_fires_exactly_once_not_a_backlog(isolated_store):
    from app.automation.models import utc_now
    a = _create(isolated_store, interval_s=10)
    now = utc_now()
    inputs = {"automation_id": a.id}
    run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    # time passes well beyond several missed intervals while paused
    resume_inputs = {"automation_id": a.id}
    run(pipeline.execute(REGISTRY, "RESUME_AUTOMATION", resume_inputs, approval=_bound_approval(resume_inputs)))
    fired = run(engine.tick(isolated_store, REGISTRY, now=now + timedelta(seconds=500)))
    assert len(fired) == 1  # exactly one fire, no backlog catch-up
    assert isolated_store.get(a.id).fire_count == 1


# ── expiration preserved across control ops ─────────────────────────────────

def test_expires_at_unchanged_by_pause_resume(isolated_store):
    a = _create(isolated_store)
    original_expiry = a.expires_at
    inputs = {"automation_id": a.id}
    run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    run(pipeline.execute(REGISTRY, "RESUME_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    assert isolated_store.get(a.id).expires_at == original_expiry


# ── state survives persistence lifecycle ────────────────────────────────────

def test_cancel_persists_across_store_reload(isolated_store, tmp_path):
    a = _create(isolated_store)
    inputs = {"automation_id": a.id}
    run(pipeline.execute(REGISTRY, "CANCEL_AUTOMATION", inputs, approval=_bound_approval(inputs)))
    reloaded = AutomationStore(path=tmp_path / "automations.json")
    assert reloaded.get(a.id).status.value == "cancelled"


# ── no ad-hoc dedicated automation engine was created ───────────────────────

def test_lifecycle_capabilities_use_the_existing_engine_module(isolated_store):
    import app.capabilities.automation_lifecycle as mod
    import inspect
    src = inspect.getsource(mod)
    assert "app.automation import engine" in src
    assert "app.automation.store import get_default_store" in src
