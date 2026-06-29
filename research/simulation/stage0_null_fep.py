#!/usr/bin/env python3
"""
Stage 0: Locked Null FEP Model — Hysteresis Test
=================================================
QUESTION: Does a minimal, locked free-energy landscape produce spurious
hysteresis under pressure sweep?

AXIOM 1 GATE:
  h > THRESHOLD → Axiom 1 FAILS (null model already breaks; stop here)
  h ≈ 0 across all π → Stage 0 PASSES → human-subject testing justified

NULL MODEL (locked — nothing adapts):
  F(μ, s, π) = (π/2)(μ − s)² + ((1−π)/2)μ²

  μ  = internal state (belief)
  s  = sensory input (pressure)
  π  ∈ (0,1) = precision, FIXED — no dynamic update

ANALYTICAL SOLUTION (convex, unique minimum):
  ∂F/∂μ = 0  →  μ* = π·s       (linear in s)

PREDICTION FOR NULL MODEL:
  Because μ* = π·s is linear, up-sweep and down-sweep reach the SAME
  equilibrium at every s.  Therefore h ≡ |μ*(up) − μ*(down)| = 0.

  Any h > THRESHOLD indicates a simulation bug, not a model property.

WHAT STAGE 0 DOES NOT TEST:
  — Hierarchical FEP models
  — Dynamic precision (state-dependent π)
  — Value constraints
  — Social network effects
  Those belong to Stage 1+.
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

THRESHOLD   = 1e-6        # h below this counts as zero
S_MIN       = -3.0        # pressure sweep bounds
S_MAX       =  3.0
N_POINTS    = 121         # sweep resolution
N_STEPS     = 10_000      # gradient-descent steps per point
LR          = 0.05        # learning rate
TOL         = 1e-13       # convergence tolerance for GD

PRECISION_VALUES = np.round(np.linspace(0.05, 0.95, 19), 3)

OUT = Path(__file__).parent / "output"
OUT.mkdir(parents=True, exist_ok=True)


# ── Model ─────────────────────────────────────────────────────────────────────

def free_energy(mu: np.ndarray, s: float, pi: float) -> np.ndarray:
    return 0.5 * pi * (mu - s) ** 2 + 0.5 * (1.0 - pi) * mu ** 2


def grad_F(mu: float, s: float, pi: float) -> float:
    return mu - pi * s          # closed form: π(μ−s) + (1−π)μ = μ − πs


def analytical_eq(s: float, pi: float) -> float:
    return pi * s               # unique minimum of F


def gradient_descent(s: float, pi: float, mu_init: float) -> float:
    mu = mu_init
    for _ in range(N_STEPS):
        g   = grad_F(mu, s, pi)
        mu2 = mu - LR * g
        if abs(mu2 - mu) < TOL:
            return mu2
        mu = mu2
    return mu


# ── Hysteresis sweep ──────────────────────────────────────────────────────────

def sweep(pi: float) -> dict:
    s_vals = np.linspace(S_MIN, S_MAX, N_POINTS)

    # Up sweep — carry equilibrium forward
    mu_up = np.empty(N_POINTS)
    mu = gradient_descent(s_vals[0], pi, mu_init=0.0)
    for i, s in enumerate(s_vals):
        mu = gradient_descent(s, pi, mu_init=mu)
        mu_up[i] = mu

    # Down sweep — carry equilibrium backward
    mu_down = np.empty(N_POINTS)
    mu = gradient_descent(s_vals[-1], pi, mu_init=0.0)
    for i, s in enumerate(reversed(s_vals)):
        mu = gradient_descent(s, pi, mu_init=mu)
        mu_down[N_POINTS - 1 - i] = mu

    mu_ref = pi * s_vals          # analytical μ* = π·s

    h          = np.abs(mu_up - mu_down)
    err_gd     = np.max(np.abs(mu_up - mu_ref))   # GD vs analytical

    return dict(s=s_vals, mu_up=mu_up, mu_down=mu_down,
                mu_ref=mu_ref, h=h,
                max_h=float(np.max(h)),
                err_gd=float(err_gd))


# ── Run ───────────────────────────────────────────────────────────────────────

def run() -> dict:
    print("Stage 0 — Null FEP Model")
    print(f"Sweeping {len(PRECISION_VALUES)} precision values: "
          f"{PRECISION_VALUES[0]:.2f} → {PRECISION_VALUES[-1]:.2f}")
    results = {}
    for pi in PRECISION_VALUES:
        results[pi] = sweep(pi)
        verdict = "pass" if results[pi]["max_h"] < THRESHOLD else "FAIL"
        print(f"  π={pi:.3f}  max_h={results[pi]['max_h']:.2e}  [{verdict}]")
    return results


# ── Report ────────────────────────────────────────────────────────────────────

def report(results: dict) -> bool:
    max_h_global = max(r["max_h"] for r in results.values())
    passed       = max_h_global < THRESHOLD

    lines = [
        "",
        "══════════════════════════════════════════════════════",
        "  Stage 0 — Null FEP Model — Report",
        "══════════════════════════════════════════════════════",
        f"  {'π':>8}  {'max h':>12}  {'GD error':>12}  {'verdict':>8}",
        "  " + "─" * 48,
    ]
    for pi, r in sorted(results.items()):
        v = "PASS" if r["max_h"] < THRESHOLD else "FAIL"
        lines.append(
            f"  {pi:>8.3f}  {r['max_h']:>12.2e}  {r['err_gd']:>12.2e}  {v:>8}"
        )
    lines += [
        "",
        f"  Global max h : {max_h_global:.2e}",
        f"  Threshold    : {THRESHOLD:.2e}",
        "",
    ]
    if passed:
        lines += [
            "  RESULT: PASS",
            "  Null model shows h ≈ 0 across all precision values.",
            "  No spurious hysteresis — simulation is clean.",
            "  Axiom 1 survives the null kill attempt.",
            "  Proceed to Stage 1 (non-linear landscape / dynamic precision).",
        ]
    else:
        lines += [
            "  RESULT: FAIL",
            "  h > threshold under null model.",
            "  Axiom 1 fails: simulation bug or model mis-specification.",
            "  Do not proceed to Stage 1.",
        ]
    lines.append("══════════════════════════════════════════════════════")

    body = "\n".join(lines)
    print(body)

    txt = OUT / "stage0_report.txt"
    txt.write_text(body)
    print(f"\n  Report  → {txt}")
    return passed


# ── Plots ─────────────────────────────────────────────────────────────────────

def plots(results: dict):
    pi_list = sorted(results.keys())
    s_ref   = results[pi_list[0]]["s"]
    mu_range = np.linspace(S_MIN - 1, S_MAX + 1, 400)

    fig = plt.figure(figsize=(14, 10))
    gs  = gridspec.GridSpec(2, 2, figure=fig, hspace=0.42, wspace=0.34)

    # 1 — Free-energy landscapes at s=1.5
    ax = fig.add_subplot(gs[0, 0])
    for pi in [0.1, 0.3, 0.5, 0.7, 0.9]:
        F = free_energy(mu_range, s=1.5, pi=pi)
        ax.plot(mu_range, F, label=f"π={pi:.1f}")
    ax.axvline(1.5, color="gray", lw=0.8, ls="--", label="s=1.5")
    ax.set(xlabel="μ", ylabel="F(μ)", title="Free-energy landscapes  (s = 1.5)",
           ylim=(-0.2, 7))
    ax.legend(fontsize=7)
    ax.grid(alpha=0.2)

    # 2 — Equilibrium μ* vs s  (should be linear: μ* = π·s)
    ax = fig.add_subplot(gs[0, 1])
    for pi in [0.1, 0.3, 0.5, 0.7, 0.9]:
        r = results[pi]
        ax.plot(r["s"], r["mu_up"],  lw=2.0, label=f"π={pi:.1f}")
        ax.plot(r["s"], r["mu_ref"], lw=0.8, ls="--", alpha=0.45, color="black")
    ax.set(xlabel="s (pressure)", ylabel="μ*",
           title="Equilibrium vs pressure\n(solid = GD,  dashed = analytical π·s)")
    ax.legend(fontsize=7)
    ax.grid(alpha=0.2)

    # 3 — Hysteresis h vs s
    ax = fig.add_subplot(gs[1, 0])
    for pi in [0.1, 0.3, 0.5, 0.7, 0.9]:
        r = results[pi]
        ax.plot(r["s"], r["h"], label=f"π={pi:.1f}")
    ax.axhline(THRESHOLD, color="red", lw=1.2, ls="--",
               label=f"threshold {THRESHOLD:.0e}")
    ax.set(xlabel="s (pressure)", ylabel="h = |μ_up − μ_down|",
           title="Hysteresis h vs pressure", yscale="log")
    ax.legend(fontsize=7)
    ax.grid(alpha=0.2, which="both")

    # 4 — max h vs π
    ax  = fig.add_subplot(gs[1, 1])
    pis = np.array(pi_list)
    mhs = np.array([results[p]["max_h"] for p in pi_list])
    ax.scatter(pis, mhs, s=35, color="steelblue", zorder=3)
    ax.plot(pis, mhs, color="steelblue", alpha=0.6)
    ax.axhline(THRESHOLD, color="red", lw=1.2, ls="--",
               label=f"threshold {THRESHOLD:.0e}")
    ax.set(xlabel="Precision π", ylabel="max h",
           title="Peak hysteresis across precision sweep", yscale="log")
    ax.legend(fontsize=8)
    ax.grid(alpha=0.2, which="both")

    fig.suptitle("Stage 0 — Null FEP Model — Hysteresis Test",
                 fontsize=13, fontweight="bold")

    out = OUT / "stage0_null_fep.png"
    fig.savefig(out, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Plots   → {out}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = run()
    passed  = report(results)
    plots(results)
    raise SystemExit(0 if passed else 1)
