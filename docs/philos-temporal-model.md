# Philos Temporal Model

**Status:** Resolved · v1.0 · **no code** · all §10 decisions closed
**Unblocks:** `docs/philos-orientation-engine.md` §4, §7, §8 (objectives now have `t`)
**Depends on:** `app/lib/causalEngine.ts` (the Verified Causal Graph already *is* a partial order)

> This must be resolved before any Orientation Engine code. Without a temporal
> model, "cumulative gap" and "peak gap" reference a `t` that does not exist, and
> "optimization" reduces to *allocate burden* rather than *allocate burden over
> time*.

---

## 1. Purpose

Define the meaning of **time** inside Philos OPM — precisely enough that
`∫ gap(t) dt`, `max_t gap(t)`, intervention scheduling, and concurrency are all
well-posed, **without weakening the verified causal graph**.

---

## 2. Problem

Current Philos OPM is a static verified causal graph. It contains burden,
capacity, gap, and Wellbeing transitions — but **no temporal dimension**. Without
one:

```
no time → no schedule → no cumulative burden → no peak burden → no optimization
```

---

## 3. Core principle — derive time, do not bolt it on

The graph is **already a partial order**: `dependsOn` → DAG → topological order
(`projectToCausalSpine` already returns it). Time should be **derived from that
proven order**, not imposed as an independent wall-clock axis.

Why this matters:

- A wall-clock/discrete axis imposed externally can place an effect before its
  cause; you would have to *add* constraints `t(cause) < t(effect)` to stay valid.
- A time model **derived from the causal order** satisfies "preserve causal
  validity" **by construction** — `t` cannot contradict `dependsOn` because it is
  defined *from* it.

> **Principle:** Time is a reading of the verified causal order, not a new axis
> laid over it.

---

## 4. Requirements

The temporal model must:

1. **Preserve causal validity** — `t` must be monotone along `dependsOn`.
2. **Preserve FSM legality** — Wellbeing transitions remain adjacent + continuous.
3. **Support burden redistribution** — assignments can occur at distinct times.
4. **Support intervention ordering** — and its dual, *concurrency* (§6).
5. **Support cumulative and peak measurement** — i.e. define `gap(t)` *between*
   events (§7), not only at event points.

---

## 5. Candidate models

### A. Discrete wall-clock steps  `t ∈ {0,1,2,…}`
Each intervention occurs at a step.
- **+** simple, easy to reason about.
- **−** artificial granularity; **forbids concurrency** if one event per step;
  does **not** preserve causal validity for free (needs added ordering
  constraints).

### B. Event time
Time advances only when a verified event occurs.
- **+** closer to causal semantics than (A).
- **−** events are **instantaneous** → no native notion of **duration**, which
  allocation needs; ordering of *independent* events is left ambiguous.

### C. Causal (logical) time — *new, recommended skeleton*
`t(n) = ` topological layer of node `n` in the verified DAG
(`t(n) = 1 + max over d∈dependsOn(n) of t(d)`, roots at `0`).
- **+** monotone along `dependsOn` **by construction** (Req 1 free); **concurrency
  is native** — independent nodes share a layer (§6); reuses the already-proven
  structure, adds no new axis.
- **−** purely ordinal — no metric duration on its own (addressed by §5.D).

### D. Timed Causal Graph — *recommended full model*
**Causal time (C) as the skeleton + an optional duration metric layered on top.**
Each node/intervention may carry a duration `δ(n) ≥ 0`; real timestamps are
assigned by any monotone embedding of the causal layers that respects durations.
- **+** keeps (C)'s causal-validity-and-concurrency guarantees **and** gives the
  metric needed for `∫`, `max`, scheduling, and duration-aware allocation.
- **−** more to specify; duration values become part of the calibration surface
  (see Orientation Engine §9).

---

## 6. Concurrency (a hard requirement, not a nicety)

In Case Zero, `classifying` and `harming` are both roots (`dependsOn: []`) →
they sit at the **same causal layer** → they are **concurrent**. Multiple carriers
also act in parallel. A model that serializes everything (naive A) therefore
**mis-measures cumulative gap**. The temporal model must permit *simultaneous*
events at the same logical time. This is the decisive argument for (C)/(D) over (A).

---

## 7. `gap(t)` sampling semantics

To make `∫ gap(t) dt` and `max_t gap(t)` well-defined, `gap` must be a function of
time, not just a value at event points. Define it **piecewise-constant** between
successive transition times `t_i`:

```
gap(t) = gap_i           for t ∈ [t_i, t_{i+1})
∫ gap(t) dt = Σ_i gap_i · (t_{i+1} − t_i)
peak gap     = max_i gap_i
```

**Sampling convention — post-transition (resolved, §10.4).** `gap_i` is sampled
**after** layer `i`'s transitions are applied, and held until the next tick. You
endure the state you are *in* during an interval, which is the post-transition
state of the layer you just entered: the moment Harming collapses Wellbeing into
`Destroyed`, the high gap begins and is counted until Responding acts. Sampling
*before* the transition would under-count the suffering actually endured.

Under pure causal time (C, no durations) all `Δt = 1` and `∫` degenerates to a
sum over layers; under the timed model (D) `Δt = δ` carries real weight.

---

## 8. FSM-to-time granularity (must be pinned)

A single stage may perform several Wellbeing transitions (e.g. `harming` does
`Stable→Fragile→Damaged→Destroyed`). The model must declare whether time advances
**per transition** or **per stage**. Recommended: **per transition** — each FSM
edge is a temporal tick — so the collapse and the climb are measured at the
resolution at which they actually occur. This keeps `gap(t)` faithful to the
state trajectory rather than to stage boundaries.

---

## 9. Recommendation

```
Skeleton : Causal (logical) time     — derived from dependsOn, concurrency-native
Metric   : optional duration δ(n)    — added only where allocation needs it
Together : a Timed Causal Graph
gap(t)   : piecewise-constant between transition ticks
Ticks    : one per Wellbeing transition
```

Neither A nor B alone. (C) gives validity + concurrency for free; (D) adds the
metric the Orientation Engine's objectives require — without ever introducing a
time axis that could contradict the proven causal order.

---

## 10. Resolved decisions

The six focus points, closed. These are now normative for v1.0.

**10.1 — Source of duration `δ`.** `δ` is **not intrinsic** to the verified graph;
it is a **calibration-sourced metric overlay**. Absent calibrated values, `δ = 1`
for all ticks — which collapses the timed model (D) back to **pure causal time
(C)**, still fully valid, merely unweighted. Therefore the system **degrades
gracefully**: no calibration → ordinal causal time → proof intact. Any
`δ`-weighted measure (`∫ gap dt`, `peak gap` in real time) is **advisory** until
`δ` is externally validated (ties to Orientation Engine §9). Note: *which*
weighted measure is selected is **not** the temporal model's to decide — the
choice of objective/weighting is governed by **preference authorship** (Orientation
Engine §12), never platform-chosen.

**10.2 — Capacity regeneration over time.** For v1.0, carrier capacity is
**depletable and non-regenerating within a recovery episode**. `capacity(c)` is
non-increasing as `c` absorbs burden; it does **not** auto-replenish between
ticks. Auto-regeneration would let the optimizer assume effectively infinite
carrier capacity over time and **hide burnout** — the exact danger §6/non-depletion
guards against. Regeneration exists only as an **explicit, modeled rest
intervention** (out of scope for v1.0). Consequence: the non-depletion constraint
is **cumulative over the episode**, not merely per-tick: `Σ_t assigned(c, t) ≤
capacity(c)`.

**10.3 — Simultaneous transition conflicts.** **Forbidden, by rule.** Concurrency
is allowed across *different* subjects, but all transitions on the **same**
stateful subject (e.g. `Survivor.Wellbeing`) must be **causally ordered** —
"single-writer per subject." Two same-layer (concurrent) nodes may not both
transition the same subject. This is a new **Proof Engine verification rule**
(proposed code `CONCURRENT_STATE_WRITE`) to be added when Layer 4 code begins; it
guarantees the running state — and thus `gap(t)` — is always well-defined. The
graph stays a partial order; each subject's transitions form a total order within it.

**10.4 — `gap(t)` sampling: after, not before.** Resolved in §7 — gap for the
interval `[t_i, t_{i+1})` is the **post-transition** value at `t_i`. Suffering
endured = the state you are in, counted from the moment you enter it.

**10.5 — Temporal layers derived only from verified topology.** **Yes — and
strictly.** The temporal **order** is derived **solely** from `dependsOn` (the
verified DAG). Durations `δ` only set interval *widths*; they can **never
reorder**. Formally: the temporal order is always a linear extension of the causal
partial order — `time-order ⊆ causal-order`, always. Time therefore cannot
contradict proof.

**10.6 — No code.** This is a definition. Implementation (including the
`CONCURRENT_STATE_WRITE` rule and the timed projection) begins only after this
bundle is agreed and committed.

---

## 11. Relationship to the layers

```
Layer 2  Proof Engine        defines the partial order (dependsOn).
§3–§9    Temporal Model       reads that order as time (skeleton) + duration (metric).
Layer 4  Orientation Engine   schedules & optimizes over that timed model.

Time is derived from proof. Optimization runs over derived time.
Neither ever expands what the Proof Engine has proven.
```

---

*End of temporal model (v1.0, resolved). All six §10 decisions closed. Remaining
gate before non-advisory operation is calibration of `δ` and the burden/capacity
numbers (Orientation Engine §9) — not the temporal definition.*
