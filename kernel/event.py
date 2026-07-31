"""Canonical Event (ADR-003). Immutable, ordered, timestamped fact."""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field

_seq = itertools.count(1)


@dataclass(frozen=True)
class Event:
    type: str                                  # e.g. "user.spoke", "edge.set"
    subject: str                               # entity id it is about
    payload: dict = field(default_factory=dict)
    actor: str = "system"                      # Origin (INV-3)
    seq: int = field(default_factory=lambda: next(_seq))   # total order (ADR-003 R-3)


# Convenience constructor used by the demo (matches `UserSpoke("Hello Merlin")`).
def UserSpoke(message: str, actor: str = "user:roei") -> Event:
    return Event("user.spoke", "conversation:main", {"message": message}, actor=actor)
