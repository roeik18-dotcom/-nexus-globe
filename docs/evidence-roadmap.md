# Evidence Roadmap

**Status: Candidate — framework specified; validation not yet run**

*This document tracks the evidence state of every major claim in the Philos program.
It is a living index, not a research paper. Each row carries a grade; grades change
when tests are defined or run. See `docs/research-charter.md` for grade definitions.*

---

## §1 Evidence Grade Summary

| Grade | Color convention | Current count |
|---|---|---|
| Frozen | Green | 2 |
| Candidate | Purple | 12 |
| Placeholder | Orange | 9 |
| Not established | Red | 6 |

---

## §2 FEP Falsification Track

| Claim | Grade | Stage | Result |
|---|---|---|---|
| Single-level Gaussian FEP produces h ≈ 0 (null model) | **Frozen** | Stage 0a | max h = 3.78×10⁻¹² — PASS |
| Any linear landscape with fixed precision → h = 0 | **Frozen** | Stage 0a analytic | Proven analytically — PASS |
| 2-latent null model also produces h ≈ 0 | **Candidate** | Stage 0b | Not yet run |
| Non-linear landscape (cliff) produces h > 0 | **Candidate** | Stage 0c | Not yet run |
| h in non-linear model is not a GD artifact | **Candidate** | Stage 0d | Not yet run |
| D4 behavioral dissociation (sacred vs preference) exists in subjects | **Not established** | Stage 1 | Requires human subjects |

---

## §3 Marketplace Architecture Track

| Claim | Grade | Stage | Result |
|---|---|---|---|
| 5-var constraint graph converges uniquely (linear) | **Frozen** | Stage 0b-arch | ρ(A) = 0.62, 500/500 inits — PASS |
| 5-var convergence holds across α×β sweep | **Frozen** | Stage 0c-arch | Operating region = 100% Type A — PASS |
| 10-var expanded Marketplace converges uniquely | **Frozen** | Stage 0d-arch | ρ(W) = 0.70, operating region stable — PASS |
| Value constraint priority (I2) — filters not utilities | **Candidate** | Architecture | Specified in §5 of marketplace-core-v0.md; not validated |
| Intent/Behavior/Outcomes ordering (I5, §7) improves matching | **Candidate** | Architecture | Specified; requires controlled evaluation |
| Trust/Confidence update equations are well-defined | **Placeholder** | Architecture | Equations not yet written |
| DimensionReading is the correct OPM→Marketplace interface | **Candidate** | Proposal | See dimension-reading-proposal.md; not implemented |
| Value Fusion produces emergent capabilities from provider combinations | **Candidate** | §10.3 of dynamics | Discriminating criterion not yet specified |
| capacity measurement is feasible from observable data | **Placeholder** | DimensionReading | No measurement protocol defined |
| PUDM Relation Entities (VCR + PCR) as first-class entities with relationType semantics | **Candidate** | Architecture | Schema specified in PUDM v0.2 §3.1; not empirically validated |
| G-2 Deferred Contract: PCR `selected_for` write-layer enforcement | **Placeholder** | Architecture | Deferred — no write API exists; activates on any `selected_for` write path |

---

## §4 Model of 9 (M9) Track

| Claim | Grade | Note |
|---|---|---|
| Reality/Human/Human Drives is a valid 3-part decomposition | **Candidate** | Designed; not tested |
| The 9 dimensions are jointly exhaustive | **Placeholder** | No exhaustiveness proof |
| The 9 dimensions are mutually exclusive | **Placeholder** | No exclusion test |
| M9 is H9 (can describe human orientation in 9 components) | **Candidate** | Plausible; not demonstrated |
| M9 is G9 (forbids states; makes predictions) | **Not established** | Falsification field empty by design |
| dimensionPressure is measurable | **Placeholder** | No measurement protocol |
| dimensionDeficit correctly predicts Required Values | **Candidate** | Inference rule specified; not validated |

---

## §5 Evidence Layer Protocol (I5, §7)

*This section applies to the Marketplace architecture, not to the FEP track.*

The three evidence layers for all human variables:

| Layer | Definition | Weight |
|---|---|---|
| **Intent** | Declared — what actor claims they will do | Weak — prior only |
| **Behavior** | Observable pattern of action across cases | Stronger — updates prior |
| **Outcomes** | Measurable consequences of actor's contribution | Strongest — grounds posterior |

**Invariant I5**: No variable (Trust, Reputation, Expertise, Availability, Collaboration, Impact)
may be updated on Intent alone. Behavior or Outcomes evidence required to move beyond prior.

Evidence chain downstream of Outcomes:
```
Outcomes → Trust → Reputation → Impact → Learning → Next Mission
```

Grade: **Frozen** (this is an architectural constraint, not an empirical claim).
Whether the ordering improves matching quality is **Candidate** (requires controlled evaluation).

---

## §6 Application Track (Nexus/Globe)

| Component | Grade | Note |
|---|---|---|
| Nexus globe visualization | **Candidate** | Built and deployed; usage data not collected |
| OPM graph view | **Candidate** | Built; causal spine not validated |
| Value affinity sync (globe ↔ OPM) | **Candidate** | Implemented; accuracy not measured |
| Network Effects visualization | **Candidate** | Implemented; no user studies |
| Case Pattern Engine | **Candidate** | Schema locked; classifier not validated |
| Situation classifier (Claude-based) | **Candidate** | Implemented; requires ANTHROPIC_API_KEY to run |
| Transition Engine | **Candidate** | Simulator built; stability test passed for 5 cases |
| PUDM view (`/pudm`) | **Candidate** | Built; data model summary and coverage statistics |
| Marketplace / Graph Explorer (`/marketplace`) | **Candidate** | Built; read-only traversal of full PUDM chain (Mission → Gap → Value → [VCR] → Capability → [PCR] → Provider); Node Inspector + Relation Inspector, 5 inspector kinds; no user studies |

---

## §7 Missing Validations (Blocking)

These validations are required before any Candidate claim can advance to confirmed:

1. **Trust/Confidence update equations** — must be formally defined before Layer 3c convergence harness is meaningful
2. **Mode B validation** — a real case where a person used Philos mapping during an actual decision; required for I5 §7 claim
3. **Matching Engine doc** (`docs/marketplace-matching-engine-v0.md`) — required before Matching Engine can formally implement §7 constraints
4. **M9 G9 test** — must specify at least one state the model forbids, and demonstrate that it is actually absent

---

## §8 Next Actions (Sequenced by dependency)

```
1. Write Trust/Confidence update equations        → unblocks Layer 3c harness
2. Write marketplace-matching-engine-v0.md        → unblocks §7 implementation
3. Define DimensionReading formally               → unblocks OPM→Marketplace interface
4. Run testClassifier.ts (needs ANTHROPIC_API_KEY) → validates situation classifier
5. Mode B: real case validation                   → first empirical data point on I5
6. Specify M9 G9 falsification field              → upgrades M9 from Placeholder to Candidate
```

---

*Evidence Roadmap | Created from session record 2026-07-09*
*Evidence grade: Candidate — framework specified, not externally reviewed*
