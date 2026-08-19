# PHILOS — SYSTEM BLUEPRINT v1 (CANONICAL)

*The single source of truth for Philos. `PHILOS-PRODUCT-ARCHITECTURE.md` was a
second document also labelled canonical; its unique sections are merged here (§§20–23)
and it is now a stub pointing back to this file. Where anything disagrees with this
document, this document wins.*

*Written before implementation began. Part of it has since shipped, so the original
"nothing here is implemented" no longer holds — **§0 below is the authoritative
account of what exists.** Read every section through it: an unmarked section is a
proposal, not a description of the system.*

> **Rule for everything below:** every metric declares **source · time-range · sample-size · confidence · verification-status**; every screen answers **one** user question; every action shows **what changed** afterward. Inferred impact is never shown as verified fact.

> **Traceability rule (applies to every surface, including the globe):**
> **every node, line, metric and status must trace to a source event or a projection
> of source events.** If a visual element cannot name the event behind it, it does not
> ship. Decoration that implies data — random points, static "live" indicators,
> invented statuses — is a defect, not a style choice.

---

## 0. Build status (authoritative — 2026-08-03)

**Status vocabulary.** Five values, and no others:

| Status | Means |
|---|---|
| **implemented — reference vertical slice** | Works end to end for **one seeded Value Group**, in a local projection, with tests. **Not** a production capability. |
| **partially implemented** | Some of the section works, within the same one-group slice; named parts are absent. |
| **mocked** | Something renders, but no event or projection stands behind it. |
| **planned** | Designed here, not built. |
| **missing** | Required by this blueprint, not designed anywhere yet. |

**What "reference vertical slice" excludes — read this before any status below.**
There is **one** Value Group, whose history begins in **one hand-written seed event
log** (38 events in `valueGroupLog.ts` — this note said 42 until the figure was read
off `event_count` at runtime on 2026-08-03) and continues in a **durable append-only
log on disk**. There is **no multi-group runtime, no identity or authentication, and
no live production data.** Every "implemented" below is bounded by that sentence.

**The log now has a writer (2026-08-03).** Until this date every Philos screen was a
pure fold of a `const`, and the product's only action — the Join button — appended to
React state and vanished on refresh. `app/lib/philos/eventStore.ts` (the append rules),
`app/lib/philos/commands/joinGroup.ts` (the first command) and
`app/lib/philos-event-store.ts` (the durable JSONL store) close that loop: a person
joins, the event is written, and all four screens re-project it. One command exists,
not four; §5's loop is still mostly unwritable.

**The viewer is resolved, not assumed (2026-08-03).** `p_you` used to be a string a
component passed to itself — "you" existed in the UI whether or not the log had heard
of you. `app/lib/philos-viewer.ts` is now the single seam every render and the join
action resolve identity through, and `app/lib/philos/viewerIdentity.ts` projects what
the log can actually account for: registered or not, which groups and on what basis,
which events are yours, with provenance. A name that has not been written to the log
is labelled **local**, never shown as recorded. `/hub` opens with that personal answer
(§14's *why me*) before the system totals. `/dynamics` now passes the viewer, so §5's
gate operates server-side — it hides nothing today, because every event is public,
which is the point of turning it on before there is anything to hide.

**Still not built, and deliberately:** there is no session, no sign-in, and no second
participant. `resolveViewer()` returns one local viewer and is `async` so a real
session lands in that file alone. Minting a per-browser identity would create the
second participant §16 says must not exist before the privacy rules do.

| § | Subject | Status |
|---|---------|--------|
| 1 | Executive definition | **planned** — the definition, not the build |
| 2 | System hierarchy | **partially implemented** — one Value Group; ecosystem/global layers do not exist |
| 3 | Three complexity levels | **planned** |
| 4 | Six Value-Group aspects | **partially implemented** — all six render as Community subviews for the one seeded group; the ecosystem overview is a stub |
| 5 | Core user loop | **planned** |
| 6 | Person schema (12 layers) | **missing** — no Person entity. A *viewer identity* now exists (`viewerIdentity.ts`): registration, memberships and authored events, projected from the log. That is 3 of the 12 layers' worth of fact, not the schema |
| 7 | Value Group schema | **implemented — reference vertical slice** ¹ |
| 8 | Action lifecycle | **partially implemented** — allocation states only, one group |
| 9 | Resource-transfer lifecycle | **partially implemented** — approve/complete + tiers, one transfer, group→project only |
| 10 | Impact verification | **implemented — reference vertical slice** ¹ · **trust: missing** |
| 11 | Canonical Event Log | **implemented — reference vertical slice** ¹ |
| 12 | Hidden engines | **planned** |
| 13 | Globe legend & semantics | **partially implemented** ² — the traceability rule is now **satisfied**: every node, line and HUD figure on the globe traces to an event. Still absent: per-aspect projections, and 12 of 16 event types draw nothing |
| 14 | Four journeys | **planned** |
| 15 | Daily-life taxonomy | **planned** |
| 16 | Privacy & exposure | **missing** — required before any second participant. The viewer gate (§5 of the UI contract) is now *wired* on `/dynamics`, so the mechanism exists ahead of the rules |
| 17 | Gap analysis | reference |
| 18 | Phased plan | reference |
| 19 | Next milestone | reference |
| 20 | Value Forge | **planned** (merged from PRODUCT-ARCHITECTURE §4) |
| 21 | Value Leaders | **partially implemented** (merged §5) — roles from events; trust **missing** |
| 22 | Community Resources | **partially implemented** (merged §6) — money only; other kinds declared, unused |
| 23 | Philos Core & Matching Engine | **planned** (merged §7) |
| 24 | Design guardrails | **planned** (merged §11) |

¹ **Scope note.** Validated for one seeded Value Group only; not yet generalized to
multi-group production runtime.

² **Globe scope note (verified 2026-08-16, Mission B/B9 update).** Arc coverage and
node coverage are different counts, so they are stated separately. **Arcs:**
`projectGlobeGraph` draws a line for `member.joined`, `leader.appointed`,
`transfer.completed`, and (as of this pass) `group.opened` — its own real
`central_value` fact, drawn once as an arc from the group to its own new `value`
node — **4 of the 16** event types the log defines. **Nodes:** the group's own
`group.opened` event now renders TWO nodes — the `value_group` anchor and a
visually distinct `value` node for its real `central_value` — connected by the arc
above; the person and recipient nodes are endpoints of the three pre-existing arc
types. So **4 of 16 event types are represented on the globe** in total, and **12 of
16 are not represented at all** — neither node nor line. (`person.registered` and
`transfer.approved` are read as well, for node labels and for the recipient's
identity, but draw nothing of their own.) **9 arcs and 11 nodes** render for the
seeded group (5 joins, 2 appointments, 1 transfer, 1 central_value), a figure now
pinned by test rather than observed by eye. The completed transfer carries amount,
currency, resource type and value tags read straight off the event, and a transfer
with no `resource_delta` yields an arc with no amount rather than a fabricated one.
A legend names every line type **and every node type**. `NEED`/`RESOURCE`/`ACTION`/
`EFFECT` are deliberately NOT node types on this graph: it is built entirely from
the legacy Value-Group event log, and canon's own Action/Effect/Need carry no
`group_id` (the same gap documented across Community/Dynamics/Brain) — there is no
real edge to place them on.

**Nothing mocked remains on this screen.** The elements this note used to list —
~61 ontology nodes from `data/*.json` positioned by hashing an id, the 720-point
decorative swarm, the LIVING FORCES relabelling of entity counts, the cycling LIVE
STREAM, the fixed `SYNC · REALTIME` / `ORBIT · OPTIMAL` strings, the static green
"live" dot and the 62%-filled time scrub — have all been removed. The HUD's stat bar
now counts the render arrays themselves (nodes drawn · arcs drawn · relation types)
instead of reporting 61 entities and 147 PUDM relations while 8 lines were on
screen. `app/planet/__tests__/globeHonesty.test.ts` holds each removal in place and
asserts that no `data/*.json` read reaches the route.

Point position is layout, never geography: nodes take evenly spaced slots on a
sphere in the projection's deterministic order, because the log records no
coordinates and inventing one per node would be inventing data.

### What exists today

```
app/lib/philos-viewer.ts             resolveViewer() — the one seam that answers "who is looking"
        ↓
app/hub/actions.ts                   server action — the network edge of the write path
        ↓
app/lib/philos/commands/joinGroup.ts is this act admissible? → the events that record it
        ↓
app/lib/philos/eventStore.ts         append rules: unique ids, orderable time, valid causality
        ↓
app/lib/philos-event-store.ts        the durable log:  seed  ++  <dataDir>/philos-events.jsonl
        ↓
app/lib/philos/projectValueGroup.ts  pure projection, provenance on every figure
app/lib/philos/viewerIdentity.ts     what the log knows about the viewer — same discipline
        ↓
app/hub/community  (Value Group screen)   every number traces to an event
app/hub            (entry screen)          the personal answer, then derived counts
app/planet         (globe)                 nodes and arcs from the same log
app/dynamics       (causal graph)          viewer-scoped; explicit vs inferred kept apart
```

Read and write are separate directions over one log, and the split is enforced: the
command owns **meaning** ("may this person join?"), the store owns **integrity** ("does
the log stay sound?"), and neither answers the other's question. The command decides
membership by asking `projectValueGroup` rather than re-scanning for `member.joined`,
because the projection counts the founder and appointed leaders as members without
either emitting one — a writer with its own definition would record a join the screen
could never show.

`app/lib/philos/projectGlobeGraph.ts` extends the same chain to the globe: it
projects nodes and arcs from the event log so each point and line names the event
that created it.

**The chain is now exclusive.** `app/planet/page.tsx` reads nothing but the
projection — the `data/*.json` ontology reads, the second node population and the
HUD counts that described it are gone, and `app/planet` no longer imports anything
outside `app/lib/philos`. Every population on the globe is event-backed, so the
traceability rule holds across all three Philos screens. What the globe still lacks
is reach, not provenance: 12 of the 16 event types draw nothing — only
`group.opened` (the anchor node), `member.joined`, `leader.appointed` and
`transfer.completed` reach the screen — and §13's per-aspect projections
(OVERVIEW=activity, PEOPLE=relationships, …) are unbuilt.

### Naming (canonical — use these, and only these)

| Use | Not | Why |
|---|---|---|
| **Value Group** | Value Hub, Group Hub | the code uses `value_group`; one name only |
| **Aspects**: OVERVIEW · PEOPLE · VALUES · ACTIVITY · RESOURCES · IMPACT | "terminals" | the six are Value-Group **aspects** (sections/subviews), not routes — see §4a; their internal order is the shared structure |
| **Surface** | "terminal" | a product route. There are seven: Hub · Brain · Dynamics · Community · Marketplace · Globe · World (§4a) |
| **Globe** | Planet, World-globe, Living Planet | the 3D visualization layer |
| **Overview aspect** | "World terminal" | the ① OVERVIEW / ecosystem-view aspect, which is *not* the globe and *not* the `/world` surface |

`/planet` remains the route name; "Planet" is a path, not a concept.

### Entry point (settles a live contradiction)

**The product entry point is the Value Group, never the globe.** The globe is a
**secondary visualization layer**, revealed only after a user has understood one
group, and only once its lines trace to real events (§13, §18 step 7).

*Enforced in code: `next.config.js` redirects `/` → `/hub`, and both `/hub` screens
link out to `/planet` as a secondary destination.*

---

## 1. Executive definition
**Philos is an orientation, coordination, resource-allocation, and real-world-impact operating system.** It connects **people, values, needs, capabilities, groups, resources, actions, and measurable outcomes** through one consistent architecture.

Its unit of measurement is **reality — what changed in the world — not content** (posts, likes, views). Simple on the surface, precise underneath, consistent across every screen, explainable when needed, invisible when not. **The user does not operate the architecture; the architecture understands and guides the user.**

It is **not**: a social network, an analytics dashboard, a 3D globe, a donations app, a groups app, or a people-ranking system. The globe is a *visualization layer*, never the home screen.

---

## 2. System hierarchy
```
PHILOS  (orientation & human-coordination engine)
        │
   GLOBAL VALUE SYSTEM
        │
   VALUE ECOSYSTEM  (value communities)
        │
   VALUE GROUP  ← the central unit of action
        │  built from six aspects (Identity · People · Activity · Resources · Values&Forge · Impact)
        │
   PEOPLE · ACTIONS · RESOURCES · OUTCOMES
```
Zoomed out the same tree reads: **People → Groups → Cities → Countries → Global dynamics.**

---

## 3. Information architecture — three complexity levels (K)
The same system, three depths, so a newcomer, a group leader, and a researcher share one product:

| Level | Time | Answers |
|-------|------|---------|
| **Snapshot** | 10 s | what's happening · what changed · what matters · what I can do |
| **Exploration** | minutes | people · groups · values · budgets · actions · impact |
| **Research** | deep | distributions · comparisons · forecasts · networks · history · source data |

Snapshot shows **5–7 numbers only**; everything else opens on demand. Never dump "everything" on one screen.

---

## 4. The six Value-Group aspects (B) + shared internal structure (C)
Every aspect answers exactly one question, and every screen presents them in the **same internal order** so the user learns the language once:

```
Overview → People → Activity → Resources → Values → Impact
```

> **Nomenclature correction.** These six were called "six terminals" in earlier drafts of this
> section. They are **aspects** — the six sections of a Value Group (§2 already states this:
> "built from six aspects"), rendered as subviews inside a product surface. They are not routes.
> The rename to "terminals" was introduced during a document merge; see §4a for the vocabulary
> now in force. `PHILOS-PRODUCT-ARCHITECTURE.md` records the original rename and is marked
> "do not edit" — the correction lives here only.

| Aspect | The one question | Shows |
|----------|------------------|-------|
| **① OVERVIEW / ecosystem view** — *not the `/world` product route* | What's happening now across the ecosystem? | global state, regions, continents, trends, events, needs, resource flow, values rising/falling |
| **② PEOPLE** | Who participates and what do they bring? | users, new users, value-leaders, founders, roles, matches, relationship network, contribution history, trust |
| **③ VALUES** | What do people believe and what drives them? | all values, popular/sought/growing, resourced, in-tension, complementary, value-forges, regional distribution, trends |
| **④ ACTIVITY** | What is actually being done now? | today, open actions, tasks, projects, requests, votes, events, field reels, before/after, stalled vs progressing |
| **⑤ RESOURCES** | Where is power, and how is it distributed? | money in/out, budget available/allocated, pending allocations, transfers, time, knowledge, equipment, grants, references, approval status |
| **⑥ IMPACT** | What actually changed in the world? | people affected, communities changed, projects completed, problems solved, resources/time/money saved, trust built, cost-to-result, impact by value/region/time |

---

## 4a. Product surfaces vs Value-Group aspects (vocabulary, in force)

Two different things had the same name. They no longer do.

**7 PRODUCT SURFACES** — the product's routes:

| Surface | Route |
|---|---|
| **Hub** | `/hub` |
| **Brain** | `/brain` |
| **Dynamics** | `/dynamics` |
| **Community** | `/hub/community` |
| **Marketplace** | `/marketplace` |
| **Globe** | `/planet` |
| **World** | `/world` |

**6 VALUE-GROUP ASPECTS** — Overview · People · Activity · Resources · Values · Impact (§4).
They are **sections / subviews rendered inside a surface**, not routes. Today they are
implemented as the Community surface's own `?mode=` subviews.

**Vocabulary, binding:**

- **surface** = a product route (there are seven).
- **aspect** = a Value-Group section / subview (there are six).
- **"terminal"** is **retired** for the six-set. Do not reintroduce it for either set.

`WORLD` the aspect (§4 ①, now **OVERVIEW / ecosystem view**) and `/world` the surface are
different things: the aspect is the zoomed-out view of the Value-Group ecosystem; the surface
is the PUDM reference-architecture route.

---

## 5. The core user loop (A)
Every feature must serve one beat of this loop. Nothing else ships.
```
Person → Value → Situation/Need → Group/People → Action → Resources → Result → Reflection
```
Product verbs: **Discover → Orient → Join → Act → Measure → Reflect → Grow → Influence.**

---

## 6. Person schema (D) — 12 layers
```json
{
  "person_id": "",
  "identity":       { "name": "", "avatar": "", "headline": "", "region": "" },
  "core_values":    [{ "value_id": "", "rank": 1, "since": "" }],
  "beliefs":        [{ "statement": "", "stance": "" }],
  "interests":      ["domain"],
  "needs":          [{ "need_id": "", "description": "", "urgency": "" }],
  "capabilities":   [{ "capability_id": "", "level": "", "offered": true }],
  "knowledge":      [{ "topic": "", "evidence": [] }],
  "goals":          [{ "goal": "", "horizon": "" }],
  "relationships":  [{ "person_id": "", "type": "", "strength": 0 }],
  "action_history": ["event_id"],
  "trust":          { "score": 0, "basis": ["kept_commitments","helped","managed_budget","solved","verified"] },
  "privacy":        { "<field>": "public | matches_only | private" }
}
```
**The public profile shows only what the user approved.** The internal model powers matching but must never become covert surveillance.

---

## 7. Value Group schema (E) — the central unit

> **Status: implemented — reference vertical slice.** Validated for one seeded
> Value Group only; not yet generalized to multi-group production runtime. The log
> is now durable and has a writer (§0); what is still absent is multi-group runtime,
> identity/authentication, and live data.
```json
{
  "group_id": "", "name": "", "central_value": "", "secondary_values": [],
  "founder_id": "", "creation_reason": "", "opened_at": "", "region": "",
  "visibility": "public | private | invite", "status": "active | dormant | closed",
  "goal": "",
  "leaders": [{ "person_id": "", "role": "value|activity|resources|trust|community|connections",
               "appointed_by": "", "since": "", "term": "", "powers": [], "decisions": ["event_id"] }],
  "members": ["person_id"],
  "activity": { "today": ["event_id"], "projects": [], "tasks": [], "votes": [], "events": [], "requests": [] },
  "resources": { "money": {"in":0,"out":0,"available":0,"allocated":0},
                 "time_hours":0, "knowledge": [], "equipment": [], "spaces": [], "partners": [] },
  "allocation_proposals": ["allocation_id"],
  "transfers": ["transfer_id"],
  "value_forge": { "agreements": [], "conflicts": [], "complementary": [], "connected_groups": [] },
  "impact": { "people_affected":0, "goals_met": [], "resources_invested":0,
              "result_vs_investment":"", "failures": [], "next": "" }
}
```

---

## 8. Action lifecycle (7)
```
PROPOSED → OPEN → JOINED → IN_PROGRESS → COMPLETED → REFLECTED
                                     ↘ STALLED (needs people / resources / decision)
```
Every state transition is an **event**. On completion the action must state its effect on **people, values, and system state** — never a dead "submitted".

---

## 9. Resource-transfer lifecycle (F)
Supported flows:
```
user → user   ·   user → group   ·   group → user
group → group ·   group → project ·   project → supplier
```
Every transfer = a ledger entry:
```json
{ "transfer_id":"", "type":"", "source":"", "recipient":"", "amount":0, "resource_kind":"money|time|knowledge|equipment|service",
  "purpose":"", "value_tag":"", "approvals":[{"person_id":"","role":"","at":""}],
  "evidence":[], "status":"proposed|approved|executing|completed|reversed", "result":"" }
```
**Permission tiers:** small = auto-approve · medium = resources-lead approval · high = vote / trust committee · exceptional = risk review + full documentation. No free-for-all money movement.

---

## 10. Impact-verification model (I) + Trust & transparency (J)
Impact and reputation must separate **six evidence levels** — never collapse them:
```
claim  →  self-report  →  evidence  →  community verification  →  external verification  →  system inference
```
- **Never present inferred impact as verified fact.** Each impact figure carries its `verification_status`.
- **Transparency, not shaming.** A truth-table per person/group/project tracks: promises · actions · execution · budget · timeliness · results · consistency · trust — always distinguishing *claim vs self-report vs evidence vs community-verified vs external vs system-inference.*
- **Trust** is derived from kept commitments, helping, budget stewardship, problems solved, and verifications — **not** likes or followers.

---

## 11. Canonical Event Log (M) — the single source of truth

> **Status: implemented — reference vertical slice.** Validated for one seeded
> Value Group only; not yet generalized to multi-group production runtime. The log
> is now durable and has a writer (§0); what is still absent is multi-group runtime,
> identity/authentication, and live data.
**All feeds, statistics, timelines, budgets, profiles, impact, replay, and globe visuals derive from ONE event log.** No screen is built on separately-fabricated telemetry.
```json
{
  "event_id":"", "actor_id":"", "entity_type":"", "entity_id":"", "event_type":"",
  "value_tags":[], "resource_delta":{}, "location":{},
  "timestamp":"", "visibility":"", "evidence":[], "confidence":0,
  "impact_claim":{}, "verification_status":"", "caused_by":[]
}
```
`caused_by` (event_ids that produced this event) is declared here to match
`events.ts`; it is consumed by the **Dynamics Layer**
([`PHILOS-DYNAMICS-LAYER.md`](PHILOS-DYNAMICS-LAYER.md)). This paragraph said it was
"not yet populated by any seed event — declared-but-unused"; that is **out of date**.
Four seed events declare it (`valueGroupLog.ts` — the parents `e010`, `e040`, `e047`,
`e050`), and the `joinGroup` command writes one on every membership, so the field is
in live use on both the seeded and the recorded side. `resource_delta`'s non-money
kinds (§22) remain genuinely declared-but-unused.
**Known drift, not resolved here:** this JSON lists `location:{}`, but the
`PhilosEvent` interface in `events.ts` has **no** `location` field. Flagged for
reconciliation; deliberately left unchanged, as it is outside the `caused_by`
envelope contract this change introduces.

Derived projections: feeds · timeline · statistics · budgets · profiles · impact · globe · replay · daily summaries. *(An event model already sketched for the voice system — `docs/architecture/adr-003-event-model.md` — can inform this, but Philos needs its own value/resource/impact-typed log.)*

---

## 12. Hidden engines (L)
Behind the human surface — the user never operates these; they orient the user:
```
Identity Engine · Value Model · Context Engine · Need/Capability Model · Trust Ledger ·
Matching Engine · Group Engine · Resource Ledger · Action Lifecycle · Impact Engine ·
Event Log · Memory · Privacy Layer · Explanation Layer · World Projection
```
The Matching Engine runs continuously: *Who am I? → What do I believe? → Where do I fit? → Who should I meet? → What should I do? → What changes if I do it?*

---

## 13. Globe legend & interaction semantics (J)
The globe is the top visualization layer, revealed last. Per aspect it shows a different projection (OVERVIEW=activity, PEOPLE=relationships, VALUES=value clusters, ACTIVITY=action flows, RESOURCES=resource flows, IMPACT=outcomes). **Every node/line/color declares:**
`entity · relation type · value · action/event source · resource flow · time · confidence · strength · plain-language explanation` — and whether the link is **support, tension, need, or influence.** A permanent legend is always on screen. It is a map of meaning, never a control panel — and **no line exists until it represents a real event.**

---

## 14. The four journeys (12–15)
- **Beginner onboarding:** Welcome → *why me* → build profile (identity → values → interests → needs → capabilities → privacy) → orientation ("where you matter") → first action → first verified result → *only then* the world layer.
- **Daily use:** global daily summary + **personal daily summary** (actions, connections strengthened, value movement, contribution, thanks, people affected — separating *action taken / estimated impact / verified impact*).
- **Group-leader:** identity → members & roles → today's activity → budget & ledger → allocation proposals & votes → verified impact → accountability (who appointed, term, decisions, replaceability).
- **Resource-allocation:** propose → who receives / how much / which value / how many affected / risk → approval tier → vote → execution → **result after execution**.

---

## 15. Daily-life & global-statistics taxonomy (G, H)
Snapshot surfaces 5–7 of these; the rest live in Exploration/Research:
- **Global daily summary** · **personal daily summary** · new users · active groups · value-leaders · allocations · project progress · **verified** stories · impact reels · events · non-monetary prediction markets.
- **Global statistics** across five families: **People · Values · Activity · Resources · Impact**, plus regional distributions, continental impact, search demand, emerging values, progress, failures, verified outcomes.
- **Prediction markets** reward accuracy with reputation/trust/expertise — **never money**, never addictive betting.
- **Maps** show only measured activity (density, shortage, surplus, trust change, collaboration, flows) with source/time/confidence/sample — **never "national character" as objective truth.**

---

## 16. Privacy & exposure rules (18)
1. Nothing personal is public by default.
2. Public profile = only user-approved fields.
3. The internal model informs matching but is not covert tracking.
4. No indexes used to shame individuals.
5. Regional/aggregate stats require sample size + confidence and are dynamic aggregations of active users, not verdicts on cultures.
6. Consent is explicit and revocable.

---

## 17. Current-repository gap analysis (19)
**Exists today** (real data + schemas):

| Have | Count | Maps to |
|------|-------|---------|
| `values.json` + schema | 12 | Values / value system |
| `capabilities.json` + schema | 14 | Capabilities |
| `gaps.json` + schema | 14 | Needs / tensions |
| `missions.json` + schema | 12 | Situations |
| `providers.json` + schema | 15 | *partial* People/orgs |
| relations (value↔capability 75, provider↔capability 20) | 95 | edges |
| `personChain.ts` / `personStore.ts` | — | *partial* person model |
| UI: `/hub` (Today), `/hub/community` (Value Group), globe, surfaces | — | Snapshot + one Value Group shell |

**Missing — the core of this blueprint (must be authored):**
- **Event Log** (single source of truth) — today's screens use *fabricated* example numbers, not events. ⚠️ highest-priority gap.
- **Person** full 12-layer profile + **Privacy Layer**.
- **Value Group** entity (founder, leaders, roles, members, budget).
- **Resource Ledger** + transfers + approval tiers.
- **Trust Ledger** and **Impact-verification** (the six evidence levels).
- **Matching Engine** and the other hidden engines.

**Honest state:** we have an *ontology* (values/capabilities/gaps/missions) and *beautiful shells*, but **no people, no money, no events, no verified impact.** The blueprint's job is to close that, event-log-first.

---

## 18. Phased implementation plan (22 / deliverable 20)
1. **Product Architecture** — definitions, aspects, models, user path, meaning of every element. *(this document)*
2. **Information Architecture** — navigation, hierarchy, what's primary/secondary/on-click.
3. **Data Architecture** — Event Log · Person · Value Group · Action · Resource Transfer · Impact.
4. **Beginner Journey** — enter → understand → profile → values → join group → first action → first result.
5. **Value Group MVP** — identity · people · activity · budget · allocations · impact (from real events).
6. **World Layer** — statistics · continents · map · trends · flows (derived from events).
7. **Globe** — only after meaning + data exist and its lines represent real events.
8. **Visual System** — hierarchy · depth · motion · explanations · legend · onboarding.

**Guardrails:** no panels before a user path · no data without definition & source · no auto moral-scores · no exposure without consent · no shaming indexes · no regional stats without sample/confidence · no globe before real event-lines · no "impact" that's only an estimate · one question per screen · every action shows what changed.

---

## 19. Recommended next milestone (exactly one)
**Build ONE Value Group, end-to-end, backed by a real Event Log — not fabricated data.**

Concretely: the **"אחריות קהילתית"** group, where the screen answers, from real events:
*who opened it · who leads it (roles, appointment, trust) · who participates · what happened today · how many resources exist · which allocations are open · and what actually changed.*

This forces the three foundational pieces into existence together — **Event Log + Person + Value Group + Resource Ledger** — and produces the first screen whose every number is real and explainable. Everything else (World layer, globe, research) then derives from the same events.

*Deliverable order for the milestone: (1) Event schema + seed events → (2) Person + Value Group from those events → (3) the Value Group screen reading only from the log, with each figure showing source/verification.*

---

*Originally: "Nothing built." That milestone has since been built — the Event Log
and one Value Group exist (§0). The rule it stated still stands: implementation
proceeds from the Event Log outward, and the globe comes last.*

---

# Merged from PHILOS-PRODUCT-ARCHITECTURE.md

*The sections below existed only in that document. They are reproduced here so this
file is complete; that document is now a stub. Status per §0.*

## 20. The Value Forge (כור ההיתוך) — **planned**
Most systems connect people who share a value. Philos also stages **dialogue *between*
values.** The Value Forge shows the meeting points of different values:

```
   Truth × Freedom      Responsibility × Creativity      Equality × Security
```

Each meeting surfaces **where there is agreement**, **where there is tension**, and
**what shared actions already exist** across the two values. This turns
value-difference from conflict into coordination.

*Not implemented. `ValueGroupView` has no forge field; §7's `value_forge` key is
unpopulated.*

---

## 21. Value Leaders (not "managers") — **partially implemented**

> Roles only, for one seeded Value Group. Trust is **missing**, not partial.

Leadership is expressed as trusted contribution, not hierarchy. Each value-leader
shows **area of responsibility · trust level · contribution · recent activity · how
to reach them.**

*Implemented: role, role label, area, who appointed them, since when — from
`leader.appointed` events. Not implemented: trust level, contribution history,
contact. Trust in particular requires the Trust Ledger (§10), which does not exist;
invented trust scores were deliberately removed rather than left as placeholders.*

---

## 22. Community Resources (not just a bank account) — **partially implemented**

> Money only, for one seeded Value Group. Time, knowledge, equipment and
> service are declared in the type and used by no event.

"Budget" means **everything the community can draw on**, not money alone: **donations ·
volunteer hours · available expertise · equipment · collaborations · time · knowledge.**

*Implemented: money only — received, spent, committed, available, each with
provenance. `ResourceDelta` declares `time | knowledge | equipment | service` but no
event uses them yet.*

---

## 23. The Philos Core — the hidden engine — **planned**
The user does **not** operate the system. The system orients the user. The Core
continuously computes:

```
Who am I?  →  What do I believe?  →  Where do I fit?  →
Who should I meet?  →  What should I do?  →  What changes if I do it?
```

### The Matching Engine
```
User → Orientation → Value Profile → Context → Matching Engine
                                          ├── People        ├── Projects
                                          └── Communities   └── Actions
                                                    ↓
                                              Real Impact
```

The Core is meant to know: who you are, what you value, your capabilities, what you
seek, **where power is missing**, where you can contribute, which group you belong to,
which forge you should join, which people to meet, which actions to take.

**The user's activity cycle** — every screen is one beat of it, or a bridge to the next:
```
Discover → Orient → Join → Act → Reflect → Learn → Grow → Influence
```

*Not implemented. No Person entity, no value profile, no matcher.*

---

## 24. Design guardrails — **planned as a standard, partly violated today**
1. **Human on the surface, model-driven underneath** — never expose the ontology; express it in plain words.
2. **One skeleton everywhere** — six aspects, identical meaning at every scale.
3. **The system orients the user** — users don't navigate the architecture; it guides them.
4. **Progressive disclosure** — Value Group first, globe last.
5. **Everything is explained** — legend + on-demand meaning on every visual.
6. **Every action shows its real effect** on people, values, and system state.
7. **No sci-fi decoration, no extra panels** — clarity before spectacle.

*Guardrail 4 is satisfied — `/` enters at `/hub`, and the globe is reached from
there. Guardrail 5 is satisfied on the globe: a legend names every line and node
type, and each arc states its event on hover. Guardrail 7 is satisfied: the ontology
nodes, the decorative swarm, the invented HUD strings, the static live dot and the
fixed time scrub are all removed, and the debt this note used to record is closed.
One piece of decoration is left by choice — a CSS starfield behind the globe, which
asserts nothing and is guarded by test to stay that way. Guardrails 1, 2, 3 and 6
remain **planned**: the six aspects exist as a shared nav but not as a shared
projection, and no engine orients the user.*
