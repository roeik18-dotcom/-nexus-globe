"""Milestone 1 — The First Living Event.  Run: python3 -m kernel.demo"""
from __future__ import annotations

from kernel import Kernel
from kernel.event import Event, UserSpoke


def main() -> None:
    k = Kernel()
    print("EVENT → BUS → STORE → REDUCER → STATE   (Merlin Kernel v0)\n")

    # 1–4: an action happens → Event through Bus → Store → State.
    k.publish(UserSpoke("Hello Merlin"))
    print("EVENT STORED     ✅  (event_count=%d)" % len(k.store))
    print("STATE UPDATED    ✅")
    print("\nCURRENT STATE")
    print("-" * 30)
    print("last_event: %s" % k.state.last_event_type)
    print("message:    %r" % k.state.last_message)

    # 5: the World Graph moves — every event changes the 'universe', not just the log.
    k.publish(Event("node.added", "person:roei",  {"kind": "Person"}))
    k.publish(Event("node.added", "person:noa",   {"kind": "Person"}))
    k.publish(Event("edge.set",   "person:roei",  {"to": "person:noa", "attrs": {"trust": 0.87}}))
    g = k.state.world_graph
    print("\nWORLD GRAPH UPDATED ✅")
    print("  nodes: %s" % list(g["nodes"]))
    print("  edges: %s" % [f"{a}→{b} trust={at.get('trust')}" for (a, b), at in g["edges"].items()])

    # one more action moves the universe (append-only; trust changes):
    k.publish(Event("edge.set", "person:roei", {"to": "person:noa", "attrs": {"trust": 0.42}}))
    print("  after 1 more event: roei→noa trust 0.87 → %.2f"
          % k.state.world_graph["edges"][("person:roei", "person:noa")]["trust"])

    # 6: see it — kernel self-reports (OBS-001).
    print("\nKERNEL HEALTH (OBS-001): %s" % k.health.observe())

    # Milestone-1 success criteria, checked:
    assert len(k.store) == 5                                  # events stored
    assert k.state.last_message == "Hello Merlin"             # state updated & persisted
    assert k.state.world_graph["nodes"], "world graph populated"
    assert k.state.world_graph["edges"][("person:roei", "person:noa")]["trust"] == 0.42
    # determinism / replay (INV-5): rebuild state from the log → identical
    from kernel.reducer import build_state
    assert build_state(k.store.events()) == k.state
    print("\n✅ Milestone 1 — The First Living Event: Event→Bus→Store→State→WorldGraph, live & replayable.")


if __name__ == "__main__":
    main()
