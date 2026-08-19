# Philos Dynamics — UI display contract (PROPOSAL, for approval before any React)

*Step 3, part 1: the contract between `projectDynamics` and the view. **No React until
this is approved.** It fixes what the projection returns, which component consumes each
field, how explicit vs inferred is shown, how absence (withheld / unresolved) is stated,
what the viewer gate hides, and the honesty tests that must pass before implementation
begins. The sequence that worked all along holds: Schema → Validator → Projection → Tests
→ **UI contract** → UI. Not reordered.*

Sources of truth: [`projectDynamics.ts`](app/lib/philos/projectDynamics.ts) ·
[`PHILOS-DYNAMICS-LAYER.md`](PHILOS-DYNAMICS-LAYER.md) ·
[`PHILOS-SYSTEM-BLUEPRINT.md`](PHILOS-SYSTEM-BLUEPRINT.md) §13 (globe legend, traceability).

---

## 0. The one rule the UI inherits
**Every pixel traces to an event_id, or it does not render.** The projection already
enforces this — the UI's job is to *display without weakening it*. Specifically the UI
must never: invent a node/edge, upgrade an `inferred` edge to look factual, show a hidden
event, or paper over an absence with a fabricated value. Decoration that implies data is a
defect (§13). The projection is pure and viewer-scoped; the UI is a **pure function of its
output** — no second data source, no `data/*.json`, no re-derivation.

---

## 1. What `projectDynamics` returns (the data contract)
`projectDynamics({ events, window?, viewer?, mode? }) → DynamicsGraph`. Exact shape (from
the code, not a sketch):

```ts
DynamicsGraph {
  nodes: DynamicsNode[]              // one per displayed event
  edges: DynamicsEdge[]              // causal links, both endpoints displayed
  domain_transitions: DomainTransition[]   // aggregated cross-domain edge counts
  unresolved_claims: UnresolvedClaim[]     // dangling caused_by / join targets, viewer-scoped
  diagnostics: CausalityDiagnostic[]       // validator output (7 codes)
  summary: DynamicsSummary
}

DynamicsNode  { event_id, domain, entity_type, entity_id, event_type, timestamp, label }
DynamicsEdge  { source_event_id, target_event_id, edge_origin:"explicit"|"inferred",
                evidence_level, join_key?, domain_transition:[Domain,Domain],
                confidence?, provenance }
Provenance    { source_events[], sample_size, verification_status, confidence?, time_range? }
UnresolvedClaim { event_id, kind:"missing_causal_parent"|"missing_join_target",
                  reference, join_key? }
DynamicsSummary { node_count, edge_count, explicit_edges, inferred_edges,
                  domains:Record<Domain,number>, unresolved_count, withheld }
Domain = "people" | "community" | "activity" | "resources" | "impact"
```

**Load-bearing facts the UI must respect:**
- `edge_origin` and `evidence_level` are **separate axes** — the UI renders both, never
  collapses them. `explicit` → `evidence_level:"self_report"`; `inferred` →
  `"system_inference"` (ladder rung 6, **never** "verified").
- `join_key` is present **iff** `edge_origin === "inferred"`; `confidence` present iff inferred.
- `withheld` = edges the viewer/window filter dropped; `unresolved_count` = viewer-scoped
  dangling references. Both are **honest absence counts**, not errors to hide.

---

## 2. Field → component mapping (what consumes what)
| Field | Component | Use |
|---|---|---|
| `nodes[].domain` | **Domain lane / color** | one color per domain (5); the node's lane |
| `nodes[].label` | node caption | from payload, never the raw id when a name exists |
| `nodes[].event_type` · `timestamp` | node tooltip | "what happened, when" — verbatim |
| `edges[].edge_origin` | **edge style** | `explicit` = solid; `inferred` = dashed (§3) |
| `edges[].evidence_level` | edge badge | ladder word, shown literally (`self_report` / `system_inference`) |
| `edges[].join_key` | inferred-edge label | names the basis of the guess (§3) |
| `edges[].confidence` | inferred-edge weight/opacity | a *hypothesis strength*, labeled as such |
| `edges[].domain_transition` | edge endpoints' lanes | which domain → which |
| `edges[].provenance.source_events` | **"why is this here?" popover** | the event_ids behind the line |
| `domain_transitions` | **ripple summary bar** | "resources → impact ×1", etc. |
| `unresolved_claims` | **Unresolved panel** (§4) | inspectable list, never hidden |
| `diagnostics` | **Integrity panel** (dev/debug) | validator findings; errors visible |
| `summary.*` | **HUD counts** | nodes · edges (explicit/inferred) · withheld · unresolved |

No component may read anything not in this table. If a component needs a value the
projection doesn't return, the fix is a projection change + test, **not** a UI-side
computation.

---

## 3. Explicit vs inferred — the visual language (the crown honesty rule)
The whole layer exists to not render correlation as causation. So:

| | **explicit** | **inferred** |
|---|---|---|
| Basis | a `caused_by` declaration | an allow-listed foreign key |
| Line | **solid** | **dashed** |
| Badge | `self_report` | `system_inference` |
| Extra label | — | **`join_key`** named ("via allocation_id") + **confidence** shown as a hypothesis weight |
| Popover | "declared by {actor} at {timestamp}" + source_events | "inferred from {join_key}; not a declared link" + source_events |
| Never | shown as "verified" | shown as solid, or without its join_key, or as a certain arrow |

An inferred edge is **a hypothesis with its basis shown** — the dashed style + the
`system_inference` badge + the named join_key together say "guess, and here's why." The UI
must make explicit and inferred **visually distinguishable at a glance**, and clickable to
their `source_events`.

---

## 4. Withheld & unresolved — absence is stated, not faked
- **`summary.withheld`** renders as a persistent, quiet HUD line: *"N cross-domain links
  hidden from this view."* It is never zero-suppressed into silence when > 0, and never
  shown as a fabricated edge. Clicking it explains *why* (viewer/window scope) — but does
  **not** reveal the hidden endpoints (that would defeat the gate, §5).
- **`unresolved_claims`** get their own inspectable **Unresolved panel**: each row shows
  `kind` (missing parent / missing join target), the owning `event_id`, and the dangling
  `reference` (+ `join_key` when present). This is a first-class output — a caused_by that
  points nowhere is *information*, shown, never swallowed.
- **`diagnostics`** with error severity surface in an Integrity panel; the UI must not
  render any edge the validator rejected (the projection already omits them — the UI simply
  must not re-add or fake them).

---

## 5. Viewer gate — what is shown vs hidden
The projection is **already viewer-scoped**: with a `viewer`, non-public events not owned by
that viewer are absent from `nodes`, their edges are dropped, and their `unresolved_claims`
are filtered out. The UI's obligations:
1. **Render only what the projection returned.** Never fetch or reconstruct a hidden event —
   the UI has no second data source, so a hidden event is simply not renderable. This is the
   structural guarantee, not a UI check.
2. **State the hidden count, not the hidden data.** `summary.withheld` is the honest signal;
   the UI shows the count and the reason ("outside your view"), never the endpoints.
3. **No viewer toggle that reveals others' private data.** Switching viewer = re-running the
   projection with a new `viewer`, which re-derives visibility server-side. The UI cannot
   "unhide" client-side because it never received the data.

---

## 6. Honesty tests that MUST pass before any React
These are the gate. Written first (contract tests over the projection output + the render
function once it exists); React implementation does not start until these are green.

1. **Provenance completeness** — for every rendered edge element, a `source_events` list is
   present and every id resolves to a rendered-or-known event. No edge element without it.
2. **No fabricated marks** — the count of rendered node elements === `summary.node_count`;
   rendered edge elements === `summary.edge_count`. No extra decorative nodes/lines.
3. **Explicit ≠ inferred** — every `inferred` edge element carries the dashed class **and**
   the `system_inference` badge **and** a non-empty `join_key` label; no `inferred` edge is
   ever labeled "verified" or rendered solid. Every `explicit` edge shows `self_report`.
4. **Axes not collapsed** — an edge's rendered origin (solid/dashed) and its rendered
   evidence word are read from the two separate fields; a test flips one and asserts the
   other is unaffected.
5. **Withheld is stated** — when `summary.withheld > 0`, the withheld indicator renders with
   the exact count; when `0`, no fabricated "all shown" claim beyond the count.
6. **Unresolved is inspectable** — the Unresolved panel renders exactly
   `summary.unresolved_count` rows, each naming its `reference`.
7. **Viewer gate holds** — given a graph produced with a `viewer`, no hidden `event_id`
   appears anywhere in the rendered DOM (labels, tooltips, popovers, data-attrs).
8. **Determinism** — the same `DynamicsGraph` renders byte-identical markup twice (no clock,
   no random layout seed that changes output).
9. **No external data** — the render path imports nothing outside `app/lib/philos` + the
   component's own props; a test asserts no `data/*.json` read reaches it (mirrors
   `globeHonesty.test.ts`).

---

## 7. Out of scope for this contract (named, so they're not silently assumed)
- Layout algorithm (force-directed vs lanes vs timeline) — a rendering choice, decided when
  UI starts; the contract constrains *what* is shown and *how honestly*, not the geometry.
- New event types, new inference rules, `filters` — projection-layer changes, not UI.
- `causality.verified` (raising an explicit edge above `self_report`) — a future step; the
  UI must read `evidence_level` per-edge so it needs no change when that lands.

---

## 8. Approval checklist
Approve when these read true; then — and only then — React begins:
- [ ] the data contract (§1) matches `projectDynamics.ts` exactly
- [ ] the field→component map (§2) has no component reading outside it
- [ ] explicit/inferred visual rules (§3) preserve "hypothesis, not fact"
- [ ] withheld/unresolved (§4) and the viewer gate (§5) state absence, never fake or leak
- [ ] the honesty tests (§6) are the pre-React gate
