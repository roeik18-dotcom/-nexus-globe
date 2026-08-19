"""Data model for the Master Day Opening — shared by every collector,
the planner, and the renderer. Pure data, no I/O, no audio, fully testable.

Provenance discipline (the whole point of this module): every reported
status carries WHERE it came from and HOW SURE we are, so the renderer can
never produce a sentence that implies more certainty than the underlying
data supports.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum


class Provenance(Enum):
    FACT = "FACT"           # read directly from a real, current source
    DERIVED = "DERIVED"     # computed/inferred from one or more FACTs
    UNKNOWN = "UNKNOWN"     # no trustworthy source exists — never fabricated


class Lifecycle(Enum):
    """Domains that track a config/pipeline maturity (Human Config, Music
    Config) report one of these — never invented, only set when the
    collector actually found evidence for that stage."""
    DRAFT = "DRAFT"
    MAPPING = "MAPPING"
    VALIDATION = "VALIDATION"
    MASTER_FINAL = "MASTER_FINAL"
    UNKNOWN = "UNKNOWN"


class OpenLoopClass(Enum):
    """Section 3 (Unfinished Work / Open Loops) classification. Assigned by
    the PLANNER from a domain's own reported fields (blocker/error/lifecycle/
    next_action) — never set arbitrarily by a collector, so the same rule
    applies uniformly across domains."""
    UNFINISHED = "UNFINISHED"
    BLOCKED = "BLOCKED"
    WAITING = "WAITING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


@dataclass
class DomainStatus:
    """One domain's contribution to the briefing (section B-H)."""
    domain: str                       # "human_config", "music_config", ...
    label_he: str                     # Hebrew heading for the renderer
    provenance: Provenance
    summary_he: str                   # what actually gets spoken for this domain
    source: str = ""                  # file path / mechanism this came from
    timestamp: float | None = None    # when the underlying data was last touched
    confidence: float | None = None   # 0..1 where meaningful, else None
    next_action_he: str = ""          # this domain's own candidate next action
    blocker_he: str = ""              # active blocker, if any
    lifecycle: Lifecycle | None = None
    error: str | None = None          # set if the collector itself failed (section 9)
    what_changed_he: str = ""         # diffed against the previous persisted run by the
                                       # planner; "" means "no prior run" or "no detected change"
    unfinished_he: str = ""           # what remains unfinished in this domain; "" if none
    open_loop: OpenLoopClass | None = None   # set by the planner, see OpenLoopClass docstring
    details: dict = field(default_factory=dict)   # collector-specific extra data

    @property
    def verified(self) -> bool:
        return self.provenance == Provenance.FACT


@dataclass
class ImbalanceAssessment:
    """Section 9 — Philos imbalance detection. Only ever states a real
    imbalance when both the personal-orientation and behavioral-evidence
    domains are themselves FACT/DERIVED; otherwise provenance is UNKNOWN and
    statement_he is the fixed honest sentence, never a guess."""
    provenance: Provenance
    statement_he: str
    corrective_action_he: str = ""    # "" unless a verified imbalance selected one


@dataclass
class PriorityItem:
    """Section 11 — one slot in the fixed 3-item priority stack."""
    label: str          # "PRIORITY 1" | "PRIORITY 2" | "PRIORITY 3"
    text_he: str


@dataclass
class FinalOrientation:
    """Section 12 — the fixed closing block. Replaces the old single
    'next action' sentence with the full required structure."""
    main_direction_he: str
    main_open_loop_he: str
    next_action_he: str
    philos_balance_he: str


@dataclass
class OutcomeCandidate:
    """One candidate for the day's top-3 outcomes, before/after prioritization."""
    domain: str
    text_he: str
    blocker_removal: bool = False
    is_dependency: bool = False
    strategic_value: int = 0          # 0-3, collector's own estimate, not invented from nothing
    continuity_from_yesterday: bool = False
    executable_today: bool = True


@dataclass
class DayOpeningReport:
    generated_at: float = field(default_factory=time.time)
    orientation_he: str = ""
    domains: list[DomainStatus] = field(default_factory=list)
    synthesis_lines_he: list[str] = field(default_factory=list)   # אדם — ..., מוזיקה — ..., ...
    top_outcomes_he: list[str] = field(default_factory=list)      # <= 3, legacy — superseded by `priorities`
    next_action_he: str = ""          # legacy — superseded by `final.next_action_he`
    imbalance: ImbalanceAssessment | None = None
    priorities: list[PriorityItem] = field(default_factory=list)   # exactly 3, see planner
    final: FinalOrientation | None = None
    full_text_he: str = ""            # exact text handed to TTS — canonical, never re-generated

    def to_dict(self) -> dict:
        return {
            "generated_at": self.generated_at,
            "orientation_he": self.orientation_he,
            "domains": [
                {
                    "domain": d.domain, "label_he": d.label_he, "provenance": d.provenance.value,
                    "summary_he": d.summary_he, "source": d.source, "timestamp": d.timestamp,
                    "confidence": d.confidence, "next_action_he": d.next_action_he,
                    "blocker_he": d.blocker_he,
                    "lifecycle": d.lifecycle.value if d.lifecycle else None,
                    "error": d.error,
                    "what_changed_he": d.what_changed_he,
                    "unfinished_he": d.unfinished_he,
                    "open_loop": d.open_loop.value if d.open_loop else None,
                }
                for d in self.domains
            ],
            "synthesis_lines_he": self.synthesis_lines_he,
            "top_outcomes_he": self.top_outcomes_he,
            "next_action_he": self.next_action_he,
            "imbalance": (
                {
                    "provenance": self.imbalance.provenance.value,
                    "statement_he": self.imbalance.statement_he,
                    "corrective_action_he": self.imbalance.corrective_action_he,
                }
                if self.imbalance else None
            ),
            "priorities": [{"label": p.label, "text_he": p.text_he} for p in self.priorities],
            "final": (
                {
                    "main_direction_he": self.final.main_direction_he,
                    "main_open_loop_he": self.final.main_open_loop_he,
                    "next_action_he": self.final.next_action_he,
                    "philos_balance_he": self.final.philos_balance_he,
                }
                if self.final else None
            ),
            "full_text_he": self.full_text_he,
        }
