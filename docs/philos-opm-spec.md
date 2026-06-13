# Philos OPM — Verified Human Systems Causal Model

**Status:** Normative draft · v0.1
**Reference implementation:** `app/lib/causalEngine.ts`, `app/lib/opm.ts`, `app/lib/burdenNarrative.ts`
**Verified against:** Case Zero (Noa), production commit `6890aaf`

---

## 0. Scope and intent

This document specifies **Philos OPM** as a formal modeling method, not a UI. Philos
OPM is a profile that sits *next to* classical Object-Process Methodology (OPM /
ISO 19450, as implemented in tools such as OPCloud) and adds the primitives
required to model, verify, and act on **human systems under harm and recovery**.

Two design commitments distinguish it from a visualization:

1. **Causality is proven, not drawn.** The causal spine is a typed graph that is
   machine-verified. A model that cannot be verified does not render and does not
   ship (`§8`).
2. **The subject has authority.** Disclosure of the classified event is gated by
   the subject's consent at the level of *representation*, not merely process
   enablement (`§4.4`).

Terminology note: "OPM" in classical usage = *Object-Process Methodology*. In
this project the UI panel is historically called "OPM" = *Operational Process
Map*. This spec uses **classical OPM** for the former and **Philos OPM** for the
method defined here. The acronym collision is incidental, not a lineage claim.

---

## 1. The six primitives (overview)

| # | Primitive | Kind | Not expressible in classical OPM as |
|---|-----------|------|-------------------------------------|
| 1 | Burden Field | conserved quantity over nodes | a redistributable, conserved mass |
| 2 | Capacity–Load–Gap | per-node deficit triple | a quantitative coverage gap |
| 3 | Value Affinity Link | weighted relational link | "shares value ⇒ can carry burden" |
| 4 | Consent-Gated Disclosure | representation gate | subject-authored visibility of typing |
| 5 | Wellbeing State Machine | typed FSM with continuity | a continuity-checked recovery trajectory |
| 6 | Verified Causal Graph | typed DAG + verifier | a *proven* causal chain, not asserted |

Classical OPM can *describe the topology* of all six. It cannot **compute**,
**rank**, **enforce consent on representation**, or **fail a build** when the
causal story is false. That gap is the reason Philos OPM exists (`§9`).

---

## 2. Primitive 1 — Burden Field

### 2.1 Definition
Let `N` be the set of nodes (departments or persons). A **Burden Field** is a
function

```
B : N → ℝ≥0
```

assigning a non-negative load to each node. The **total burden** is

```
T = Σ_{n∈N} B(n)
```

A **redistribution operator** `R : B → B'` is *mass-preserving up to recovery*:

```
Σ B'(n) = Σ B(n) − r      with recovery r ≥ 0
```

and reduces the **concentration index**

```
κ(B) = max_{n} B(n) / T        κ ∈ (0, 1]
```

`κ → 1` means burden is concentrated on one node (the Philos failure mode);
`R` lowers `κ` by moving mass to nodes with spare capacity (`§3`, `§4`).

### 2.2 Reference
`loadModel`: `beforePct` (≈ 100% on one person) → `afterPct` + `communityPct`;
`distributedLoad` is `Σ` of capacity routed in.

### 2.3 Classical-OPM gap
OPM effect links are **qualitative** state changes. OPM has no conserved scalar
field and no notion of "the same burden moved from A to B." Aggregation is
whole–part, not mass transfer.

---

## 3. Primitive 2 — Capacity–Load–Gap

### 3.1 Definition
For each node `n`, a **Quantity** is the pair

```
Q(n) = (load L(n), capacity C(n))     L, C ∈ ℝ≥0
gap(Q)      = max(0, L(n) − C(n))
isCovered(Q) = gap(Q) = 0
```

`gap` is the uncovered burden — the actionable deficit. The system's objective is
`Σ_n gap(Q(n)) → 0` via redistribution and recovery.

### 3.2 Reference
`Quantity`, `gap()`, `isCovered()` in `causalEngine.ts`;
`OpmDepartment.{load, capacityApplied, missingCapacity}` in `opm.ts`.
Verified: `gap({load: 80, capacity: 55}) = 25`.

### 3.3 Classical-OPM gap
OPM has no per-node quantitative deficit primitive. The closest analogue —
attributes with values — carries no `max(0, L−C)` semantics and no aggregate
objective.

---

## 4. Primitive 3 — Value Affinity Link

### 4.1 Definition
Let `V` be the value set
`{Dignity, Autonomy, PersonalSecurity, Trust, Truth, Justice, Protection, Responsibility}`.
Each person `p` has values `vals(p) ⊆ V` and a capacity `cap(p) ∈ ℝ≥0`.

The **affinity** between two people is the count of shared values:

```
aff(p, q) = | vals(p) ∩ vals(q) |
```

A person `q` is an eligible **carrier** for a victim `s` iff

```
carrier(s, q) ⇔ aff(s, q) > 0 ∧ cap(q) > 0
```

Carriers are ranked by `aff` then `cap` (descending). Burden is allocated to
carriers in that order — the value-network that absorbs the Burden Field (`§2`).

### 4.2 Reference
`affinity()`, `rankCarriers()`; role→value map in `loadModel`
(`lawyer↦Justice, therapist↦Protection, journalist↦Truth, donor↦Responsibility,
peer_survivor↦Dignity`).
Verified: for `Noa{Dignity, Autonomy, Trust}` over a pool, ranking is
`peer(aff 3) > therapist(aff 1)`; a lawyer with `{Justice, Truth}` is excluded
(`aff 0`).

### 4.3 Classical-OPM gap
OPM structural links are aggregation (whole–part), generalization (is-a),
exhibition (has-attribute), classification (instance-of). None expresses a
**weighted "shares-value-with ⇒ can-carry-burden-for"** relation. It is a new
relational primitive.

### 4.4 Note on directionality
Affinity is symmetric (`aff(p,q) = aff(q,p)`); *carrying* is directional
(`s` receives, `q` gives) and additionally gated on `cap(q) > 0`.

---

## 5. Primitive 4 — Consent-Gated Disclosure

### 5.1 Definition
Let a **Classification** be `c = (typeHe, typeEn)` and **Consent**
`k ∈ {withheld, granted}`, where the authority over `k` is the **subject's**.
Disclosure is the function

```
D(c, k) =
  granted  ↦ ( classified = true,  label = c,                 status = "approved for community publication" )
  withheld ↦ ( classified = false, label = privacy-safe term, status = ∅ )
```

The classified type is **never typed into the artifact** unless `k = granted`.
This is a gate on **representation**, distinct from a gate on process execution.

### 5.2 Reference
`disclose()` in `causalEngine.ts`; `resolveEventDescriptor()` in
`burdenNarrative.ts`.
Verified: `granted → "הטרדה מינית"`; `withheld → "A severe violation"`.
Structurally enforced: see invariant `V5` (`§7`).

### 5.3 Classical-OPM gap
OPM's **condition link** gates whether a *process runs*. Consent-Gated Disclosure
gates whether an *object's classification is representable at all*, with authority
vested in the modeled human subject. OPM has no privacy/authority semantics over
representation.

---

## 6. Primitive 5 — Wellbeing State Machine

### 6.1 Definition
A typed finite state machine over the ordered states

```
Destroyed < Damaged < Fragile < Stable < Recovered     (indices 0..4)
```

Let `idx : State → {0..4}`. A transition `from → to` is **legal** iff it moves
exactly one adjacent step:

```
legal(from, to) ⇔ | idx(from) − idx(to) | = 1
```

Harm moves down the spine; recovery climbs up. **No non-adjacent jumps** — a
collapse from `Stable` to `Destroyed` must traverse `Fragile` and `Damaged`, and
recovery must traverse every intermediate state.

### 6.2 Continuity
A stage declares transitions `(subject, from, to)`. Evaluated in causal order, a
transition is admissible iff its `from` equals the subject's **running state**.
This converts numeric jumps (`Trust = 22 → 48`) into a checked trajectory.

### 6.3 Reference
`Wellbeing`, `WELLBEING_STATES`, `isLegalTransition()`, `checkContinuity()`.
Verified Case Zero trajectory:

```
Values Harmed      : Stable → Fragile → Damaged → Destroyed   (collapse)
Community Response : Destroyed → Damaged → Fragile            (first stabilization)
Recovery           : Fragile → Stable → Recovered             (recovery)
```

### 6.4 Classical-OPM gap
OPM supports states and state-transition (effect) links, so a *single* labeled
transition is expressible. What OPM does not provide is **machine-checked
continuity across an ordered causal chain** — the guarantee that the running
state actually equals each stage's declared precondition.

---

## 7. Primitive 6 — Verified Causal Graph

### 7.1 Definition
A **Causal Graph** is `G = (Nodes, sources, initialStates)` where each node
declares four things — *inputs, outputs, state transitions, causal
dependencies*:

```
CausalNode = {
  id, title,
  inputs       : Link[]   // consumes | enables | gates
  outputs      : Link[]   // produces  | transforms
  transitions  : StateTransition[]
  dependsOn    : NodeId[]
}
Link = { type, resource, state? }
```

Link types are typed, not decorative:

| type | meaning | creates a dependency? |
|------|---------|-----------------------|
| `consumes` | requires and uses up an input | yes |
| `produces` | yields an output resource | — |
| `transforms` | changes a resource's state | — |
| `enables` | instrument/agent that must exist | no (presence only) |
| `gates` | condition state that must hold | no (presence only) |

The UI spine is a **projection** of `G` (`projectToCausalSpine`), in verified
topological order — derived, never hand-authored.

### 7.2 Verification rules
`verifyCausalGraph(G)` returns `{ ok, errors[], order }`. `ok` requires **all**:

- **V1 — Referential integrity.** Every `dependsOn` id exists. *(else `DEP_MISSING`)*
- **V2 — Acyclicity.** `G` is a DAG; Kahn topological sort consumes every node. *(else `CYCLE`)*
- **V3 — Provenance + declared dependency.** Every `consumes`/`transforms` input is a `source` or `produces`d upstream, **and** its producer is a transitive `dependsOn`. *(else `INPUT_UNPRODUCED` / `DEP_NOT_DECLARED`)*; enablers/gates must at least resolve *(else `ENABLER_MISSING`)*.
- **V4 — State continuity + legality.** Evaluated in topological order, each transition's `from` equals the running state and is an adjacent edge. *(else `STATE_DISCONTINUITY` / `ILLEGAL_TRANSITION` / `NO_INITIAL_STATE`)*
- **V5 — Consent invariant.** Any node producing `EventType.published` must hold a `gates` input `PublicationConsent` at state `granted`. *(else `CONSENT_UNGATED`)*

### 7.3 Verified fault detection
The verifier is shown to **reject** broken graphs, not just accept the good one:

```
drop consent gate     → CONSENT_UNGATED@classifying
inject cycle          → CYCLE, DEP_NOT_DECLARED@impacting
undeclare dependency  → DEP_NOT_DECLARED@impacting
illegal state jump    → ILLEGAL_TRANSITION@recovering
```

### 7.4 Classical-OPM gap
OPM/OPL is a specification language; consistency is a tooling concern, not an
intrinsic, executable gate. Philos OPM ships the verifier *as the model* and
binds rendering and deployment to it (`§8`).

---

## 8. Case Zero — the verified flow

The canonical instance `PHILOS_CASE_ZERO`. Sources:
`Event`, `PublicationConsent`, `Community`. Initial state:
`Survivor.Wellbeing = Stable`.

```
                       gates PublicationConsent=granted
                              │
   ┌──────────────────────────▼─────────────────────────────────────────────┐
   │ classifying — "Event Classification"                                    │
   │   gates  PublicationConsent@granted ; enables Community                 │
   │   produces EventType.published                  (V5 satisfied)          │
   └──────────────────────────────────────────────────────────────────────────┘
        (independent — no Wellbeing transition)

   harming — "Values Harmed"             enables Event
        produces AffectedValues.harmed
        Wellbeing: Stable → Fragile → Damaged → Destroyed
                              │ dependsOn
   impacting — "Impact"        ▼  consumes AffectedValues.harmed
        produces Impact
                              │ dependsOn
   responding — "Community Response" ▼ consumes Impact ; enables Community
        produces CommunityResponse
        Wellbeing: Destroyed → Damaged → Fragile
                              │ dependsOn
   recovering — "Recovery"     ▼  consumes CommunityResponse
        produces Recovery
        Wellbeing: Fragile → Stable → Recovered
```

Verified topological order:

```
classifying → harming → impacting → responding → recovering
```

Mapped to the UI spine the public sees:

```
Event Classification → Values Harmed → Impact → Community Response → Recovery
```

Display taxonomy per stage (content only; order is the graph's):

| Stage (node) | UI key | Items (he · en) |
|---|---|---|
| classifying | event | consent-gated classification + approval badge |
| harming | values | כבוד·Dignity, אוטונומיה·Autonomy, ביטחון אישי·Personal Security, אמון·Trust |
| impacting | impact | נטל נזק·Harm Burden, דליפת אנרגיה·Energy Leakage, פגיעה תפקודית·Functional Impairment, אובדן אמון·Trust Loss |
| responding | community | תמיכה·Support, אימות·Validation, חשיפה·Exposure, מימון·Funding |
| recovering | recovery | שיקום·Rehabilitation, השבת אמון·Trust Restoration, חזרה לתפקוד·Return to Function, הזדמנויות חדשות·New Opportunities |

The numeric Burden/Capacity/Gap, energy-leakage, and orientation metrics remain a
**separate, secondary** layer ("Measured Effects"); the causal spine is primary
("Causal Path"). Event Classification and consent behavior are unchanged.

---

## 9. What classical OPM alone cannot do

Classical OPM can *describe* the Case Zero topology (objects, processes, links).
It cannot, without leaving the methodology:

1. **Compute** the Burden Field, gaps, leakage, or orientation — OPM is a
   specification language, not a quantitative engine.
2. **Rank carriers** by value affinity — there is no weighted value-network link.
3. **Enforce consent on representation** — condition links gate process execution,
   not whether a classification may be typed into the artifact, and OPM has no
   subject-authority semantics.
4. **Guarantee continuity** of a recovery trajectory across an ordered chain.
5. **Fail a build** when the causal story is internally false.

Philos OPM's irreducible operational purpose is therefore: *given a case,
quantify where burden concentrates, rank the value-aligned people who can absorb
it, compute the resulting recovery trajectory, gate disclosure on the subject's
consent, and refuse to ship if the causal model does not verify.* That output is
a **decision** plus a **privacy-safe public artifact**, neither of which is
derivable from a classical OPM model alone.

---

## 10. Why build-time failure matters

The guard in `opm.ts` runs at module import:

```ts
const r = verifyPhilos();
if (!r.ok) throw new Error("Philos causal graph failed verification …");
```

Because `opm.ts` is imported during Next.js static generation, a non-verifying
graph **fails `next build` and server start**. Consequences:

- **No silent false causality.** A cycle, an undeclared dependency, an illegal
  Wellbeing jump, or an ungated consent disclosure stops the deployment instead
  of shipping a plausible-but-unproven story.
- **The proof is a release gate, not a lint suggestion.** Verification is on the
  critical path to production (`tsc → build → deploy`), so the invariants in
  `§7.2` hold for every shipped commit (e.g. `6890aaf`).
- **Dignity-critical safety.** In a human-harm domain, an unverifiable causal
  claim is a liability. Binding rendering to a passing proof makes "the model is
  wrong" a *loud build error*, not a production incident.

This is the line that moves Philos from a screen to a method: the model is only
considered to exist if it verifies, and it only ships if the verification passes.

---

## 11. Relationship to classical OPM (summary)

Philos OPM is **not** an application of classical OPM, and **not** a metamodel
extension of it. It is an **independent, verifiable profile** that:

- reuses OPM's intuition (objects, processes, typed links, states),
- adds six primitives OPM lacks (`§1`),
- replaces "draw the chain" with "prove the chain" (`§7`),
- and binds the proof to the build (`§10`).

A future convergence path exists: express the six primitives as a documented OPM
extension profile and emit OPL alongside the verified graph, gaining OPM's
standardized interchange without losing Philos's computation, consent, and
build-time guarantee. That convergence is out of scope for v0.1.

---

*End of specification v0.1.*
