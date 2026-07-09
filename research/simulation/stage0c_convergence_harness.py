#!/usr/bin/env python3
"""
Stage 0c-arch: Layer 3c Convergence Harness
============================================
Layer 3 (Architecture) | Evidence status: Unknown

PURPOSE:
  Classify the constraint graph's convergence behavior across a parameter
  space. Stage 0b-arch tested one point (default weights). This harness
  sweeps two axes and maps where each convergence type dominates.

§7 CLASSIFICATION TABLE (from marketplace-dynamics-v0.md §7):

  Type A — Unique convergence
    All N_INIT inits → same fixed point (spread < ε_spread)
    max h < ε_h (path-independent)
    Verdict: WELL-DEFINED. Architecture holds.

  Type B — Multistability
    Different inits → different fixed points (spread > ε_spread)
    System converges but attractor depends on history.
    Verdict: PATH-DEPENDENT. §6 redesign needed before use.

  Type C — Limit cycle
    System does not settle; variance over last K steps > ε_var.
    Verdict: DYNAMIC INSTABILITY. §6 redesign needed.

  Type D — Divergence
    ||x|| grows without bound (> MAX_NORM).
    Verdict: UNBOUNDED. §6 redesign needed.

SWEEP AXES:
  α — coupling scale  (how strong are the constraint links?)
  β — nonlinearity   (sigmoid sharpness on update functions)
      β=0: linear (reduces to Stage 0b)
      β>0: sigmoid activation introduces clipping and potential multistability

WHAT THIS DOES NOT TEST:
  — Whether the fixed point is *correct* (ground truth unknown)
  — D4 (sacred value hysteresis) — independent research question
  — Product behavior — no runtime code

KILL CONDITION:
  If Type A occupies < 50% of the expected operating region (α ∈ [0.5,1.5],
  β ∈ [0,2]), the §6 constraint graph needs structural redesign before any
  baseline comparison makes sense.
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path
from collections import Counter

OUT = Path(__file__).parent / "output"
OUT.mkdir(parents=True, exist_ok=True)

# ── Configuration ──────────────────────────────────────────────────────────────

N_INIT        = 100     # random inits per parameter point
MAX_ITER      = 3000    # iterations per run
TOL_CONV      = 1e-9    # convergence tolerance (|Δx| < TOL)
EPS_SPREAD    = 1e-4    # fixed-point spread threshold for Type B
EPS_VAR       = 1e-3    # oscillation variance threshold for Type C
MAX_NORM      = 1e6     # divergence threshold for Type D
TAIL_K        = 50      # last K steps used for oscillation check
THRESHOLD_H   = 1e-4    # hysteresis threshold for path-independence check
P_RANGE       = np.linspace(-2, 2, 21)  # pressure sweep for hysteresis

# Sweep grid
ALPHA_VALS = np.round(np.linspace(0.2, 3.0, 15), 3)   # coupling scale
BETA_VALS  = np.round(np.linspace(0.0, 4.0, 12), 3)   # nonlinearity

# Variable layout
TRUST, SUPPORT, OUTCOMES, EVIDENCE, REPUTATION = 0, 1, 2, 3, 4
N    = 5
VARS = ["Trust", "Support", "Outcomes", "Evidence", "Reputation"]

SEED = 42
np.random.seed(SEED)


# ── Update function ────────────────────────────────────────────────────────────

def sigmoid(x, beta):
    """Smooth saturation. beta=0 → identity (linear); large beta → step."""
    if beta == 0.0:
        return x
    return 1.0 / (1.0 + np.exp(-beta * x))


def step(x, alpha, beta, b):
    """
    One synchronous update of the constraint graph.
    Linear structure from §6 scaled by α; sigmoid activation at strength β.
    """
    trust      = x[TRUST]
    support    = x[SUPPORT]
    outcomes   = x[OUTCOMES]
    evidence   = x[EVIDENCE]
    reputation = x[REPUTATION]

    new_trust      = sigmoid(alpha * (0.30 * reputation + 0.30 * evidence) + b[TRUST], beta)
    new_support    = sigmoid(alpha * 0.50 * trust                          + b[SUPPORT], beta)
    new_outcomes   = sigmoid(alpha * (0.40 * support + 0.30 * trust)       + b[OUTCOMES], beta)
    new_evidence   = sigmoid(alpha * 0.60 * outcomes                       + b[EVIDENCE], beta)
    new_reputation = sigmoid(alpha * 0.70 * evidence                       + b[REPUTATION], beta)

    return np.array([new_trust, new_support, new_outcomes, new_evidence, new_reputation])


def run_one(x0, alpha, beta, b=None):
    """
    Iterate from x0 to convergence (or MAX_ITER).
    Returns (final_state, converged, diverged, oscillating).
    """
    if b is None:
        b = np.zeros(N)
    x     = x0.copy()
    tail  = np.zeros((TAIL_K, N))
    for i in range(MAX_ITER):
        x_new = step(x, alpha, beta, b)
        tail[i % TAIL_K] = x_new
        if np.max(np.abs(x_new)) > MAX_NORM:
            return x_new, False, True, False     # diverged
        if np.max(np.abs(x_new - x)) < TOL_CONV:
            return x_new, True,  False, False    # converged
        x = x_new
    # Did not converge — oscillating?
    osc = float(np.max(tail.var(axis=0))) > EPS_VAR
    return x, False, False, osc


# ── §7 Classifier ──────────────────────────────────────────────────────────────

def classify_params(alpha, beta):
    """
    Run N_INIT random initializations. Classify into A/B/C/D.
    Returns (dominant_type, type_counts, fixed_points).
    """
    fps   = []
    types = []
    b     = np.zeros(N)

    for _ in range(N_INIT):
        x0  = np.random.uniform(-3, 3, N)
        xf, conv, div, osc = run_one(x0, alpha, beta, b)
        if div:
            types.append("D")
        elif osc:
            types.append("C")
        elif not conv:
            types.append("C")   # non-converged, non-diverged = limit cycle
        else:
            types.append("_")   # converged — check A vs B below
            fps.append(xf)

    # Distinguish A vs B among converged runs
    if fps:
        fp_arr  = np.array(fps)
        spread  = float(fp_arr.std(axis=0).max())
        label   = "A" if spread < EPS_SPREAD else "B"
        for i, t in enumerate(types):
            if t == "_":
                types[i] = label

    counts = Counter(types)
    pct_A  = counts.get("A", 0) / N_INIT
    return pct_A, counts, np.array(fps) if fps else np.empty((0, N))


# ── Hysteresis spot-check at selected (α, β) ──────────────────────────────────

def hysteresis_spot(alpha, beta):
    """Return max h across the pressure sweep for Trust."""
    b_unit = np.zeros(N)
    b_unit[TRUST] = 1.0

    x        = np.zeros(N)
    mu_up    = []
    for p in P_RANGE:
        x, _, _, _ = run_one(x, alpha, beta, p * b_unit)
        mu_up.append(x.copy())

    x        = mu_up[-1].copy()
    mu_down  = []
    for p in reversed(P_RANGE):
        x, _, _, _ = run_one(x, alpha, beta, p * b_unit)
        mu_down.insert(0, x.copy())

    mu_up   = np.array(mu_up)
    mu_down = np.array(mu_down)
    return float(np.max(np.abs(mu_up - mu_down)))


# ── Sweep ──────────────────────────────────────────────────────────────────────

print("Stage 0c-arch: sweeping parameter space...")
print(f"  α values: {len(ALPHA_VALS)}  |  β values: {len(BETA_VALS)}  "
      f"|  {N_INIT} inits each  →  {len(ALPHA_VALS)*len(BETA_VALS)*N_INIT} total runs")
print()

pct_A_map    = np.zeros((len(BETA_VALS), len(ALPHA_VALS)))
dom_type_map = np.full((len(BETA_VALS), len(ALPHA_VALS)), "?")
counts_grid  = {}

for bi, beta in enumerate(BETA_VALS):
    for ai, alpha in enumerate(ALPHA_VALS):
        pct_A, counts, _ = classify_params(alpha, beta)
        pct_A_map[bi, ai]    = pct_A
        counts_grid[(ai,bi)] = counts
        # Dominant type
        dom = max(counts, key=counts.get) if counts else "?"
        dom_type_map[bi, ai] = dom
        mark = "✓" if pct_A >= 0.9 else ("~" if pct_A >= 0.5 else "✗")
        print(f"  α={alpha:.2f} β={beta:.1f}  →  "
              f"A={counts.get('A',0):3d} B={counts.get('B',0):3d} "
              f"C={counts.get('C',0):3d} D={counts.get('D',0):3d}  [{mark}]")

# Hysteresis at three representative points
spot_pairs = [(1.0, 0.0), (1.5, 1.0), (2.0, 2.0)]
h_spots    = {}
for alpha, beta in spot_pairs:
    h_spots[(alpha, beta)] = hysteresis_spot(alpha, beta)


# ── Report ─────────────────────────────────────────────────────────────────────

# Operating region: α ∈ [0.5, 1.5], β ∈ [0, 2]
alpha_op = (ALPHA_VALS >= 0.5) & (ALPHA_VALS <= 1.5)
beta_op  = (BETA_VALS  >= 0.0) & (BETA_VALS  <= 2.0)
op_A_pct = pct_A_map[np.ix_(beta_op, alpha_op)].mean() * 100

kill_triggered = op_A_pct < 50.0

lines = [
    "",
    "══════════════════════════════════════════════════════════════════",
    "  Stage 0c-arch: Layer 3c Convergence Harness",
    "  Layer 3 (Architecture) | Evidence status: Unknown",
    "══════════════════════════════════════════════════════════════════",
    "",
    "  §7 Classification Table:",
    "    A = Unique convergence (well-defined)    ✓",
    "    B = Multistability (path-dependent)      ⚠",
    "    C = Limit cycle / non-convergent         ✗",
    "    D = Divergence                           ✗",
    "",
    f"  Sweep: α ∈ [{ALPHA_VALS[0]},{ALPHA_VALS[-1]}] ({len(ALPHA_VALS)} pts)  ×  "
    f"β ∈ [{BETA_VALS[0]},{BETA_VALS[-1]}] ({len(BETA_VALS)} pts)",
    f"  {N_INIT} random initialisations per grid point",
    "",
    "  Operating region (α ∈ [0.5,1.5], β ∈ [0,2]):",
    f"    Mean Type-A rate: {op_A_pct:.1f}%",
    f"    Kill condition triggered? {'YES — §6 needs redesign' if kill_triggered else 'NO — architecture holds in op. region'}",
    "",
    "  Hysteresis spot-checks:",
]
for (a, b), h in h_spots.items():
    tag = "path-indep" if h < THRESHOLD_H else "PATH-DEPENDENT"
    lines.append(f"    α={a:.1f} β={b:.1f}  max h = {h:.2e}  [{tag}]")

lines += [
    "",
    "  Independence note:",
    "  These results do NOT confirm or refute D4.",
    "  They test only structural well-posedness of the §6 constraint graph.",
    "══════════════════════════════════════════════════════════════════",
]

body = "\n".join(lines)
print(body)
(OUT / "stage0c_arch_report.txt").write_text(body)
print(f"\n  Report → {OUT / 'stage0c_arch_report.txt'}")


# ── Plots ──────────────────────────────────────────────────────────────────────

fig, axes = plt.subplots(1, 3, figsize=(16, 5))
fig.suptitle(
    "Stage 0c-arch: Layer 3c Convergence Harness — §7 Classification\n"
    "Layer 3 (Architecture) | Evidence: Unknown",
    fontsize=11, fontweight="bold"
)

alpha_labels = [f"{a:.1f}" for a in ALPHA_VALS]
beta_labels  = [f"{b:.1f}" for b in BETA_VALS]

# Plot 1: Type-A rate heatmap
ax = axes[0]
im = ax.imshow(pct_A_map, origin="lower", aspect="auto",
               cmap="RdYlGn", vmin=0, vmax=1,
               extent=[ALPHA_VALS[0]-0.05, ALPHA_VALS[-1]+0.05,
                       BETA_VALS[0]-0.1,  BETA_VALS[-1]+0.1])
ax.set_xlabel("Coupling scale α")
ax.set_ylabel("Nonlinearity β")
ax.set_title("Type-A rate\n(unique convergence %)")
fig.colorbar(im, ax=ax, fraction=0.046)
# Mark operating region
from matplotlib.patches import Rectangle
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
ax = axes[1]
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
ax = axes[2]
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

plt.tight_layout()
plot_path = OUT / "stage0c_arch_convergence.png"
fig.savefig(plot_path, dpi=150, bbox_inches="tight")
plt.close(fig)
print(f"  Plot  → {plot_path}")
