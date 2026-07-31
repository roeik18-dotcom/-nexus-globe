"""Merlin OS · Cognition = Philos Orientation Engine — v0 shell (RFC-020).

This is where Merlin stops only *recognising intent* and starts *deciding*.

The shell implements the RFC-020 interface and emits one Event per pipeline seam
(RFC-020 §3, OBS-001) so every decision is observable and replayable (INV-5). The
orientation ALGORITHM is injected via the `OrientationAlgorithm` plug-point
(`philos_seam.py`) — locked Philos theory owned by Roei (INV-9). The shell calls and
measures it; it never prescribes the logic. Swapping the algorithm changes no
consumer (RFC-020 §4 / INV-7).

Run the demo:  python -m mos.cognition
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .events import EventBus, new_event
from .philos_seam import OrientationAlgorithm, RuleStub, SeamResult

# RFC-020 §3 observable seams (the SEAMS are canonical; their CONTENT is the algorithm)
SEAMS = ["observation", "evidence", "context", "weighting",
         "conflict_resolution", "alternative_generation", "evaluation", "decision"]


@dataclass
class OrientationInput:                       # RFC-020 §1 input contract (v0 subset)
    intent: str
    intent_confidence: float = 0.0
    context: dict = None
    evidence: list = None
    params: dict = None                       # e.g. {"target": "pro_tools"} for open_app
    correlation_id: Optional[str] = None
    cause: Optional[str] = None               # causation_id of the triggering event

    def __post_init__(self):
        if self.context is None:
            self.context = {}
        if self.evidence is None:
            self.evidence = []
        if self.params is None:
            self.params = {}


@dataclass
class Orientation:                            # RFC-020 §2 output contract
    intent: str
    goal: str
    decision: str
    confidence: float
    weighed_factors: list
    alternatives: list
    conflicts: list
    rationale: str
    engine_version: str

    def as_min(self) -> dict:
        """The compact shape Roei asked for."""
        return {"intent": self.intent, "goal": self.goal,
                "decision": self.decision, "confidence": round(self.confidence, 2)}


class CognitionEngine:
    """RFC-020 shell. Runs the seams around the injected orientation algorithm."""

    def __init__(self, bus: EventBus,
                 algorithm: Optional[OrientationAlgorithm] = None) -> None:
        self.bus = bus
        self.algo = algorithm or RuleStub()
        self.version = self.algo.version

    def _seam(self, name: str, inp: OrientationInput, payload: dict) -> None:
        self.bus.publish(new_event(
            type=f"cognition.seam.{name}", actor="mos.cognition",
            subject=f"intent:{inp.intent}",
            payload={"seam": name, "engine_version": self.version, **payload},
            correlation_id=inp.correlation_id, causation_id=inp.cause))

    def orient(self, inp: OrientationInput) -> Orientation:
        # perception-facing seams (observable pass-through before the algorithm)
        self._seam("observation", inp, {"intent": inp.intent,
                                        "intent_confidence": inp.intent_confidence})
        self._seam("evidence", inp, {"n_evidence": len(inp.evidence)})
        self._seam("context", inp, {"context_keys": sorted(inp.context.keys())})

        # --- locked-theory plug-point: the algorithm decides (INV-9) ---
        r: SeamResult = self.algo.orient(
            inp.intent, inp.intent_confidence, inp.context, inp.evidence)

        # algorithm-facing seams (measured from the result, RFC-020 §3)
        self._seam("weighting", inp, {"weighed_factors": r.weighed_factors})
        self._seam("conflict_resolution", inp, {"conflicts": r.conflicts})
        self._seam("alternative_generation", inp, {"alternatives": r.alternatives})
        self._seam("evaluation", inp, {"chosen": r.decision, "confidence": r.confidence})

        orientation = Orientation(
            intent=inp.intent, goal=r.goal, decision=r.decision, confidence=r.confidence,
            weighed_factors=r.weighed_factors, alternatives=r.alternatives,
            conflicts=r.conflicts, rationale=r.rationale, engine_version=self.version)

        # decision seam + the durable decision fact (a Planner/Action consumes this)
        self._seam("decision", inp, {"decision": r.decision, "goal": r.goal,
                                     "confidence": r.confidence})
        self.bus.publish(new_event(
            type="decision.made", actor="mos.cognition", subject=f"intent:{inp.intent}",
            payload=orientation.as_min() | {"engine_version": self.version,
                                            "rationale": r.rationale,
                                            "params": inp.params},
            correlation_id=inp.correlation_id, causation_id=inp.cause))
        return orientation


def _demo() -> None:
    import json
    bus = EventBus()
    engine = CognitionEngine(bus)
    for intent, conf in [("ask_time", 0.95), ("day_opener", 0.88), ("frobnicate", 0.6)]:
        ev = bus.publish(new_event(
            "intent.classified", "mos.intent", f"intent:{intent}",
            {"intent": intent, "confidence": conf}, correlation_id=f"turn::{intent}"))
        o = engine.orient(OrientationInput(intent=intent, intent_confidence=conf,
                                           context={"active_project": "merlin-os"},
                                           correlation_id=ev.correlation_id, cause=ev.id))
        print(f"\nINTENT {intent!r} → {json.dumps(o.as_min(), ensure_ascii=False)}")
        print(f"  why: {o.rationale}")
    print(f"\nengine_version={engine.version}  events={len(bus.log)}")


if __name__ == "__main__":
    _demo()
