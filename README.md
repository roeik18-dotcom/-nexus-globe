# Philos — Falsification Program

> A structured falsification program investigating whether sacred values exhibit
> a behavioral hysteresis signature that cannot be reduced to ordinary strong preferences.

---

## What this is

This repository contains two separate things:

1. **A Next.js application** (`app/`) — a prototype for human-orientation tooling (Nexus, Proof Lab, etc.). See `app/` for details.
2. **A falsification program** (`research/`) — a structured sequence of tests designed to kill the core scientific hypothesis before building anything on top of it.

The sections below describe the falsification program. For the application, see `docs/philos-orientation-engine.md`.

---

## The core hypothesis

**Sacred values** (values treated as protected absolutes, not as high-utility preferences) exhibit **behavioral hysteresis**: when pressure toward violation is applied then removed, the system does not return to its prior state along the same path.

This is distinct from ordinary strong preferences, which show resistance to trade-off but no path-dependence.

If the hysteresis signature is absent, or if it is fully reducible to a standard preference model without additional structure, this research program terminates. See §Termination Conditions below.

---

## Knowledge state map

Every claim carries an evidence level:

| Level | Meaning |
|---|---|
| **A** | Replicated in code — result reproduced by simulation |
| **B** | Analytical argument — derivable from model assumptions |
| **C** | Literature-supported — established in cited prior work |
| **D** | Hypothesis — not yet tested |

| Claim | Status | Level | Stage |
|---|---|---|---|
| Single-level Gaussian FEP (locked null model) does not produce hysteresis | **Supported** | A | Stage 0a |
| Any linear landscape with fixed precision produces h = 0 | **Supported** | B | Stage 0a (analytic) |
| 2-latent reductions of the null model also produce h ≈ 0 | Not yet tested | — | Stage 0b (planned) |
| Non-linear landscape (hard exclusion boundary = cliff) produces h > 0 | Not yet tested | — | Stage 0c (planned) |
| Hysteresis in non-linear model is not an artifact of GD step size | Not yet tested | — | Stage 0d (planned) |
| Hysteresis is NOT derivable from FEP with standard priors alone | Not yet tested | — | Stage 0e (planned) |
| Action-conditioned model with value boundary reproduces hysteresis | Not yet tested | — | Stage 0e (planned) |
| Full Adams et al. MDP formulation reproduces the same mechanism | Not yet tested | — | Stage 0e.1 (planned) |
| Sacred values differ dynamically from matched high-utility preferences (D4) | Not yet tested | — | Stage 1 (planned) |
| Subject-authored evidence accumulation produces different opportunities than observer-extracted reputation | Not yet tested | — | Stage 2 (planned) |
| 5-var Marketplace constraint graph (linear) converges uniquely | **Supported** | A | Stage 0b-arch |
| 5-var constraint graph: convergence holds across α × β parameter space | **Supported** | A | Stage 0c-arch |
| 10-var expanded Marketplace graph converges uniquely in operating region | **Supported** | A | Stage 0d-arch |

---

## Stage structure

Each stage is a **kill attempt**, not a demonstration. Stages run only if the prior stage passes.

### Stage 0a — Null model (COMPLETE)
Locked single-level Gaussian FEP. Fixed precision. Gradient descent only.

**Prediction:** h ≈ 0 (linear landscape → unique equilibrium, path-independent).

**Result:** max h = 3.78 × 10⁻¹² across 19 precision values (0.05–0.95). Threshold: 10⁻⁶. **PASS.**

Simulation: `research/simulation/stage0_null_fep.py`
Report: `research/simulation/output/stage0_report.txt`

---

### Stage 0b-arch — 5-var constraint graph convergence (COMPLETE)
Linear null model. 5 variables: Trust, Support, Outcomes, Evidence, Reputation.

**Result:** ρ(A) = 0.6202 < 1. 500/500 inits converge to unique fixed point. max h = 2.80 × 10⁻¹². Critical scale ×1.65 → instability. **PASS.**

Simulation: `research/simulation/stage0b_constraint_convergence.py`
Report: `research/simulation/output/stage0b_arch_report.txt`

---

### Stage 0c-arch — 5-var convergence harness: α × β sweep (COMPLETE)
Same 5-variable system. Sweeps coupling scale α ∈ [0.2, 3.0] × sigmoid nonlinearity β ∈ [0, 4]. 18,000 total runs. §7 classification per cell.

**Result:** Operating region (α ∈ [0.5,1.5], β ∈ [0,2]) = 100% Type A. Kill condition NOT triggered. Sigmoid activation rescues divergence at high coupling scales. **PASS.**

Simulation: `research/simulation/stage0c_convergence_harness.py`
Report: `research/simulation/output/stage0c_arch_report.txt`

---

### Stage 0d-arch — 10-var expanded Marketplace convergence (COMPLETE)
Expanded system: Trust, Evidence, Support, Outcomes, Reputation, Match, Resolution, Resources, Governance, Value-alignment. Same α × β sweep. 18,000 runs.

**Result:** ρ(W) = 0.70. Linear stability boundary at α ≈ 1.43. Operating region = 100% Type A. All hysteresis spot-checks path-independent. Kill condition NOT triggered. **PASS.**

Architecture spec: `docs/marketplace-core-v0.md`, `docs/marketplace-dynamics-v0.md`
Simulation: `research/simulation/stage0d_arch_marketplace_convergence.py`
Report: `research/simulation/output/stage0d_arch_report.txt`

---

### Stage 0b — 2-latent null model (PLANNED)
Same locked assumptions, but with two latent variables. Tests whether dimensionality alone introduces spurious hysteresis.

**Kill condition:** h > 10⁻⁶ → null model is ill-specified; stop.

---

### Stage 0c — Non-linear landscape (PLANNED)
Replace quadratic F with a landscape containing a hard exclusion boundary (value constraint modeled as a cliff, not a soft penalty).

**Prediction if deontological constraint is real:** h > 0 above some boundary sharpness threshold.
**Kill condition:** h ≈ 0 even with hard boundary → value constraint adds no new structure; stop.

---

### Stage 0d — Step-size robustness (PLANNED)
Confirm Stage 0c result is not a GD artifact. Vary learning rate, step count, landscape resolution. Measure whether h is monotone in boundary sharpness or erratic.

**Kill condition:** h is non-monotone or artifact-dependent → result not robust; revise model.

---

### Stage 0e — FEP with action conditioning (PLANNED)
Full perception + action loop. Test whether active inference alone (without explicit value boundary) reproduces D4-style dissociation.

**Kill condition:** Standard FEP with strong priors already produces D4 → sacred values claim is not needed; stop.

---

### Stage 1 — Behavioral dissociation D4 (PLANNED)
Human-subject or survey-based test. Compare sacred-value items against matched high-utility items on:
- Resistance to increasing pressure
- Return path when pressure is removed

**Kill condition:** No statistically significant difference between sacred-value and high-utility groups on hysteresis measure → D4 does not exist; stop.

---

## Termination conditions

The program terminates if **any** of the following occur:

1. A faithful replication of the Adams et al. MDP reproduces D4 completely within standard FEP, without additional structure.
2. Published literature already contains the D4 dissociation (sacred vs. preference hysteresis) with sufficient replication.
3. Stage 1 finds no statistically significant behavioral difference between sacred-value and matched-preference conditions.
4. A simpler published model explains the candidate findings without additional assumptions.
5. The non-linear landscape (Stage 0c) shows h ≈ 0 even with hard boundary — meaning the deontological structure adds no dynamics.

These are not edge cases. They are the primary outcomes this program is designed to detect.

---

## What this program does not claim

- It does not claim Philos is a new theory of human behavior.
- It does not claim sacred values are a new discovery (they are well-established in moral psychology, Tetlock et al.).
- It does not claim the hysteresis mechanism is unique to humans.
- It does not claim the Philos application is validated by any result here.

The program makes one narrow claim: that a specific formal signature (hysteresis under pressure sweep) distinguishes sacred values from strong preferences in a way that requires additional model structure. That claim is either supported or it is not.

---

## Repository structure

```
docs/
  philos-reality-flow-v0.md     ← Layer 0: Matter + Space + Time axiom, 5 laws, energy flow
  marketplace-core-v0.md        ← Marketplace entity taxonomy and constraint graph
  marketplace-dynamics-v0.md    ← Matching Engine, Resolution Engine, update equations
  philos-research-questions.md  ← Open questions tracker
  philos-orientation-engine.md  ← Orientation Engine spec (Layer 4)
  philos-calibration.md         ← Calibration requirements
  philos-opm-spec.md            ← Object-Process Model spec
  philos-temporal-model.md      ← Temporal model
research/
  simulation/
    stage0_null_fep.py                       ← Stage 0a: FEP null model
    stage0b_constraint_convergence.py        ← Stage 0b-arch: 5-var convergence
    stage0c_convergence_harness.py           ← Stage 0c-arch: 5-var α×β sweep
    stage0d_arch_marketplace_convergence.py  ← Stage 0d-arch: 10-var Marketplace
    output/
      stage0_report.txt                      ← Stage 0a report
      stage0_null_fep.png                    ← Stage 0a plots
      stage0b_arch_report.txt                ← Stage 0b-arch report
      stage0b_arch_convergence.png           ← Stage 0b-arch plots
      stage0c_arch_report.txt                ← Stage 0c-arch report
      stage0c_arch_convergence.png           ← Stage 0c-arch plots
      stage0d_arch_report.txt                ← Stage 0d-arch report
      stage0d_arch_convergence.png           ← Stage 0d-arch plots
  (listed above)
app/                            ← Next.js application (separate)
```

---

## Application (Next.js)

The `app/` directory contains a Next.js prototype for the Philos human-orientation interface. To run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The application is independent of the falsification program and makes no claims that depend on Stage 1+ results.
