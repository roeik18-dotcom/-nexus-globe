"""Per-session memory promotion candidates — proposed but not yet approved."""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Categories that carry personal / preference data.
# Philos does not store these without an explicit policy override.
PERSONAL_CATEGORIES: frozenset[str] = frozenset({"preference", "personal", "identity"})


@dataclass
class MemoryCandidate:
    id: str
    persona: str
    key: str
    value: object
    category: str
    reason: str
    source: str       # "session" | "tool" | "summary"
    confidence: float
    proposed_at: str


class MemoryCandidateRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, list[MemoryCandidate]] = {}

    def propose(
        self,
        session_id: str,
        persona: str,
        key: str,
        value: object,
        category: str = "general",
        reason: str = "",
        source: str = "session",
        confidence: float = 1.0,
    ) -> MemoryCandidate:
        if not key or not key.strip():
            raise ValueError("key must be non-empty")
        if persona == "philos" and category in PERSONAL_CATEGORIES:
            raise ValueError(
                f"philos does not store personal memory (category={category!r}); "
                "use a non-personal category or switch persona"
            )
        candidate = MemoryCandidate(
            id=str(uuid.uuid4()),
            persona=persona,
            key=key.strip(),
            value=value,
            category=category,
            reason=reason,
            source=source,
            confidence=confidence,
            proposed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )
        self._sessions.setdefault(session_id, []).append(candidate)
        logger.info(
            "candidate[%s] proposed key=%r category=%r persona=%r",
            session_id, key, category, persona,
        )
        return candidate

    def get(self, session_id: str, candidate_id: str) -> MemoryCandidate | None:
        for c in self._sessions.get(session_id, []):
            if c.id == candidate_id:
                return c
        return None

    def list(self, session_id: str) -> list[MemoryCandidate]:
        return list(self._sessions.get(session_id, []))

    def remove(self, session_id: str, candidate_id: str) -> bool:
        entries = self._sessions.get(session_id, [])
        filtered = [c for c in entries if c.id != candidate_id]
        self._sessions[session_id] = filtered
        removed = len(filtered) < len(entries)
        if removed:
            logger.info("candidate[%s] removed id=%r", session_id, candidate_id)
        return removed

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        logger.info("candidate[%s] cleared", session_id)


candidate_registry = MemoryCandidateRegistry()
