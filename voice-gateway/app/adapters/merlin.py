"""Merlin adapter — ClaudeAdapter + per-session Essence context injection.

Architecture:
  MerlinAdapter subclasses ClaudeAdapter (reuses all streaming, history,
  summarization, and delegation logic).  The only addition is a one-shot
  Essence context fetch at the start of each session, injected into the
  system prompt via ClaudeAdapter._essence_extra.

Session lifecycle:
  1. main.py creates a VoiceSessionContext(session_id, profile_id) at
     WebSocket connection time and passes it to register_session().
  2. The first respond() call fetches Essence context for profile_id,
     caches it, and sets _essence_extra so ClaudeAdapter picks it up.
  3. Subsequent respond() calls skip the fetch — cache hit.
  4. reset() clears the cache and delegates to ClaudeAdapter.reset().
  5. unregister_session() is called in finally at disconnect.

Security:
  - profile_id is never logged.
  - Essence content is never logged.
  - fetch_essence_context() handles all network/auth errors and returns ""
    so the session always degrades gracefully.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import AsyncIterator

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

    def register_session(self, ctx: VoiceSessionContext) -> None:
        """Call at WebSocket connect time to bind a profile_id to the session."""
        self._session_contexts[ctx.session_id] = ctx

    def unregister_session(self, session_id: str) -> None:
        """Call in finally at WebSocket disconnect to release all session state."""
        self._session_contexts.pop(session_id, None)
        self._essence_cache.pop(session_id, None)
        self._essence_extra.pop(session_id, None)

    # ── Adapter interface ─────────────────────────────────────────────────────

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        if session_id not in self._essence_cache:
            ctx = self._session_contexts.get(session_id)
            profile_id = ctx.profile_id if ctx else None
            if profile_id:
                block = await fetch_essence_context(profile_id)
            else:
                logger.debug("merlin[%s] no profile_id — skipping Essence fetch", session_id)
                block = ""
            self._essence_cache[session_id] = block
            # Inject once; ClaudeAdapter reads _essence_extra every turn.
            if block:
                self._essence_extra[session_id] = block
            else:
                self._essence_extra.pop(session_id, None)

        async for chunk in super().respond(text, session_id):
            yield chunk

    async def reset(self, session_id: str) -> None:
        self._essence_cache.pop(session_id, None)
        self._essence_extra.pop(session_id, None)
        await super().reset(session_id)
