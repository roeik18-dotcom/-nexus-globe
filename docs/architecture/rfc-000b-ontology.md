# RFC-000B — System Ontology

**Subordinate to [RFC-000](system-constitution.md); companion to
[RFC-000A Glossary](rfc-000a-glossary.md).** Decision type: **[E] Engineering.**
Status: v0.1 (2026-07-31). This defines the **formal typed object model** — the
foundation the Knowledge Graph Engine is built on. Terms used here are defined in
RFC-000A.

## 1. Root rule
**Everything the system knows about is an `Entity`.** Every Entity has, from the
root type, the fields that satisfy RFC-000's invariants:

```
Entity (abstract root)
  id:         stable unique identifier      (INV-4)
  type:       entity type name
  created_at: timestamp                      (INV-1)
  updated_at: timestamp
  version:    monotonic version              (INV-2 / replay)
  origin:     what created it                (INV-3)
  evidence:   [EvidenceRef]                  (INV-2, may be empty for raw facts)
```

State is **derived** from Events over Entities (INV-5); an Entity's current form is
the fold of the Events that touched it.

## 2. Entity type hierarchy
```
Entity
├── Actor
│   ├── Person          (Roei; others)
│   └── Agent           (a runtime capability holder)
├── WorkItem
│   ├── Project         (Merlin, Philos, Music)
│   ├── Goal            (desired future state)
│   ├── Task            (unit of work under a Goal)
│   └── Mission         (standing purpose spanning Projects)
├── Knowledge
│   ├── Document
│   ├── Conversation
│   ├── Decision        (references Evidence — INV-2)
│   ├── Evidence
│   └── Value / Rule    (normative entities; Philos-linked)
├── Temporal
│   ├── Event           (immutable; the source of truth)
│   └── Action          (an effect; has Origin — INV-3)
└── Environment
    ├── Device
    ├── Location
    └── Service
```
New entity types are added only via ADR (RFC-000 §12) and defined in RFC-000A first.

## 3. Typed relations
Relations are **typed and directional**; each may carry its own evidence + timestamp.

| Relation | From → To | Meaning |
|---|---|---|
| `owns` | Actor → WorkItem | ownership / responsibility |
| `part_of` | WorkItem → WorkItem | composition (Task part_of Goal part_of Project) |
| `depends_on` | Entity → Entity | dependency (drives build order; see gap-map §2) |
| `produces` | Action → Event | an Action emits Events |
| `references` | Decision → Evidence | INV-2 accountability link |
| `about` | Knowledge → Entity | a Document/Conversation concerns an Entity |
| `derived_from` | Knowledge → Event+ | how a fact was inferred (replay/provenance) |
| `before` / `after` | Temporal → Temporal | Allen-style temporal ordering |
| `orients` | Value/Rule → Decision | Philos orientation constrains a Decision (AX-5) |

## 4. Modeling rules
- **R-1** Inheritance: subtypes add fields; they never remove a root field.
- **R-2** Composition over deep hierarchy: prefer `part_of` relations to deep subtype trees.
- **R-3** Every normative link (a Decision constrained by a Value/Rule) uses `orients`
  and records the Value — orientation is explicit, never implicit (AX-5).
- **R-4** No dangling relations: both endpoints are Entities with stable ids (INV-4).
- **R-5** Temporal truth: a fact's validity interval is modeled with `before`/`after`;
  "current" is a query over time, not a mutable flag.

## 5. What this unblocks
This ontology is the schema the **Knowledge Graph Engine** (Gap #4) implements:
Entity Registry (§2), Relation Registry (§3), graph query/update, versioning, and
temporal + evidence links — all now have a formal definition to build against.

## Pending [U]
- Whether `Value`/`Rule` entities are authored only from Philos's locked core, or may
  also be operator-defined at runtime.
- `Mission` cardinality (one vs per-track) — mirrors RFC-000A's open question.

*RFC-000B v0.1 — 2026-07-31. Formal object model; foundation for the Knowledge Graph.*
