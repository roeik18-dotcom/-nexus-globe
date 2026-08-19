"""Offline unit tests for app.action_intent.gate — no network, no n8n.

Covers every example given in the spec, plus adjacent phrases pulled from
app/domain_router.py's real PHILOS/HUMAN_CONFIG/MUSIC_CONFIG/RUNTIME cue
lists, to prove the action-intent gate and domain_router's own keyword
classification cannot be confused for one another.
"""

from app.action_intent.gate import BOOKMARK_AUDIT, EXECUTION_TEST_N8N_ECHO, classify_action_intent

SHOULD_DISPATCH = [
    "בדיקת n8n",
    "תבדוק את חיבור n8n",
    "run n8n echo test",
]

MUST_NOT_DISPATCH = [
    "מה זה n8n?",
    "איך n8n עובד?",
    "פילוס ו-n8n",
    "תסביר לי על אוטומציות",
]

# Real domain_router cue phrases (app/domain_router.py) — none reference n8n
# and none should ever dispatch, regardless of containing action-ish verbs.
DOMAIN_ROUTER_CUES_MUST_NOT_DISPATCH = [
    "פילוס",
    "philos",
    "value hub",
    "כור ההיתוך החיובי",
    "קונפיג אדם",
    "מי אני",
    "מיקס",
    "מוזיקלי",
    "מצב מרלין",
    "בדוק את הרשת",   # has the action verb "בדוק" but zero n8n reference
    "בדוק רשת",
    "מצב הפרויקט",
    "בוקר טוב",
]


def test_should_dispatch_examples():
    for text in SHOULD_DISPATCH:
        decision = classify_action_intent(text)
        assert decision.dispatch is True, f"expected dispatch for {text!r}, got {decision}"
        assert decision.intent == EXECUTION_TEST_N8N_ECHO


def test_must_not_dispatch_examples():
    for text in MUST_NOT_DISPATCH:
        decision = classify_action_intent(text)
        assert decision.dispatch is False, f"expected NO dispatch for {text!r}, got {decision}"
        assert decision.intent is None


def test_domain_router_cues_never_dispatch():
    for text in DOMAIN_ROUTER_CUES_MUST_NOT_DISPATCH:
        decision = classify_action_intent(text)
        assert decision.dispatch is False, f"domain query {text!r} must never dispatch, got {decision}"


def test_bare_n8n_mention_without_verb_does_not_dispatch():
    decision = classify_action_intent("n8n")
    assert decision.dispatch is False


def test_action_verb_without_n8n_does_not_dispatch():
    decision = classify_action_intent("תבדוק את זה")
    assert decision.dispatch is False


def test_never_raises_on_empty_or_weird_input():
    for text in ("", "   ", "?????", "n8n" * 50, "‏‎"):
        decision = classify_action_intent(text)
        assert decision.dispatch in (True, False)


def test_english_check_verb_dispatches():
    decision = classify_action_intent("check n8n connection")
    assert decision.dispatch is True
    assert decision.intent == EXECUTION_TEST_N8N_ECHO


def test_english_question_about_n8n_does_not_dispatch():
    decision = classify_action_intent("what is n8n and how does it work")
    assert decision.dispatch is False


# ── BOOKMARK_AUDIT intent ────────────────────────────────────────────────────

BOOKMARK_SHOULD_DISPATCH = [
    "בדוק את הסימניות שלי",
    "תבדוק סימניות",
    "run bookmark audit",
    "check my bookmarks",
    "audit bookmarks",
]

BOOKMARK_MUST_NOT_DISPATCH = [
    "מה זה סימניה?",
    "איך שומרים סימניות?",
    "תסביר לי על סימניות",
    "what is a bookmark?",
    "יש לי הרבה סימניות",  # mentions topic, no action verb
]


def test_bookmark_audit_should_dispatch_examples():
    for text in BOOKMARK_SHOULD_DISPATCH:
        decision = classify_action_intent(text)
        assert decision.dispatch is True, f"expected dispatch for {text!r}, got {decision}"
        assert decision.intent == BOOKMARK_AUDIT


def test_bookmark_audit_must_not_dispatch_examples():
    for text in BOOKMARK_MUST_NOT_DISPATCH:
        decision = classify_action_intent(text)
        assert decision.dispatch is False, f"expected NO dispatch for {text!r}, got {decision}"


def test_n8n_and_bookmark_intents_do_not_cross_trigger():
    d1 = classify_action_intent("בדיקת n8n")
    assert d1.intent == EXECUTION_TEST_N8N_ECHO
    d2 = classify_action_intent("בדוק את הסימניות שלי")
    assert d2.intent == BOOKMARK_AUDIT
    # mentioning both topic words without a clear single target still
    # resolves to whichever topic matcher runs first (n8n), deterministically
    d3 = classify_action_intent("תבדוק n8n וגם סימניות")
    assert d3.dispatch is True
    assert d3.intent in (EXECUTION_TEST_N8N_ECHO, BOOKMARK_AUDIT)
