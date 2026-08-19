"""Merlin adapter — ClaudeAdapter + per-session Essence context injection.

Architecture:
  MerlinAdapter subclasses ClaudeAdapter (reuses all streaming, history,
  summarization, and delegation logic).  The only addition is a one-shot
  Essence context fetch at the start of each session, injected into the
  system prompt via ClaudeAdapter._set_session_essence().

Session lifecycle:
  1. main.py creates a VoiceSessionContext(session_id, profile_id) at
     WebSocket connection time and passes it to register_session().
  2. The first respond() call fetches Essence context for profile_id,
     caches it, and calls _set_session_essence() so ClaudeAdapter picks it up.
  3. Subsequent respond() calls skip the fetch — cache hit.
  4. reset() clears the cache and delegates to ClaudeAdapter.reset().
  5. unregister_session() is called in finally at disconnect.

Security:
  - profile_id is never logged.
  - Essence content is never logged.
  - fetch_essence_context() handles all network/auth errors and returns ""
    so the session always degrades gracefully.

Action-intent gate (2026-08-12):
  respond() first runs app.action_intent.gate.classify_action_intent(text).
  This is a separate concern from domain_router's knowledge classification
  further down the (unchanged) ClaudeAdapter path — see
  app/action_intent/__init__.py for why the two must not merge. Only an
  explicit EXECUTION_TEST_N8N_ECHO intent short-circuits this method; every
  other turn (including turns that happen to mention n8n without an action
  verb) falls through to the Essence + ClaudeAdapter + domain_router path
  exactly as before.

PHILOS-observation gate (2026-08-14):
  respond() checks app.action_intent.philos_observation_gate BEFORE the
  action-intent gate above — a third, narrower discrimination axis ("does
  this turn carry an explicit canon self-report"), never merged with either
  the action-intent gate or domain_router (same "don't merge" discipline
  those two already hold between themselves). Recognizes ONLY an explicit
  "philos:"/"פילוס:" key=value self-report shape — never infers a canon
  field from natural language (see that module's own header for why).
  A recognized turn short-circuits exactly like EXECUTION_TEST_N8N_ECHO
  does: no history append, no Essence fetch, no Claude call. An
  unrecognized turn (the overwhelming default — including ordinary
  Human/Music/Studio/General questions) falls through unchanged, all the
  way to the action-intent gate and beyond.

PHILOS-orientation interview (2026-08-14):
  respond() checks app.action_intent.philos_orientation_interview BEFORE
  even the PHILOS-observation gate above — an active interview's next
  answer must never be reinterpreted by any other gate, and a FRESH natural
  first-person self-report ("אני מרגיש מרוקן לאחרונה") is the whole product
  gap this module closes: unlike the explicit-prefix gate, it recognizes
  ordinary spoken language and gets to a canon-valid Observation by asking
  one minimal follow-up question at a time, never inferring a canon field
  from tone or wording. Turns starting with the explicit "philos:"/"פילוס:"
  prefix are excluded from this module's own intent classifier, so the two
  never compete for the same turn. Same short-circuit shape as the gate
  above: a recognized turn (continuing OR starting an interview) returns a
  reply with no history append, no Essence fetch, no Claude call; None (the
  overwhelming default for a fresh turn) falls through unchanged.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import AsyncIterator

from app.action_intent.dispatch import dispatch as dispatch_action_intent
from app.action_intent.gate import classify_action_intent
from app.action_intent.philos_observation_gate import handle_philos_observation_turn
from app.action_intent.philos_orientation_interview import (
    cancel_interview as cancel_philos_orientation_interview,
    handle_philos_orientation_turn,
)
from app.adapters.claude import ClaudeAdapter
from app.essence_context import fetch_essence_context

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VoiceSessionContext:
    """Immutable per-connection identity passed at the WebSocket boundary."""

    session_id: str
    profile_id: str | None


class MerlinAdapter(ClaudeAdapter):
    """ClaudeAdapter with persona=merlin and one-shot Essence context injection."""

    def __init__(self, **kwargs: object) -> None:
        super().__init__(persona="merlin", **kwargs)
        self._session_contexts: dict[str, VoiceSessionContext] = {}
        # session_id → fetched Essence block (populated once, cached for session lifetime)
        self._essence_cache: dict[str, str] = {}

    @property
    def name(self) -> str:
        return "merlin"

    # ── Session boundary ──────────────────────────────────────────────────────

    def get_profile_id(self, session_id: str) -> str | None:
        """Return the profile_id bound to session_id, or None if not registered."""
        ctx = self._session_contexts.get(session_id)
        return ctx.profile_id if ctx else None

    def register_session(self, ctx: VoiceSessionContext) -> None:
        """Call at WebSocket connect time to bind a profile_id to the session."""
        self._session_contexts[ctx.session_id] = ctx

    def unregister_session(self, session_id: str) -> None:
        """Call in finally at WebSocket disconnect to release all session state."""
        self._session_contexts.pop(session_id, None)
        self._essence_cache.pop(session_id, None)
        self._clear_session_essence(session_id)
        cancel_philos_orientation_interview(session_id)

    # ── Adapter interface ─────────────────────────────────────────────────────

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        # PHILOS-orientation interview: checked first — an active interview's
        # next answer must never be reinterpreted by any other gate, and this
        # is the ONLY path that recognizes a fresh natural self-report (no
        # "philos:" prefix required). Returns None (the overwhelming default
        # for a fresh turn with no active interview) for anything that isn't
        # a first-person self-state statement or an in-progress answer.
        orientation_reply = await handle_philos_orientation_turn(text, session_id, self.get_profile_id(session_id))
        if orientation_reply is not None:
            yield orientation_reply
            return

        # PHILOS-observation gate: checked next — an explicit self-report
        # shape is the most specific possible trigger, and must never be
        # shadowed by the action-intent gate's own verb/topic matching.
        # Returns None (the overwhelming default) for anything that isn't
        # this exact explicit shape, including ordinary Human/Music/Studio/
        # General questions — those fall through completely unchanged.
        philos_reply = await handle_philos_observation_turn(text, self.get_profile_id(session_id))
        if philos_reply is not None:
            yield philos_reply
            return

        # Action-intent gate: runs before anything else, on the raw turn
        # text, independent of domain_router's knowledge classification.
        # dispatch=False (the overwhelming default) falls straight through
        # to the unchanged Essence + ClaudeAdapter + domain_router path
        # below. dispatch=True short-circuits: no history append, no Essence
        # fetch, no Claude call, no domain_router — this turn is answered
        # entirely by the n8n adapter's StructuredResult.
        decision = classify_action_intent(text)
        if decision.dispatch:
            reply = await dispatch_action_intent(decision, session_id)
            yield reply
            return

        if session_id not in self._essence_cache:
            ctx = self._session_contexts.get(session_id)
            profile_id = ctx.profile_id if ctx else None
            if profile_id:
                block = await fetch_essence_context(profile_id)
            else:
                logger.debug("merlin[%s] no profile_id — skipping Essence fetch", session_id)
                block = ""
            self._essence_cache[session_id] = block
            # Inject once; ClaudeAdapter reads the stored block every turn.
            self._set_session_essence(session_id, block)

        async for chunk in super().respond(text, session_id):
            yield chunk

    async def reset(self, session_id: str) -> None:
        self._essence_cache.pop(session_id, None)
        self._clear_session_essence(session_id)
        await super().reset(session_id)
