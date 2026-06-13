# Philos Orientation Engine — Problem Definition

**Status:** Problem definition · v1.0 · **no code**
**Layer:** 4 (Orientation / Search) — sits above Layer 2 (Proof Engine)
**Depends on:** `app/lib/causalEngine.ts` (Verified Causal Graph),
`docs/philos-opm-spec.md`, `docs/philos-temporal-model.md` (resolves §4)

> This document defines a problem. It deliberately contains no implementation.
> The temporal prerequisite (§4) is now **resolved** in the Temporal Model;
> the remaining gate before non-advisory operation is **calibration** (§9).

---

## 1. Purpose

The Orientation Engine does **not** create or modify causal structure. Its role is
to **search, rank, and compare intervention plans** strictly within the set of
already-verified causal graphs.

```
Proof Engine (Layer 2)   defines what is ALLOWED.
Orientation Engine (L4)  ranks what is PREFERABLE — by a declared preference.
```

"Preferable" is not intrinsic. The engine ranks **by an explicit, authored
preference function** (§7), never by a preference buried inside the optimizer.
This keeps the value judgment visible and external — the same discipline as
consent-gated disclosure.

---

## 2. Core invariant — Verification precedes optimization

```
NO OPTIMIZATION OUTSIDE THE PROVEN-VALID GRAPH.
```

Every candidate plan must satisfy, without exception:

- Verified causal-graph constraints (acyclicity, provenance, declared deps)
- Wellbeing state-machine legality + continuity
- Consent-gated disclosure requirements
- Capacity constraints
- Carrier non-depletion (§6)

The Proof Engine defines the feasible set. The Orientation Engine only ranks
*within* it. Feasibility is a precondition of ranking, never a result of it.

**Companion invariant — authorship precedes selection (§12).** Ranking *within*
the feasible set is itself a value judgment. The engine may not collapse the
Pareto set to a single recommended plan without a **recorded, authorized
preference**. No platform-authored preference, ever.

---

## 3. Role separation

| | Proof Engine (L2) | Orientation Engine (L4) |
|---|---|---|
| Question | Can this plan work? | Which valid plan is best? |
| Method | Verification | Search / optimization |
| Output | valid / invalid (+ error codes) | ranked plans (+ objective values) |
| Robust to bad numbers? | Yes — checks structure only | **No** — see §9 |

---

## 4. Prerequisite — a temporal model (RESOLVED)

This prerequisite is closed by `docs/philos-temporal-model.md` (v1.0). Summary of
what the Orientation Engine may now rely on:

- **Time = causal (logical) time** — derived solely from the verified DAG's
  `dependsOn` order; concurrency-native; `time-order ⊆ causal-order` always, so
  time can never contradict proof.
- **Metric = optional duration `δ`** — a calibration overlay; unset `δ` defaults
  to `1`, degrading the timed model to pure causal time (still valid). `δ`-weighted
  objectives are **advisory** until `δ` is validated.
- **`gap(t)`** is piecewise-constant, sampled **post-transition**, one tick per
  Wellbeing transition.

Therefore `final gap`, `cumulative gap` (`∫ gap(t) dt`), and `peak gap`
(`max gap(t)`) are now all well-posed (§7). The remaining gate is calibration
(§9), not the time definition.

---

## 5. Decision variables

The recovery *state path* is essentially fixed by the FSM
(`Destroyed → Damaged → Fragile → Stable → Recovered`, adjacent-only) — there is
little freedom there. The real search space is the **allocation and schedule**:

For each eligible carrier `c` (`affinity(s, c) > 0`):
- burden assigned to `c`
- activation timing of `c` *(requires §4)*
- intervention ordering *(meaningful only if state/capacity is sequence-coupled)*
- intervention duration *(requires §4)*

This is a **Burden Allocation Problem**, not a Recovery Path Search.

---

## 6. Constraints

A plan is feasible iff it satisfies §2 **and**:

- **Eligibility:** assignment only to carriers with `affinity(s, c) > 0`.
- **Coverage accounting:** `gap = max(0, total_burden − Σ assigned(c))`.
- **Carrier non-depletion (cumulative over the episode):** capacity is
  **depletable and non-regenerating** within an episode (Temporal Model §10.2),
  so the constraint is over the whole schedule, not per tick:
  `Σ_t assigned(c, t) ≤ capacity(c)`. The `Burden Field` applies to carriers too —
  solving the survivor's gap by transferring collapse to a helper (burnout = new
  burden) is **infeasible by construction**, not merely undesirable.
- **Consent:** disclosure remains gated; no plan may assume publication the
  subject did not grant.

---

## 7. Candidate objectives (a trade-off, not a single scalar)

```
1. Final Gap        minimize  gap(t_end)
2. Cumulative Gap   minimize  ∫ gap(t) dt
3. Peak Gap         minimize  max_t gap(t)
```

(All three are now well-posed — the temporal model is resolved, §4.) These
conflict. Committing silently to one is itself a value judgment. The honest output
for a human-harm domain is the **Pareto frontier** across the three; *who* selects
the point on that frontier is governed by **preference authorship (§12)** — never
a platform-chosen weighting.

---

## 8. Feasibility & infeasibility

- **Under-capacity:** if `Σ capacity < total_burden`, zero gap is unreachable. The
  engine must return the **minimum-residual-gap** plan and report the uncovered
  remainder — it must not fail or pretend a full recovery exists.
- **Over-capacity / ties:** many plans may reach `gap = 0`; the chosen objective
  (and §7's frontier) breaks ties.
- **Empty feasible set:** if no plan satisfies §2+§6, the engine returns "no valid
  plan" with the binding constraint — never a best-effort plan outside the proven
  set.

---

## 9. Calibration requirement (the cost of crossing from proof to search)

The Proof Engine is robust to bad numbers — it checks structure only. The
Orientation Engine is **not**: the moment it optimizes, its output becomes a
recommendation a human may act on, and that recommendation is only as reliable as
the calibration of:

- burden
- capacity
- affinity
- recovery effects
- duration `δ` (Temporal Model §10.1 — unset `δ` defaults to `1`, i.e. pure
  causal time; `δ`-weighted objectives are advisory until `δ` is validated)

These are currently model-internal and **not externally validated**. Therefore:

```
Until calibration is externally validated, all Orientation Engine outputs are
ADVISORY, not decisional.
```

This is not a disclaimer of convenience — it is the boundary that prevents
confident, wrong recommendations in a dignity-critical domain.

---

## 10. Design note — verify by construction, not by inner loop

Re-running full `verifyCausalGraph` on every candidate is expensive and invites
the anti-pattern of searching invalid space and filtering. Preferred: encode the
verified constraints (§2, §6) as **feasibility predicates the generator respects**,
so candidates are valid *by construction*; full verification is then a final
confirmation, not the search loop. The invariant in §2 holds either way.

---

## 11. Open research questions

1. **Objective semantics** — which best represents human recovery: lowest final
   burden, lowest cumulative suffering, or lowest peak suffering? Likely answer:
   expose the trade-off (§7), do not pre-resolve.
2. **Temporal model** — *resolved* (`docs/philos-temporal-model.md`): causal time
   + optional duration; gap sampled post-transition; one tick per transition.
3. **Carrier dynamics** — *resolved for v1.0* (Temporal Model §10.2): capacity is
   depletable and non-regenerating within an episode; regeneration only via an
   explicit rest intervention (future).
4. **Preference authorship** — *resolved* (§12): subject-authored, explicit,
   recorded; platform never authors; community never overrides.

---

## 12. Preference authorship (resolved)

The objective and weighting that select a single plan from the Pareto frontier
(§7) encode a value judgment. This section fixes **who may author that preference**.
It is the consent principle generalized from *disclosure* to *selection*:
authorship gates selection exactly as consent gates disclosure.

### 12.1 Invariant — authorship precedes selection
The engine may not reduce the Pareto set to one recommended plan without a
**recorded, authorized preference** (author + time + authority basis). Absent one,
it **presents the frontier and selects nothing**.

### 12.2 Authority order
Each level applies only if every prior level is **genuinely unavailable**, and
every authorship act is recorded and revocable:

1. **Subject (survivor) — primary.** Subject-authored preference always has
   priority and supersedes any proxy at any time. Like consent, it is revocable
   and a later subject choice overrides an earlier proxy choice.
2. **Subject's prior directive.** A preference the subject authored earlier (an
   advance directive). Still the subject's own voice — outranks any proxy.
3. **Subject-designated proxy.** Someone the subject explicitly nominated.
   Legitimate *because* subject-authorized.
4. **Legally / ethically mandated guardian.** Only where law or ethics designates
   one (minor, adjudicated incapacity). Must be explicit and accountable.
5. **No authorized author → no selection.** The engine returns the Pareto set as
   advisory, flagged *"no authored preference,"* and chooses nothing. The platform
   still must not pick weights.

### 12.3 Hard rules
- **No platform-authored preference, ever.** The platform computes the feasible
  set (Proof Engine), presents the Pareto options with a plain explanation of what
  each costs, and records the authored choice — and stops there. No default scalar
  weighting, no pre-selected option, no nudge-by-default.
- **No implicit preference.** A selection with no recorded author is invalid. The
  absence of a preference means *present, don't choose* — never *use a hidden
  default*.
- **Community cannot author or override.** Community supplies capacity (Value
  Affinity), not values. It has **no authoring authority** over the subject's
  recovery preference and can never override the subject — directly or in
  aggregate. Community input, if surfaced at all, is information the subject may
  weigh; nothing more.
- **Conflict resolution.** Live subject > subject prior directive > proxy >
  guardian; community never. A proxy or guardian preference that conflicts with a
  known prior subject directive **loses** to the directive.
- **Transparency.** Every presented or selected plan records who authored the
  preference and under what authority; non-subject authorship is flagged to the
  subject when capacity returns, and remains revocable.

### 12.4 Why this matters (critical)
In a harm domain the subject is often least able to author preference exactly when
decisions are most urgent. Two failure modes are blocked by the above:

- **Silent platform defaults** — choosing "sensible weights" would make a value
  choice on the subject's behalf, invisibly. Forbidden by 12.3.
- **Community capture** — the community optimizing for *its* preferred narrative
  (e.g. maximize Exposure) over the subject's wish for privacy or lowest peak
  suffering. Forbidden by 12.3.

The cost is that, without an authorized author, the engine only *presents*. That
is acceptable: every presented option is already proven valid (Proof Engine), so
presenting-without-choosing is safe and honest — it never ships a value judgment
no one was authorized to make.

---

## 13. Relationship to Philos OPM

```
Philos OPM (L2)        proves that a recovery plan is structurally VALID.
Orientation Engine (L4) ranks the valid plans by a declared preference.

Proof precedes optimization.
The optimizer chooses among the proven; it never expands what is proven.
```

---

*End of problem definition (v1.0). §4 (temporal model) and §12 (preference
authorship) are resolved. The single remaining gate before non-advisory
implementation is §9 (calibration discipline).*
