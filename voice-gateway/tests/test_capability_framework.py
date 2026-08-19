"""Framework + security acceptance for the generic capability pipeline."""

import asyncio

from app.capabilities._framework import pipeline
from app.capabilities._framework.registry import ActionRegistry
from app.capabilities.registry import REGISTRY

run = asyncio.run


def test_registry_lookup_and_intent():
    assert set(REGISTRY.action_types()) == {"MONTHLY_PAYMENT", "TABLE_REPORT", "WEB_RESEARCH", "MARKET_DATA", "SHOP_SEARCH", "PRICE_COMPARE", "PRODUCT_COMPARE", "EMAIL_DRAFT", "EMAIL_SEND", "SCHEDULE_REPORT", "CONDITION_WATCH", "GOV_IL_RESEARCH", "LIST_AUTOMATIONS", "PAUSE_AUTOMATION", "RESUME_AUTOMATION", "CANCEL_AUTOMATION", "EXECUTION_TEST_N8N_ECHO", "PHILOS_ORIENTATION", "PHILOS_TRANSFER_EXECUTE", "PHILOS_OBSERVE"}
    assert REGISTRY.get("MONTHLY_PAYMENT") is not None
    assert REGISTRY.get("NOPE") is None
    assert REGISTRY.resolve_intent("compute the monthly payment") == "MONTHLY_PAYMENT"
    assert REGISTRY.resolve_intent("please build a report") == "TABLE_REPORT"
    assert REGISTRY.resolve_intent("what is the weather") is None


def test_duplicate_registration_rejected():
    reg = ActionRegistry()
    reg.register(REGISTRY.get("MONTHLY_PAYMENT"))
    try:
        reg.register(REGISTRY.get("MONTHLY_PAYMENT"))
        assert False, "expected duplicate registration to raise"
    except ValueError:
        pass


def test_unknown_action_type_rejected():
    sr = run(pipeline.execute(REGISTRY, "DELETE_EVERYTHING", {"x": 1}))
    assert sr.status == "rejected" and sr.code == "unknown_action_type"


def test_input_cannot_set_side_effecting_or_approval():
    for bad_key in ("side_effecting", "approval_required", "approval", "action_type"):
        inputs = {"price": 1, "down_payment": 0, "apr": 0, "term_months": 1,
                  "fees": [], "currency": "USD", bad_key: True}
        sr = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", inputs))
        assert sr.status == "rejected" and sr.code == "malformed_request", bad_key


def test_malformed_inputs_controlled():
    # not an object
    sr = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", "not-an-object"))
    assert sr.status == "rejected"
    # missing required input
    sr2 = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT",
                               {"price": 1, "apr": 0, "term_months": 1, "fees": [], "currency": "USD"}))
    assert sr2.status == "rejected" and sr2.code == "missing_input"


def test_duplicate_pure_action_is_safe():
    pipeline.reset_idempotency_store()
    inputs = {"price": 1000, "down_payment": 0, "apr": 0, "term_months": 10,
              "fees": [], "currency": "USD"}
    aid = "act-fixed-dup-1"
    first = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", inputs, action_id=aid))
    second = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT", inputs, action_id=aid))
    assert first.status == "accepted"
    assert second.status == "duplicate" and second.code == "duplicate_action_id"
    # same underlying result echoed, no re-execution divergence
    assert second.result["monthly_payment"] == first.result["monthly_payment"]


def test_no_secrets_or_inputs_in_logs(caplog):
    pipeline.reset_idempotency_store()
    marker = "SECRETMARKER-XYZ"
    with caplog.at_level("INFO"):
        sr = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT",
                 {"price": 1000, "down_payment": 0, "apr": 0, "term_months": 10,
                  "fees": [], "currency": marker}))
    assert sr.status == "accepted"
    assert sr.result["currency"] == marker           # marker IS in the result
    assert marker not in caplog.text                 # but NEVER in the logs


def test_structured_result_shape():
    sr = run(pipeline.execute(REGISTRY, "MONTHLY_PAYMENT",
             {"price": 1000, "down_payment": 0, "apr": 0, "term_months": 10,
              "fees": [], "currency": "USD"}))
    for attr in ("status", "code", "action_id", "correlation_id", "result", "http_status"):
        assert hasattr(sr, attr)
    assert sr.result["provenance"]["action_type"] == "MONTHLY_PAYMENT"
