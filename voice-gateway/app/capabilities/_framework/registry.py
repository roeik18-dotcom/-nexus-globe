"""The Action Registry: the single declarative source of truth mapping
action_type -> ActionSpec. Deny-first: an unknown action_type resolves to None
and the pipeline rejects it (it never guesses or falls through to a default)."""

from __future__ import annotations

from typing import Optional

from app.capabilities._framework.models import ActionSpec


# Informational-phrasing gate: a query ASKING ABOUT a capability by name
# ("explain what web research does") must never be treated the same as a
# query COMMANDING it ("do a web research on X") just because the
# capability's own intent_pattern substring happens to appear in the
# sentence. This mirrors app.action_intent.gate's own question/explain
# filter (self-contained here, not imported — that module lives next to
# bookmark_audit, which this generic framework must not depend on). Kept
# deliberately small and conservative: a false negative here just means a
# real command needs slightly more direct phrasing; a false positive (a
# question that slips through as a command) is the failure mode that
# actually matters for "informational queries do not dispatch".
_QUESTION_MARKERS = ("?", "؟")  # ASCII + Arabic question mark
_EXPLAIN_PHRASES = (
    "explain", "what is", "what does", "what's", "tell me about", "how does",
    "מה זה", "תסביר", "הסבר", "ספר לי על", "מה ה",
)


def _is_informational_phrasing(low_text: str) -> bool:
    return any(m in low_text for m in _QUESTION_MARKERS) or any(p in low_text for p in _EXPLAIN_PHRASES)


class ActionRegistry:
    def __init__(self) -> None:
        self._specs: dict[str, ActionSpec] = {}

    def register(self, spec: ActionSpec) -> None:
        if spec.action_type in self._specs:
            raise ValueError(f"duplicate action_type in registry: {spec.action_type}")
        self._specs[spec.action_type] = spec

    def get(self, action_type: str) -> Optional[ActionSpec]:
        """Deny-first lookup. Unknown -> None (pipeline rejects)."""
        return self._specs.get(action_type)

    def action_types(self) -> list[str]:
        return sorted(self._specs)

    def resolve_intent(self, text: str) -> Optional[str]:
        """Map free text to an action_type via each spec's intent_patterns.
        Returns None if nothing matches — the framework never dispatches on an
        unresolved intent. Untrusted content cannot introduce new patterns; the
        pattern set is fixed by the registered specs, not by the input.
        Text asking ABOUT a capability (a question, or explanatory phrasing —
        see _is_informational_phrasing) never resolves, even if a capability's
        pattern substring appears in it — knowledge questions are not action
        commands."""
        if not text:
            return None
        low = text.lower()
        if _is_informational_phrasing(low):
            return None
        for action_type, spec in self._specs.items():
            if spec.intent_patterns and any(p.lower() in low for p in spec.intent_patterns):
                return action_type
        return None
