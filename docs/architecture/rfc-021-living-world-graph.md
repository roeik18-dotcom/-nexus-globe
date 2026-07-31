# RFC-021 — Living World Graph (Philos substrate)

**Subordinate to [RFC-000](system-constitution.md); realizes
[RFC-000B Ontology](rfc-000b-ontology.md); is the substrate for
[RFC-020 Orientation Engine](rfc-020-orientation-engine.md).** Decision type:
**[E] for graph structure; [U] + locked theory for trust/value calculus.**
Status: Draft (v0.1, 2026-07-31).

> **The key idea:** the Orientation Engine does **not** operate on text or documents.
> It operates on a **live graph of reality** — people, relations, values, events,
> projects — that updates over time. This is what distinguishes Philos from a system
> that just stores conversations.

## 1. One graph, many views
There is **one** Living World Graph. The "seven maps" are **projections/queries over
it** (RFC-030 State projections), not seven systems.

## 2. Structure ([E], from RFC-000B)
- **Nodes** = typed Entities: Person · Group · Organization · Place · Event · Project ·
  Idea · Resource · Time-marker.
- **Edges** = typed, **weighted**, **temporal** relations, e.g.:
  ```
  Person A ──▶ Person B
     trust: 0..1 · influence: 0..1 · reciprocity: 0..1
     interaction_frequency · shared_history · valid_interval[t0,t1]
  ```
- **Temporal by construction** (RFC-000B R-5, RFC-030): every node/edge attribute has a
  time interval; "now" is a query, history is free, the future is a projection.
- **Event-sourced** (ADR-003): the graph is a projection of Events; it is rebuildable,
  never a primary mutable store.

## 3. The seven maps = projections
| Map | Projection over the graph |
|---|---|
| 🌍 Live World Map | your ego-network: nodes reachable from `You`, grouped by domain |
| 🕸️ Relationship Graph | Person↔Person edges with trust/influence/reciprocity |
| ❤️ Value Distribution | aggregate of Value-edges → weight per value, per actor/group |
| ⚡ Influence Map | directed influence edges, transitively closed |
| 🌐 Energy / Flow Map | Resource flows (time/money/knowledge/emotion/trust) as weighted edges |
| 🧭 Orientation Map | current per-node status: stable / declining / in-conflict / opportunity / risk |
| 📈 Evolution Timeline | the same graph sampled across time — how nodes/edges changed |

## 4. What is LOCKED ([U], not defined here)
- **How trust / influence / reciprocity / value-weight are computed.** The graph
  *carries* these as attributes; the **calculus that produces them is locked Philos
  theory** (tension-flow, 3·6·9, geometric/supernova — INV-9). This RFC defines the
  slots, never the formulas.
- What "stable / declining / conflict / opportunity" mean on the Orientation Map — that
  is the Orientation Engine's output (RFC-020), i.e. locked theory.

## 5. Dependencies (why this is downstream of LEVEL 1)
The Living World Graph is a **payload**; it needs a **container**: the Knowledge Graph
Engine (Gap #4), which needs the **Kernel Event Store** (LEVEL 1, ADR-003/RFC-030).
So: **build the graph engine on the Kernel first; then this becomes real, not a
diagram.**

## Open [U]
- The attribute set per edge type (which metrics are first-class).
- Which locked-theory quantity maps to `trust`, `influence`, etc.

*RFC-021 v0.1 Draft — 2026-07-31. Structure [E]; the calculus stays locked.*
