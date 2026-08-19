"""DOMAIN STATE — the knowledge layer of the orientation core.

Represents WHAT IS TRUE / DERIVED / UNKNOWN for a domain right now. This is
knowledge, never runtime/turn state — it is produced by collectors/sources, not
by RuntimeControlState. The hard rule: UNKNOWN is preserved as UNKNOWN and is
never silently promoted to FACT.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class KnowledgeStatus(str, Enum):
    FACT = "FACT"          # verified from a real source
    DERIVED = "DERIVED"    # computed from FACT(s), not a raw source
    UNKNOWN = "UNKNOWN"    # no supporting source — must be spoken as unknown, never as fact

    def is_assertable_fact(self) -> bool:
        return self is KnowledgeStatus.FACT


@dataclass
class DomainItem:
    """One concrete piece of a domain's state (a task, a blocker, a finding)."""
    text: str
    status: KnowledgeStatus = KnowledgeStatus.UNKNOWN
    open: bool = True                      # True = open loop; False = completed/closed
    source: str = ""                       # path / mechanism this came from
    confidence: float | None = None
    is_blocker: bool = False
    is_next_action: bool = False


@dataclass
class DomainState:
    """Current knowledge for one domain. Uniform, provenance-disciplined."""
    domain_id: str
    status: KnowledgeStatus = KnowledgeStatus.UNKNOWN
    items: list[DomainItem] = field(default_factory=list)
    confidence: float | None = None
    source: str = ""                       # provenance: where this state came from
    last_updated: float | None = None      # epoch seconds of the underlying data
    unknown_reason: str = ""               # required non-empty when status is UNKNOWN

    # ---- derived views (never mutate items) --------------------------------
    @property
    def open_items(self) -> list[DomainItem]:
        return [i for i in self.items if i.open]

    @property
    def completed_items(self) -> list[DomainItem]:
        return [i for i in self.items if not i.open]

    @property
    def blockers(self) -> list[DomainItem]:
        return [i for i in self.items if i.is_blocker]

    @property
    def next_actions(self) -> list[DomainItem]:
        return [i for i in self.items if i.is_next_action]

    @property
    def has_open_loop(self) -> bool:
        return any(i.open for i in self.items)

    def age_seconds(self, now: float) -> float | None:
        if self.last_updated is None:
            return None
        return max(0.0, now - self.last_updated)

    def facts(self) -> list[DomainItem]:
        return [i for i in self.items if i.status is KnowledgeStatus.FACT]

    def unknowns(self) -> list[DomainItem]:
        return [i for i in self.items if i.status is KnowledgeStatus.UNKNOWN]

    def __post_init__(self):
        # Invariant: an UNKNOWN domain must carry a reason and must not present
        # any item as a FACT (guards UNKNOWN->FACT leakage at construction).
        if self.status is KnowledgeStatus.UNKNOWN and not self.unknown_reason:
            self.unknown_reason = "no supporting source available"
