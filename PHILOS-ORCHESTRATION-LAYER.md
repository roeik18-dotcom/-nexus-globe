# Philos Orchestration Layer — design spec

*The next milestone. Not another tab or KPI — the super-layer that turns the nine
domains from separate screens into one navigable journey, and makes a change in one
domain visibly roll through the rest. Design only; the Hud code is built elsewhere.*

Siblings: [`PHILOS-SYSTEM-BLUEPRINT.md`](PHILOS-SYSTEM-BLUEPRINT.md) ·
[`PHILOS-PRODUCT-ARCHITECTURE.md`](PHILOS-PRODUCT-ARCHITECTURE.md).

---

## 0. The one principle
**Orchestration = navigation + more projections over the ONE event log. No static JSON.**
Every screen is `project*(events, window, viewer)`. Every number traces to source events —
the `מקור: N אירועים` provenance already shown in the value-group Hud, extended to *every*
panel. This is what the event-sourced foundation was built for; the orchestration layer adds
projections and a shell, not plumbing.

**The one exception — stated honestly.** Nearly all of this is "just another projection,"
with **one** deliberate carve-out: the **Dynamics Layer** (§6) adds a single optional field,
`caused_by`, to the event envelope. That is **not** a projection — it is an additive,
versioned **schema evolution of the data contract.** An earlier draft of this doc claimed
"No new data model" flatly; that was wrong, because §6 changes the envelope. One field, one
place, treated as a schema change (validated, tested, blueprint §11 updated in lockstep) —
never smuggled in as "just a fold." Full spec: [`PHILOS-DYNAMICS-LAYER.md`](PHILOS-DYNAMICS-LAYER.md).

## 1. The foundation that already exists (verified)
- **Event log:** `PhilosEvent[]` with a typed `EventType` union — `person.registered`,
  `group.opened`, `resource.received`, `impact.recorded`, `impact.verified`,
  `verification.requested`, … (`app/lib/philos/events.ts`).
- **Projections:** `projectValueGroup(events)` → the six terminals; `projectGlobeGraph(events)`
  → the globe. Pure folds of the log.
- **Impact lifecycle:** `impact.recorded` → (`verification.requested`) → `impact.verified`,
  with 6 evidence levels + 4 results (`verified/partially_verified/rejected/inconclusive`)
  + methods → `statusForMethod`.
- **Honesty confirmed — Hud AND Planet:** `/hub/community` → `VALUE_GROUP_EVENTS →
  projectValueGroup`; `/planet/page.tsx` → `projectGlobeGraph(VALUE_GROUP_EVENTS, GROUP_ID)`,
  whose own docstring records that the old `data/*.json` ontology read was **removed** and
  `projectGlobeGraph` is now the only source. **No static JSON in the Philos Hud/Planet render
  path.** The static files (`values.json`, `value-capability-relations.json`, missions/gaps/
  capabilities/providers) feed only the **legacy Nexus surfaces** — `/world`, `/marketplace`,
  `/pudm`, `app/graph/realityGraph.ts` — a *separate* value-capability subsystem, not the
  event-sourced Philos path. (The old static `/world` route is a distinct, older thing from the
  event-backed Planet; don't confuse them when calling World 🟢.)

The spine is real. Everything below is a fold of the same `PhilosEvent[]`.

## 2. The gap: modules → orchestration
Today the six terminals are **tabs** — they show *state*. Missing is the layer that (a)
gives the user a personal starting point, (b) makes the terminals *stations on one journey*,
and (c) shows the **cross-domain ripple**. Maturity: everything else 9.5+, Dynamic
Orchestration ~6.8 — this is the lift.

## 3. Every domain is a projection (one signature)
```
project<Domain>(events: PhilosEvent[], window: TimeWindow, viewer: PersonId) → DomainView
```
World · People · Values · Activity · Resources · Impact · Community — folds of the log.
Knowledge · Music — the config projections (`personal_config`), same discipline.

## 4. The six missing system-layers — each is a projection, not a feature
| Layer | Projection | Answers |
|---|---|---|
| **Personal (Home)** | `project(events, {assignee: viewer, since: lastSeen})` | מה דורש ממני · מי מחכה · מה השתנה מאז שנכנסתי · משימות · זמן שנשאר · הושלם |
| **Observation** | `derive(events, window)` — rates/deltas/outliers | עומס · חוסר-אנשים · ערכים בירידה · קבוצות מתפרקות · צווארי בקבוק · אנשים לא-מטופלים |
| **Timeline** | `project(events, window ∈ {today,week,month,90d,year,all,custom})` + time-travel `fold(events ≤ T)` | כל KPI נגזר-מחדש לחלון · תנועה בזמן |
| **Publication** | `project(events, type ∈ publish.*)` | מה פורסם · מתי · מי · לאיזו קבוצה · אישור · reach · הצטרפו · השפעה |
| **End-of-Day** | `project(events(today), attributedTo: viewer)` | ביצעת · על מי השפעת · מה התקדם · מה נשאר · למחר · ערכים שהתחזקו |
| **Dynamics** | `projectDynamics(events)` — the cross-domain DAG (§6) | איך שינוי בתחום אחד מתגלגל לכל השאר |

None require new storage. `Personal`/`Observation`/`End-of-Day` are *filtered/derived*
folds; `Timeline` *parameterizes* the existing folds; `Publication`/`Dynamics` need the
event taxonomy completed (§8).

## 5. The event lifecycle IS the journey
```
open → verify → publish → join → help → impact.recorded → impact.verified → close → archive
```
Each arrow is an event. An entity's lifecycle view = its events in order, end-to-end.
The user journey the orchestration renders is exactly this, made navigable:
```
התחלתי יום → מה דורש טיפול → נכנסתי לאירוע → עזרתי → משאבים עודכנו
        → ערכים זזו → ההשפעה נמדדה → סיכום יום אישי → המערכת למדה
```

## 6. The Dynamics Layer — the crown (specified, grounded in `events.ts`)
Not domains in isolation, but the **directed graph of cross-domain effects**. Grounded in the
real primitives:
- **`PhilosEvent` today** carries `event_id · actor_id · entity_type · entity_id · event_type ·
  value_tags · timestamp · visibility · payload · resource_delta · evidence · confidence ·
  impact_claim · verification_status` — **but no link between events.** That single absence is
  the one enabling change.
- **The enabling change:** add `caused_by?: string[]` to `PhilosEvent` (the event_ids that
  produced this one). With it, ripple is **traced**; without it, ripple is **inferred**, and
  inference must be labeled as such — the existing `Provenance` / `verification_status`
  discipline applied to causality.

**`projectDynamics(events, groupId) → DynamicsGraph`** — modeled on `projectGlobeGraph`:
```
inOrder(events)                                    // existing deterministic sort helper
 → nodes: one per event, tagged domain = domainOf(event_type)
          group.*→Community · resource.*/allocation.*/transfer.*→Resources · person.*/member.*/leader.*→People
          request.*/update.*/meeting.*→Activity · impact.*/verification.*→Impact · value_tags→Values
 → edges: for each event e — one per id in e.caused_by                          (kind: "traced")
          else shared JOIN KEY + adjacent in time                               (kind: "inferred")
          join keys = allow-list: same entity_id OR payload.allocation_id
                      OR payload.target_impact_event_id OR payload.person_id
 → every edge carries Provenance { source_events, verification_status, confidence }
```
> **Correction (grounded in `events.ts`/`valueGroupLog.ts`).** An earlier draft of this chain
> used `transfer.made`, `person.joined`, `value.strengthened` — **none of which are in the
> 16-type `EventType` union.** And it inferred edges by `entity_id` alone, which **misses the
> flagship edge**: `transfer.completed` (e051, entity `tr_elder_support_01`) and
> `impact.recorded` (e070, entity `imp_elder_support_july`) share **no `entity_id`**, only
> `payload.allocation_id`. The real chain, and the wider join-key rule, are above. Full
> derivation, invariants, failure modes and test matrix: [`PHILOS-DYNAMICS-LAYER.md`](PHILOS-DYNAMICS-LAYER.md).

The canonical cross-domain chain the graph makes visible — **real seed events only:**
```
group.opened e010 → member.joined e020…e024 → transfer.completed e051
            → impact.recorded e070 → impact.verified e071/e072/e073
```
Note: `impact.verified → impact.recorded` is **already** explicitly linked in the seed via
`payload.target_impact_event_id` — so it renders **traced** the moment `projectDynamics` reads
that FK, before any `caused_by` is seeded. It is the layer's proof-of-concept.

**Ripple queries:**
- **forward** = transitive closure over `caused_by⁻¹` from a chosen event (the cascade).
- **backward** = transitive closure over `caused_by` (the causes).
- **Render:** pick any event → cascade + causes across domains, each edge marked **traced**
  (`caused_by`, honesty rung `self_report` — a declared, attributable link, never "proven")
  or **inferred** (shared join-key + time, honesty rung `system_inference` — dashed, basis
  shown). An inferred edge is a *hypothesis with its basis shown*, never a certain arrow —
  `Provenance` applied to causality. **No invented links.**

This is the jump from "six panels of state" to "one system where a change is watched rolling
through every domain."

## 7. Navigation model — one journey, not tabs
```
entry
 └─ Personal Dashboard ("my day")           ← the first thing seen, not "what happened in the system"
      └─ the journey (stations, not tabs):
         needs-me → event → help → resources → values → impact → day-summary → system-learns
```
Plus a **SYSTEM VIEW** super-layer that shows the whole at once:
```
People · Groups · Events · Resources · Values · Impact   —   Relationships · Dynamics · Forecast
```
Me-vs-System is two projections of the same log: `viewer`-filtered (3 tasks · 2 alerts · 5
people · 1 group) vs global aggregate (38 events · 420 people · 51 groups · 87 actions).

## 8. Complete the event taxonomy (the "12 missing")
The current union covers person/group/resource/impact/verification. Publication, Dynamics,
Personal, and End-of-Day need events to project. Likely additions:
`publish.made` · `person.assigned` / `task.opened` / `task.completed` ·
`group.joined` / `group.left` · `membership.granted` · `value.strengthened` /
`value.weakened` · `allocation.proposed` / `transfer.made` (if not present) ·
`day.summarized`. Add them to `EventType` **with a projection per terminal** — no event
type without a fold that consumes it.

## 9. Honesty invariants (carry forward — non-negotiable)
1. Every panel is a projection of `PhilosEvent[]`; **no `data/*.json` in any render path.**
2. Every KPI cites its source events (extend `מקור: N אירועים` to Personal/Observation/Dynamics/Timeline).
3. Derived numbers (trends, ripple, "changed since login") are **computed**, never hardcoded;
   absence of data is stated honestly, never faked (`0` with provenance, not an invented figure).
4. The two static `data/*.json` files feed **nothing** in the orchestration layer; the Planet
   path must be confirmed clean before World is 🟢 end-to-end.

## 10. Build sequence (incremental — each ships as a projection + a nav station)
1. **Personal Layer (Home)** — highest daily value, smallest projection. Makes the system answer "what do I do now?"
2. **Timeline control** — re-folds the existing terminals over a window; cheap, high leverage.
3. **Dynamics Layer** — the crown; needs `caused_by` + `projectDynamics`. The signature capability.
4. **Observation Layer** — derived trends/anomalies over windows.
5. **Publication Layer** — after the publish event types land (§8).
6. **End-of-Day Layer** — today's events attributed to the viewer.

Each is a fold of the one log + a station on the journey. The stack below it (Event Engine,
Projection Engine, Knowledge Engine, Traceability — all 9.5+) is already ready to carry it.

## 11. The milestone
This layer is the jump from *"see what each domain shows"* to *"understand how a change in
one domain rolls through the whole system"* — the difference between a set of modules and a
living, orchestrated platform. It adds no data model; it composes what already exists into
one coherent journey with a beginning, a middle, and an end.
