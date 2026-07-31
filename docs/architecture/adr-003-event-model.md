# ADR-003 — Event Model

**Subordinate to [RFC-000](system-constitution.md); builds on
[RFC-000B Ontology](rfc-000b-ontology.md).** Decision type: **[E] Engineering.**
Status: Accepted (v0.1, 2026-07-31).

## Context
RFC-000 makes Events the source of truth: INV-1 (every Event has a timestamp), INV-5
(every state transition is replayable — State is reconstructable from Events), AX-1
(every observable change is an Event). But the **Event itself has no schema yet.**
Everything else — Memory, Knowledge Graph, Replay, Mission Control — reads Events, so
this is foundational and must be pinned before those are built.

## Decision
An **Event** is an immutable, append-only, timestamped fact. Canonical shape:

```
Event
├── id           : str            # stable unique id (INV-4)
├── type          : str           # dotted event type, e.g. "stt.transcribed"
├── timestamp     : ISO-8601 + monotonic seq   # INV-1; seq breaks ties for ordering
├── actor         : EntityRef      # who/what caused it (Origin, INV-3)
├── subject       : EntityRef      # the Entity it is about
├── payload       : dict           # type-specific data (schema per event type)
├── causation_id  : str | None     # the Event/command that caused this one
├── correlation_id: str | None     # groups events of one turn/session
└── version       : int            # event-schema version for that type
```

Rules:
- **R-1 Immutable & append-only.** Events are never edited or deleted; a correction is
  a *new* Event (e.g. `decision.revised`), not a mutation.
- **R-2 State is a fold over Events.** No component keeps authoritative State outside
  the Event log; "current" is `reduce(events)` (INV-5, RFC-000B R-5).
- **R-3 Ordering.** `(timestamp, seq)` gives total order per stream; `causation_id` /
  `correlation_id` give the causal/session graph.
- **R-4 Everything flows through the Event Bus** (RFC-000 §8); no component emits a
  state change without emitting its Event.
- **R-5 Typed payloads.** Each `type` has its own payload schema, versioned by
  `version`; unknown types are stored, never dropped (forward-compatible replay).

## Example
```
Event { type:"stt.transcribed", actor:merlin.runtime, subject:conversation:42,
        payload:{ transcription: <ADR-002 object> }, correlation_id:"turn-7" }
```

## Alternatives
- **Mutable current-state store** — rejected: breaks INV-5 (no replay), loses history.
- **Logs-only (unstructured)** — rejected: not queryable/foldable into State.
- **Structured append-only Event log (this ADR)** — chosen (Event Sourcing / CQRS,
  per Kleppmann; ties to RFC-000B `derived_from`).

## Consequences
- Enables: Replay/time-travel, Change-Log (Layer 2), Verification provenance,
  Mission-Control event stream — all read this one model.
- Requires an Event Bus + append-only Event Store (LEVEL 1 in RFC-001).
- Existing service logs are NOT the Event Store; they are diagnostics. A real Event
  Store is a build task.

## Review trigger
First real consumer (Memory Core or Knowledge Graph) that needs a field not present.

*ADR-003 v0.1 — 2026-07-31.*
