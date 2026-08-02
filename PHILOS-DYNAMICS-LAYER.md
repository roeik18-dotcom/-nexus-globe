# Philos Dynamics Layer — specification

*The cross-domain causality layer: how a change in one domain is shown rolling through the
rest. **Status:** the envelope evolution (`caused_by`) + validator (Step 1) and the
`projectDynamics` projection (Step 2) are **implemented and tested** in
`app/lib/philos/{eventCausality,projectDynamics}.ts`; the UI and the further projections
(Observation / Personal / Publication) remain **proposed**. This doc grounds every claim in
the real primitives — `events.ts`, `valueGroupLog.ts`, `projectGlobeGraph.ts` — and marks
which parts are **envelope change**, **projection**, and **UI/policy**, built in that order.*

Parent: [`PHILOS-ORCHESTRATION-LAYER.md`](PHILOS-ORCHESTRATION-LAYER.md) §6 ·
Canonical: [`PHILOS-SYSTEM-BLUEPRINT.md`](PHILOS-SYSTEM-BLUEPRINT.md) §11, §13.

> **The one framing correction this document makes.** The orchestration doc's §0 says
> "**No new data model.**" That is **false for this layer.** Adding `caused_by` is an
> **evolution of the event envelope and the data contract** — additive and optional, but a
> real schema change, versioned and tested as such. Everything *else* in orchestration is
> "just another projection"; the Dynamics Layer is the **one** place that touches the
> envelope. Treating it as merely a projection is the honesty error, and this doc exists to
> hold the line on that distinction.

---

## 0. What already exists (verified against code, 2026-08-02)

| Primitive | Where | Shape (exact) |
|---|---|---|
| Event envelope | `events.ts:198` | `event_id · actor_id · entity_type · entity_id · event_type · value_tags · timestamp · visibility · payload? · resource_delta? · evidence? · confidence? · impact_claim? · verification_status?` — **no link field between events** |
| Entity types (5) | `events.ts:35` | `person · value_group · allocation · transfer · impact` |
| Event types (16) | `events.ts:37` | person.registered · group.opened · leader.appointed · member.joined · request.opened · update.posted · meeting.scheduled · resource.received · allocation.proposed · allocation.voted · allocation.approved · transfer.approved · transfer.completed · impact.recorded · verification.requested · impact.verified |
| Evidence ladder (6) | `events.ts:18` | claim → self_report → evidence → community_verified → external_verified → **system_inference** (last, and *never* "verified") |
| Provenance | `events.ts:222` | `source_events[] · sample_size · verification_status · confidence? · time_range?` |
| Deterministic order | `events.ts:237` | `inOrder()` — sort by timestamp, tie-break `event_id` |
| Reference projection | `projectGlobeGraph.ts` | `(events, groupId) → { nodes, arcs }`; 10 nodes / 8 arcs on the seed |

**The single absence that this layer fills:** the envelope carries **no link between
events.** Causality today is *not representable* — it can only be guessed from shared keys
and time. That guess is legitimate but must be labeled a guess.

---

## 1. Causality model

### 1.1 The field
```ts
// PROPOSED addition to PhilosEvent — additive, optional, one field.
caused_by?: string[];   // event_ids that produced THIS event
```
A child names its parents. The graph direction is **cause → effect** = reading
`caused_by` in reverse.

### 1.2 Direct vs inferred causality — two edge kinds, never merged
| Kind | Basis | Honesty label (ladder) | Rendered as |
|---|---|---|---|
| **traced** | `child.caused_by` contains `parent.event_id` | `self_report` — the child's `actor_id` *declared* this link at `child.timestamp` | a solid, attributable link |
| **inferred** | shared join-key + temporal adjacency (§1.3) | `system_inference` — rung 6, **never** "verified" | a dashed hypothesis, with its basis shown |

**Critical honesty nuance.** A `traced` edge is factual only in that *the link was
declared* — it is attributable to a person and a time, not proven true. It is **never**
promoted above `self_report` unless a future `causality.verified` event checks it (a
possible extension, §7, not required now). "Explicit `caused_by` edges are factual" means
*the declaration is a recorded fact*, not *the causation is objectively proven.*

> **Step-2 refinement — keep two orthogonal axes, never conflate them.** The
> `traced → self_report` / `inferred → system_inference` shorthand above is a *default
> mapping*, not an identity. `projectDynamics` (Step 2) must carry **two independent
> fields** on every edge:
> - **`edge_origin ∈ { explicit, inferred }`** — *structural*: did a `caused_by` declare
>   this link, or did the projection guess it from a join key?
> - **`evidence_level ∈ { self_report, system_inference, … }`** — *trust*: how much the
>   causal claim is actually supported.
>
> They are separate because an `explicit` edge is still only `self_report` until
> independently verified (an author declaring a cause does not make it trustworthy), and an
> `inferred` edge defaults to `system_inference`. Collapsing origin into evidence is exactly
> the "correlation rendered as causation" error this layer exists to refuse. **Step 1 (this
> commit) introduces neither field — it only validates the `caused_by` envelope.** The edge
> model lands with `projectDynamics`.

### 1.3 The inference rule (must be wider than the orchestration draft)
The orchestration §6 draft said inferred = "same `entity_id` + adjacent in time." **That is
too narrow** and would miss the flagship edge. Grounding in the seed:

- `transfer.completed` (e051) has `entity_id = tr_elder_support_01`.
- `impact.recorded` (e070) has `entity_id = imp_elder_support_july`.
- They share **no `entity_id`** — only `payload.allocation_id = alloc_elder_support`.

So the funding→impact ripple, the one this layer exists to show, is **invisible** to an
`entity_id`-only rule. The inference rule must therefore be:

```
inferred edge (A → B) exists when B.timestamp ≥ A.timestamp, they are adjacent in the
per-key ordering, and A, B share ANY join key:
  • same entity_id, OR
  • a declared foreign key: B.payload.allocation_id == A.entity_id | A.payload.allocation_id
                            B.payload.target_impact_event_id == A.event_id
                            B.payload.person_id == A.entity_id   (people ↔ group)
Join keys are an EXPLICIT allow-list, never "any matching string" — a coincidental
value match is not evidence of causation.
```
Everything caught this way is `system_inference`, dashed, with the join key named in its
provenance. **Correlation is never rendered as causation** — the label and the visual
weight say "hypothesis," and the basis (which key, what time gap) is always shown.

### 1.4 Constraints
- **Self-reference prohibited.** `e.event_id ∉ e.caused_by`. Validation error (§8 D2).
- **Missing parent.** A `caused_by` id with no matching event → the edge is **dropped and
  surfaced** in an `unresolved[]` diagnostics list, never silently swallowed and never
  crashing the projection.
- **Cycle detection.** The traced graph must be a **DAG**. A back-edge (a `caused_by` that
  points forward in time, or closes a loop) is broken at the offending edge; both events
  are flagged; neither link is rendered as fact.
- **Temporal ordering.** Every parent must satisfy `parent.timestamp ≤ child.timestamp`
  (cause precedes effect). A violation marks the edge **disputed**, shown as a defect, not
  a fact. (This is *implied* by DAG but stated separately because it is checkable on a
  single edge without a full traversal.)
- **Cross-group causality.** An edge may cross `groupId` boundaries **only if both
  endpoints are visible to the viewer** (`visibility` + membership). Otherwise the edge is
  **withheld** (privacy), not drawn — an absence is honest; a leak is not.
- **Immutability.** `caused_by` is set at event creation and **never edited.** The log is
  append-only; a correction is a *new* event (e.g. a future `causality.retracted`), never a
  mutation of the original. This is what makes the causal history itself replayable.

---

## 2. Backward compatibility

The field is **optional and additive** — every one of the 16 existing event types and all
seed events remain valid unchanged. **No migration is required to keep the system working.**

**What `caused_by` absent means — the three readings, and the ruling:**

| Reading | Verdict |
|---|---|
| "no causality" (this event had no cause) | ❌ never assume this — it asserts knowledge we don't have |
| "legacy event" (written before the field existed) | ✅ true for every current event, but not a *semantic* claim |
| **"unknown causality"** (cause not recorded) | ✅ **this is the canonical meaning** |

Absent `caused_by` ⇒ **unknown**, never **none**. The projection may still *infer* edges
for such an event (§1.3), clearly labeled inferred. It must never state "this event had no
cause."

**Versioning strategy.** Additive optional fields do not need an envelope version bump to
*read*; but to make the change auditable, stamp new events with a small
`schema: { caused_by: 1 }` capability marker **only if** the writer sets `caused_by`. No
back-fill of old events. `PHILOS-SYSTEM-BLUEPRINT.md §11`'s canonical event JSON must gain
the field in the same change, or the blueprint and code drift (§8, contradiction check).

---

## 3. `projectDynamics` contract

Modeled on `projectGlobeGraph(events, groupId)`. **Implemented in `projectDynamics.ts` (Step 2).**
The shipped signature is `projectDynamics({ events, window?, viewer?, mode? })` — no `groupId`
(the projection spans the whole log), `mode` drives Step-1 validation, `filters` deferred, and
`withheld` lives on `summary`; `projectDynamics.ts` is the source of truth for the exact types.
The sketch below shows the intent:

```ts
interface DynamicsQuery {
  events: PhilosEvent[];
  groupId: string;               // scope; cross-group edges gated by §1.4
  viewer: string;                // person_id — filters by visibility/membership
  window?: [string, string];     // ISO [from,to]; default = all
  filters?: {
    domains?: Domain[];          // restrict to a subset of the 9
    kinds?: ("traced" | "inferred")[];
    minConfidence?: number;
  };
}

interface DynamicsNode {
  event_id: string;
  domain: Domain;                // domainOf(event_type) — §5
  entity_type: EntityType;
  entity_id: string;
  timestamp: string;
  label: string;                 // from payload, never invented
}

interface DynamicsEdge {
  from: string;                  // parent event_id (cause)
  to: string;                    // child event_id (effect)
  kind: "traced" | "inferred";
  domainTransition: [Domain, Domain];   // e.g. ["resources","impact"]
  join_key?: string;             // which key produced an inferred edge
  provenance: Provenance;        // source_events, verification_status, confidence
}

interface DynamicsGraph {
  nodes: DynamicsNode[];
  edges: DynamicsEdge[];
  unresolved: { event_id: string; missing_parent: string }[];  // dangling caused_by
  disputed:   { edge: [string, string]; reason: "cycle" | "temporal" }[];
  withheld:   number;            // count of edges hidden by visibility — stated, not hidden
}

function projectDynamics(q: DynamicsQuery): DynamicsGraph;   // pure fold, like projectGlobeGraph
```

**Contract guarantees:**
- Pure and deterministic — same input ⇒ same output, ordered by `inOrder`.
- Every `edge.provenance.source_events` is non-empty and names real `event_id`s.
- `unresolved`, `disputed`, `withheld` are **first-class outputs**, never swallowed — the
  same discipline as `verification.requested` making "under review" a carried state, not a
  guessed one.

---

## 4. Honesty rules (bind the projection AND the UI)

1. **Traced edges are factual as declarations** — attributable to `actor_id` + `timestamp`;
   never promoted above `self_report`.
2. **Inferred edges are labeled inferred** — `system_inference`, dashed, basis shown.
3. **Correlation is never rendered as causation** — an inferred edge is visually and textually
   a hypothesis; shared-key + adjacency is stated as such.
4. **No causal edge without provenance** — `source_events` mandatory; an edge that cannot
   name its events does not render (blueprint §13 traceability rule, applied to causality).
5. **Every displayed ripple traces to event_ids** — forward/backward closures return the
   exact event_id path; the UI can always answer "why is this line here?" with a list.
6. **Absence is stated, not faked** — `unresolved`/`disputed`/`withheld` counts are shown;
   an empty ripple is "no recorded causes," never an invented arrow.

---

## 5. The nine-domain model

`domainOf(event_type)` — the tagging function every node needs:

| Domain | Incoming event types (real) | Outgoing effects (what it causes downstream) | Projection output | Gap |
|---|---|---|---|---|
| **People** | person.registered · member.joined · leader.appointed | joins/roles that enable activity & allocation votes | actor nodes, role edges | — |
| **Community / Groups** | group.opened | the container every other domain hangs off | group anchor node | — |
| **Activity / Events** | request.opened · update.posted · meeting.scheduled | requests that motivate allocations | activity nodes | request→allocation link is inferable only, no `caused_by` yet |
| **Resources** | resource.received · allocation.proposed · allocation.voted · allocation.approved · transfer.approved · transfer.completed | funds the work that produces impact | ledger nodes, transfer edges | — |
| **Values** | *(none dedicated)* — carried as `value_tags[]` on every event | value movement | value-tag rollups | **no `value.strengthened/weakened` event** — value movement is inferred from tags, not recorded (orchestration §8) |
| **Impact** | impact.recorded · verification.requested · impact.verified | the measured result; end of the chain | impact nodes, verification edges | — |
| **Publication** | *(none)* | reach → new joins | — | **needs `publish.*`** (orchestration §8) |
| **Personal** | *(none dedicated)* | — | viewer-filtered fold of all above | projection-only, no new type |
| **Observation** | *(none dedicated)* | — | derived rates/deltas | projection-only, no new type |

**Result: 6 of 9 domains have real incoming events today** (People, Community, Activity,
Resources, Impact, and Values *via tags only*). Publication needs new event types; Personal
and Observation are pure projections. **The Dynamics vertical slice (§6) touches only the
first six and needs no new event type.**

---

## 6. Minimal vertical slice

**The chain, in real seed events (verified in `valueGroupLog.ts`):**

```
group.opened      e010   (Community)
   → member.joined  e020…e024   (People)          [5 members]
   → transfer.completed  e051   (Resources)       resource_delta −5000 ILS
   → impact.recorded     e070   (Impact)          self_report, confidence 0.7
   → impact.verified     e071/e072/e073 (Impact)   site_visit + document_review + community_attestation
```

**What the seed supports today — the honest state:**

| Edge | Join available now | Kind today | Needs `caused_by`? |
|---|---|---|---|
| group.opened → member.joined | `payload.person_id` / shared group `entity_id` | inferred | to become traced, yes |
| allocation.approved e047 → transfer.approved e050 | `payload.allocation_id` | inferred | yes |
| transfer.approved e050 → transfer.completed e051 | same `entity_id` tr_elder_support_01 | inferred | optional |
| **transfer.completed e051 → impact.recorded e070** | `payload.allocation_id` only (**different entity_id**) | **inferred** | **yes — the flagship edge** |
| impact.recorded e070 → impact.verified e071 | `payload.target_impact_event_id = e070` | **near-traced** (explicit FK already in payload) | already explicit |

**Two honest findings from the seed:**
1. **With the current seed, every cross-domain edge is `inferred`** — there is not one
   `caused_by` in the log. That is the correct *current* state and a valid first test: prove
   `projectDynamics` draws the whole ripple as clearly-labeled hypotheses, `withheld`/
   `unresolved` = 0.
2. **`impact.verified → impact.recorded` is already explicitly linked** via
   `payload.target_impact_event_id` (e071/e072/e073 → e070). This is the one place the log
   *already* records causation — it should render **traced** the moment `projectDynamics`
   reads that FK, before any `caused_by` is added. It is the proof-of-concept for the whole
   layer.

**What new event TYPES the slice needs: none.** The only additions are (a) the optional
`caused_by` field, and (b) — to demonstrate *traced* rather than *inferred* — seeding
`caused_by` on the flagship chain, which is a **data edit to `valueGroupLog.ts`, deferred**
(not part of this design step).

---

## 7. Separation of concerns (build these as distinct changes)

| Concern | Change | Risk | When |
|---|---|---|---|
| **Event envelope** | add optional `caused_by?: string[]` to `PhilosEvent`; update blueprint §11 JSON | schema evolution — versioned, tested | step 1 |
| **New event types** | **none for this layer** (contrast Publication/Personal, orchestration §8) | — | n/a here |
| **Projection logic** | `projectDynamics` + `domainOf` + inference allow-list + DAG/temporal validation | pure, isolated, fully testable | step 2–3 |
| **UI representation** | ripple view: traced solid / inferred dashed / disputed flagged / provenance on click | none until logic is locked | **last** |
| **Policy / governance** | cross-group visibility gate; immutability rule; future `causality.verified/retracted` | privacy-critical | with projection |

**Order is non-negotiable:** envelope → projection → tests → vertical slice → then the other
projections (Observation/Personal/Publication) → **UI last.** No UI before causality,
provenance, and backward-compat are locked.

---

## 8. Returns

### 8.1 Exact schema delta
```diff
  export interface PhilosEvent {
    event_id: string;
    actor_id: string;
    entity_type: EntityType;
    entity_id: string;
    event_type: EventType;
    value_tags: string[];
    timestamp: string;
    visibility: "public" | "private" | "invite";
    payload?: Record<string, unknown>;
    resource_delta?: ResourceDelta;
    evidence?: string[];
    confidence?: number;
    impact_claim?: ImpactClaim;
    verification_status?: VerificationStatus;
+   /** event_ids that produced this event. Absent = UNKNOWN cause, never "no cause". */
+   caused_by?: string[];
  }
```
One field. Optional. Additive. No change to any existing event. Blueprint §11 JSON gains the
same field in the same commit.

### 8.2 Invariants (D-series)
- **D1 Referential:** every id in `caused_by` resolves to an existing `event_id`, else →
  `unresolved[]`.
- **D2 No self-reference:** `e.event_id ∉ e.caused_by`.
- **D3 Acyclic:** the traced graph is a DAG.
- **D4 Temporal:** every parent `timestamp ≤` child `timestamp`.
- **D5 Immutable:** `caused_by` never edited post-creation; corrections are new events.
- **D6 Visibility-gated:** cross-group edge rendered only if both endpoints visible to viewer.
- **D7 Provenance-complete:** every rendered edge has non-empty `source_events`.
- **D8 Kind-separated:** inferred never rendered as traced; `system_inference` labeled.
- **D9 Unknown≠none:** absent `caused_by` = unknown, never asserted as "no cause."

### 8.3 Failure modes
| Failure | Behavior (never crash, never fake) |
|---|---|
| dangling `caused_by` id | edge dropped → `unresolved[]`, count surfaced |
| cycle | back-edge broken, both events flagged → `disputed[]` |
| parent after child | edge → `disputed[] (temporal)` |
| cross-group leak | edge withheld → `withheld` count |
| inference explosion (many adjacency edges) | cap N per key, **log what was dropped** (no silent truncation — blueprint honesty rule) |
| coincidental key match | excluded — join keys are an explicit allow-list, not "any equal string" |

### 8.4 Test matrix
| # | Input | Expect nodes | Expect edges | Diagnostics |
|---|---|---|---|---|
| T1 | full seed, no `caused_by` | all events in window, domain-tagged | all cross-domain edges = **inferred**, dashed | unresolved 0 · disputed 0 · withheld 0 |
| T2 | seed | — | e071→e070 rendered **traced** via `target_impact_event_id` FK | — |
| T3 | seed + `caused_by:["e051"]` on e070 | — | e051→e070 flips inferred→**traced** | — |
| T4 | e070 with `caused_by:["e070"]` | — | — | D2 violation caught (self-ref) |
| T5 | e051 with `caused_by:["e_ghost"]` | — | e051 edge dropped | unresolved: `{e051, e_ghost}` |
| T6 | A→B→A `caused_by` loop | — | back-edge broken | disputed (cycle) |
| T7 | child `caused_by` a later-timestamp parent | — | edge marked | disputed (temporal) |
| T8 | cross-group parent invisible to viewer | — | edge absent | withheld ≥ 1 |
| T9 | window narrower than chain | only in-window nodes | only in-window edges | boundary edges → unresolved (parent out of window), stated |
| T10 | filters.kinds=["traced"] on pure seed | nodes | **0 edges** (seed has no traced) | honest empty, not faked |

### 8.5 Smallest implementation sequence
1. Add `caused_by?` to `PhilosEvent` (type only) + a `validateCausality(events)` pass
   enforcing D1–D4, returning diagnostics. **No projection yet.**
2. Implement `projectDynamics` (pure): `domainOf`, inference allow-list (§1.3), DAG/temporal
   from step 1, Provenance on every edge, `unresolved/disputed/withheld` outputs.
3. Write T1–T10. Land them green — **on the unchanged seed**, so T1/T2/T10 prove the honest
   all-inferred-plus-one-FK-traced current state.
4. Vertical slice: seed `caused_by` on the flagship chain (data edit to `valueGroupLog.ts`,
   a *separate, deferred* change) → T3 goes from fixture to seed.
5. Only then: Observation / Personal / Publication projections.
6. UI last.

### 8.6 Contradiction check vs `PHILOS-SYSTEM-BLUEPRINT.md`
| Question | Verdict |
|---|---|
| Does adding `caused_by` contradict the blueprint? | **No.** Blueprint §11 mandates "ONE event log," not a frozen envelope. An additive optional field stays within one log. But §11's canonical JSON **must gain the field** in the same change, or code and blueprint drift. |
| Does the orchestration doc contradict the blueprint? | **No — but it contradicts itself.** Orchestration §0 "No new data model" is falsified by its own §6 (`caused_by`). Fixed by the framing note at the top of this doc and the §0/§6 edits landing alongside it. |
| Does the orchestration §6 chain match reality? | **No, as originally written** — it used `transfer.made`, `person.joined`, `value.strengthened`, which are **not** in the 16-type union. Corrected to the real chain (§6 here). |
| Drift already present in the blueprint? | **Yes, two, minor:** (a) blueprint §11 JSON has a `location` field that `events.ts` **dropped**; (b) blueprint §0 header says the seed is "42 events" — the file holds **38**. Both worth reconciling, neither blocks this layer. |

---

## 8.7 Step-1 review outcome (adversarial pass, 2026-08-02)
Six independent skeptics reviewed the shipped validator; six findings were confirmed by
refute-first verification. Four were **fixed** in the same change; two are **deferred** as a
contract decision, not hidden:

**Fixed (within the 6-diagnostic contract + the "never crash" rule):**
- The validator **crashed** (`TypeError: not iterable`) on a non-array `caused_by`
  (`null`/string/number) — the exact malformed-JSON it exists to guard. Now every iteration
  site is `Array.isArray`-guarded and a non-array field yields one `invalid_parent_id`.
- `causalDeclaration` threw on `null` while `causalParents` returned `[]`; both now read a
  non-array as `unknown`/`[]`, consistently, without throwing.
- `findCycles`'s docstring overclaimed "every distinct simple cycle"; narrowed to what a
  three-colour DFS actually guarantees (≥1 cycle per back-edge — sound for the DAG verdict).
- Added tests pinning the non-string `invalid_parent_id` branch and the malformed-container
  cases (previously only the empty-string half was covered).

**Resolved — the 7th diagnostic, in a separate follow-up commit:**
- **Timestamp hardening → `invalid_timestamp` (always error).** `parent_after_child`
  previously trusted `Date.parse`, so on input violating the documented `// ISO 8601 with
  offset` type it had two gaps: an **offsetless** timestamp was read in the host timezone
  (non-deterministic), and an **unparseable** one yielded `NaN`, silently no-op'ing the check
  (a false negative). Both are now caught: a timestamp used in causality validation must carry
  an explicit `Z`/`±HH:MM` offset **and** parse to a real instant, or it is flagged
  `invalid_timestamp` and the ordering comparison is skipped (never a host-local or raw-string
  fallback). Seed data — all offset-bearing — stays green. This closed the module's two
  headline promises: **deterministic** and **no silent failure**.

**Final diagnostic set (7):**

| Code | Severity | Fires when |
|---|---|---|
| `self_reference` | error | an event lists itself in `caused_by` |
| `duplicate_parent` | error | a parent id appears more than once |
| `invalid_parent_id` | error | a parent id is empty/non-string, or `caused_by` is not an array |
| `missing_parent` | warning (lenient) / error (strict) | a parent id resolves to no event |
| `parent_after_child` | error | a cause's instant is after its effect's |
| `causal_cycle` | error | the `caused_by` graph is not a DAG |
| `invalid_timestamp` | error | a causal timestamp is unparseable or lacks an explicit offset |

## 8.8 Step-2 review outcome (adversarial pass, 2026-08-02)
Six independent skeptics reviewed `projectDynamics`; **12 findings confirmed, 0 uncertain** (the
edge-direction/semantics core came back clean). All 12 were in the new module and **fixed** in the
same change, each pinned by a test:

- **Cycle suppression (high).** Edges were suppressed by `findCycles`' reported paths, which are
  incomplete — overlapping cycles could leak one edge rendered as a `self_report` **fact**. Now
  suppressed by **strongly-connected-component membership** (Tarjan over the resolved `caused_by`
  graph): an explicit edge whose parent and child share an SCC never renders. Complete, not
  per-path.
- **`rejectedPairs` was over-broad (med/low).** A single catch-all over `parent_id` dropped
  *valid-but-duplicated* edges and pre-empted the unresolved-claim push for strict missing parents.
  Split by reason: only `parent_after_child` rejects a pair; `duplicate_parent` renders once;
  `missing_parent` flows to `unresolved_claims` in **both** modes; cycles → SCC; bad timestamps →
  by-event.
- **Inference allow-list (med/low).** Rule A could self-loop (`target_impact_event_id` == own id)
  and didn't check the cause is actually an `impact.recorded` (Rule B checks both endpoints). Added
  a self-loop guard and the missing type-gate; a mislinked FK now becomes a `missing_join_target`
  claim, never a drawn edge.
- **Window / viewer honesty (med).** A malformed/offsetless `window` bound silently returned the
  whole log — now **throws**. `unresolved_claims` were computed over the full log and could **leak
  a hidden event's id** past the viewer gate — now filtered to the displayed graph, and a
  `summary.withheld` count states how many edges the view hid.
- **Coverage (med/low).** The cycle, `invalid_timestamp`, and viewer-visibility rejection paths had
  no projection-level tests — a reversed-key or dropped-guard regression would have shipped silent.
  Added tests for each (incl. a 3-node overlapping cycle that a per-path suppression would leak).

Result: 33 projectDynamics tests, full suite green.

## 9. One-paragraph summary
The Dynamics Layer is the **one** part of orchestration that is not merely a projection: it
adds a single optional field, `caused_by`, to the event envelope — a real, versioned schema
evolution. Everything else it needs already exists: the 16 event types, the 6-level ladder
whose rung 6 (`system_inference`) is the honest label for guessed links, `Provenance`, and
`inOrder`. The flagship ripple — funding a group's work and seeing the verified impact it
produced — **cannot be inferred from `entity_id` alone** (the events share only a payload
foreign key), which is exactly why `caused_by` is required rather than optional for the edge
the layer exists to draw. Build it envelope → projection → tests → seed → other projections →
UI, and never draw a causal line the log cannot name.
