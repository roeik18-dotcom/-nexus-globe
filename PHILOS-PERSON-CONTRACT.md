# PHILOS — PERSON CONTRACT (LOCKED)

- **LOCK_STATUS:** LOCKED — vocabulary and layer boundaries
- **SCOPE:** what "Person" means across the seven PHILOS product surfaces
- **SUBORDINATE TO:** [`PHILOS-MELTING-POT-CANON.md`](./PHILOS-MELTING-POT-CANON.md) (ontology) and
  [`PHILOS-SYSTEM-BLUEPRINT.md`](./PHILOS-SYSTEM-BLUEPRINT.md) (product)
- **PURPOSE:** stop one measurement layer from being presented as the whole person

> This document locks distinctions, not implementations. It adds no entity, no store,
> no measurement, and no relation that the canon does not already state.

---

## 1. PERSON

**Person = an identity anchor. Nothing else.**

```
Person = { person_id, display_name?, display_name_source ∈ {event | local}, classification }
```

A Person carries **no state, no score, no cell, no domain, no config, and no 9-cell model.**

Cited basis:
- Canon §25 (type boundary): `Person ≠ Observation ≠ CellState ≠ Need ≠ Target ≠ Offer ≠
  Resource ≠ Action ≠ Transfer ≠ Effect` — "A human being must never be represented as a
  cell value or a deficit identity."
- Canon §6: "Observation is a measurement of a cell, **never a property of the person**."
- Canon §19: "There is no universal human profile."
- Canon §21: `NO_GLOBAL_PERSON_SCORE`, `NO_PERMANENT_DEFICIT_PROFILE`.

**Explicitly not declared, and never to be declared without a canon amendment:**

- ❌ "Person = 9 cells"
- ❌ "Person = Body / Emotion / Cognition"
- ❌ "Person Now = the whole person"
- ❌ "Person = Human Config"

---

## 2. PERSON_PROFILE

**Persistent, config-sourced knowledge *about* a person.**

Human Config and Music Config are two instances of this one role. At runtime a profile is
addressed only as `CanonicalRef` strings (`HUMAN:<n>`, `MUSIC:<n>`, `COLOR:<n>`), never as
copied source text.

**CONFIG ≠ LIVE STATE.** A profile answers *"what is known about this person"*. It never
answers *"what is true right now"*. A config entry may be listed and counted; it may never
populate a Measure.

A profile is broader than, and not reducible to, the measured state space. Human Config's own
structure is `CONFIG FAMILY → Section → Heading → Canonical_ID` with four `Domain` values and
eleven `Section` values; neither factors into a 3×3 grid.

---

## 3. PERSON_CONTEXT

```
PersonContext = { person_id, reference_group, context, as_of }
```

- `reference_group` **may be UNKNOWN**.
- **No default reference group may be invented.** Canon §20: reference groups must be explicit
  and contestable by the subject; canon §21: `NO_DEFAULT_REFERENCE_GROUP`.
- Canon §19: `P = P(person, reference_group, context, time)` — a Level without a stated
  reference is not interpretable.

When `reference_group` is unknown, the word **UNKNOWN** renders beside the value. It is never
omitted, and never silently filled.

---

## 4. PERSON_MEASURED_STATE_SPACE

**The canon 3×3, and only that.**

```
Domain (G | E | C)  ×  Frame (I | R | S)  =  9 measurement cells

       I (individual)   R (relational)   S (systemic)
  G       G_I               G_R              G_S
  E       E_I               E_R              E_S
  C       C_I               C_R              C_S
```

- Each cell carries `CellState = (Level, Stability)` — canon §4.
- `Frame = S` cells are additionally keyed by `SystemicChannel`; this adds **no cells** (canon §18).
- Tension is **not** part of CellState (canon §4).
- No fourth Domain, no fifth Frame (canon §3).

**This is the measured state space. It is not the Person.**

> `PERSON ≠ 9 CELLS.`
> The 9 cells describe *what has been measured*, not *who someone is*. A person with one
> observed cell is not one-ninth described; they are a person about whom one measurement exists.

Aggregation rule: **none exists.** Canon §4 states no rule for combining multiple Observations
of one cell. Selection is therefore *most recent Observation per cell* — a chronological
selection, never an aggregation. Canon §21: `NO_CROSS_FRAME_AGGREGATION`.

---

## 5. PERSON_NOW_PRODUCT_SUMMARY

**A product summary composed from separately-sourced layers, assembled for one
`PERSON_CONTEXT`.**

It is **not** the Person (§1) and **not** the measured state space itself (§4). It is a view
that draws on several layers, each labelled with its own provenance and epistemic status.

Its honesty anchor is a permanent **coverage count** (e.g. "1 of 9 cells observed"), so a
partially-measured state space can never read as a complete person.

### 5.1 Input matrix (locked)

| Input | Status | Rule |
|---|---|---|
| Measured cells **+ coverage count** | **REQUIRED** | The count is required *with* the cells. Cells without coverage is a violation. |
| Context | **REQUIRED** | As a slot. Renders `UNKNOWN` until a real `reference_group` exists. |
| Active tensions | **REQUIRED slot** | ⚠ The current implementation is a **level-sign reading**, not canon Tension, and **must be labelled as such** until the Target/Tension canon task lands. See §7. |
| Needs | **REQUIRED** | Canon §12: Need is the sovereign subject-side entry into Matching. |
| Values | **OPTIONAL** | Interpretation-grade. Stamp STATIC. |
| Verified group relations | **OPTIONAL** | Membership only. Its relation to an Observation is separately UNRESOLVED and must say so. |
| Recent change | **OPTIONAL** | Per-cell, chronological only. |
| Evidence | **REQUIRED** | Canon §17: claimed must never render as verified. |
| Next action | **OPTIONAL / scope-labelled** | An unlabelled next action is forbidden. Semantics deferred to a separate task. |
| Config presented as state | **FORBIDDEN** | §2. |
| 6-Class mention presented as measurement | **FORBIDDEN** | §6. |
| Composite person score | **FORBIDDEN** | Canon §21 `NO_GLOBAL_PERSON_SCORE`. |
| Dominant domain / person level | **FORBIDDEN** | Canon §19, §21. |

---

## 6. CANON 3×3 ≠ 6-CLASS

Two different things that must never be conflated.

| | **Canon 3×3** | **6-Class** |
|---|---|---|
| Axes | Domain (G/E/C) × Frame (I/R/S) | Dimension (PHYSICAL/EMOTIONAL/COGNITIVE) × Orientation (INTERNAL/EXTERNAL) |
| Cells | 9 | 6 |
| Produces | `(Level, Stability)` — a **measurement** | `mentioned` + matched tokens — a **token mention** |
| Source | `Observation` fields | deterministic token match over `Observation.context` text |
| Provenance | CANON | STATIC (a rule over a real record) |
| May write state | yes, through the canon chain | **never** |
| Role | **measurement space** | **interpretation / token-mention layer** |

**Binding rules:**

1. `MENTIONED ≠ MEASURED.` A 6-Class hit may **cite** a cell. It may never **create, update,
   or select** one.
2. **`INTERNAL` / `EXTERNAL` must NOT be mapped to Frame `I` / `R` / `S`.** Two values against
   three, and no source document maps them.
3. The relation between the two models is **UNRESOLVED**, and stays UNRESOLVED unless a future
   canon amendment maps it explicitly.
4. The Dimension axis (PHYSICAL/EMOTIONAL/COGNITIVE) is *nominally parallel* to Domain
   (G/E/C). That parallel is **CANDIDATE_ALIGNMENT / REVIEW_REQUIRED** — no source asserts it,
   and no code may rely on it.

---

## 7. Known divergence — Tension (recorded, not fixed)

Canon §7 defines Tension as a derived relation from `(CellState, Target)`; canon §8 states
"Tension is not derivable without an explicit reference object."

The current implementation derives it from the **sign of Level alone** (`level < 0`), with no
`Target` involved. The codebase already records this itself, in
`app/lib/philos/canon/verticalSlice.ts`: *"Target's role stays a validated pass-through, never
a Tension input … no function in this codebase reads both a `CellState` and a `Target`
together to produce anything."*

**Until a separate canon task resolves this**, any surface rendering "Tension" is rendering a
level-sign reading and must be labelled accordingly. Nothing in this contract changes Tension
semantics.

---

## 8. UNKNOWN ≠ UNRESOLVED ≠ NOT_APPLICABLE

| Word | Means | Render |
|---|---|---|
| **UNKNOWN** | Representable; no record exists. | Name the missing record type. |
| **UNRESOLVED** | Records exist on both sides; no verified relation joins them. | Name both sides and why the join failed. |
| **NOT_APPLICABLE** | The concept does not apply here at all. | Name the reason. |

Never substitute one for another. Never render `0`, `—`, or an empty panel in their place.

---

## 9. Architecture note — MERLIN

**Merlin is a separate runtime beside PHILOS. Merlin is NOT the PHILOS Brain.**

Authoritative basis — `docs/architecture/rfc-000a-glossary.md` (RFC-000A, Runtime):
"Two named runtimes: **Merlin Runtime** (voice + execution) and **Philos Runtime**
(orientation + knowledge), joined by the Integration Layer."

- **Merlin may ingest Observations into PHILOS** — `POST /api/canon/observations`.
- **Merlin may consume PHILOS Orientation** — `GET /api/canon/observations/:id/orientation`.
- **PHILOS never gains execution authority from this contract.** Merlin remains authoritative
  for capability resolution, side-effect policy, approval policy, network scope, credentials,
  idempotency, execution, and verification evidence from tools.
- `/brain` is a PHILOS **product surface** — a view that renders interpretation of a stored
  Observation for a human reader. Merlin's Cognition stage is a **runtime process** inside an
  execution loop. **A view is not a process.**

**No Merlin code changes follow from this document.**

> ⚠ Open naming collision, recorded not resolved: the word "Philos" denotes both the
> seven-surface product and Merlin's Cognition/Orientation stage
> (`docs/MERLIN-OS-ARCHITECTURE-v1.md` §4.3, `rfc-020-orientation-engine.md`). RFC-000A's
> Orientation row still reads `Canonical source: ____ [U]`. Resolving it is a separate
> decision.

---

---

## 10. Related locks

- [`PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md`](./PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md) — the
  shared `EvidenceRef` / `NextActionRef` display vocabulary. It closes master §23 item 3, and it
  supplies the two fields this contract marks REQUIRED (§5.1 Evidence) and OPTIONAL/scope-labelled
  (§5.1 Next action): a next action without `scope` may not be rendered at all.
- [`PHILOS-SYSTEM-LANGUAGE.md`](./PHILOS-SYSTEM-LANGUAGE.md) — the system vocabulary, the
  chronology/hierarchy split, the seven terminals with their colors, the source→PHILOS
  translation layer, and the L1–L6 weights model (SOURCE/SYNTHESIS, **not** implemented).
  That model stays at SOURCE status and is **not promoted**: no terminal computes or renders
  `S`, `capacityScore`, or `readiness to act`. This is a non-promotion rule, not an open
  question — canon §21 (`NO_GLOBAL_PERSON_SCORE`, `NO_CROSS_FRAME_AGGREGATION`) constrains
  what the system computes about a person, not what a source document contains. A canon
  question would arise only if someone proposed to compute and display `S`.

**LOCKED.** Vocabulary and layer boundaries are locked; do not reopen without a demonstrable
contradiction against the canon.
