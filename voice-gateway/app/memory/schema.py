"""Memory schema — the unit of what Merlin knows about you."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Memory:
    # Identity
    id: str
    tier: str        # "session" | "personal" | "project" | "relationship"
    category: str    # "preference" | "goal" | "event" | "habit" | "style" | "project" | "person" | "fact"
    key: str         # stable human-readable identifier, snake_case
    value: str       # concise factual statement

    # Provenance
    confidence: float = 0.8       # 0.0 – 1.0
    source: str = "inferred"      # "inferred" | "explicit" | "observed"
    importance: str = "medium"    # "critical" | "high" | "medium" | "low"

    # Timestamps
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    last_used: str  = field(default_factory=_now)

    # Control
    editable: bool = True
    tags: list[str] = field(default_factory=list)

    # ── serialization ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "id":          self.id,
            "tier":        self.tier,
            "category":    self.category,
            "key":         self.key,
            "value":       self.value,
            "confidence":  self.confidence,
            "source":      self.source,
            "importance":  self.importance,
            "created_at":  self.created_at,
            "updated_at":  self.updated_at,
            "last_used":   self.last_used,
            "editable":    self.editable,
            "tags":        self.tags,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Memory":
        return cls(
            id=d["id"],
            tier=d.get("tier", "personal"),
            category=d.get("category", "fact"),
            key=d["key"],
            value=d["value"],
            confidence=float(d.get("confidence", 0.8)),
            source=d.get("source", "inferred"),
            importance=d.get("importance", "medium"),
            created_at=d.get("created_at", _now()),
            updated_at=d.get("updated_at", _now()),
            last_used=d.get("last_used", _now()),
            editable=bool(d.get("editable", True)),
            tags=list(d.get("tags", [])),
        )
