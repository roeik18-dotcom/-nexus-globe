"""DOMAIN POLICY — the control layer: what Merlin MAY talk about and how eagerly.

Policy is configuration, NOT runtime state and NOT knowledge. It is loaded from a
dedicated store (config/orientation_domains.json) with in-code defaults, kept
separate from RuntimeControlState (turn state) and DomainState (knowledge).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import IntEnum


class Proactivity(IntEnum):
    OFF = 0     # only ever spoken on explicit user request
    LOW = 1     # rarely surfaced on its own
    MEDIUM = 2
    HIGH = 3    # actively surfaced when relevant


@dataclass
class DomainPolicy:
    enabled: bool = True
    priority: int = 5                       # 1..10, higher = more important
    proactivity: Proactivity = Proactivity.MEDIUM
    day_opening_inclusion: bool = True
    conversation_inclusion: bool = True
    cooldown_seconds: float = 0.0           # min gap between proactive mentions
    max_items: int = 3
    freshness_requirement: float | None = None  # max age (s) of state data; None = no requirement

    def to_dict(self) -> dict:
        d = asdict(self)
        d["proactivity"] = int(self.proactivity)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "DomainPolicy":
        d = dict(d)
        if "proactivity" in d:
            d["proactivity"] = Proactivity(int(d["proactivity"]))
        allowed = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in allowed})
