"""System invariants — the LAW of the kernel, as enforced code (not prose).

The shift the whole platform turns on: from writing components to writing rules.
A rule written in a doc is a request; a rule checked mechanically is law. `verify()`
returns the list of violated invariants (empty = the system is correct). Call it after
any sequence — in tests, or as a runtime guard — and no matter how many capabilities,
agents, or LLMs are swapped in later, the system stays correct as long as this passes.
"""
from __future__ import annotations

import dataclasses

from kernel.reducer import build_state


def verify(kernel) -> list[str]:
    violations: list[str] = []
    events = kernel.store.events()

    # ✓ State = fold(events)
    if kernel.state != build_state(events):
        violations.append("State must equal fold(events)")

    # ✓ Events are immutable
    for e in events:
        if not (dataclasses.is_dataclass(e) and getattr(type(e).__dataclass_params__, "frozen", False)):
            violations.append("Events must be immutable (frozen)")
            break

    # ✓ Events are append-only & ordered (seq strictly increasing)
    seqs = [getattr(e, "seq", None) for e in events]
    if any(s is None for s in seqs) or seqs != sorted(seqs) or len(set(seqs)) != len(seqs):
        violations.append("Events must be append-only and strictly ordered")

    # ✓ World Graph is a Projection (derived from events, not stored independently)
    if kernel.state.world_graph != build_state(events).world_graph:
        violations.append("World Graph must be a projection of events")

    # ✓ Capabilities never mutate State (implied by 'State = fold' holding AFTER
    #   capabilities have run — a capability that wrote state directly would break it)

    return violations


# Invariants enforced HERE (mechanically), vs. enforced WHEN the component exists.
ENFORCED_NOW = [
    "State = fold(events)",
    "Events are immutable",
    "Events are append-only & ordered",
    "Capabilities never mutate State",
    "World Graph is a Projection",
]
ENFORCED_WHEN_BUILT = [
    "Projections never emit Events",       # structural: build_state returns State, never publishes
    "Planners never execute",              # when Planner is built
    "Executors never decide",              # when Executor is built
    "Every side effect has a preceding Event",  # when Executor emits tool.executed
]
