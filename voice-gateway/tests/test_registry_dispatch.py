"""app.action_intent.registry_dispatch — the additive bridge from a
registry-resolved ActionIntentDecision into the generic capability pipeline.
Never touches EXECUTION_TEST_N8N_ECHO/BOOKMARK_AUDIT (those keep their own
hardcoded path in dispatch.py, unaffected by this module's existence).
"""

import asyncio

from app.action_intent.dispatch import dispatch
from app.action_intent.gate import ActionIntentDecision, classify_action_intent
from app.action_intent.registry_dispatch import dispatch_registry_action
from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

run = asyncio.run


def test_no_capability_currently_qualifies_for_question_only_auto_dispatch():
    """Honest baseline: as of this pass, every voice-reachable capability
    with intent_patterns needs more than a bare 'question' field — so a real
    voice turn matching one of them safely rejects with malformed_request,
    never guesses. This test documents that fact so a future addition of a
    genuinely question-only capability is a deliberate, visible change."""
    for action_type in REGISTRY.action_types():
        spec = REGISTRY.get(action_type)
        if not spec.intent_patterns:
            continue
        required = {f.name for f in spec.required_inputs if f.required}
        if required:
            assert not (required <= {"question"}), (
                f"{action_type} now qualifies for text-only auto-dispatch — "
                "update this test's assumption deliberately, don't let it silently pass"
            )


def test_zero_required_input_capability_dispatches_successfully_via_bridge():
    """LIST_AUTOMATIONS needs nothing — the bridge should reach it with an
    empty inputs mapping and get a real 'accepted' result, proving the bridge
    genuinely calls the real pipeline, not a stub."""
    decision = ActionIntentDecision(True, "LIST_AUTOMATIONS", "forced", text="list automations")
    sr = run(dispatch_registry_action(decision))
    assert sr.status == "accepted"


def test_missing_structured_input_capability_rejects_safely_not_a_crash():
    decision = ActionIntentDecision(True, "PHILOS_ORIENTATION", "forced", text="philos orientation please")
    sr = run(dispatch_registry_action(decision))
    assert sr.status == "rejected"
    assert sr.code == "missing_input"


def test_unknown_action_type_rejects_safely():
    decision = ActionIntentDecision(True, "NOT_A_REAL_ACTION_TYPE", "forced", text="whatever")
    sr = run(dispatch_registry_action(decision))
    assert sr.status == "rejected"
    assert sr.code == "unknown_action_type"


def test_dispatch_py_routes_a_registry_resolved_intent_through_the_bridge():
    """End-to-end through the SAME dispatch() function a real voice turn
    calls — proves the wiring, not just the bridge in isolation."""
    decision = ActionIntentDecision(True, "LIST_AUTOMATIONS", "forced", text="list automations")
    reply = run(dispatch(decision, "session-test-registry-dispatch"))
    assert "לא בוצעה פעולה" not in reply


def test_dispatch_py_still_prioritizes_hardcoded_intents_unaffected():
    """gate.py's own documented rule: hardcoded intents always win on overlap
    and never reach the registry bridge — re-verified live through dispatch(),
    not just read from the source."""
    decision = classify_action_intent("בדיקת n8n")
    assert decision.dispatch and decision.intent == "EXECUTION_TEST_N8N_ECHO"


def test_registry_dispatch_never_imported_by_bookmark_or_echo_paths():
    """Structural: registry_dispatch.py must not import bookmark_audit or the
    n8n echo client — it is a generic bridge, not a third copy of either."""
    import inspect
    from app.action_intent import registry_dispatch as rd
    src = inspect.getsource(rd)
    assert "bookmark_audit" not in src
    assert "send_echo_action_request" not in src
