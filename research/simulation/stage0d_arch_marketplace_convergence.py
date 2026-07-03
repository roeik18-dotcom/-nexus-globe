#!/usr/bin/env python3
"""
Stage 0d-arch: Expanded Marketplace Convergence Harness
=======================================================
Layer 3 (Architecture) | Evidence status: Unknown

PURPOSE:
  Test convergence of the full 10-variable Marketplace constraint graph
  (docs/marketplace-dynamics-v0.md §10–11) across a 2D parameter sweep.

  Extends Stage 0c-arch (5 variables, Trust/Support/Outcomes/Evidence/Reputation)
  to the complete Marketplace state:
    Trust, Evidence, Support, Outcomes, Reputation,
    Match, Resolution, Resources, Governance, Value-alignment.

  Coupling matrix W from marketplace-dynamics-v0.md §10.1:
    ρ(W) = 0.70 (all row sums = 0.70 by design)
    Linear stability boundary: α_crit = 1/0.70 ≈ 1.43

§7 CLASSIFICATION TABLE:
  Type A — Unique convergence    (well-defined, path-independent)
  Type B — Multistability        (path-dependent, init history matters)
  Type C — Limit cycle           (dynamic instability)
  Type D — Divergence            (unbounded)

SWEEP AXES:
  α — coupling scale  ∈ [0.2, 3.0]
  β — nonlinearity   ∈ [0.0, 4.0]  (sigmoid sharpness; β=0 → linear)

KILL CONDITION:
  Type A < 50% of operating region (α ∈ [0.5,1.5], β ∈ [0,2])
  → §6 expanded constraint graph needs structural redesign.

INDEPENDENCE NOTE:
  Results do NOT confirm or refute D4 (sacred value hysteresis).
  They test only structural well-posedness of the expanded §6 constraint graph.
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from pathlib import Path
from collections import Counter

OUT = Path(__file__).parent / "output"
OUT.mkdir(parents=True, exist_ok=True)

# ── Configuration ──────────────────────────────────────────────────────────────

N_INIT      = 100
MAX_ITER    = 3000
TOL_CONV    = 1e-9
EPS_SPREAD  = 1e-4
EPS_VAR     = 1e-3
MAX_NORM    = 1e6
TAIL_K      = 50
THRESHOLD_H = 1e-4
P_RANGE     = np.linspace(-2, 2, 21)

ALPHA_VALS = np.round(np.linspace(0.2, 3.0, 15), 3)
BETA_VALS  = np.round(np.linspace(0.0, 4.0, 12), 3)

# Variable layout (marketplace-dynamics-v0.md §7)
TRUST, EVIDENCE, SUPPORT, OUTCOMES, REPUTATION, \
    MATCH, RESOLUTION, RESOURCES, GOVERNANCE, VALUE = range(10)
N    = 10
VARS = ["Trust", "Evidence", "Support", "Outcomes", "Reputation",
        "Match", "Resolution", "Resources", "Governance", "Value"]

SEED = 42
np.random.seed(SEED)


# ── Coupling matrix W (marketplace-dynamics-v0.md §10.1) ──────────────────────
#
# W[i, j] = coupling weight from variable j to variable i.
# All row sums = 0.70 → ρ(W) = 0.70 (Perron-Frobenius).
# Stability boundary at α · 0.70 = 1  →  α_crit ≈ 1.43.

W = np.zeros((N, N))

# T[t+1] ← 0.20·E + 0.15·O + 0.20·Rep + 0.15·G   (sum=0.70)
W[TRUST, EVIDENCE]    = 0.20
W[TRUST, OUTCOMES]    = 0.15
W[TRUST, REPUTATION]  = 0.20
W[TRUST, GOVERNANCE]  = 0.15

# E[t+1] ← 0.40·O + 0.30·Rep                       (sum=0.70)
W[EVIDENCE, OUTCOMES]   = 0.40
W[EVIDENCE, REPUTATION] = 0.30

# S[t+1] ← 0.35·T + 0.15·E + 0.20·V               (sum=0.70)
W[SUPPORT, TRUST]    = 0.35
W[SUPPORT, EVIDENCE] = 0.15
W[SUPPORT, VALUE]    = 0.20

# O[t+1] ← 0.20·T + 0.28·M + 0.22·R               (sum=0.70)
W[OUTCOMES, TRUST]      = 0.20
W[OUTCOMES, MATCH]      = 0.28
W[OUTCOMES, RESOLUTION] = 0.22

# Rep[t+1] ← 0.15·T + 0.35·E + 0.20·O             (sum=0.70)
W[REPUTATION, TRUST]     = 0.15
W[REPUTATION, EVIDENCE]  = 0.35
W[REPUTATION, OUTCOMES]  = 0.20

# M[t+1] ← 0.25·T + 0.10·Rep + 0.15·RA + 0.20·V  (sum=0.70)
W[MATCH, TRUST]      = 0.25
W[MATCH, REPUTATION] = 0.10
W[MATCH, RESOURCES]  = 0.15
W[MATCH, VALUE]      = 0.20

# R[t+1] ← 0.24·E + 0.28·S + 0.18·G               (sum=0.70)
W[RESOLUTION, EVIDENCE]   = 0.24
W[RESOLUTION, SUPPORT]    = 0.28
W[RESOLUTION, GOVERNANCE] = 0.18

# RA[t+1] ← 0.35·T + 0.20·Rep + 0.15·G            (sum=0.70)
W[RESOURCES, TRUST]      = 0.35
W[RESOURCES, REPUTATION] = 0.20
W[RESOURCES, GOVERNANCE] = 0.15

# G[t+1] ← 0.15·T + 0.35·E + 0.20·O              (sum=0.70)
W[GOVERNANCE, TRUST]     = 0.15
W[GOVERNANCE, EVIDENCE]  = 0.35
W[GOVERNANCE, OUTCOMES]  = 0.20

# V[t+1] ← 0.42·T + 0.28·G                         (sum=0.70)
W[VALUE, TRUST]      = 0.42
W[VALUE, GOVERNANCE] = 0.28

# Verify row sums
assert np.allclose(W.sum(axis=1), 0.70), "Row sums must equal 0.70"


# ── Update function ────────────────────────────────────────────────────────────

def sigmoid(x, beta):
    """Smooth saturation. β=0 → identity; large β → step function."""
    if beta == 0.0:
        return x
    return 1.0 / (1.0 + np.exp(-beta * x))


def step(x, alpha, beta, b):
    """Synchronous update: x[t+1] = σ_β(α · W · x[t] + b)."""
    return sigmoid(alpha * (W @ x) + b, beta)


def run_one(x0, alpha, beta, b=None):
    """
    Iterate from x0. Returns (final_state, converged, diverged, oscillating).
    """
    if b is None:
        b = np.zeros(N)
    x    = x0.copy()
    tail = np.zeros((TAIL_K, N))
    for i in range(MAX_ITER):
        x_new = step(x, alpha, beta, b)
        tail[i % TAIL_K] = x_new
        if np.max(np.abs(x_new)) > MAX_NORM:
            return x_new, False, True, False    # diverged
        if np.max(np.abs(x_new - x)) < TOL_CONV:
            return x_new, True, False, False    # converged
        x = x_new
    osc = float(np.max(tail.var(axis=0))) > EPS_VAR
    return x, False, False, osc                 # non-converged


# ── §7 Classifier ──────────────────────────────────────────────────────────────

def classify_params(alpha, beta):
    """
    Run N_INIT random initialisations. Classify into A/B/C/D.
    Returns (pct_A, type_counts, fixed_points).
    """
    fps   = []
    types = []
    b     = np.zeros(N)

    for _ in range(N_INIT):
        x0 = np.random.uniform(-3, 3, N)
        xf, conv, div, osc = run_one(x0, alpha, beta, b)
        if div:
            types.append("D")
        elif osc:
            types.append("C")
        elif not conv:
            types.append("C")
        else:
            types.append("_")
            fps.append(xf)

    if fps:
        fp_arr = np.array(fps)
        spread = float(fp_arr.std(axis=0).max())
        label  = "A" if spread < EPS_SPREAD else "B"
        for i, t in enumerate(types):
            if t == "_":
                types[i] = label

    counts = Counter(types)
    pct_A  = counts.get("A", 0) / N_INIT
    return pct_A, counts, np.array(fps) if fps else np.empty((0, N))


# ── Hysteresis spot-check ──────────────────────────────────────────────────────

def hysteresis_spot(alpha, beta):
    """Return max hysteresis across all variables for Trust pressure sweep."""
    b_unit = np.zeros(N)
    b_unit[TRUST] = 1.0

    x      = np.zeros(N)
    mu_up  = []
    for p in P_RANGE:
        x, _, _, _ = run_one(x, alpha, beta, p * b_unit)
        mu_up.append(x.copy())

    x        = mu_up[-1].copy()
    mu_down  = []
    for p in reversed(P_RANGE):
        x, _, _, _ = run_one(x, alpha, beta, p * b_unit)
        mu_down.insert(0, x.copy())

    return float(np.max(np.abs(np.array(mu_up) - np.array(mu_down))))


# ── Spectral radius vs α in the linear (β=0) case ────────────────────────────

def spectral_radius(alpha):
    """ρ(αW) = α · ρ(W) = α · 0.70 for this matrix."""
    return float(np.max(np.abs(np.linalg.eigvals(alpha * W))))


# ── Sweep ──────────────────────────────────────────────────────────────────────

print("Stage 0d-arch: sweeping 10-variable Marketplace constraint graph...")
print(f"  W row sums: {W.sum(axis=1)}  → ρ(W) = {spectral_radius(1.0):.4f}")
print(f"  α values: {len(ALPHA_VALS)}  |  β values: {len(BETA_VALS)}"
      f"  |  {N_INIT} inits each  →  {len(ALPHA_VALS)*len(BETA_VALS)*N_INIT} total runs")
print()

pct_A_map    = np.zeros((len(BETA_VALS), len(ALPHA_VALS)))
dom_type_map = np.full((len(BETA_VALS), len(ALPHA_VALS)), "?")
counts_grid  = {}

for bi, beta in enumerate(BETA_VALS):
    for ai, alpha in enumerate(ALPHA_VALS):
        pct_A, counts, _ = classify_params(alpha, beta)
        pct_A_map[bi, ai]     = pct_A
        counts_grid[(ai, bi)] = counts
        dom  = max(counts, key=counts.get) if counts else "?"
        dom_type_map[bi, ai] = dom
        mark = "✓" if pct_A >= 0.9 else ("~" if pct_A >= 0.5 else "✗")
        print(f"  α={alpha:.2f} β={beta:.1f}  →  "
              f"A={counts.get('A',0):3d} B={counts.get('B',0):3d} "
              f"C={counts.get('C',0):3d} D={counts.get('D',0):3d}  [{mark}]")

# Hysteresis spot-checks at representative operating points
spot_pairs = [(1.0, 0.0), (1.5, 1.0), (2.0, 2.0)]
h_spots    = {}
for alpha, beta in spot_pairs:
    h_spots[(alpha, beta)] = hysteresis_spot(alpha, beta)

# Spectral radius curve (linear case)
scales    = np.linspace(0.05, 4.0, 80)
rho_curve = np.array([spectral_radius(s) for s in scales])
crit_idx  = np.searchsorted(rho_curve, 1.0)
crit_scale = scales[crit_idx] if crit_idx < len(scales) else float("inf")


# ── Report ─────────────────────────────────────────────────────────────────────

alpha_op = (ALPHA_VALS >= 0.5) & (ALPHA_VALS <= 1.5)
beta_op  = (BETA_VALS  >= 0.0) & (BETA_VALS  <= 2.0)
op_A_pct = pct_A_map[np.ix_(beta_op, alpha_op)].mean() * 100
kill_triggered = op_A_pct < 50.0

rho_at_default = spectral_radius(1.0)

lines = [
    "",
    "══════════════════════════════════════════════════════════════════",
    "  Stage 0d-arch: Expanded Marketplace Convergence Harness",
    "  10-variable constraint graph (marketplace-dynamics-v0.md §10)",
    "  Layer 3 (Architecture) | Evidence status: Unknown",
    "══════════════════════════════════════════════════════════════════",
    "",
    "  Variables: Trust, Evidence, Support, Outcomes, Reputation,",
    "             Match, Resolution, Resources, Governance, Value",
    "",
    "  §7 Classification Table:",
    "    A = Unique convergence (well-defined)    ✓",
    "    B = Multistability (path-dependent)      ⚠",
    "    C = Limit cycle / non-convergent         ✗",
    "    D = Divergence                           ✗",
    "",
    f"  Coupling matrix W: all row sums = 0.70",
    f"  ρ(W) = {rho_at_default:.4f}  (linear stability at α=1.0)",
    f"  Linear stability boundary: ρ(αW)=1 at α ≈ {crit_scale:.2f}",
    "",
    f"  Sweep: α ∈ [{ALPHA_VALS[0]},{ALPHA_VALS[-1]}] ({len(ALPHA_VALS)} pts)  ×  "
    f"β ∈ [{BETA_VALS[0]},{BETA_VALS[-1]}] ({len(BETA_VALS)} pts)",
    f"  {N_INIT} random initialisations per grid point",
    "",
    "  Operating region (α ∈ [0.5,1.5], β ∈ [0,2]):",
    f"    Mean Type-A rate: {op_A_pct:.1f}%",
    f"    Kill condition triggered? {'YES — §6 needs redesign' if kill_triggered else 'NO — architecture holds in op. region'}",
    "",
    "  Hysteresis spot-checks (Trust pressure sweep, all variables):",
]
for (a, b), h in h_spots.items():
    tag = "path-indep" if h < THRESHOLD_H else "PATH-DEPENDENT"
    lines.append(f"    α={a:.1f} β={b:.1f}  max h = {h:.2e}  [{tag}]")

lines += [
    "",
    "  Independence note:",
    "  These results do NOT confirm or refute D4 (sacred value hysteresis).",
    "  They test only structural well-posedness of the expanded §6 constraint graph.",
    "  Architectural hysteresis here would indicate a constraint graph defect,",
    "  not confirmation of D4.",
    "══════════════════════════════════════════════════════════════════",
]

body = "\n".join(lines)
print(body)
(OUT / "stage0d_arch_report.txt").write_text(body)
print(f"\n  Report → {OUT / 'stage0d_arch_report.txt'}")


# ── Plots ──────────────────────────────────────────════════════════════════════

fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle(
    "Stage 0d-arch: Expanded Marketplace (10-var) — §7 Convergence Classification\n"
    "Layer 3 (Architecture) | Evidence: Unknown",
    fontsize=11, fontweight="bold"
)

# Plot 1: Type-A rate heatmap
ax = axes[0, 0]
im = ax.imshow(pct_A_map, origin="lower", aspect="auto",
               cmap="RdYlGn", vmin=0, vmax=1,
               extent=[ALPHA_VALS[0]-0.05, ALPHA_VALS[-1]+0.05,
                       BETA_VALS[0]-0.1,  BETA_VALS[-1]+0.1])
ax.set_xlabel("Coupling scale α")
ax.set_ylabel("Nonlinearity β")
ax.set_title("Type-A rate\n(unique convergence %)")
fig.colorbar(im, ax=ax, fraction=0.046)
rect = Rectangle((0.5, 0.0), 1.0, 2.0, lw=2, edgecolor="black",
                  facecolor="none", linestyle="--", label="op. region")
ax.add_patch(rect)
ax.legend(fontsize=8)

# Plot 2: Dominant type map
type_to_int = {"A": 3, "B": 2, "C": 1, "D": 0}
dom_int_map = np.array(
    [[type_to_int.get(dom_type_map[bi, ai], -1)
      for ai in range(len(ALPHA_VALS))]
     for bi in range(len(BETA_VALS))]
)
ax = axes[0, 1]
cmap2 = matplotlib.colormaps["RdYlGn"].resampled(4)
im2 = ax.imshow(dom_int_map, origin="lower", aspect="auto",
                cmap=cmap2, vmin=-0.5, vmax=3.5,
                extent=[ALPHA_VALS[0]-0.05, ALPHA_VALS[-1]+0.05,
                        BETA_VALS[0]-0.1,  BETA_VALS[-1]+0.1])
ax.set_xlabel("Coupling scale α")
ax.set_ylabel("Nonlinearity β")
ax.set_title("Dominant type per cell\n(A=green, B=yellow, C=orange, D=red)")
cbar2 = fig.colorbar(im2, ax=ax, fraction=0.046, ticks=[0, 1, 2, 3])
cbar2.set_ticklabels(["D", "C", "B", "A"])
rect2 = Rectangle((0.5, 0.0), 1.0, 2.0, lw=2, edgecolor="black",
                   facecolor="none", linestyle="--")
ax.add_patch(rect2)

# Plot 3: Type distribution at α=1.0 across β
ax = axes[1, 0]
alpha_idx_1 = np.argmin(np.abs(ALPHA_VALS - 1.0))
A_slice = pct_A_map[:, alpha_idx_1]
B_slice = np.array([counts_grid.get((alpha_idx_1, bi), {}).get("B", 0) / N_INIT
                    for bi in range(len(BETA_VALS))])
C_slice = np.array([counts_grid.get((alpha_idx_1, bi), {}).get("C", 0) / N_INIT
                    for bi in range(len(BETA_VALS))])
D_slice = np.array([counts_grid.get((alpha_idx_1, bi), {}).get("D", 0) / N_INIT
                    for bi in range(len(BETA_VALS))])
ax.stackplot(BETA_VALS,
             A_slice, B_slice, C_slice, D_slice,
             labels=["A (unique)", "B (multi)", "C (cycle)", "D (diverge)"],
             colors=["#4CAF50", "#FFEB3B", "#FF9800", "#F44336"],
             alpha=0.85)
ax.set_xlabel("Nonlinearity β")
ax.set_ylabel("Fraction of runs")
ax.set_title(f"Type distribution at α=1.0\n(default coupling scale)")
ax.legend(fontsize=8, loc="upper right")
ax.set_ylim(0, 1)
ax.grid(alpha=0.2)

# Plot 4: Spectral radius vs α (linear case, β=0)
ax = axes[1, 1]
ax.plot(scales, rho_curve, color="steelblue", lw=2, label="ρ(αW)")
ax.axhline(1.0, color="red", ls="--", lw=1.2, label="stability boundary ρ=1")
ax.axvline(1.0, color="gray", ls=":", lw=1, label="α=1.0 (default)")
if crit_scale < 3.5:
    ax.axvline(crit_scale, color="orange", ls="--", lw=1.2,
               label=f"α_crit ≈ {crit_scale:.2f}")
ax.fill_between(scales, rho_curve, 1.0,
                where=rho_curve >= 1.0,
                color="red", alpha=0.10, label="divergent (linear)")
ax.set_xlabel("Coupling scale α")
ax.set_ylabel("ρ(αW)")
ax.set_title("Spectral radius — 10-var system\n(linear case, β=0)")
ax.legend(fontsize=7)
ax.grid(alpha=0.2)
ax.set_xlim(0, 4)

plt.tight_layout()
plot_path = OUT / "stage0d_arch_convergence.png"
fig.savefig(plot_path, dpi=150, bbox_inches="tight")
plt.close(fig)
print(f"  Plot  → {plot_path}")
