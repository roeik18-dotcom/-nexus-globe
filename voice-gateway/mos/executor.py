"""Merlin OS · Executor (v0) — plan.created → tool.executed (with INV-6 gate).

Executes a plan's steps. Reversible/safe actions run immediately (emit
`tool.executed`); irreversible/outward actions emit `permission.required` and run only
after `approval.granted` (INV-6). v0 tools are simulated (no real side effect yet);
the real tool layer replaces `_run` behind the same events (INV-7).
"""
from __future__ import annotations

from .events import Event, EventBus, new_event
from .tools import run_tool

# safe/reversible actions run without approval; everything else is gated (INV-6)
_AUTO = {"read_clock", "read_mission_control", "read_weather", "halt_speech",
         "ask_clarify", "run_morning_brief"}


class Executor:
    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        self.pending: dict[str, dict] = {}       # token -> {action, subject, corr}
        bus.subscribe(self._on)

    def _run(self, action: str, subject: str, corr, cause, params=None) -> None:
        ok, result = run_tool(action, {"n_events": len(self.bus.log), **(params or {})})
        self.bus.publish(new_event(
            "tool.executed", "mos.executor", subject,
            {"tool": action, "ok": ok, "result": result},
            correlation_id=corr, causation_id=cause))

    def _on(self, e: Event) -> None:
        if e.type == "plan.created":
            for step in e.payload.get("steps", []):
                action, params = step["action"], step.get("params") or {}
                if action in _AUTO:
                    self._run(action, e.subject, e.correlation_id, e.id, params)
                else:
                    self.pending[e.id] = {"action": action, "subject": e.subject,
                                          "corr": e.correlation_id, "params": params}
                    self.bus.publish(new_event(
                        "permission.required", "mos.executor", e.subject,
                        {"action": action, "token": e.id, "target": params.get("target"),
                         "reason": "irreversible/outward — requires approval (INV-6)"},
                        correlation_id=e.correlation_id, causation_id=e.id))
        elif e.type == "approval.granted":
            p = self.pending.pop(e.payload.get("token"), None)
            if p:
                self._run(p["action"], p["subject"], p["corr"], e.id, p.get("params"))
