# RFC-020 — Philos Orientation Engine (measurable interface)

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E] for the
interface/harness; [U] + locked theory for the algorithm itself.**
Status: Draft (v0.1, 2026-07-31).

> **Scope discipline (critical).** The *orientation algorithm* — what Philos actually
> does inside — is **locked theory owned by Roei**. Its canonical definition lives in
> the Philos docs (`PHILOS-3-6-9`, `PHILOS-GEOMETRIC-TENSION`, `PHILOS-SUPERNOVA-MODEL`,
> `PHILOS-NEXUS-TRANSLATION`). **This RFC does NOT define, redesign, or approximate that
> algorithm.** It defines only the **engineering shell** that makes the engine
> *measurable, versionable, and comparable* — so Philos stops being "a philosophy" and
> becomes an engineering component you can test, improve, and swap.

## Why this is the most important Philos document
Today Philos is a shell of infrastructure. The one thing missing is the ability to ask:

> **"Given the same inputs and the same criteria, does `philos@v2` produce a better
> orientation than `philos@v1`?"**

The moment that question is answerable, Philos is an engineering artifact. This RFC
makes it answerable — **without touching the locked internal logic.**

## What this RFC defines ([E])

### 1. Input contract
```
OrientationInput {
  observation:  [Event]         # what happened (ADR-003)
  evidence:     [Evidence]      # supporting refs (RFC-000B)
  context:      Context         # relevant state + prior orientation
  constraints:  [Value | Rule]  # normative inputs (RFC-000B `orients`)
  criteria:     [Criterion]     # what "good orientation" is measured against
}
```

### 2. Output contract
```
Orientation {
  decision:        <opaque to the shell; defined by locked theory>
  confidence:      0..1
  weighed_factors: [{factor, weight}]     # what mattered and how much
  alternatives:    [{option, score}]      # options considered + evaluation
  conflicts:       [{between, resolution}]# tensions found + how resolved
  rationale:       str                    # human-readable "why"
  engine_version:  str                    # philos@x.y (RFC-012)
}
```
The shell requires these *fields* for comparability; it does **not** dictate how the
algorithm fills them (that is locked theory).

### 3. Pipeline stage boundaries (observable seams, NOT the logic)
The engine exposes these stages as **measurable boundaries** (OBS-001), so each can be
inspected and compared. **The content of each stage is locked Philos theory:**
```
Observation → Evidence → Context → Weighting → Conflict Resolution
            → Alternative Generation → Evaluation → Decision
```
Each seam emits an Event; the shell measures latency/inputs/outputs per seam. It never
prescribes the internal rule at a seam.

### 4. Evaluation harness (what makes it engineering)
```
Harness(input_set, criteria):
  for version in [v1, v2, ...]:
     run engine@version over the SAME input_set
     score each Orientation against criteria
  → comparison table: which version orients better, where, and why
```
- Same inputs, same criteria, different engine versions (RFC-012 R-4).
- Deterministic replay via the Event log (ADR-003 / INV-5).
- Criteria are **[U]** (Roei defines what "better orientation" means); the harness is
  **[E]**.

## What this RFC explicitly does NOT do
- Define the tension-flow / 3·6·9 / geometric / supernova logic (locked; INV-9).
- Decide what a "good" orientation is (that is `[U]` criteria).
- Replace the canonical Philos docs — it points to them.

## Open [U]
- Canonical mapping from the locked theory to the stage seams (which locked concept
  lives at "Weighting", "Conflict Resolution", etc.).
- The `Criterion` set: how orientation quality is scored.

*RFC-020 v0.1 Draft — 2026-07-31. Interface + harness only; algorithm stays locked.*
