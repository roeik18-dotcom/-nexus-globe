"""State container (RFC-030). Derived, never a primary store."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class State:
    event_count: int = 0
    last_event_type: str | None = None
    last_message: str | None = None
    # Living World Graph (RFC-021) — a projection carried inside State.
    world_graph: dict = field(default_factory=lambda: {"nodes": {}, "edges": {}})
