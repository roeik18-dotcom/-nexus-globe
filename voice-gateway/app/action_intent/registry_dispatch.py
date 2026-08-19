"""Bridges a registry-resolved ActionIntentDecision (app.action_intent.gate)
into the generic capability pipeline. Additive only — never touches the two
hardcoded intents (EXECUTION_TEST_N8N_ECHO, BOOKMARK_AUDIT), which keep their
own dispatch path in dispatch.py unchanged. Called only when gate.py already
resolved a decision whose intent is a real, registered action_type that is
NOT one of those two hardcoded ones (see dispatch.py's own fallback branch).

Free-text input extraction is deliberately narrow: the ONLY structured input
this module will ever construct from raw utterance text is a single
`{"question": text}` mapping, and only for a capability whose entire set of
REQUIRED fields is satisfied by that one key (e.g. WEB_RESEARCH's own
`max_sources` is declared with a value, so it does not qualify unless
`required=False`; today no registered capability actually qualifies this
narrowly, and that is fine — see module note below). Every other
capability's required_inputs (canon_event_id, urls, target_action_type,
etc.) cannot be safely guessed from free text, so this module does not
attempt to. In that case `inputs` is submitted as an EMPTY mapping and
`pipeline.execute()`'s own input validation naturally, safely rejects the
call with a controlled `malformed_request` result — never a crash, never a
guessed value, never an escalation. This is a disclosed, honest UX gap
(voice alone cannot supply e.g. a PHILOS `canon_event_id`), not a security
gap: a bare intent match with no real structured input source no more
executes a real handler than any other malformed request would.

PHILOS_ORIENTATION in particular: its intent_patterns is `()` (never
resolved from free text at all, by its own module's design — see
philos_orientation.py), so it can never even reach this bridge via
gate.py's registry fallback. This module does not special-case it.
"""

from __future__ import annotations

import logging

from app.action_intent.gate import ActionIntentDecision
from app.capabilities._framework import pipeline
from app.capabilities._framework.models import StructuredResult
from app.capabilities.registry import REGISTRY

logger = logging.getLogger("merlin.action_intent")


def _text_only_inputs(action_type: str, text: str) -> dict:
    """Returns {"question": text} only when that single field would satisfy
    every REQUIRED input the spec declares; otherwise an empty mapping, so
    pipeline.execute() reports the real missing fields itself rather than
    this module guessing or fabricating one."""
    spec = REGISTRY.get(action_type)
    if spec is None:
        return {}
    required_names = {f.name for f in spec.required_inputs if f.required}
    if required_names and required_names <= {"question"}:
        return {"question": text}
    return {}


async def dispatch_registry_action(
    decision: ActionIntentDecision, *, action_id: str | None = None,
    provenance_source: str = "merlin-voice",
) -> StructuredResult:
    """Never raises — pipeline.execute() already guarantees that. Returns a
    real StructuredResult with a real action_id/correlation_id — auto-
    generated unless the caller forces one via `action_id` (normally omitted;
    exists so a duplicate real turn, or a proof/test harness, can force the
    same id twice and exercise the capability's own idempotency guarantee
    through this path — same optional pass-through dispatch.py's echo branch
    already has, generalized, not a new dedup mechanism)."""
    action_type = decision.intent or ""
    inputs = _text_only_inputs(action_type, decision.text)
    logger.info("REGISTRY_DISPATCH action_type=%s has_question_input=%s", action_type, bool(inputs))
    return await pipeline.execute(REGISTRY, action_type, inputs, action_id=action_id,
                                  provenance_source=provenance_source)
