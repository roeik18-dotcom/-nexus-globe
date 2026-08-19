"""MERLIN E2E ACCEPTANCE HARNESS — real user flows through existing,
already-built components (domain_router + the capability registry/pipeline).

This is NOT new implementation. It wires nothing new into the live voice
runtime (service/merlin_service.py / app/adapters/merlin.py stay untouched —
see the phase report's ACTION_INTENT_CONSOLIDATION section for why that
remains structurally blocked). Every scenario below calls the SAME functions
a live adapter would call once that wiring lands: app.domain_router.classify/
route for knowledge questions, app.capabilities.registry.REGISTRY.resolve_intent
+ app.capabilities._framework.pipeline.execute for action commands.

No PHILOS scenario here — PHILOS bridge implementation is explicitly owned by
a separate PHILOS session and out of scope.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app import master_config as mc
from app.domain_router import Domain, classify, route
from app.capabilities._framework import pipeline
from app.capabilities._framework.models import inputs_hash as fw_hash
from app.capabilities.registry import REGISTRY

run = asyncio.run

requires_live_human_master = pytest.mark.skipif(
    mc.human_master_path() is None,
    reason="real Human Config master not reachable in this environment",
)


def _bound_approval(inputs: dict, *, ttl_s: float = 300.0) -> dict:
    return {
        "approved": True, "inputs_hash": fw_hash(inputs),
        "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl_s)).isoformat().replace("+00:00", "Z"),
    }


# ── A. informational Human request → Human domain, NO action dispatch ──────

def test_A_human_informational_request_classifies_human_no_action_dispatch():
    query = "מה המטרות והשאיפות שלי"
    domain, confidence = classify(query)
    assert domain is Domain.HUMAN_CONFIG
    assert confidence > 0
    assert REGISTRY.resolve_intent(query) is None


@requires_live_human_master
def test_A_human_informational_request_real_retrieval_no_fabrication():
    rr = route("מה המטרות והשאיפות שלי")
    assert rr.domain is Domain.HUMAN_CONFIG
    assert rr.context_text.strip()
    assert all(s.status == "LOADED" for s in rr.sources)


# ── B. Music request → Music domain ─────────────────────────────────────────

def test_B_music_request_classifies_music_no_action_dispatch():
    query = "מה מצב קונפיג מוזיקה"
    domain, confidence = classify(query)
    assert domain is Domain.MUSIC_CONFIG
    assert REGISTRY.resolve_intent(query) is None


# ── C. Studio project request → Studio retrieval ────────────────────────────

def test_C_studio_request_classifies_studio_no_action_dispatch():
    query = "מצב האולפן"
    domain, confidence = classify(query)
    assert domain is Domain.STUDIO_PROJECT
    assert REGISTRY.resolve_intent(query) is None


def test_C_studio_request_real_retrieval_from_the_real_ledger():
    from app.studio_index import retrieve_studio_project
    res = retrieve_studio_project("אולפן", limit=3)
    if res.get("status") != "LOADED":
        pytest.skip("real Studio ledger not reachable in this environment")
    rr = route("מצב האולפן")
    assert rr.domain is Domain.STUDIO_PROJECT
    assert rr.confidence == 1.0
    assert rr.context_text.strip()
    assert all(s.status == "LOADED" for s in rr.sources)


# ── D. public government research → research capability ────────────────────

def test_D_gov_research_command_dispatches_to_gov_il_research():
    query = "search data.gov.il for flights"
    assert REGISTRY.resolve_intent(query) == "GOV_IL_RESEARCH"
    # informational domain routing is untouched by this — GENERAL, not a knowledge domain
    domain, _ = classify(query)
    assert domain not in (Domain.HUMAN_CONFIG, Domain.MUSIC_CONFIG, Domain.STUDIO_PROJECT)


def test_D_gov_research_executes_read_only_no_approval_needed():
    spec = REGISTRY.get("GOV_IL_RESEARCH")
    assert spec.side_effect.value == "read_only"
    assert spec.approval_policy.value == "none"
    # malformed/empty mode selection is denied, not silently defaulted
    sr = run(pipeline.execute(REGISTRY, "GOV_IL_RESEARCH", {}))
    assert sr.status == "rejected"


# ── E. email draft → no side effect ─────────────────────────────────────────

def test_E_email_draft_produces_no_side_effect():
    inputs = {"to": ["team@example.com"], "subject": "Status", "body": "All good."}
    sr = run(pipeline.execute(REGISTRY, "EMAIL_DRAFT", inputs))
    assert sr.status == "accepted"
    assert sr.result["send_status"] == "not_sent"
    assert REGISTRY.get("EMAIL_DRAFT").side_effect.value == "read_only"


# ── F. email send request → approval gate ───────────────────────────────────

def test_F_email_send_without_approval_is_denied_at_the_gate():
    inputs = {"to": ["team@example.com"], "subject": "Go", "body": "Ship it."}
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", inputs))
    assert sr.status == "rejected"
    assert sr.code == "approval_missing"
    # never resolved from free text either — no path bypasses the gate via intent resolution
    assert REGISTRY.resolve_intent("send this email now") != "EMAIL_SEND"


def test_F_email_send_with_fresh_bound_approval_reaches_the_handler():
    from app.capabilities.email_send import normalize_inputs, build_approval
    raw = {"to": ["team@example.com"], "subject": "Go", "body": "Ship it."}
    approval = build_approval(normalize_inputs(raw), approved=True)
    # No live n8n configured in this environment — the approval gate itself
    # is what's under test; the actual send outcome honestly reports
    # not-connected rather than a fabricated success.
    sr = run(pipeline.execute(REGISTRY, "EMAIL_SEND", raw, approval=approval))
    assert sr.code != "approval_missing"


# ── G. scheduled read-only report → automation ──────────────────────────────

def test_G_scheduled_read_only_report_fires_via_automation(tmp_path):
    from app.automation import engine
    from app.automation.models import utc_now
    from app.automation.store import AutomationStore, set_default_store_for_testing

    store = AutomationStore(path=tmp_path / "e2e_automations.json")
    set_default_store_for_testing(store)
    try:
        create_inputs = {
            "target_action_type": "MONTHLY_PAYMENT",
            "target_inputs": {"price": 1000, "down_payment": 0, "apr": 0, "term_months": 10,
                              "fees": [], "currency": "USD"},
            "interval_s": 60, "ttl_s": 3600,
        }
        sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", create_inputs))
        assert sr.status == "accepted"
        automation_id = sr.result["automation_id"]

        fired = run(engine.tick(store, REGISTRY, now=utc_now()))
        assert any(f["automation_id"] == automation_id and f["status"] == "accepted" for f in fired)
    finally:
        set_default_store_for_testing(None)


def test_G_a_side_effecting_target_can_never_be_scheduled():
    sr = run(pipeline.execute(REGISTRY, "SCHEDULE_REPORT", {
        "target_action_type": "EMAIL_SEND", "target_inputs": {}, "interval_s": 60, "ttl_s": 3600,
    }))
    assert sr.status == "rejected" and sr.code == "action_not_read_only"


# ── H. unknown action → deny ─────────────────────────────────────────────────

def test_H_unknown_action_is_denied_not_silently_ignored():
    sr = run(pipeline.execute(REGISTRY, "DEFINITELY_NOT_A_REAL_ACTION", {}))
    assert sr.status == "rejected"
    assert sr.code == "unknown_action_type"
    assert REGISTRY.resolve_intent("do something nobody registered") is None


# ── I. side-effect attempt without approval → deny (generic, not email-specific) ──

def test_I_side_effect_without_approval_denied_generically(tmp_path):
    """Same gate as F, exercised on a DIFFERENT capability (automation
    control, not email) to prove the approval requirement is a pipeline-wide
    property, not something special-cased per capability."""
    from app.automation import engine
    from app.automation.models import TriggerType
    from app.automation.store import AutomationStore, set_default_store_for_testing

    store = AutomationStore(path=tmp_path / "e2e_automations_2.json")
    set_default_store_for_testing(store)
    try:
        a = engine.create_automation(store, REGISTRY, action_type="MONTHLY_PAYMENT", inputs={},
                                     trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)
        sr = run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", {"automation_id": a.id}))
        assert sr.status == "rejected" and sr.code == "approval_missing"
        assert store.get(a.id).status.value == "active"  # untouched — denial was real, not cosmetic
    finally:
        set_default_store_for_testing(None)


# ── cross-cutting: this harness never imports PHILOS or bookmark internals ──

def test_no_scenario_here_imports_philos_or_bookmark_modules():
    import ast
    from pathlib import Path
    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    imported_modules = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported_modules += [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.append(node.module)
    assert not any("bookmark" in m.lower() for m in imported_modules), imported_modules
    assert not any("philos" in m.lower() for m in imported_modules), imported_modules
