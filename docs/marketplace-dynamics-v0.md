# Marketplace Dynamics — v0

**Layer 3 (Architecture) | Evidence status: D — Hypothesis**

*Formal dynamic model for the Philos Marketplace. Defines the Matching Engine (§8),
Resolution Engine (§9), update equations (§10), and convergence conditions (§11).
These specifications are inputs to the convergence simulator:
`research/simulation/stage0d_arch_marketplace_convergence.py`.*

*Independence note: These dynamics do not confirm or refute D4 (sacred value hysteresis).
They test only structural well-posedness of the expanded §6 constraint graph.*

---

## §7 State Vector

The aggregate Marketplace state is a vector **x** ∈ ℝ¹⁰.
All variables are normalized to [0, 1] under sigmoid activation; unbounded in the linear model.

| Index | Variable | Symbol | Description |
|---|---|---|---|
| 0 | Trust | T | Aggregate actor trust (mean of 6-dim trust vectors across active actors) |
| 1 | Evidence | E | Quality-weighted average of case evidence |
| 2 | Support | S | Net weighted actor stance (rescaled to [0,1]) |
| 3 | Outcomes | O | Historical resolution quality |
| 4 | Reputation | Rep | Aggregate actor reputation |
| 5 | Match quality | M | Team-role fit score for current missions |
| 6 | Resolution confidence | R | Confidence of most recent resolution |
| 7 | Resource adequacy | RA | Budget and resource coverage |
| 8 | Governance score | G | Rule compliance and oversight quality |
| 9 | Value alignment | V | Actor pool alignment with case value constraints |

---

## §8 Matching Engine

### §8.1 Problem Statement

Given:
- Mission M with required roles R = {r₁, ..., rₖ}
- Candidate actor set A = {a₁, ..., aₙ}
- Budget constraint B(M)

Find team assignment π: R → A that maximizes team quality.

### §8.2 Actor-Role Score Function

σ(aᵢ, rⱼ) = Σᵥ wᵥ · fᵥ(aᵢ, rⱼ)

| Component | Formula | Default weight |
|---|---|---|
| Expertise | cos(skills(a), required_skills(r)) | 0.30 |
| Trust (role-weighted) | Σ_d trust_d(a) · domain_weight(d, r) | 0.25 |
| History | past_success_rate(a, domain(r)) | 0.20 |
| Availability | 1 − current_load(a) | 0.10 |
| Value alignment | ethical_trust(a) | 0.10 |
| Cost fit | max(0, 1 − |cost(a) − target_cost(r)| / B(M)) | 0.05 |

### §8.3 Optimal Assignment

π* = argmax_π Σⱼ σ(π(rⱼ), rⱼ)

Hard constraints (not soft penalties):
- Budget: Σⱼ cost(π(rⱼ)) ≤ B(M)
- Availability: load(π(rⱼ)) < 1  ∀j
- Ethics: ethical_trust(π(rⱼ)) > θ_ethics  ∀j
- Injectivity: π is injective unless roles explicitly allow shared actors

Complexity: NP-hard (generalized assignment). Approximate with greedy descent + local swap.

### §8.4 Aggregate Match Quality

M = (1/|R|) Σⱼ σ(π*(rⱼ), rⱼ) ∈ [0, 1]

This feeds into the convergence update (§10, variable index 5).

---

## §9 Resolution Engine

### §9.1 Actor Stances

Each actor aᵢ holds stance pos(aᵢ, M) ∈ {−1, 0, +1} for case M.
(−1 = oppose, 0 = neutral/reserve, +1 = support)

Stance weight:
w(aᵢ) = professional_trust(aᵢ) · expertise_relevance(aᵢ, M)

### §9.2 Weighted Consensus Score

C = Σᵢ pos(aᵢ) · w(aᵢ) / Σᵢ |w(aᵢ)|  ∈ [−1, +1]

### §9.3 Decision Rule

Let θ_resolve = 0.60 (default resolution threshold).

```
if any Governor enforces a hard block:
    decision ← BLOCKED           # overrides consensus, no exceptions
elif |C| ≥ θ_resolve:
    decision ← APPROVED  if C > 0
    decision ← REJECTED  if C < 0
    confidence ← |C|
else:
    decision ← UNRESOLVED        # request more evidence or mediation
```

The Governor hard block is NOT overridable by consensus. This implements the deontological
structure: Value Office constraints are exclusion filters, not items in a utility sum.

### §9.4 Resolution Confidence

R = |C| · (1 − H(stance_distribution))

where H is the normalized entropy of the stance distribution.
R → 1 when all actors agree. R → 0 when perfectly split.

---

## §10 Update Equations

Synchronous update: **x**[t+1] = σ_β(α · W · **x**[t] + **b**)

where:
- α   = coupling scale parameter
- β   = nonlinearity (sigmoid sharpness); β=0 → identity (linear model)
- σ_β(·) = element-wise sigmoid(x, β) = 1/(1+e^{−βx}) if β>0, else x
- **b** = external pressure vector (default **0**)

### §10.1 Coupling Matrix W

Row sums are designed to equal 0.70, giving ρ(W) = 0.70 (Perron-Frobenius for row-stochastic
scaling). Stability boundary at α = 1/0.70 ≈ 1.43 in the linear case.

```
           T      E      S      O     Rep     M      R     RA      G      V
T    [ 0.000  0.200  0.000  0.150  0.200  0.000  0.000  0.000  0.150  0.000 ]
E    [ 0.000  0.000  0.000  0.400  0.300  0.000  0.000  0.000  0.000  0.000 ]
S    [ 0.350  0.150  0.000  0.000  0.000  0.000  0.000  0.000  0.000  0.200 ]
O    [ 0.200  0.000  0.000  0.000  0.000  0.280  0.220  0.000  0.000  0.000 ]
Rep  [ 0.150  0.350  0.000  0.200  0.000  0.000  0.000  0.000  0.000  0.000 ]
M    [ 0.250  0.000  0.000  0.000  0.100  0.000  0.000  0.150  0.000  0.200 ]
R    [ 0.000  0.240  0.280  0.000  0.000  0.000  0.000  0.000  0.180  0.000 ]
RA   [ 0.350  0.000  0.000  0.000  0.200  0.000  0.000  0.000  0.150  0.000 ]
G    [ 0.150  0.350  0.000  0.200  0.000  0.000  0.000  0.000  0.000  0.000 ]
V    [ 0.420  0.000  0.000  0.000  0.000  0.000  0.000  0.000  0.280  0.000 ]
```

Row sums all equal 0.70. Variable ordering: T=0, E=1, S=2, O=3, Rep=4, M=5, R=6, RA=7, G=8, V=9.

### §10.2 Explicit Update Rules

```
T[t+1]   = σ_β(α · (0.20·E[t] + 0.15·O[t] + 0.20·Rep[t] + 0.15·G[t]))
E[t+1]   = σ_β(α · (0.40·O[t] + 0.30·Rep[t]))
S[t+1]   = σ_β(α · (0.35·T[t] + 0.15·E[t] + 0.20·V[t]))
O[t+1]   = σ_β(α · (0.20·T[t] + 0.28·M[t] + 0.22·R[t]))
Rep[t+1] = σ_β(α · (0.15·T[t] + 0.35·E[t] + 0.20·O[t]))
M[t+1]   = σ_β(α · (0.25·T[t] + 0.10·Rep[t] + 0.15·RA[t] + 0.20·V[t]))
R[t+1]   = σ_β(α · (0.24·E[t] + 0.28·S[t] + 0.18·G[t]))
RA[t+1]  = σ_β(α · (0.35·T[t] + 0.20·Rep[t] + 0.15·G[t]))
G[t+1]   = σ_β(α · (0.15·T[t] + 0.35·E[t] + 0.20·O[t]))
V[t+1]   = σ_β(α · (0.42·T[t] + 0.28·G[t]))
```

**These coupling weights are initial architectural estimates, not empirically calibrated.**
They encode the dependency graph from §4 of `marketplace-core-v0.md`. Real calibration requires
outcome data.

### §10.3 Cycles

The constraint graph contains two primary cycles:

```
Cycle A (short): T → S → R → E → Rep → T
Cycle B (long):  T → M → O → E → Rep → T → V → M
```

Both cycles pass through Trust and Evidence. If Trust and Evidence diverge, all downstream
variables are unreliable.

---

## §11 Convergence Analysis Protocol

### §11.1 Linear Stability (β = 0)

At β = 0: **x**[t+1] = α · W · **x**[t]

Spectral radius: ρ(αW) = α · ρ(W) = α · 0.70
Stability boundary: α_crit = 1/0.70 ≈ 1.43

At default α = 1.0: ρ = 0.70 < 1 → convergent.
At α = 1.5: ρ = 1.05 > 1 → divergent (sigmoid activation may rescue).

### §11.2 §7 Classification

Per cell (α, β), run N_INIT = 100 random initializations:

| Type | Condition |
|---|---|
| A — Unique convergence | All inits → same fixed point (spread < ε_spread) |
| B — Multistability | Different inits → different fixed points (spread > ε_spread) |
| C — Limit cycle | Variance over last K steps > ε_var |
| D — Divergence | ‖x‖ > MAX_NORM |

### §11.3 Kill Condition

If Type A occupies < 50% of the expected operating region:
- α ∈ [0.5, 1.5]
- β ∈ [0, 2]

→ §6 constraint graph needs structural redesign before any baseline comparison.

### §11.4 Hysteresis Condition

External pressure p applied to Trust (b[TRUST] = p). Sweep p ∈ [−2, +2] up then down.

h_i = max_p |x_i(up) − x_i(down)|

If h_i > ε_h = 1e-4 for any variable → path-dependent; architecture has history dependence.

Note: this architectural hysteresis is distinct from D4 (sacred-value hysteresis). Finding
h > 0 here would indicate a constraint graph defect, not confirmation of D4.

### §11.5 Convergence Simulator

Implemented in: `research/simulation/stage0d_arch_marketplace_convergence.py`

Sweep grid:
- α ∈ [0.2, 3.0], 15 points
- β ∈ [0.0, 4.0], 12 points
- 100 random initialisations per grid point
- Total: 18,000 runs

Outputs:
- Type-A rate heatmap
- Dominant-type map
- β-slice at α = 1.0
- Spectral radius curve (linear case)

---

*Layer 3 (Architecture) | Evidence: D — Hypothesis*
*Independence note: This dynamic model does not confirm or refute D4.*
