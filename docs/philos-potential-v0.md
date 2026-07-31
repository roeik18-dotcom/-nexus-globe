# Philos — Potential (C3) · v0

**Status: Candidate** — conceptual definition (ontology + detection + validation)
specified; empirical calibration pending. Answers research question **C3**.
Core principle: **Ontology ≠ Measurement** (the definition is stable; detection
mechanisms may evolve without changing it).

> **Potential is an ontological property. Detection produces *evidence about* that
> property — never the property itself.** (Ontology → Detection → Validation.)

---

## 1. Ontology — what Potential IS (stable)

> **Potential** = a person's **unactualized capacity to produce action,
> development, or contribution that has not yet been expressed in practice.**

- A **property of the person** — NOT relative to any system, scaffold, or
  intervention. (Two systems may *estimate* it differently; the entity is the
  person's, not the system's.)
- **Bounded**, not "any theoretical capacity": it is directed at realization in
  the world — *action / development / contribution* — which ties it to the
  existing Philos ontology (Action layer; C4 Development; D3 Contribution).
- **Differs from demonstrated ability:** demonstrated ability = capacity already
  *expressed / realized*; Potential = capacity *not yet expressed*.

## 2. Detection — how Potential is estimated (extensible)

> **Detection mechanisms *estimate* Potential; they do not *define* it.**

- **P1 · Scaffold Lift** — Vygotsky ZPD / dynamic assessment: the lift between
  supported and solo performance on a comparable task. Observable in a single
  session, *before* independent expression.
- **P3 · Constraint Removal** — Conservation of Resources + Philos's D6
  internal/external split: capacity present behind a *removable* external /
  structural constraint (vs an internal deficit).
- **Extensible:** new detection mechanisms (a future behavioral measure, an AI
  model, …) may be added here WITHOUT changing the ontology (§1).

**Measure (specified, uncalibrated):**
`scaffoldLift = norm(supported − solo)` ·
`constraintGap = capacity-evidence × removable-external-constraint` ·
`potentialSignal = f(scaffoldLift, constraintGap)` — an **estimate** of Potential,
not Potential itself.

## 3. Validation — how the ESTIMATE is assessed over time

> **Validation assesses the *quality of the Detection estimate* — not the
> existence of Potential itself.**

- **P2 · Trajectory** (longitudinal): does the estimated `potentialSignal` predict
  later *realized* action/development/contribution better than demonstrated
  ability alone?
- Requires a persistence / Evidence layer (F2) — **not yet built.**

## Hierarchy

```
Potential            (ontology — property of the person)
├── Detection        estimate:  Scaffold Lift (P1) · Constraint Removal (P3)   [extensible]
└── Validation       estimate-quality over time:  Trajectory (P2)
```

Potential — the ontological entity · Detection — an estimate of it · Validation —
assessment of the estimate's quality.

## Falsification

- **Construct-level:** if no detection mechanism's estimate predicts later
  expression better than demonstrated ability → the construct is not useful/valid,
  and the "potential before recognition" claim fails.
- **P1:** falsified if `scaffoldLift` carries no predictive signal for later solo
  achievement.
- **P3:** falsified if removing the identified constraint does not yield
  realization at the predicted rate.

## Differentiation (E4)

vs LinkedIn (measures *demonstrated ability* / past achievement) — Philos targets
*unexpressed* capacity (Potential), estimated **before** recognition.

## Dependencies / what this unblocks

- **Unblocks:** C4 (Development = trajectory of realized potential), D3
  (Contribution), F2 (Evidence layer records detection + validation).
- **Depends on:** C1 (Person — where potential is held), C7 (Dream — the direction
  against which potential is assessed), and a persistence layer for P2.

## Open (honest)

- The measure is **specified but uncalibrated** (calibration per
  `philos-calibration.md`; a hypothesis until validated against real outcomes).
- P2 (validation) is blocked by the missing persistence / Evidence layer.

## Out of Scope

This document defines **Potential only**. It does NOT define:
- **Development, Action, or Contribution** — the downstream chain (see
  `philos-development-chain-v0.md`).
- **Trust, Identity, or Person** (C5 / C2 / C1) — referenced, not defined here.
- The **persistence / Evidence layer** (F2) that P2 depends on.
- **Calibrated** thresholds — the measure is specified, not yet calibrated.
- Any **UI / presentation** of potential (that is the Experience Layer's job).

---

*Grounding frameworks: Vygotsky (ZPD / dynamic assessment), Hobfoll (Conservation
of Resources). Dweck (growth mindset) and Bandura (self-efficacy) inform WHY
scaffolding produces lift — supporting, not definitional. Status: Candidate v0,
2026-07-30.*
