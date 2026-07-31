"""Merlin OS · Planner (v0) — decision.made → plan.created.

Turns a decision into an executable plan. v0: a single-step plan (the decision is the
step). Real Planner (goals, critical path, dependencies) replaces this behind the same
event contract (INV-7). Subscriber on the bus; emits `plan.created`.
"""
from __future__ import annotations

from .events import Event, EventBus, new_event


class Planner:
    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        bus.subscribe(self._on)

    def _on(self, e: Event) -> None:
        if e.type != "decision.made":
            return
        self.bus.publish(new_event(
            "plan.created", "mos.planner", e.subject,
            {"goal": e.payload.get("goal"),
             "steps": [{"action": e.payload["decision"]}],
             "confidence": e.payload.get("confidence")},
            correlation_id=e.correlation_id, causation_id=e.id))
