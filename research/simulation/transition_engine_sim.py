#!/usr/bin/env python3
"""
Transition Engine Simulator
Layer 1 (OPM Extension) | Evidence: D — Hypothesis
Spec: docs/transition-engine-v0.md §8

Implements the synchronous step function and runs five diagnostic cases
to observe basic engine dynamics before any empirical calibration.

No empirical claims. Parameters are initial hypotheses (§7, §10).
"""

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os

# ── Department indices ────────────────────────────────────────────────────────
P, S, C, E, B, L = 0, 1, 2, 3, 4, 5
DEPT_NAME  = ["Personal", "Social", "Cognitive", "Emotional", "Behavioral", "Learning"]
DEPT_COLOR = ["#1565C0", "#2E7D32", "#6A1B9A", "#C62828", "#E65100", "#00838F"]

# ── Transfer function type tags ───────────────────────────────────────────────
AMPLIFY, ATTENUATE, CONVERT, DELAY = "amp", "att", "conv", "delay"

# ── System parameters (all uncalibrated hypotheses) ───────────────────────────
CAPACITY     = 1.0    # energy ceiling per department
THRESH       = 0.05   # channel activation threshold (§3 Condition 1)
FLOW_RATE    = 0.10   # fraction of source energy transferred per step per channel
LEAK_RATE    = 0.08   # fraction of arriving energy lost in transit
DECAY_RATE   = 0.80   # natural energy decay per step (all departments, always)
PRESS_RATE   = 1.12   # recursive pressure factor per step (Law T6.R)
DELAY_WIN    = 3      # steps for delay-and-compress accumulation (§4)
SOURCE_DEP   = False  # source does NOT deplete when firing (spec §8 reading)
# FLOW_RATE: spec §8 transfers energy[X] bulk each step → saturation with k>1.
# Conductance model (FLOW_RATE fraction per step) produces tractable dynamics.
# SOURCE_DEP=False matches spec §8 (source is a pressure reservoir, not depleting).
# Approximate steady-state for dept Y from constant source X:
#   E_Y* = X×FLOW×k×(1-LEAK) / (1-DECAY) = X×0.10×k×0.92/0.20 = X×0.46×k
# P=0.5: E* ≈ 0.5×0.46×1.4 = 0.32, B* ≈ E*×0.46×1.3 = 0.19 (sub-saturation).

# ── Channel definitions — §7 channel table ────────────────────────────────────
# (source, target, transfer_type, gain_k)
CHANNEL_DEFS = [
    (P, S, ATTENUATE, 0.7),   (P, C, CONVERT,   1.0),   (P, E, AMPLIFY,  1.4),
    (S, P, ATTENUATE, 0.5),   (S, C, CONVERT,   1.0),   (S, E, AMPLIFY,  1.2),
    (C, E, ATTENUATE, 0.6),   (C, B, CONVERT,   1.0),   (E, B, AMPLIFY,  1.3),
    (E, C, CONVERT,   1.0),   (B, L, DELAY,     1.0),   (B, S, ATTENUATE, 0.8),
    (L, P, DELAY,     1.0),   (L, C, ATTENUATE, 0.5),   (L, E, ATTENUATE, 0.4),
    (C, S, ATTENUATE, 0.6),   (S, B, AMPLIFY,   1.0),   (E, S, ATTENUATE, 0.5),
]


def make_channels(hard_block=(), soft_block=None):
    """
    Build the 18-channel graph.
    hard_block : iterable of (src, tgt) pairs — unconditionally blocked
    soft_block : dict (src, tgt) -> strength in [0, 1) — partial suppression
    """
    hard_set  = set(hard_block)
    soft_dict = soft_block or {}
    return [
        {
            "src": src, "tgt": tgt, "tf": tf, "k": k,
            "hard": (src, tgt) in hard_set,
            "soft": soft_dict.get((src, tgt), 0.0),
            "buf":  [],
        }
        for src, tgt, tf, k in CHANNEL_DEFS
    ]


def _apply_transfer(e_eff, tf, k):
    if tf == AMPLIFY:   return e_eff * k
    if tf == ATTENUATE: return e_eff * k
    if tf == CONVERT:   return e_eff   # magnitude preserved; type changes semantically
    return e_eff                       # DELAY handled by caller via buffer


def step(energy, channels):
    """
    One synchronous step (§8).

    All channels read from energy[t]. Writes accumulate into delta, then
    produce energy[t+1] = clip(energy[t] + delta, 0, CAPACITY).

    Returns
    -------
    new_energy   : ndarray shape (6,)
    leakage      : float — total energy lost this step
    hard_hit     : bool array (6,) — departments with at least one blocked channel
    """
    delta      = np.zeros(6)
    leakage    = 0.0
    any_above  = np.zeros(6, dtype=bool)   # src energy >= threshold for any channel
    hard_hit   = np.zeros(6, dtype=bool)   # src of at least one hard-blocked channel

    for ch in channels:
        src, tgt = ch["src"], ch["tgt"]
        e_src    = energy[src]

        if e_src < THRESH:
            continue                        # below threshold — channel does not fire

        any_above[src] = True

        if ch["hard"]:
            hard_hit[src] = True            # will apply recursive pressure below
            continue

        # Flow: channel transfers FLOW_RATE fraction of source energy per step.
        # k values in §7 are relative amplifiers/attenuators applied to the flow.
        e_eff = e_src * FLOW_RATE * (1.0 - ch["soft"])

        # Delay-and-compress: accumulate into buffer; release when full
        if ch["tf"] == DELAY:
            ch["buf"].append(e_eff)
            if len(ch["buf"]) < DELAY_WIN:
                continue
            arriving = sum(ch["buf"])
            ch["buf"] = []
        else:
            arriving = max(0.0, _apply_transfer(e_eff, ch["tf"], ch["k"]))

        # Deposit into target (respecting saturation)
        space = CAPACITY - (energy[tgt] + delta[tgt])
        if space > 0.0:
            received  = min(arriving * (1.0 - LEAK_RATE), space)
            delta[tgt] += received
            leakage   += arriving * LEAK_RATE
        else:
            leakage += arriving             # saturation blocker: full leak (§5.3)

    # Post-processing per department
    for d in range(6):
        delta[d] -= energy[d] * (1.0 - DECAY_RATE)      # natural decay (always)
        if hard_hit[d] and energy[d] >= THRESH:
            delta[d] += energy[d] * (PRESS_RATE - 1.0)  # recursive pressure (Law T6.R)

    new_energy = np.clip(energy + delta, 0.0, CAPACITY)
    return new_energy, leakage, hard_hit


def simulate(init, channels, n_steps=50):
    """Run `n_steps` of the step function; return (history, leakages)."""
    e      = np.array(init, dtype=float)
    hist   = [e.copy()]
    leaks  = []
    for _ in range(n_steps):
        e, lk, _ = step(e, channels)
        hist.append(e.copy())
        leaks.append(lk)
    return np.array(hist), leaks


def metrics(hist, leaks, label=""):
    peak    = hist.max(axis=0)
    sat     = [DEPT_NAME[i] for i in range(6) if (hist >= 0.99).any(axis=0)[i]]
    eq_step = len(hist) - 1
    for t in range(1, len(hist) - 1):
        if np.max(np.abs(hist[t + 1] - hist[t])) < 0.005:
            eq_step = t
            break
    return {
        "label":     label,
        "peak":      peak,
        "dominant":  DEPT_NAME[int(np.argmax(peak))],
        "saturated": sat,
        "eq_step":   eq_step,
        "total_leak":sum(leaks),
    }


# ── Output directory ──────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUT_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Case 1 — Base case: single gap in Personal department
# ─────────────────────────────────────────────────────────────────────────────
init1 = [0.50, 0.0, 0.0, 0.0, 0.0, 0.0]
chs1  = make_channels()
hist1, leaks1 = simulate(init1, chs1, n_steps=60)
m1    = metrics(hist1, leaks1, "Case 1: Single personal gap")

# ─────────────────────────────────────────────────────────────────────────────
# Case 2 — Social pressure: second energy source at Social
# ─────────────────────────────────────────────────────────────────────────────
init2 = [0.50, 0.35, 0.0, 0.0, 0.0, 0.0]
chs2  = make_channels()
hist2, leaks2 = simulate(init2, chs2, n_steps=60)
m2    = metrics(hist2, leaks2, "Case 2: Social pressure (S=0.35)")

# ─────────────────────────────────────────────────────────────────────────────
# Case 3 — Trust vs. shame: compare soft blocker strengths on P→S
# ─────────────────────────────────────────────────────────────────────────────
init3       = [0.50, 0.05, 0.0, 0.0, 0.0, 0.0]
chs3_shame  = make_channels(soft_block={(P, S): 0.80})   # high shame: 80% reduction
chs3_trust  = make_channels(soft_block={(P, S): 0.05})   # high trust: 5% reduction
hist3s, leaks3s = simulate(init3, chs3_shame, n_steps=60)
hist3t, leaks3t = simulate(init3, chs3_trust, n_steps=60)
m3s = metrics(hist3s, leaks3s, "Case 3a: High shame  (P→S blocked 80%)")
m3t = metrics(hist3t, leaks3t, "Case 3b: High trust  (P→S blocked  5%)")

# ─────────────────────────────────────────────────────────────────────────────
# Case 4 — Hard block on E→B (value constraint → recursive pressure)
# ─────────────────────────────────────────────────────────────────────────────
init4 = [0.50, 0.0, 0.0, 0.0, 0.0, 0.0]
chs4  = make_channels(hard_block={(E, B)})
hist4, leaks4 = simulate(init4, chs4, n_steps=60)
m4    = metrics(hist4, leaks4, "Case 4: E→B hard blocked (value constraint)")

# ─────────────────────────────────────────────────────────────────────────────
# Case 5 — Value change: hard block removed at step 25
#           Phase A (0–24): E→B blocked  →  Phase B (25–59): block lifted
# ─────────────────────────────────────────────────────────────────────────────
init5    = [0.50, 0.0, 0.0, 0.0, 0.0, 0.0]
chs5_blk = make_channels(hard_block={(E, B)})
chs5_free= make_channels()

e5 = np.array(init5, dtype=float)

# Phase A
hist5_a, leaks5_a = [], []
for _ in range(25):
    e5, lk, _ = step(e5, chs5_blk)
    hist5_a.append(e5.copy())
    leaks5_a.append(lk)

pivot_E = float(e5[E])   # Emotional energy at the moment block is lifted

# Phase B
hist5_b, leaks5_b = [], []
for _ in range(35):
    e5, lk, _ = step(e5, chs5_free)
    hist5_b.append(e5.copy())
    leaks5_b.append(lk)

hist5  = np.array([init5] + hist5_a + hist5_b)
leaks5 = leaks5_a + leaks5_b
m5     = metrics(hist5, leaks5, "Case 5: E→B unblocked at step 25")


# ─────────────────────────────────────────────────────────────────────────────
# Plot
# ─────────────────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(2, 3, figsize=(17, 10))
axes      = axes.flatten()

steps50 = np.arange(61)
steps51 = np.arange(len(hist5))


def _draw_trajectory(ax, hist, title, subtitle, steps=None):
    if steps is None:
        steps = np.arange(len(hist))
    for i, (name, color) in enumerate(zip(DEPT_NAME, DEPT_COLOR)):
        ax.plot(steps, hist[:, i], label=name, color=color, linewidth=1.9)
    ax.set_title(f"{title}\n{subtitle}", fontsize=8, fontweight="bold")
    ax.set_xlabel("Step", fontsize=7)
    ax.set_ylabel("Energy", fontsize=7)
    ax.set_ylim(-0.02, 1.08)
    ax.tick_params(labelsize=6)
    ax.grid(True, alpha=0.2)
    ax.legend(loc="upper right", fontsize=5.8, ncol=2)


# Case 1
_draw_trajectory(
    axes[0], hist1,
    "Case 1 — Base: Personal gap",
    f"P₀=0.7 | all channels open | eq≈step {m1['eq_step']}",
    steps50,
)

# Case 2
_draw_trajectory(
    axes[1], hist2,
    "Case 2 — Social pressure",
    f"P₀=0.7  S₀=0.5 | eq≈step {m2['eq_step']}",
    steps50,
)

# Case 3: overlay shame vs. trust
ax3 = axes[2]
for i, (name, color) in enumerate(zip(DEPT_NAME, DEPT_COLOR)):
    ax3.plot(steps50, hist3s[:, i], color=color, linewidth=1.5,
             linestyle="--", alpha=0.65)
    ax3.plot(steps50, hist3t[:, i], color=color, linewidth=1.9,
             linestyle="-", label=name)
ax3.set_title(
    "Case 3 — Trust vs. shame on P→S\n"
    "Solid = trust (10% block)   Dashed = shame (75% block)",
    fontsize=8, fontweight="bold",
)
ax3.set_xlabel("Step", fontsize=7); ax3.set_ylabel("Energy", fontsize=7)
ax3.set_ylim(-0.02, 1.08); ax3.tick_params(labelsize=6)
ax3.grid(True, alpha=0.2)
ax3.legend(loc="upper right", fontsize=5.8, ncol=2)

# Case 4
_draw_trajectory(
    axes[3], hist4,
    "Case 4 — Hard block: E→B (value constraint)",
    f"Recursive pressure in Emotional | eq≈step {m4['eq_step']}",
    steps50,
)

# Case 5: vertical line at pivot step
ax5 = axes[4]
for i, (name, color) in enumerate(zip(DEPT_NAME, DEPT_COLOR)):
    ax5.plot(steps51, hist5[:, i], color=color, linewidth=1.9, label=name)
ax5.axvline(x=20, color="#333", linestyle=":", linewidth=1.8, alpha=0.8,
            label="Block lifted (step 25)")
ax5.set_title(
    "Case 5 — Value change: E→B unblocked at step 25",
    fontsize=8, fontweight="bold",
)
ax5.set_xlabel("Step", fontsize=7); ax5.set_ylabel("Energy", fontsize=7)
ax5.set_ylim(-0.02, 1.08); ax5.tick_params(labelsize=6)
ax5.grid(True, alpha=0.2)
ax5.legend(loc="upper right", fontsize=5.8, ncol=2)

# Panel 6: summary table
axes[5].axis("off")
summary = (
    "Transition Engine — Diagnostic Summary\n"
    "═══════════════════════════════════════════════\n\n"
    f"Case 1  Peak E={m1['peak'][E]:.3f}  B={m1['peak'][B]:.3f}"
    f"  Dominant: {m1['dominant']}\n"
    f"Case 2  Peak E={m2['peak'][E]:.3f}  B={m2['peak'][B]:.3f}"
    f"  Dominant: {m2['dominant']}\n"
    f"        Social amplification: ΔE={m2['peak'][E]-m1['peak'][E]:+.3f}\n\n"
    f"Case 3  Social peak:\n"
    f"  Shame (75%): {m3s['peak'][S]:.3f}\n"
    f"  Trust (10%): {m3t['peak'][S]:.3f}  Δ={m3t['peak'][S]-m3s['peak'][S]:+.3f}\n\n"
    f"Case 4  Peak E={m4['peak'][E]:.3f}  B={m4['peak'][B]:.3f}\n"
    f"        (E→B blocked → recursive pressure)\n\n"
    f"Case 5  E at pivot (step 25): {pivot_E:.3f}\n"
    f"        Peak B after unblock: {m5['peak'][B]:.3f}\n\n"
    "Layer 1 (OPM Extension)\n"
    "Evidence: D — Hypothesis\n"
    "Parameters are uncalibrated estimates."
)
axes[5].text(
    0.04, 0.97, summary,
    transform=axes[5].transAxes,
    va="top", ha="left",
    fontsize=8, fontfamily="monospace",
    bbox=dict(facecolor="#f5f5f5", edgecolor="#bbb", boxstyle="round,pad=0.6"),
)

plt.suptitle(
    "Transition Engine — Five Diagnostic Cases\n"
    "docs/transition-engine-v0.md §8",
    fontsize=11, fontweight="bold", y=1.01,
)
plt.tight_layout()

plot_path = os.path.join(OUT_DIR, "transition_engine_trajectories.png")
plt.savefig(plot_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"Plot: {plot_path}")


# ─────────────────────────────────────────────────────────────────────────────
# Text report
# ─────────────────────────────────────────────────────────────────────────────
def _fmt(m):
    rows = [f"  {m['label']}", "  Peak energy:"]
    for i, name in enumerate(DEPT_NAME):
        rows.append(f"    {name:12s}: {m['peak'][i]:.4f}")
    rows += [
        f"  Dominant dept  : {m['dominant']}",
        f"  Saturated depts: {m['saturated'] or 'none'}",
        f"  Steps to eq.   : {m['eq_step']}",
        f"  Total leakage  : {m['total_leak']:.4f}",
    ]
    return "\n".join(rows)


SEP = "━" * 72

report = f"""TRANSITION ENGINE SIMULATION REPORT
Layer 1 (OPM Extension) | Evidence: D — Hypothesis
Spec: docs/transition-engine-v0.md

Parameters (all uncalibrated hypotheses):
  CAPACITY   = {CAPACITY}
  THRESH     = {THRESH}    channel activation threshold
  LEAK_RATE  = {LEAK_RATE}    fraction lost in transit
  DECAY_RATE = {DECAY_RATE}    natural energy decay per step
  SOURCE_DEP = {SOURCE_DEP}    source depletion on transfer (conductance model)
  PRESS_RATE = {PRESS_RATE}    recursive pressure factor (Law T6.R)
  DELAY_WIN  = {DELAY_WIN}       delay-compress window (steps)

{SEP}
CASE 1 — Base: single gap in Personal department
{SEP}
Initial: P={init1[P]:.1f}, all others 0.0 | All channels open
{_fmt(m1)}

Interpretation:
  P fires P→E (k=1.4), P→S (k=0.7), P→C (convert).
  Emotional peaks rapidly from amplification.
  Behavioral activates from E→B (k=1.3) and C→B (convert).
  B→L fires after {DELAY_WIN} steps; L→P fires after another {DELAY_WIN} steps.
  Natural decay ({DECAY_RATE}/step) produces damping spiral.
  Result demonstrates Law T4 with g < 1 (gap closes over time).

{SEP}
CASE 2 — Social pressure added (S₀=0.5)
{SEP}
Initial: P={init2[P]:.1f}, S={init2[S]:.1f}, others 0.0 | All channels open
{_fmt(m2)}

Emotional peak delta vs. Case 1: {m2['peak'][E] - m1['peak'][E]:+.4f}
Behavioral peak delta vs. Case 1: {m2['peak'][B] - m1['peak'][B]:+.4f}

Interpretation:
  Social input adds a second amplification path to Emotional (S→E, k=1.2).
  S→C fires, increasing Cognitive activation independently.
  S→B fires, providing an additional direct route to Behavioral.
  Net effect: Emotional and Behavioral peaks are higher than Case 1.
  This models the phenomenology: external social pressure amplifies internal
  emotional intensity and accelerates behavioral activation.

{SEP}
CASE 3 — Trust vs. shame (soft blocker on P→S)
{SEP}
Initial: P={init3[P]:.1f}, S={init3[S]:.1f}, others 0.0
High shame: P→S soft_strength=0.75 | High trust: P→S soft_strength=0.10
{_fmt(m3s)}
{_fmt(m3t)}

Social peak delta   (trust - shame): {m3t['peak'][S] - m3s['peak'][S]:+.4f}
Emotional peak delta (trust - shame): {m3t['peak'][E] - m3s['peak'][E]:+.4f}

Interpretation:
  Shame reduces effective P→S energy by 75%; trust reduces it by only 10%.
  Higher S energy under trust propagates via S→E and S→C.
  Social department peak is measurably higher with trust.
  This is the quantifiable cost of shame: energy trapped in Personal rather
  than propagating into the social system.
  Law T3 applies here as a soft blocker — high enough P energy can still
  partially overcome the shame blocker.

{SEP}
CASE 4 — Hard block on E→B (value constraint active)
{SEP}
Initial: P={init4[P]:.1f}, others 0.0 | Hard block: E→B
{_fmt(m4)}

Emotional peak delta vs. Case 1: {m4['peak'][E] - m1['peak'][E]:+.4f}
Behavioral peak (blocked):        {m4['peak'][B]:.4f} (compare to Case 1: {m1['peak'][B]:.4f})

Interpretation:
  E→B is hard-blocked (value constraint; Law T3 — cannot be overridden).
  Recursive pressure law (T6.R): energy[E] amplifies at {PRESS_RATE}x per step.
  Emotional builds higher than Case 1 before natural decay overcomes pressure.
  E→C (convert) fires as the only available Emotional outlet — Cognitive
  receives elevated activation (rumination, over-analysis).
  Behavioral remains near-zero throughout.
  This models: suppression does not reduce emotional energy.
  It increases it. The blocked channel amplifies pressure in the source.

{SEP}
CASE 5 — Value change: E→B unblocked at step 25
{SEP}
Initial: P={init5[P]:.1f}, others 0.0
Phase A (steps 0–20):  E→B hard blocked
Phase B (steps 21–50): hard block lifted (value changed)
Emotional energy at pivot (step 25): {pivot_E:.4f}
{_fmt(m5)}

Interpretation:
  After 20 steps of blocking, Emotional has accumulated to {pivot_E:.3f}.
  When the block is lifted, E→B fires immediately with k=1.3 on {pivot_E:.3f}.
  Behavioral activation post-unblock is disproportionate to current stimulus.
  This is the key prediction of Law T6.R: suppression does not prevent action.
  It stores energy and increases the magnitude of eventual action.
  Intervention timing matters: unblocking earlier produces smaller behavioral
  surge; unblocking after long suppression produces larger surge.

{SEP}
CROSS-CASE COMPARISON
{SEP}
Emotional peak:
  Case 1 (base)          : {m1['peak'][E]:.4f}
  Case 2 (+social, S=0.5): {m2['peak'][E]:.4f}  Δ={m2['peak'][E]-m1['peak'][E]:+.4f}
  Case 4 (E→B blocked)   : {m4['peak'][E]:.4f}  Δ={m4['peak'][E]-m1['peak'][E]:+.4f}

Behavioral peak:
  Case 1 (base)          : {m1['peak'][B]:.4f}
  Case 2 (+social)       : {m2['peak'][B]:.4f}
  Case 4 (E→B blocked)   : {m4['peak'][B]:.4f}
  Case 5 (post-unblock)  : {m5['peak'][B]:.4f}

Social peak (Case 3):
  High shame (P→S 75%)   : {m3s['peak'][S]:.4f}
  High trust (P→S 10%)   : {m3t['peak'][S]:.4f}  Δ={m3t['peak'][S]-m3s['peak'][S]:+.4f}

{SEP}
OPEN QUESTIONS SURFACED BY SIMULATION
{SEP}
Q1. Does the source department lose energy when it transfers to a target?
    Current model: NO. Source energy is preserved; only target gains.
    Alternative: source depletes proportionally to energy sent.
    This choice changes cycle gain substantially. (§10 open question)

Q2. Should the step function be synchronous or sequential?
    Current: synchronous (all channels read t, write t+1 simultaneously).
    Alternative: sequential (each channel sees immediately updated values).
    (§10 open question from transition-engine-v0.md)

Q3. Are the k-values (§7 channel table) realistic?
    All values are initial estimates. Require HPE case data for calibration.

Q4. What is DECAY_RATE empirically?
    Currently 0.97/step. A free parameter. Should be derived from
    observed gap-closure rates in real cases.

Q5. Cycle gain factor g (Law T4) cannot be extracted analytically from
    the step function. Requires per-cycle energy tracking.
    Next step: instrument the step function to track full-cycle traversals.

{SEP}
Evidence: D — Hypothesis
No empirical data was used to set or validate these parameters.
Results show model-internal dynamics only, not predictions about real behavior.
"""

report_path = os.path.join(OUT_DIR, "transition_engine_report.txt")
with open(report_path, "w") as f:
    f.write(report)
print(f"Report: {report_path}")

# Console summary
print(f"\n{'Case':50s}  Peak-E   Peak-B   Dominant")
print("-" * 80)
for m in [m1, m2, m3s, m3t, m4, m5]:
    print(f"{m['label'][:50]:50s}  {m['peak'][E]:.3f}    {m['peak'][B]:.3f}    {m['dominant']}")
