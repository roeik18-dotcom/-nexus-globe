"""Reducer: Events → State (RFC-030: State = fold(events)). Deterministic (INV-5).

Also folds the Living World Graph (RFC-021), so every event moves the 'universe',
not just the log. Unknown event types are ignored (ADR-003 R-5, forward-compatible).
"""
from __future__ import annotations

from kernel.event import Event
from kernel.state import State


def build_state(events: list[Event]) -> State:
    s = State()
    for e in events:
        s.event_count += 1
        s.last_event_type = e.type
        if e.type == "user.spoke":
            s.last_message = e.payload.get("message")
            s.world_graph["nodes"].setdefault("conversation:main", {"kind": "Conversation"})
        elif e.type == "node.added":
            s.world_graph["nodes"][e.subject] = {"kind": e.payload.get("kind", "Entity")}
        elif e.type == "node.removed":
            s.world_graph["nodes"].pop(e.subject, None)
        elif e.type == "edge.set":
            s.world_graph["edges"][(e.subject, e.payload["to"])] = dict(e.payload.get("attrs", {}))
    return s
