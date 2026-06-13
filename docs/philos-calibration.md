# Philos Calibration Requirements

**Status:** Requirement definition · v0.1 · **no code, no optimizer**
**Role:** The final gate before any *non-advisory* Orientation Engine recommendation.
**Depends on:** `docs/philos-opm-spec.md`, `docs/philos-orientation-engine.md` (§9),
`docs/philos-temporal-model.md` (§10.1)

> The Proof Engine is robust to bad numbers — it checks structure only. The moment
> Philos *ranks* and *recommends*, its output becomes something a human may act on,
> and its quality collapses to the quality of its numbers. This document defines
> what must be true of those numbers **before** any recommendation may be called
> decisional rather than advisory. Until then, everything quantitative is advisory.

---

## 0. The calibration boundary

```
Structure  (Proof Engine)      — safe with uncalibrated numbers; checks validity only.
Magnitude  (burden, capacity,  — UNSAFE until calibrated; drives ranking & recommendation.
            affinity, δ, recovery effects)
```

A model can be **perfectly valid and completely wrong**: a verified graph with
fabricated magnitudes will pass every Proof Engine rule and still produce a
harmful recommendation. Calibration is the discipline that closes that gap. It is
**not** a modeling task — it is an empirical, evidence-against-reality task.

**Invariant — calibration precedes recommendation.**
No quantity may drive a *decisional* recommendation until it meets the evidence
bar in §8 for that quantity. Uncalibrated quantities may still be **displayed**,
explicitly flagged `advisory · uncalibrated`.

---

## 1. What counts as real outcome data

"Real outcome data" is evidence generated **outside the model**, about **actual
people and cases**, that can confirm or refute a model magnitude. It must be:

1. **Observed, not assumed** — recorded from a real case, not authored by the
   modeler or inferred from the model's own outputs (no circularity — a model
   output is never its own evidence).
2. **Attributable** — tied to a specific case, time, and (consented) subject.
3. **Consented** — collected under the same Consent-Gated Disclosure authority as
   the rest of Philos (subject-authored; §12 of the orientation engine). Outcome
   data about a subject is itself subject-controlled.
4. **Comparable** — measured on a defined scale (§2–§6), repeatably, by more than
   one observer where the measure is judgment-based.

**Explicitly *not* outcome data:** model predictions, expert intuition presented
as fact, single anecdotes generalized, survey items with no defined scale, or any
metric derived from the model being calibrated.

**Sources, ranked by strength:** longitudinal case records with pre/post measures
> structured clinician/advocate assessments (multi-rater) > validated
self-report instruments > retrospective case review > expert estimate (lowest;
usable only as a *prior*, never as confirmation).

---

## 2. How burden is measured

`Burden Field B : N → ℝ≥0` (load per node). To calibrate:

- **Operational definition required.** "Burden" must map to an observable: e.g. a
  composite of demand indicators (unmet tasks, financial obligation, care load,
  legal steps outstanding) and distress indicators on a **validated instrument**,
  not an invented 0–100 number.
- **Per-node attribution.** Because burden is a *field over nodes*, measurement
  must attribute load to nodes (departments/persons), not just report a global
  total — otherwise concentration `κ` cannot be validated.
- **Conservation check.** The model claims redistribution is mass-preserving
  (`Σ B'(n) = Σ B(n) − r`). Calibration must test whether measured total burden
  actually behaves conservatively under real redistribution, or whether helping
  *creates/destroys* burden in ways the model omits.

**Calibrated when:** the operational burden measure correlates with an independent
distress/functioning outcome across a defined sample, with stated reliability.

---

## 3. How capacity is measured

`capacity(c)` — how much load a carrier can absorb (depletable, non-regenerating
within an episode; Temporal Model §10.2).

- **Observable proxy required.** Capacity must be grounded in something measurable
  (availability hours, financial ceiling, professional scope, emotional bandwidth
  via a validated measure) — not assumed uniform.
- **Depletion curve.** The non-regeneration assumption is a *claim about reality*.
  Calibration must check whether capacity actually depletes monotonically within an
  episode, or whether it regenerates (which would change §10.2 and the cumulative
  non-depletion constraint).
- **Carrier-burden coupling.** The model treats over-allocation as creating
  carrier burden (burnout). Calibration must measure that coupling: how much
  absorbed load translates into carrier distress, so the non-depletion constraint
  is set at a real, protective threshold — not a guessed one.

**Calibrated when:** the capacity proxy predicts actual sustainable absorbed load,
and the burnout threshold is set from observed carrier-distress data.

---

## 4. How value affinity is validated

`aff(p, q) = |vals(p) ∩ vals(q)|` — shared values predict carrying ability.

This is the **strongest model claim and the easiest to be wrong**: that shared
values predict effective, sustained help. Calibration must test the claim itself:

- **Construct validity** — do the recorded "values" actually correspond to what
  people hold, by an independent measure (not self-labeled tags)?
- **Predictive validity** — does higher affinity actually predict better carrying
  outcomes (more load sustainably absorbed, better recovery) than low affinity?
  If affinity does **not** predict outcome, the primitive is decorative and must
  not drive ranking.
- **Confound check** — separate affinity's effect from capacity, proximity, prior
  relationship, and obligation, which may be the real drivers.

**Calibrated when:** affinity demonstrably adds predictive power for carrying
outcomes beyond capacity/proximity alone. Until then, affinity may *rank
candidates for display* but must not be presented as a validated predictor.

---

## 5. How duration δ is estimated

`δ(n)` — the metric width of each tick (Temporal Model §10.1). Unset `δ = 1`
(pure causal time, valid but unweighted).

- **δ is the most fragile magnitude** — it weights the temporal objectives
  (`∫ gap dt`, `peak gap`) directly, so error in δ distorts which plan looks best.
- **Estimation source.** δ must come from observed real durations of interventions
  and state transitions (how long, in real cases, a survivor remains in each
  Wellbeing state under given support), with a stated distribution — not a single
  point guess.
- **Sensitivity requirement.** Before δ is trusted, run a sensitivity analysis:
  if plausible δ ranges change the recommended plan, δ is **not** ready and the
  objective must fall back to `δ = 1` (ordinal, advisory).

**Calibrated when:** δ is estimated from observed durations with uncertainty
bounds, and the recommendation is stable across those bounds.

---

## 6. How recovery effects are validated

The model claims interventions move Wellbeing along
`Destroyed → Damaged → Fragile → Stable → Recovered` and reduce gap.

- **Counterfactual is required.** "The survivor improved after intervention X" is
  **not** evidence that X caused it (regression to the mean, time, co-occurring
  support). Recovery-effect calibration needs a comparison condition — at minimum
  matched cases, ideally a control — or the effect sizes are uncalibrated.
- **Transition realism.** Validate that real recovery actually traverses adjacent
  states (no skipping) and that regressions occur where the model forbids/permits
  them; if reality skips states, the FSM granularity (§8 temporal) needs revision.
- **Per-intervention effect.** Effects must be attributed to specific intervention
  types, not to "support" in aggregate, or the engine cannot rank interventions.

**Calibrated when:** intervention→transition effect sizes are estimated against a
counterfactual, with uncertainty, per intervention type.

---

## 7. What remains advisory until calibrated

Until the bar in §8 is met **per quantity**, the following are advisory and must
be labeled as such on every surface:

- Any **gap magnitude** (`load`, `capacity`, `gap` numbers).
- Any **carrier ranking** (affinity-ordered lists).
- Any **temporal objective** (`∫ gap dt`, `peak gap`) — and, with `δ` unvalidated,
  these fall back to ordinal causal time.
- Any **recovery prediction** or **"Next move"** recommendation.
- Any **single selected plan** from the Pareto frontier.

What remains **trustworthy regardless of calibration** (because it is structural,
not magnitudinal):

- Verified causal validity (acyclicity, provenance, dependencies).
- Wellbeing state-machine legality + continuity.
- Consent-gated disclosure enforcement.
- Feasibility membership (a plan is in the proven-valid set or not).

This is the precise reason the current production system is honest: it ships
**structure** (proven) and presents **magnitude** as advisory.

---

## 8. Minimum evidence required before non-advisory recommendations

A quantity crosses from *advisory* to *decisional* only when **all** of the
following hold for that quantity:

1. **Operational definition** — a written, observable definition (§2–§6), not an
   abstract number.
2. **Independent measurement** — measured from real outcome data (§1), not model
   output; multi-rater where judgment-based, with stated reliability.
3. **Validity evidence** — construct + predictive validity demonstrated on a
   defined sample (for affinity and recovery effects, against a counterfactual).
4. **Uncertainty quantified** — point estimates carry intervals; δ and recovery
   effects carry distributions.
5. **Sensitivity-stable** — the recommendation does not flip within the
   quantity's plausible range (§5).
6. **External review** — calibration evidence reviewed by qualified domain experts
   independent of the model authors (clinical / advocacy / ethics), recorded.
7. **Subject-consented data** — all outcome data used was collected under subject
   authority (§1.3).

**System-level gate.** The Orientation Engine may issue a *decisional*
recommendation only for the subset of quantities that individually pass 1–7. A
recommendation that depends on any quantity not passing 1–7 is, by definition,
**advisory** — and must say so. There is no aggregate override: one uncalibrated
load-bearing quantity makes the whole recommendation advisory.

---

## 9. Relationship to the layers

```
Layer 2  Proof Engine        proves structure — needs no calibration.
This doc Calibration         grounds magnitude against real outcomes.
Layer 4  Orientation Engine  may recommend DECISIONALLY only over calibrated quantities;
                             otherwise it presents, ADVISORY.

Structure is proven. Magnitude must be earned. Recommendation waits for both.
```

---

*End of calibration requirements (v0.1). This is the last gate before a real
recommendation engine. No optimizer code may claim decisional output until §8 is
satisfied for every quantity that output depends on.*
