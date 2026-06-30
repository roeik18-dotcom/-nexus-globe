#!/usr/bin/env python3
"""
Stage 0b-arch: Marketplace Constraint Graph — Convergence Test
==============================================================
Layer 3 (Architecture) gate. Evidence status: Unknown.

Tests whether the circular constraint dependency in the Marketplace
architecture converges to a unique, path-independent fixed point.

CONSTRAINT GRAPH (from §6 of marketplace-core-v0.md):

    Trust      ← Reputation, Evidence
    Support    ← Trust
    Outcomes   ← Support, Trust
    Evidence   ← Outcomes
    Reputation ← Evidence

    Cycle: Trust → Support → Outcomes → Evidence → Reputation → Trust

This is NOT a claim about D4 or the FEP hypothesis. This is a structural
test of whether the architecture's circular dependencies are well-behaved.
Success here does not validate D4; failure does not refute it.

THREE QUESTIONS:
  Q1: Does the system converge?   (spectral radius of transition matrix < 1)
  Q2: Is the fixed point unique?  (N random inits → same attractor)
  Q3: Is it path-independent?     (pressure-up then pressure-down → h ≈ 0)

If Q1=No or Q2=No: architecture inherits multistability — Marketplace
output depends on initialization history, not just current state.
Do not proceed to baseline comparison.

If all pass: architecture is well-posed under null (linear) coupling.
Proceed to Stage 0c-arch: non-linear / hard-boundary test.

KILL CONDITION:
  ρ(A) ≥ 1 under any plausible coupling interpretation → redesign §6.
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

OUT = Path(__file__).parent / "output"
OUT.mkdir(parents=True, exist_ok=True)

# ── Configuration ──────────────────────────────────────────────────────────────

N_INIT      = 500       # random initial conditions for uniqueness test
MAX_ITER    = 2000      # gradient steps per point
TOL         = 1e-12     # convergence tolerance
THRESHOLD_H = 1e-6      # hysteresis threshold (matches Stage 0a)
N_PRESSURE  = 81        # pressure sweep points
SEED        = 42

np.random.seed(SEED)

# Variable indices
TRUST, SUPPORT, OUTCOMES, EVIDENCE, REPUTATION = 0, 1, 2, 3, 4
VARS = ["Trust", "Support", "Outcomes", "Evidence", "Reputation"]
N    = 5


# ── Linear null model ──────────────────────────────────────────────────────────
#
# State update (synchronous):
#   x_{t+1} = A @ x_t + b
#
# A[i, j] = weight from variable j to variable i

def make_A(
    rep_to_trust   = 0.30,   # Reputation → Trust
    ev_to_trust    = 0.30,   # Evidence   → Trust
    trust_to_sup   = 0.50,   # Trust      → Support
    sup_to_out     = 0.40,   # Support    → Outcomes
    trust_to_out   = 0.30,   # Trust      → Outcomes
    out_to_ev      = 0.60,   # Outcomes   → Evidence
    ev_to_rep      = 0.70,   # Evidence   → Reputation
):
    A = np.zeros((N, N))
    A[TRUST,      REPUTATION] = rep_to_trust
    A[TRUST,      EVIDENCE  ] = ev_to_trust
    A[SUPPORT,    TRUST     ] = trust_to_sup
    A[OUTCOMES,   SUPPORT   ] = sup_to_out
    A[OUTCOMES,   TRUST     ] = trust_to_out
    A[EVIDENCE,   OUTCOMES  ] = out_to_ev
    A[REPUTATION, EVIDENCE  ] = ev_to_rep
    return A


def iterate(A, b, x0):
    x = x0.copy()
    for step in range(MAX_ITER):
        x_new = A @ x + b
        if np.max(np.abs(x_new - x)) < TOL:
            return x_new, step + 1, True
        x = x_new
    return x, MAX_ITER, False


def analytic_fixed_point(A, b):
    """x* = (I − A)^{−1} b  (valid only if ρ(A) < 1)."""
    try:
        return np.linalg.solve(np.eye(N) - A, b)
    except np.linalg.LinAlgError:
        return None


# ── Q1: Spectral radius ────────────────────────────────────────────────────────

def spectral_radius(A):
    return float(np.max(np.abs(np.linalg.eigvals(A))))


# ── Q2: Uniqueness across random initialisations ───────────────────────────────

def uniqueness_test(A, b):
    fps        = []
    n_converge = 0
    x_analytic = analytic_fixed_point(A, b)
    for _ in range(N_INIT):
        x0   = np.random.uniform(-10, 10, N)
        xf, _, ok = iterate(A, b, x0)
        if ok:
            n_converge += 1
        fps.append(xf)
    fps      = np.array(fps)
    spread   = fps.std(axis=0)
    return fps, spread, float(np.max(spread)), n_converge, x_analytic


# ── Q3: Path-independence (hysteresis sweep) ───────────────────────────────────

def hysteresis_test(A):
    """Apply external pressure to Trust; sweep up then down."""
    p_vals = np.linspace(-3.0, 3.0, N_PRESSURE)
    b_unit = np.zeros(N)
    b_unit[TRUST] = 1.0        # pressure enters via Trust

    # Up sweep — carry equilibrium forward
    x       = np.zeros(N)
    mu_up   = np.empty((N_PRESSURE, N))
    for i, p in enumerate(p_vals):
        x, _, _ = iterate(A, p * b_unit, x)
        mu_up[i] = x

    # Down sweep — carry equilibrium backward
    x         = mu_up[-1].copy()
    mu_down   = np.empty((N_PRESSURE, N))
    for i, p in enumerate(reversed(p_vals)):
        x, _, _ = iterate(A, p * b_unit, x)
        mu_down[N_PRESSURE - 1 - i] = x

    h = np.abs(mu_up - mu_down)
    return p_vals, mu_up, mu_down, h


# ── Stability boundary: ρ vs coupling scale ────────────────────────────────────

def stability_curve(scales):
    rhos = []
    for s in scales:
        A_s = make_A(
            rep_to_trust   = 0.30 * s,
            ev_to_trust    = 0.30 * s,
            trust_to_sup   = 0.50 * s,
            sup_to_out     = 0.40 * s,
            trust_to_out   = 0.30 * s,
            out_to_ev      = 0.60 * s,
            ev_to_rep      = 0.70 * s,
        )
        rhos.append(spectral_radius(A_s))
    return np.array(rhos)


# ── Run ────────────────────────────────────────────────────────────────────────

A_null = make_A()
b_null = np.zeros(N)

rho_null               = spectral_radius(A_null)
fps, spread, max_sp, n_cv, x_star = uniqueness_test(A_null, b_null)
p_vals, mu_up, mu_down, h = hysteresis_test(A_null)
max_h_global           = float(np.max(h))

scales     = np.linspace(0.05, 4.0, 80)
rho_curve  = stability_curve(scales)
crit_scale = scales[np.searchsorted(rho_curve, 1.0)]   # first scale where ρ ≥ 1


# ── Report ─────────────────────────────────────────────────────────────────────

q1_pass = rho_null < 1.0
q2_pass = max_sp   < 1e-6
q3_pass = max_h_global < THRESHOLD_H
all_pass = q1_pass and q2_pass and q3_pass

lines = [
    "",
    "══════════════════════════════════════════════════════════════",
    "  Stage 0b-arch: Marketplace Constraint Graph — Report",
    "  Layer 3 (Architecture) | Evidence status: Unknown",
    "══════════════════════════════════════════════════════════════",
    "",
    "  Constraint graph (null linear model, default coupling weights):",
    "  Trust←Rep(0.30)+Ev(0.30) | Sup←Trust(0.50)",
    "  Out←Sup(0.40)+Trust(0.30) | Ev←Out(0.60) | Rep←Ev(0.70)",
    "",
    "  Q1 — Convergence  (spectral radius)",
    f"    ρ(A) = {rho_null:.6f}",
    f"    ρ < 1?  {'YES' if q1_pass else 'NO — system diverges or oscillates'}",
    "",
    "  Q2 — Uniqueness  ({} random initialisations)".format(N_INIT),
    f"    Converged: {n_cv}/{N_INIT}",
    f"    Max spread σ across variables: {max_sp:.2e}",
    f"    Unique fixed point? {'YES' if q2_pass else 'NO — multiple attractors'}",
]
if x_star is not None:
    lines += [f"    Analytic x* = [{', '.join(f'{v:.4f}' for v in x_star)}]"]
lines += [
    "",
    "  Q3 — Path-independence  (pressure sweep ±3)",
    f"    Global max h = {max_h_global:.2e}",
    f"    Threshold    = {THRESHOLD_H:.0e}",
    f"    Path-independent? {'YES' if q3_pass else 'NO — hysteresis detected'}",
    "",
    "  Stability boundary:",
    f"    Default coupling scale = 1.0  →  ρ = {rho_null:.4f}",
    f"    ρ crosses 1 at scale ≈ {crit_scale:.2f}  (weights × {crit_scale:.2f} → unstable)",
    "",
]

if all_pass:
    lines += [
        "  RESULT: PASS",
        "  Constraint graph converges to a unique, path-independent fixed point",
        "  under null (linear) coupling.",
        "  Architecture is well-defined at default weights.",
        "  OPEN RISK: if real coupling weights scale by >{:.1f}×, the graph".format(crit_scale),
        "  crosses the stability boundary → multistability / divergence.",
        "  Proceed to Stage 0c-arch: non-linear / hard-boundary coupling.",
    ]
else:
    lines += [
        "  RESULT: FAIL",
        "  One or more convergence properties fail under null coupling.",
        "  Marketplace architecture needs §6 redesign before baseline comparison.",
    ]

lines += [
    "",
    "  Independence note:",
    "  This result does NOT confirm or refute D4 (sacred value hysteresis).",
    "  It tests only whether the §6 constraint graph is internally consistent.",
    "══════════════════════════════════════════════════════════════",
]

body = "\n".join(lines)
print(body)
(OUT / "stage0b_arch_report.txt").write_text(body)
print(f"\n  Report → {OUT / 'stage0b_arch_report.txt'}")


# ── Plots ──────────────────────────────────────────────────────────────────────

fig, axes = plt.subplots(2, 2, figsize=(13, 9))
fig.suptitle(
    "Stage 0b-arch: Marketplace Constraint Graph — Convergence & Hysteresis\n"
    "Layer 3 (Architecture) | Evidence: Unknown",
    fontsize=11, fontweight="bold"
)

# 1 — Fixed points from N_INIT random initialisations
ax = axes[0, 0]
ax.boxplot(fps, tick_labels=[v[:5] for v in VARS], patch_artist=True,
           boxprops=dict(facecolor="#a8d8ea", alpha=0.8))
if x_star is not None:
    ax.scatter(range(1, N + 1), x_star, color="red", s=60, zorder=5,
               label="Analytic x*")
    ax.legend(fontsize=8)
ax.set_title(f"Fixed points ({N_INIT} random inits)\nCollapsed boxes = unique attractor")
ax.set_ylabel("Fixed-point value")
ax.grid(alpha=0.2)

# 2 — Spectral radius vs coupling scale
ax = axes[0, 1]
ax.plot(scales, rho_curve, color="steelblue", lw=2, label="ρ(A)")
ax.axhline(1.0, color="red", ls="--", lw=1.2, label="stability boundary ρ=1")
ax.axvline(1.0, color="gray", ls=":", lw=1,  label="null model (scale=1)")
ax.axvline(crit_scale, color="orange", ls="--", lw=1,
           label=f"critical scale ≈{crit_scale:.2f}")
ax.fill_between(scales, rho_curve, 1.0,
                where=rho_curve >= 1.0,
                color="red", alpha=0.12, label="divergent region")
ax.set_xlabel("Coupling scale factor")
ax.set_ylabel("ρ(A)")
ax.set_title("Stability boundary\n(null model = scale 1.0)")
ax.legend(fontsize=7)
ax.grid(alpha=0.2)

# 3 — Trust fixed point: up vs down sweep
ax = axes[1, 0]
ax.plot(p_vals, mu_up[:, TRUST],   color="steelblue", lw=2,  label="Trust (up sweep)")
ax.plot(p_vals, mu_down[:, TRUST], color="coral",     lw=2,  ls="--",
        label="Trust (down sweep)")
ax.set_xlabel("External pressure p")
ax.set_ylabel("Trust at equilibrium")
ax.set_title("Hysteresis test — Trust\n(overlapping lines = path-independent)")
ax.legend(fontsize=8)
ax.grid(alpha=0.2)

# 4 — Max h per variable
ax = axes[1, 1]
max_h_per_var = h.max(axis=0)
colors = ["#2196F3" if v < THRESHOLD_H else "#F44336" for v in max_h_per_var]
ax.bar(VARS, max_h_per_var, color=colors, alpha=0.75)
ax.axhline(THRESHOLD_H, color="red", ls="--", lw=1.2,
           label=f"threshold {THRESHOLD_H:.0e}")
ax.set_title("Max hysteresis per variable\n(red = path-dependent)")
ax.set_ylabel("max |μ_up − μ_down|")
ax.set_yscale("log")
ax.legend(fontsize=8)
ax.grid(alpha=0.2, which="both")

plt.tight_layout()
plot_path = OUT / "stage0b_arch_convergence.png"
fig.savefig(plot_path, dpi=150, bbox_inches="tight")
plt.close(fig)
print(f"  Plot  → {plot_path}")
