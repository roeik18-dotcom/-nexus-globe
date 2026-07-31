"""Merlin OS · Runtime — wires the cognition loop end-to-end on one Event Bus.

    intent.classified → Cognition (decide) → decision.made → Action

This is the running spine of §4 (Perception→Intent→Cognition→Action), decoupled from
the Voice Track: an intent can come from voice STT *or* from anywhere else — the
platform doesn't care. v0 Action is a stub, but it enforces INV-6: irreversible /
outward actions are GATED (emit `action.gated`, await approval) instead of executing.

Run the demo:  python -m mos.runtime
"""
from __future__ import annotations

from typing import Optional

from .cognition import CognitionEngine, Orientation, OrientationInput
from .events import Event, EventBus, new_event
from .philos_seam import OrientationAlgorithm

# v0 reversibility classification (feeds INV-6). Real Action layer will own this.
_REVERSIBLE = {"read_clock", "read_mission_control", "read_weather",
               "halt_speech", "ask_clarify"}


class ActionStub:
    """Consumes decision.made and effects it — v0: reversible actions 'execute'
    (recorded); irreversible/outward actions are GATED pending approval (INV-6), then
    execute only after an `approval.granted` event referencing the gated token."""

    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        self.executed: list[str] = []
        self.gated: list[str] = []
        self.pending: dict[str, dict] = {}   # token(=decision.made id) -> {decision, subject, correlation}
        bus.subscribe(self._on_event)

    def _execute(self, decision, subject, correlation, cause, approved):
        self.executed.append(decision)
        self.bus.publish(new_event(
            "action.result", "mos.action", subject,
            {"decision": decision, "executed": True, "post_approval": approved},
            correlation_id=correlation, causation_id=cause))

    def _on_event(self, e: Event) -> None:
        if e.type == "decision.made":
            decision = e.payload["decision"]
            if decision in _REVERSIBLE:
                self._execute(decision, e.subject, e.correlation_id, e.id, approved=False)
            else:
                self.gated.append(decision)
                self.pending[e.id] = {"decision": decision, "subject": e.subject,
                                      "correlation": e.correlation_id}
                self.bus.publish(new_event(
                    "action.gated", "mos.action", e.subject,
                    {"decision": decision, "executed": False, "token": e.id,
                     "reason": "irreversible/outward — requires approval (INV-6)"},
                    correlation_id=e.correlation_id, causation_id=e.id))
        elif e.type == "approval.granted":
            token = e.payload.get("token")
            p = self.pending.pop(token, None)
            if p:
                self._execute(p["decision"], p["subject"], p["correlation"],
                              cause=e.id, approved=True)


class Runtime:
    """Bus + Cognition + Action, wired. `handle_intent` runs one full turn."""

    def __init__(self, algorithm: Optional[OrientationAlgorithm] = None) -> None:
        self.bus = EventBus()
        self.engine = CognitionEngine(self.bus, algorithm)
        self.action = ActionStub(self.bus)

    def handle_intent(self, intent: str, confidence: float,
                      context: Optional[dict] = None) -> Orientation:
        ev = self.bus.publish(new_event(
            "intent.classified", "mos.intent", f"intent:{intent}",
            {"intent": intent, "confidence": confidence},
            correlation_id=f"turn::{intent}"))
        return self.engine.orient(OrientationInput(
            intent=intent, intent_confidence=confidence, context=context or {},
            correlation_id=ev.correlation_id, cause=ev.id))

    def approve(self, token: str, approver: str = "roei") -> None:
        """Grant approval for a gated (irreversible) action (INV-6). First-class event."""
        self.bus.publish(new_event(
            "approval.granted", f"user:{approver}", "action:pending",
            {"token": token, "approver": approver}))

    def pending_tokens(self) -> dict[str, str]:
        """token -> decision, for actions awaiting approval."""
        return {tok: p["decision"] for tok, p in self.action.pending.items()}


def _demo() -> None:
    rt = Runtime()
    for intent, conf in [("ask_time", 0.95), ("day_opener", 0.88),
                         ("open_app", 0.9), ("frobnicate", 0.6)]:
        o = rt.handle_intent(intent, conf)
        print(f"{intent:<12} → decide {o.decision:<18} (conf {o.confidence:.2f})")
    print(f"\nexecuted (reversible): {rt.action.executed}")
    print(f"gated    (awaiting approval, INV-6): {list(rt.pending_tokens().values())}")

    # approve one gated action → it executes post-approval
    tok = next(iter(rt.pending_tokens()))
    print(f"\napproving token {tok} ({rt.pending_tokens()[tok]})…")
    rt.approve(tok)
    print(f"executed now: {rt.action.executed}")
    print(f"still pending: {list(rt.pending_tokens().values())}")
    print(f"total events on bus: {len(rt.bus.log)}")


if __name__ == "__main__":
    _demo()
