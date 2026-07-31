"""Merlin OS · Planner (v0.2) — decision.made → plan.created (multi-step).

Turns a decision into an executable plan. A plan is an ordered list of steps, each
with `depends_on` (v0: linear order = dependency). Some decisions expand into several
steps (a plan library); the rest are single-step. The real Planner (goal graphs,
critical path, resource limits) replaces this behind the same `plan.created` event
contract (INV-7). Subscriber on the bus.
"""
from __future__ import annotations

from .events import Event, EventBus, new_event

# decisions that expand into an ordered multi-step plan (gather → act)
_PLAN_LIBRARY: dict[str, list[str]] = {
    # a morning brief first reads system status + time, THEN briefs
    "run_morning_brief": ["read_mission_control", "read_clock", "run_morning_brief"],
}


def _expand(decision: str) -> list[str]:
    return _PLAN_LIBRARY.get(decision, [decision])


class Planner:
    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        bus.subscribe(self._on)

    def _on(self, e: Event) -> None:
        if e.type != "decision.made":
            return
        actions = _expand(e.payload["decision"])
        params = e.payload.get("params") or {}
        steps = [{"action": a, "depends_on": (actions[i - 1] if i else None),
                  "params": params if a == e.payload["decision"] else {}}
                 for i, a in enumerate(actions)]
        self.bus.publish(new_event(
            "plan.created", "mos.planner", e.subject,
            {"goal": e.payload.get("goal"), "steps": steps, "n_steps": len(steps),
             "confidence": e.payload.get("confidence")},
            correlation_id=e.correlation_id, causation_id=e.id))
