"""Explicit action-intent classifier.

Rule-based, not LLM-based — deterministic, auditable, zero added latency,
fully unit-testable, no new model/network dependency on the hot path. This
mirrors app.domain_router's own reasoning for being rule-based (see its
module docstring), applied to a much narrower question: "is this turn
explicitly asking to EXECUTE something" rather than "what topic is this".

Two hardcoded intents: EXECUTION_TEST_N8N_ECHO and BOOKMARK_AUDIT (both
read-only). Adding a new HARDCODED intent means adding a new, deliberately-
reviewed topic-token set below — never loosening an existing one to "catch
more". (2026-08-14: registry-driven capabilities are handled separately, as
an ADDITIVE fallback — see the bottom of classify_action_intent() and the
module note below. Nothing about the two hardcoded intents above changed.)

Decision policy (all conditions required to dispatch — deny-first):
  1. Any question or explanatory phrasing anywhere in the utterance blocks
     dispatch outright, even if action words are also present. Question
     marks, Hebrew question words (מה/איך/למה/מי/האם/מתי/איפה), and
     explain-style verbs (תסביר/הסבר/ספר לי) are all treated as "this is a
     knowledge query", full stop. This gate applies to EVERY intent below,
     hardcoded or registry-driven — it runs first and is never bypassed.
  2. An explicit action/imperative verb (Hebrew or English) must be present
     as its own token. Mentioning a topic word alongside unrelated text
     ("פילוס ו-n8n") without an action verb does not dispatch.
  3. The utterance must reference a specific intent's topic token(s)
     literally (e.g. "n8n" for the echo test, "סימניות"/"bookmark(s)" for
     the audit). No topic match means no dispatch, regardless of (1) and (2).

All must hold. Any one failing means NO dispatch, and the turn proceeds
through normal domain routing untouched.

Registry-driven capabilities (2026-08-14, additive, non-invasive):
  app.capabilities.registry.REGISTRY.resolve_intent() is checked as a
  SEPARATE fallback, only reached when (1) above already passed AND
  (2)+(3) above did NOT produce a hardcoded-intent dispatch. It is NOT
  gated by this module's own _ACTION_VERBS_*/_INTENT_TOPIC_MATCHERS (those
  are tuned for exactly the two hardcoded intents) — each registered
  capability's own `intent_patterns` supplies its verb+topic specificity
  instead (see app/capabilities/*.py), and REGISTRY.resolve_intent() applies
  its OWN independent question-mark/explain-phrase gate on top
  (app/capabilities/_framework/registry.py) — so a knowledge question that
  happens to mention "email"/"government"/etc. still never dispatches: gate
  (1) above catches most of them, and resolve_intent()'s own gate catches
  the rest. This module's two hardcoded intents are checked FIRST and always
  win on overlap (e.g. "test n8n" still resolves to EXECUTION_TEST_N8N_ECHO
  via the hardcoded path below, never reaching the registry fallback) — the
  registry path never overrides or loosens hardcoded-intent behavior, and
  BOOKMARK_AUDIT is completely unaffected (untouched code, still hardcoded,
  still the only path to it).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger("merlin.action_intent")

EXECUTION_TEST_N8N_ECHO = "EXECUTION_TEST_N8N_ECHO"
BOOKMARK_AUDIT = "BOOKMARK_AUDIT"

_QUESTION_WORDS_HE = frozenset({"מה", "איך", "למה", "מי", "האם", "מתי", "איפה"})
_EXPLAIN_PHRASES = ("תסביר", "הסבר", "ספר לי", "תספר לי", "explain", "tell me about")

_ACTION_VERBS_HE = frozenset({
    "בדיקת", "בדוק", "תבדוק", "בודק", "בודקת",
    "הרץ", "תריץ", "הפעל", "תפעיל",
})
_ACTION_VERBS_EN = frozenset({"run", "test", "check", "audit"})

_WORD_RE = re.compile(r"[\w֐-׿]+", re.UNICODE)

# Ordered: first topic match wins. Each entry is (intent, token_matcher).
# Substring match, not exact-token: Hebrew prepositions/articles (ה-/ו-/ב-/
# ל-/מ-/ש-/כ-) productively prefix nouns ("סימניות" -> "הסימניות" -> "the
# bookmarks"), so exact-token matching silently misses the definite-article
# form — the same class of bug app/domain_router.py documents fighting for
# "קונפיג אדם" vs "קונפיג האדם". Stems here are short enough to be
# unambiguous without a false-positive risk worth worrying about.
_N8N_TOKEN_RE = re.compile(r"n8n", re.IGNORECASE)
_BOOKMARK_STEMS_HE = ("סימני", "בוקמארק")
_BOOKMARK_STEMS_EN = ("bookmark",)


def _matches_n8n_topic(stripped: str, tokens: list[str], lower_tokens: list[str]) -> bool:
    return bool(_N8N_TOKEN_RE.search(stripped))


def _matches_bookmark_topic(stripped: str, tokens: list[str], lower_tokens: list[str]) -> bool:
    lower = stripped.lower()
    return any(stem in stripped for stem in _BOOKMARK_STEMS_HE) or any(stem in lower for stem in _BOOKMARK_STEMS_EN)


_INTENT_TOPIC_MATCHERS: tuple[tuple[str, object], ...] = (
    (EXECUTION_TEST_N8N_ECHO, _matches_n8n_topic),
    (BOOKMARK_AUDIT, _matches_bookmark_topic),
)


@dataclass(frozen=True)
class ActionIntentDecision:
    dispatch: bool
    intent: str | None
    reason: str
    # 2026-08-14: the stripped original utterance, needed by the registry-
    # driven dispatch path (app/action_intent/registry_dispatch.py) to
    # extract a capability's structured inputs. Defaulted so every existing
    # construction call site (including the hardcoded-intent branches below,
    # which never read it) stays source-compatible unchanged.
    text: str = ""


def _tokenize(text: str) -> list[str]:
    return _WORD_RE.findall(text)


def classify_action_intent(text: str) -> ActionIntentDecision:
    """Classify a single user turn. Never raises; unrecognized/ambiguous
    input always resolves to dispatch=False."""
    stripped = text.strip()

    if "?" in stripped or "؟" in stripped:
        decision = ActionIntentDecision(False, None, "question mark present", text=stripped)
        _log_decision(stripped, decision)
        return decision

    tokens = _tokenize(stripped)
    lower_tokens = [t.lower() for t in tokens]

    if any(t in _QUESTION_WORDS_HE for t in tokens):
        decision = ActionIntentDecision(False, None, "Hebrew question word present", text=stripped)
        _log_decision(stripped, decision)
        return decision

    lower_text = stripped.lower()
    if any(phrase in lower_text for phrase in _EXPLAIN_PHRASES):
        decision = ActionIntentDecision(False, None, "explanatory phrasing present", text=stripped)
        _log_decision(stripped, decision)
        return decision

    has_action_verb = (
        any(t in _ACTION_VERBS_HE for t in tokens)
        or any(t in _ACTION_VERBS_EN for t in lower_tokens)
    )
    if has_action_verb:
        for intent, matcher in _INTENT_TOPIC_MATCHERS:
            if matcher(stripped, tokens, lower_tokens):
                decision = ActionIntentDecision(True, intent, f"explicit {intent} intent", text=stripped)
                _log_decision(stripped, decision)
                return decision

    registry_action_type = _resolve_registry_intent(stripped)
    if registry_action_type is not None:
        decision = ActionIntentDecision(True, registry_action_type,
                                        f"registry-resolved capability: {registry_action_type}", text=stripped)
        _log_decision(stripped, decision)
        return decision

    decision = ActionIntentDecision(False, None, "no recognized action topic", text=stripped)
    _log_decision(stripped, decision)
    return decision


def _resolve_registry_intent(stripped: str) -> str | None:
    """Late import: app.capabilities.registry must not be imported at gate.py
    module load time (avoids any import-order coupling with the capability
    framework; this module works standalone if that package is ever absent)."""
    try:
        from app.capabilities.registry import REGISTRY
    except ImportError:  # pragma: no cover — defensive only
        return None
    return REGISTRY.resolve_intent(stripped)


def _log_decision(text: str, decision: ActionIntentDecision) -> None:
    logger.info(
        "ACTION_INTENT_DECISION query=%r dispatch=%s intent=%s reason=%r",
        text, decision.dispatch, decision.intent, decision.reason,
    )
