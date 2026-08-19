"""SCHEDULE_REPORT / CONDITION_WATCH — registry-driven automation-creation
capabilities. Every test swaps in a tmp_path-backed store; the real
state/capability_automations.json is never touched.
"""

import asyncio

import pytest

from app.automation.predicates import register_predicate
from app.automation.store import AutomationStore, set_default_store_for_testing
from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

run = asyncio.run


@pytest.fixture(autouse=True)
def isolated_store(tmp_path):
    store = AutomationStore(path=tmp_path / "automations.json")
    set_default_store_for_testing(store)
    yield store
    set_default_store_for_testing(None)


def test_schedule_report_creates_active_automation():
    inputs = {"target_action_type": "MONTHLY_PAYMENT", "target_inputs": {"price": 1}, "interval_s": 60, "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
    assert sr.status == "accepted"
    assert sr.result["status"] == "active"
    assert sr.result["trigger_type"] == "scheduled"
    assert sr.result["automation_id"]
    assert sr.result["framework"]["verification"] == "verified"


def test_schedule_report_rejects_side_effecting_target():
    inputs = {"target_action_type": "EMAIL_SEND", "target_inputs": {}, "interval_s": 60, "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
    assert sr.status == "rejected"
    assert sr.code == "action_not_read_only"


def test_schedule_report_rejects_unknown_target():
    inputs = {"target_action_type": "NOPE", "target_inputs": {}, "interval_s": 60, "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
    assert sr.status == "rejected" and sr.code == "unknown_action_type"


def test_condition_watch_creates_active_automation():
    register_predicate("test_automation_actions_flag", lambda: False)
    inputs = {"target_action_type": "TABLE_REPORT", "target_inputs": {"title": "x", "columns": [], "rows": []},
              "predicate_name": "test_automation_actions_flag", "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "CONDITION_WATCH", inputs))
    assert sr.status == "accepted"
    assert sr.result["trigger_type"] == "condition_watch"


def test_condition_watch_rejects_unknown_predicate():
    inputs = {"target_action_type": "MONTHLY_PAYMENT", "target_inputs": {}, "predicate_name": "does_not_exist",
              "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "CONDITION_WATCH", inputs))
    assert sr.status == "rejected" and sr.code == "unknown_predicate"


def test_condition_watch_rejects_side_effecting_target():
    register_predicate("test_automation_actions_flag2", lambda: False)
    inputs = {"target_action_type": "EMAIL_SEND", "target_inputs": {},
              "predicate_name": "test_automation_actions_flag2", "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "CONDITION_WATCH", inputs))
    assert sr.status == "rejected" and sr.code == "action_not_read_only"


def test_duplicate_schedule_rejected():
    inputs = {"target_action_type": "MONTHLY_PAYMENT", "target_inputs": {"price": 1}, "interval_s": 60, "ttl_s": 3600}
    first = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
    assert first.status == "accepted"
    second = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
    assert second.status == "rejected" and second.code == "duplicate_automation"


def test_input_cannot_set_control_fields():
    for bad_key in ("side_effecting", "approval_required", "approval", "action_type"):
        inputs = {"target_action_type": "MONTHLY_PAYMENT", "target_inputs": {}, "interval_s": 60,
                  "ttl_s": 3600, bad_key: True}
        sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
        assert sr.status == "rejected" and sr.code == "malformed_request", bad_key


def test_registry_resolves_automation_intents():
    assert REGISTRY.resolve_intent("please schedule a report for me") == "SCHEDULE_REPORT"
    assert REGISTRY.resolve_intent("watch for a condition") == "CONDITION_WATCH"


def test_created_automation_actually_ticks_and_fires():
    from app.automation import engine
    from app.automation.models import utc_now
    from datetime import timedelta

    inputs = {"target_action_type": "MONTHLY_PAYMENT",
              "target_inputs": {"price": 1000, "down_payment": 0, "apr": 0, "term_months": 10,
                                "fees": [], "currency": "USD"},
              "interval_s": 10, "ttl_s": 3600}
    sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", inputs))
    aid = sr.result["automation_id"]
    from app.automation.store import get_default_store
    fired = run(engine.tick(get_default_store(), REGISTRY, now=utc_now() + timedelta(seconds=1)))
    assert any(f["automation_id"] == aid and f["status"] == "accepted" for f in fired)
