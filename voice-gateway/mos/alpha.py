"""Merlin OS · Alpha Runtime — the full event-driven chain, end to end.

    text → intent.classified → (cognition) decision.made → (planner) plan.created
         → (executor) permission.required? → approval.granted → tool.executed
         → (responder) response.generated

Everything is events on one bus (INV-1), every step traceable (INV-5) and replayable
from the durable log. Components are v0/simple — that is exactly the point: the chain
is COMPLETE and can be improved piece by piece (Merlin Alpha).

NOTE: the entry point here is `speak(text)`, i.e. text already transcribed. Wiring a
real microphone/STT to emit `intent.classified` is the separate Voice Track (last,
gated on Roei's approval) — it does not change this chain.

Run the demo:  python -m mos.alpha
"""
from __future__ import annotations

from typing import Optional

from .cognition import CognitionEngine, OrientationInput
from .events import Event, EventBus, new_event
from .executor import Executor
from .intent_bridge import to_bus
from .philos_seam import OrientationAlgorithm
from .planner import Planner
from .response import Responder
from .store import JsonlEventStore


class AlphaRuntime:
    def __init__(self, algorithm: Optional[OrientationAlgorithm] = None,
                 store_path: Optional[str] = None) -> None:
        store = JsonlEventStore(store_path) if store_path else None
        self.bus = EventBus(store=store)
        if store is not None:
            self.bus.load_from(store.load())
        self.engine = CognitionEngine(self.bus, algorithm)
        self.bus.subscribe(self._on_intent)          # cognition runs on intent.classified
        self.planner = Planner(self.bus)
        self.executor = Executor(self.bus)
        self.responder = Responder(self.bus)

    def _on_intent(self, e: Event) -> None:
        if e.type != "intent.classified":
            return
        p = e.payload
        self.engine.orient(OrientationInput(
            intent=p["intent"], intent_confidence=p.get("confidence", 0.0),
            correlation_id=e.correlation_id, cause=e.id))

    # --- entry points ---
    def speak(self, text: str, correlation_id: Optional[str] = None) -> Event:
        """A transcript enters the platform → drives the whole chain."""
        return to_bus(self.bus, text, correlation_id=correlation_id)

    def approve(self, token: str, approver: str = "roei") -> None:
        self.bus.publish(new_event("approval.granted", f"user:{approver}",
                                   "action:pending", {"token": token, "approver": approver}))

    # --- read helpers ---
    def response_for(self, correlation_id: str) -> Optional[str]:
        r = [e for e in self.bus.log
             if e.type == "response.generated" and e.correlation_id == correlation_id]
        return r[-1].payload["text"] if r else None

    def pending_token(self) -> Optional[str]:
        return next(iter(self.executor.pending), None)


def _demo() -> None:
    from .trace import render
    rt = AlphaRuntime()

    print("=== Scenario: Morning Brief ('בוקר טוב') ===")
    rt.speak("בוקר טוב מרלין", correlation_id="brief")
    print("chain:", render(rt.bus.log, "brief"))
    print("response:", rt.response_for("brief"))

    print("\n=== Scenario: Open Application ('פתח Ableton') ===")
    rt.speak("פתח Ableton", correlation_id="open")
    print("chain (pre-approval):", render(rt.bus.log, "open"))
    tok = rt.pending_token()
    print(f"permission required → approving {tok} …")
    rt.approve(tok)
    print("chain (post-approval):", render(rt.bus.log, "open"))
    print("response:", rt.response_for("open"))


if __name__ == "__main__":
    _demo()
