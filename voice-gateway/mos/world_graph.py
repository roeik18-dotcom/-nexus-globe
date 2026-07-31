"""Merlin OS · World Graph (projection over the event log).

A read-model (CQRS): the world's entities + relationships, folded from events
(RFC-021 living-world-graph, ADR-003 R-2). Nodes = entities (person, project,
intent, decision, …); edges = relationships asserted by events. It holds NO
authoritative state — it is rebuilt by `from_events(log)` and feeds the Orientation
Runtime (`orientation.py`).

v0 scope: a generic projection (every event contributes its actor/subject as nodes
and an actor--type-->subject edge, plus salient facts for decisions/orientations).
Domain-specific projections refine this later.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from .events import Event


@dataclass
class Node:
    id: str
    kind: str
    attrs: dict = field(default_factory=dict)


@dataclass
class Edge:
    src: str
    rel: str
    dst: str


class WorldGraph:
    def __init__(self) -> None:
        self.nodes: dict[str, Node] = {}
        self.edges: list[Edge] = []

    def _ensure(self, node_id: str, kind: str = "entity", **attrs) -> Node:
        if node_id not in self.nodes:
            self.nodes[node_id] = Node(node_id, kind, dict(attrs))
        elif attrs:
            self.nodes[node_id].attrs.update(attrs)
        return self.nodes[node_id]

    def apply(self, e: Event) -> None:
        if e.subject:
            kind = e.subject.split(":", 1)[0] if ":" in e.subject else "entity"
            self._ensure(e.subject, kind=kind)
        if e.actor:
            self._ensure(e.actor, kind="actor")
        if e.actor and e.subject:
            self.edges.append(Edge(e.actor, e.type, e.subject))
        if e.type == "decision.made":
            did = f"decision:{e.id}"
            self._ensure(did, kind="decision",
                         decision=e.payload.get("decision"),
                         confidence=e.payload.get("confidence"))
            if e.subject:
                self.edges.append(Edge(e.subject, "decided", did))

    @classmethod
    def from_events(cls, events: list[Event]) -> "WorldGraph":
        g = cls()
        for e in events:
            g.apply(e)
        return g

    def neighbors(self, node_id: str) -> list[Edge]:
        return [e for e in self.edges if e.src == node_id or e.dst == node_id]

    def snapshot(self) -> dict:
        return {"n_nodes": len(self.nodes), "n_edges": len(self.edges),
                "kinds": dict(Counter(n.kind for n in self.nodes.values()))}


def _demo() -> None:
    from .runtime import Runtime
    rt = Runtime()
    for i, c in [("ask_time", 0.95), ("day_opener", 0.88), ("open_app", 0.9)]:
        rt.handle_intent(i, c)
    g = WorldGraph.from_events(rt.bus.log)
    print("world graph snapshot:", g.snapshot())
    print("decision nodes:")
    for n in g.nodes.values():
        if n.kind == "decision":
            print(f"  {n.id}  {n.attrs}")


if __name__ == "__main__":
    _demo()
