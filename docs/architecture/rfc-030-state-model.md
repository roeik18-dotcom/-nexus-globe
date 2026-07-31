# RFC-030 — State Model

**Subordinate to [RFC-000](system-constitution.md); depends on
[ADR-003 Event Model](adr-003-event-model.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31). The most important semantics document after RFC-000 —
everything (Memory, Graph, Mission Control, Replay) reads and writes State.

## 1. What State is
**State is a pure projection of the Event log.** It is *derived*, never primary
(RFC-000 AX-3, INV-5; ADR-003 R-2).
```
State(t) = fold(reduce_fn, events where timestamp ≤ t)
```
There is no authoritative mutable store outside the Event log. "Current state" is
`State(now)`; any past state is `State(t)` — time travel is free.

## 2. When State changes
State changes **only** when an Event is appended. No component mutates State directly;
it emits an Event, and State is re-derived. (No hidden writes — RFC-000 AX-4.)

## 3. Who may change it
- Only an **Action** with a valid **Origin** (INV-3), whitelisted or approved per the
  Decision Policy (RFC-000 §8), may emit a state-changing Event.
- A read never changes State.
- Cross-boundary writes obey RFC-010 ownership.

## 4. Rollback & reconstruction
- **Rollback** = append a compensating Event (e.g. `x.reverted`), never delete history.
  State then re-derives to the prior projection. (Append-only; ADR-003 R-1.)
- **Reconstruction** = replay the Event log from a snapshot to any `t`. A **snapshot**
  is an optional cached `State(t_k)` for speed; it is derivable, never authoritative.
- **Determinism:** given the same Event log and the same `reduce_fn` version, `State(t)`
  is identical on every replay (INV-5). `reduce_fn` is versioned (RFC-012).

## 5. Consistency rules
- **R-1** State is single-writer per stream (the Event log ordering, ADR-003 R-3).
- **R-2** A projection declares which Event types it folds; unknown types are ignored,
  never error (forward-compatible).
- **R-3** Every materialized view (Memory, Graph) is a projection and must be fully
  rebuildable from Events — if it can't be rebuilt, it is a bug, not a source of truth.
- **R-4** No State field exists that cannot be traced to the Event(s) that set it
  (provenance; RFC-000B `derived_from`).

## 6. What this unblocks
Directly enables the **Event Store + projection layer** (LEVEL 1 Kernel): the store is
the append-only Event log; State/Memory/Graph are projections over it. This RFC is the
contract the Kernel implements.

## Open [E]
- Snapshotting cadence/format (perf, not correctness).
- Projection registry mechanics.

*RFC-030 v0.1 — 2026-07-31.*
