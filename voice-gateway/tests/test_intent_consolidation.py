"""LIVE INTENT CONSOLIDATION — collision re-audit.

Registry-driven intents only: every capability resolves through
ActionRegistry.resolve_intent()/intent_patterns (already the mechanism all 7
pre-existing capabilities used) — no new ad-hoc branch was added anywhere on
a live dispatch path for EMAIL_DRAFT/EMAIL_SEND/the automation lifecycle/
GOV_IL_RESEARCH. This file is the collision guard: it fails if two
capabilities' intent_patterns could ever resolve the same utterance to two
different action_types, and it fails if the older, hardcoded
app.action_intent.gate dispatcher (the "ad-hoc branch" pattern this
consolidation deliberately does NOT extend) ever grows a new intent — that
dispatcher is bookmark_audit-coupled and out of scope (DO NOT TOUCH:
bookmark implementation).

Also proves the KNOWLEDGE-DOMAIN vs ACTION-EXECUTION separation the task
requires: app.domain_router.classify() (HUMAN_CONFIG/MUSIC_CONFIG/
STUDIO_PROJECT/PHILOS/GENERAL — "what do you know about X") and
REGISTRY.resolve_intent() (EMAIL_DRAFT/SCHEDULE_REPORT/etc. — "do X") are
two independent systems that never collapse into each other: an
informational query that domain_router classifies into a knowledge domain
must never ALSO resolve to a capability action_type, and vice versa.
"""

from app.action_intent import gate
from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY
from app.domain_router import Domain, classify


def test_no_registered_action_type_shares_an_intent_pattern_string():
    seen: dict[str, str] = {}
    for at in REGISTRY.action_types():
        spec = REGISTRY.get(at)
        for p in spec.intent_patterns:
            key = p.lower()
            assert key not in seen, f"pattern {p!r} claimed by both {seen.get(key)!r} and {at!r}"
            seen[key] = at


def test_no_intent_pattern_is_a_substring_of_another_capabilitys_pattern():
    pats = [(at, p.lower()) for at in REGISTRY.action_types() for p in REGISTRY.get(at).intent_patterns]
    for at1, p1 in pats:
        for at2, p2 in pats:
            if at1 != at2:
                assert p1 not in p2, f"{p1!r} ({at1}) is a substring of {p2!r} ({at2}) — ambiguous resolution"


def test_email_draft_resolves_cleanly():
    assert REGISTRY.resolve_intent("draft an email to the team") == "EMAIL_DRAFT"
    assert REGISTRY.resolve_intent("טיוטת אימייל בבקשה") == "EMAIL_DRAFT"


def test_email_send_has_no_free_text_intent_resolution():
    # Deliberate: a side-effecting, approval-bound action must never be
    # auto-resolved from free text the way a READ_ONLY one can be — resolving
    # EMAIL_SEND from a transcript with no approval-collection step wired
    # around it would be exactly the kind of ad-hoc escalation this whole
    # execution-security contract exists to prevent.
    assert REGISTRY.get("EMAIL_SEND").intent_patterns == ()
    for phrase in ("send this email", "send the email now", "שלח את המייל"):
        assert REGISTRY.resolve_intent(phrase) != "EMAIL_SEND"


def test_action_intent_gate_untouched_still_exactly_two_hardcoded_intents():
    # Regression guard proving this consolidation did NOT add a new ad-hoc
    # branch to the older hardcoded dispatcher (which is bookmark_audit-coupled
    # and explicitly out of scope here).
    assert {name for name, _ in gate._INTENT_TOPIC_MATCHERS} == {
        gate.EXECUTION_TEST_N8N_ECHO, gate.BOOKMARK_AUDIT,
    }


# ── knowledge-domain routing vs action routing: proven independent ─────────

_INFORMATIONAL_QUERIES = (
    ("מה המטרות והשאיפות שלי", Domain.HUMAN_CONFIG),
    ("מה מצב קונפיג מוזיקה", Domain.MUSIC_CONFIG),
    ("מה השעה", Domain.GENERAL),
)


def test_informational_domain_queries_never_dispatch_as_an_action():
    for query, expected_domain in _INFORMATIONAL_QUERIES:
        domain, _confidence = classify(query)
        assert domain == expected_domain, query
        assert REGISTRY.resolve_intent(query) is None, (
            f"informational query {query!r} (classified {domain.value}) must never resolve to a capability"
        )


def test_web_research_and_email_shaped_questions_do_not_dispatch():
    # Phrased as a QUESTION, not a command — action_intent.gate's own
    # question-word/explanatory-phrasing gate refuses these; REGISTRY-level,
    # they simply don't match any registered intent_patterns either, since no
    # capability's patterns are phrased as a bare noun ("n8n") without a verb.
    for query in ("מה זה n8n", "explain what web research does", "מה זה אימייל"):
        assert REGISTRY.resolve_intent(query) is None, query


def test_explicit_capability_command_dispatches_exactly_once():
    action_type = REGISTRY.resolve_intent("draft an email to the team")
    assert action_type == "EMAIL_DRAFT"
    # exactly one match: no other registered capability's patterns overlap
    # (already proven generally above; here, specifically for this utterance)
    matches = [at for at in REGISTRY.action_types()
              if any(p.lower() in "draft an email to the team".lower() for p in REGISTRY.get(at).intent_patterns)]
    assert matches == ["EMAIL_DRAFT"]


def test_side_effecting_command_reaches_the_approval_gate_not_bypassed():
    import asyncio
    import tempfile
    from datetime import datetime, timedelta, timezone
    from pathlib import Path

    from app.automation import engine
    from app.automation.models import TriggerType
    from app.automation.store import AutomationStore, set_default_store_for_testing

    with tempfile.TemporaryDirectory() as d:
        real_store = AutomationStore(path=Path(d) / "automations.json")
        set_default_store_for_testing(real_store)
        try:
            a = engine.create_automation(real_store, REGISTRY, action_type="MONTHLY_PAYMENT", inputs={},
                                         trigger_type=TriggerType.SCHEDULED, ttl_s=3600, interval_s=60)
            # A side-effecting action_type resolved/requested with NO approval
            # must be rejected by the pipeline's own gate — the consolidation
            # onto REGISTRY.resolve_intent() does not, and structurally cannot,
            # provide a way around that gate for any capability.
            sr_no_approval = asyncio.run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", {"automation_id": a.id}))
            assert sr_no_approval.status == "rejected" and sr_no_approval.code == "approval_missing"

            from app.capabilities._framework.models import inputs_hash as fw_hash
            inputs = {"automation_id": a.id}
            approval = {"approved": True, "inputs_hash": fw_hash(inputs),
                       "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat().replace("+00:00", "Z")}
            sr_with_approval = asyncio.run(pipeline.execute(REGISTRY, "PAUSE_AUTOMATION", inputs, approval=approval))
            assert sr_with_approval.status == "accepted"
        finally:
            set_default_store_for_testing(None)


def test_unknown_action_type_is_denied_not_silently_ignored():
    import asyncio
    sr = asyncio.run(pipeline.execute(REGISTRY, "DEFINITELY_NOT_A_REAL_ACTION", {}))
    assert sr.status == "rejected" and sr.code == "unknown_action_type"
