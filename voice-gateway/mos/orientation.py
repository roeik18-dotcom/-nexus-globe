"""Merlin OS · Orientation Runtime (RFC-020 execution shell).

The state-based orientation path Roei specified:

    Event → World Graph → Orientation Runtime → Orientation Result → Decision Proposal

The Runtime consumes (world_graph, context, goals, constraints) and returns the
canonical Orientation Result. It is the ENGINEERING SHELL, not the theory: the actual
orientation logic is the `OrientationRuntimeAlgorithm` plug-point (locked Philos
theory, INV-9). v0 ships `RuntimeStub` returning a fixed-shape result; when the locked
algorithm is ready it REPLACES the stub with no change to the Kernel, the World Graph,
or any consumer (RFC-020 §4 / INV-7).

Run the demo:  python -m mos.orientation
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol, runtime_checkable

from .events import EventBus, new_event
from .world_graph import WorldGraph


@dataclass
class OrientationResult:                       # canonical output (RFC-020 §2)
    orientation: str
    confidence: float
    conflicts: list = field(default_factory=list)
    recommended_actions: list = field(default_factory=list)
    weighed_factors: list = field(default_factory=list)
    rationale: str = ""
    engine_version: str = "philos@0.0-stub"

    def to_canonical(self) -> dict:
        return {"orientation": self.orientation, "confidence": round(self.confidence, 2),
                "conflicts": self.conflicts, "recommended_actions": self.recommended_actions}


@runtime_checkable
class OrientationRuntimeAlgorithm(Protocol):
    """Locked-theory plug-point. Whoever implements this OWNS the orientation logic."""
    version: str

    def orient(self, world_graph: WorldGraph, context: dict,
               goals: list, constraints: list) -> OrientationResult: ...


class RuntimeStub:
    """v0 placeholder (NOT the Philos algorithm). Fixed-shape, transparent, honest."""
    version = "philos@0.0-stub"

    def orient(self, world_graph, context, goals, constraints) -> OrientationResult:
        snap = world_graph.snapshot()
        goal = goals[0] if goals else "stabilize"
        return OrientationResult(
            orientation=f"world has {snap['n_nodes']} entities / {snap['n_edges']} "
                        f"relations; primary goal = '{goal}'",
            confidence=0.5,
            conflicts=[],
            recommended_actions=[{"action": "observe",
                                  "why": "v0 stub — locked algorithm not connected yet"}],
            weighed_factors=[{"factor": "world_graph_size", "weight": snap["n_nodes"]}],
            rationale=("v0 RuntimeStub returns a fixed-shape orientation. The locked "
                       "Philos algorithm replaces this behind the same contract (INV-7)."),
            engine_version=self.version)


class OrientationRuntime:
    """The shell: run the algorithm, emit orientation.result + decision.proposal."""

    def __init__(self, bus: EventBus,
                 algorithm: Optional[OrientationRuntimeAlgorithm] = None) -> None:
        self.bus = bus
        self.algo = algorithm or RuntimeStub()
        self.version = self.algo.version

    def run(self, world_graph: WorldGraph, *, context: Optional[dict] = None,
            goals: Optional[list] = None, constraints: Optional[list] = None,
            correlation_id: Optional[str] = None) -> OrientationResult:
        context, goals, constraints = context or {}, goals or [], constraints or []
        r = self.algo.orient(world_graph, context, goals, constraints)
        r.engine_version = self.version        # shell owns version stamping (RFC-012)

        res = self.bus.publish(new_event(
            "orientation.result", "mos.orientation", "world",
            {**r.to_canonical(), "engine_version": self.version, "rationale": r.rationale},
            correlation_id=correlation_id))
        # Decision Proposal — the runtime PROPOSES; the Action layer's INV-6 gate
        # still decides whether an irreversible proposal executes.
        self.bus.publish(new_event(
            "decision.proposal", "mos.orientation", "world",
            {"recommended_actions": r.recommended_actions, "confidence": r.confidence,
             "engine_version": self.version},
            correlation_id=correlation_id, causation_id=res.id))
        return r


def _demo() -> None:
    import json
    from .runtime import Runtime

    # 1) some events happen (reactive turns) → 2) fold them into a World Graph
    rt = Runtime()
    for i, c in [("ask_time", 0.95), ("day_opener", 0.88), ("open_app", 0.9)]:
        rt.handle_intent(i, c)
    graph = WorldGraph.from_events(rt.bus.log)

    # 3) run the Orientation Runtime over the world state + goals/constraints
    runtime = OrientationRuntime(rt.bus)
    result = runtime.run(graph, context={"active_project": "merlin-os"},
                         goals=["ship M3", "keep STT track separate"],
                         constraints=["no irreversible action without approval"],
                         correlation_id="orient::demo")
    print("Event → World Graph → Orientation Runtime → Result:")
    print("  world:", graph.snapshot())
    print("  " + json.dumps(result.to_canonical(), ensure_ascii=False))
    print("  why:", result.rationale)
    proposals = [e for e in rt.bus.log if e.type == "decision.proposal"]
    print(f"  decision.proposal events emitted: {len(proposals)}")


if __name__ == "__main__":
    _demo()
