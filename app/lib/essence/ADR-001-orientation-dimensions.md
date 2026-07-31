# ADR-001 — Orientation Dimensions: grounding the Essence engine in Philos theory

- **Status:** **RESOLVED — 2026-07-30.** Vision-level decision by the owner:
  **Essence Orientation is a Presentation/Interaction layer of the AI, NOT part of
  the Philos ontology / human model.** Therefore each dimension's Philos binding is
  **`independent`** (no mapping to Dimensions/Departments, by design), and the
  per-dimension axis structure is kept but **reframed from the Philos "Vesica" to a
  neutral bipolar axis** (`kind: 'bipolar'`, `poleNegative · middle · polePositive`)
  — option **V1**. `TaskFraming` stays flat (TF-3). Implemented in
  `orientation-philos-map.ts`; guard test asserts every binding is `independent`.
  (History: Phase 1 built the layer with the binding deliberately `unresolved`
  pending this decision; the earlier interim read of "independent" from code
  behavior was a Hypothesis, now confirmed as a Conclusion at the vision level.)
- **Directive:** Build on the existing model; treat Philos theory as source of
  truth; do not redesign the core; keep every change modular and
  backward-compatible; compare designs and recommend one before implementing.

## Context

Two distinct systems both called "orientation" exist:

1. **Philos theory orientation** (engine repo `cluod code`): the human model —
   3 Being dimensions (Matter·Space·Energy → **Physical · Emotional · Rational**),
   6 tension fields / departments (Physical, Emotional, Rational, ID, EGO,
   SUPEREGO), each a **bipolar opposition**, read geometrically as a vesica
   (pole ↔ pole + a relation "lens"; states: balance / tension / collapse). Core
   question: **"Where is the resistance?"** (`PHILOS-3-6-9.md`,
   `PHILOS-GEOMETRIC-TENSION.md`).

2. **Essence orientation engine** (this repo, `app/lib/essence/orientation-*`):
   infers a user's **communication preferences** from conversation. Five **flat,
   single-valued, categorical** dimensions (`orientation.ts:19-25`):

   | Dimension | Values |
   | --- | --- |
   | `OrientationCommunicationStyle` | direct · exploratory · collaborative |
   | `OrientationResponseDepth` | brief · balanced · explanatory |
   | `OrientationTaskFraming` | action_first · context_first · options_first |
   | `OrientationDecisionStyle` | decisive · comparative · deliberative |
   | `OrientationTaskCadence` | single_step · phased · continuous |

   Mature, write-free pipeline: providers (rule + LLM + composite) → accumulator
   → proposal engine → Essence profile; ~100 tests + a calibration corpus.
   **No grouping, no poles, no tension, no link to Philos.** A Python mirror in
   `voice-gateway/app/essence_context.py` must track `ORIENTATION_SCHEMA` by hand.

**Goal (chosen):** *bridge* — give the essence dimensions a principled
architecture grounded in Philos, building on both existing assets.

## Key observation

Each essence dimension has **exactly three** values — structurally the Philos
3-architecture (*something · not-something · the relation*). The two extremes are
**poles**; the middle value is the **relation/balance** (the vesica lens). Four of
five map cleanly:

| Dimension | Pole − | Relation (lens) | Pole + |
| --- | --- | --- | --- |
| CommunicationStyle | direct | collaborative | exploratory |
| ResponseDepth | brief | balanced | explanatory |
| DecisionStyle | decisive | comparative | deliberative |
| TaskCadence | single_step | phased | continuous |
| TaskFraming | action_first | *? (context_first / options_first)* | *?* |

So the flat categoricals are **latent tension axes** — they can be re-read in
Philos terms **without changing the enums** (backward-compatible).

## Options considered

| # | Design | Theory fidelity | Backward-compat | Effort | Enables "where is the resistance?" |
| --- | --- | --- | --- | --- | --- |
| A | **Taxonomy overlay** — tag each dimension with a Philos department; metadata only | Low–med | ✅ full | XS | ✗ (grouping only) |
| B | **Vesica overlay** — model each dimension as pole↔pole + relation; add a read-only tension reading | **High** | ✅ full (enums unchanged) | S–M | ✅ |
| C | **Dual-layer** — separate Philos layer consuming essence outputs | High | ✅ | L | ✅ (heavier) |
| D | **Replace** the 5 with theory-derived dimensions | Highest | ❌ breaks calibration/tests/Python mirror | L | ✅ |

D is rejected (violates backward-compat + "don't reinvent"). C is B done as a
heavier separate layer — deferrable. A is a strict subset of B.

## Decision (recommended): Option B, phased

**Phase 1 — additive mapping module** `orientation-philos-map.ts`:
for each dimension, static metadata `{ department, poleNegative, relation,
polePositive }` layered *over* `ORIENTATION_SCHEMA`. Pure data; **zero change** to
schema, inference, providers, accumulator, proposal engine, tests, or the Python
mirror. Ships with unit tests asserting the map covers every dimension/value.

**Phase 2 — read-only tension reading** `orientation-tension.ts`:
express an `AccumulatorSnapshot` as a per-dimension **vesica ratio** (which pole
the evidence leans toward = where the resistance is). Read-only; consumes existing
accumulator output; no write-path change.

**Deferred:** Phase 3 (department-level aggregation / geometric visual) and any
Option-C separate layer — only if Phases 1–2 prove insufficient.

## Open questions (need your call — not assumed)

1. **TaskFraming poles/relation** — the three values aren't an obvious bipolar
   triad. Candidate: `action_first` ↔ `context_first`, with `options_first` as the
   relation (weighing between). Needs your judgment before Phase 1 finalizes.
2. **Department mapping** — tentative and to be validated, e.g. CommunicationStyle
   → Emotional (Connection↔Disconnection); ResponseDepth → Rational
   (Clarity↔Confusion); DecisionStyle → EGO/SUPEREGO; TaskFraming → EGO
   (Navigation↔Lostness); TaskCadence → Physical (Existence/rhythm). These are
   interpretive and must be confirmed against the theory, not asserted.

## Consequences

- **+** Grounds the essence dimensions in Philos; enables "where is the
  resistance?" per communication dimension; fully backward-compatible; modular.
- **−** Introduces a mapping that must be maintained; some pole/relation and
  department assignments are interpretive (tracked as open questions above).

---

## Derivation from first principles (2026-07-30)

Per the approval constraint, before hard-coding any mapping I traced the Philos
first principles across both repos. Findings:

### What is canonical (safe to build on)
- **Dimensions** — `A9 🟢 closed`: **Physical · Emotional · Rational** ("what the
  person *has*"), explicitly *distinct from departments by design*
  (`docs/philos-research-questions.md`; `app/lib/ontology.ts:69-112`).
- **Departments** — `A8 🟢 closed`: **Body · Drive · Heart · Mind · Navigation ·
  Values · Communal** (internal keys Physical/ID/Emotional/Rational/EGO/SUPEREGO/
  Communal), each tied to one base tension field, with a fixed **Department →
  Dimension weight matrix** (`ontology.ts:120-243`, `DEPT_INTERNAL_KEYS:750`).

### What is NOT canonical (must NOT ground the mapping on it)
- **Force model** — `A1 🟡 / E6 open`: the 6-force / Freudian naming is explicitly
  flagged for replacement (SDT + Conservation of Resources). Building on it invites
  churn.
- **Reality Flow Model** (Matter · Space · **Time**; departments Personal/Social/
  Cognitive/Emotional/Behavioral/Learning) is **Layer-0, Evidence D — Hypothesis**
  (`docs/philos-reality-flow-v0.md`), *not* the canonical department set.
- **"Life"** (from "Matter → Space → Time → Life") appears **nowhere** as a
  primitive — it is an undocumented extension. Using it would be redesigning the
  core, which the directive forbids without a proven contradiction.

### Decisive finding — the mapping is *underdetermined* by the theory
There is a **category difference** between the two systems:
- Philos **Dimensions** = resource *capacity a person has*; **Departments** = where
  *load / burden* registers. Both are part of a **diagnostic** load model ("where
  is the resistance?").
- Essence **orientation** dimensions = *communication style / preference* (how the
  person likes to be engaged). This is **neither a resource nor a load.**

Therefore the first principles **do not force** any particular dimension →
dimension/department mapping. Every candidate mapping is **interpretive**, not
*necessary*. Per the directive ("prove the mapping derives from theory, not just
'feels right'"), the correct conclusion is: **do not hard-code any mapping now.**

### Candidate mappings (documented as alternatives, NOT selected)
- **Map-A · Expression channel → Dimension (P/E/R).** e.g. ResponseDepth→Rational,
  CommunicationStyle→Emotional, TaskCadence→Physical. Simple, uses the 3 closed
  dimensions. *Consequence:* forces a style onto a resource axis; several
  dimensions span two axes (ambiguous).
- **Map-B · Processing signature → Department + tension field.** e.g.
  DecisionStyle→Navigation (Navigation↔Lostness), ResponseDepth→Mind
  (Clarity↔Confusion). Richer, enables per-field vesica reading. *Consequence:*
  even more interpretive; leans on department load-semantics + the ID/EGO/SUPEREGO
  keys that A1/E6 want replaced.
- **Map-C · No semantic mapping yet.** Ground each dimension only in the abstract
  3-architecture (pole · relation · pole); leave dimension→department/dimension as
  an explicit *unresolved binding*. *Consequence:* maximally honest; defers the
  contested choice; still delivers the approved Vesica structure. **Recommended.**

### TaskFraming (action_first · context_first · options_first) — ≥2 candidates
- **TF-1:** poles `action_first ↔ context_first`, relation `options_first`.
  *Consequence:* treats "weighing options" as the balanced middle — but options is
  arguably a third stance, not a midpoint.
- **TF-2:** poles `action_first ↔ options_first`, relation `context_first`.
  *Consequence:* context (understanding) mediates commit-now vs keep-open — more
  coherent, but re-reads the schema order.
- **TF-3:** TaskFraming is a genuine 3-way categorical, **not** bipolar; leave it
  **flat** (no vesica), unlike the other four. *Consequence:* breaks uniformity but
  makes no unfounded claim. **Recommended** (matches "do not force options_first").

### Decision recorded
Phase 1 implements **Map-C**: the Vesica pole·relation·pole structure for the four
cleanly-bipolar dimensions, TaskFraming left flat (**TF-3**), and the
dimension→department/dimension mapping represented as a **typed, explicitly
`unresolved` binding** — so a future, theory-justified mapping can be set *without
any code change*. Resolving the mapping is deferred until it is decided **what
semantic role** Essence orientation plays (express dimensions / reflect departments
/ independent style), which is tied to open questions A1 and A4.

### Pending semantic decision (refined 2026-07-30)
The semantic-role question has a **prior question** that must be answered at the
*vision* level, not inferred from code:

> **Is Essence Orientation part of the Philos ontology (the human model), or a
> Presentation / Interaction layer of the AI?**

- That the current implementation adapts AI responses is an **Observation**, not
  proof of canonical meaning — *implementation behavior ≠ model definition.*
- **If Presentation/Interaction layer only** → option A (independent style):
  `binding = independent`, keep the per-dimension axis structure but drop the
  Philos framing (V1), and the ADR documents the separation.
- **If part of Philos's human model** (even if not yet used) → `independent` is
  premature; the binding **stays `unresolved`** until the model is complete (or a
  justified mapping is derived).

**Status: RESOLVED (2026-07-30).** The owner decided at the vision level:
**Presentation/Interaction layer.** Consequences implemented: binding →
`independent` for every dimension; axis reframed from Philos "Vesica" to a neutral
bipolar axis (V1: `kind:'bipolar'`, `poleNegative · middle · polePositive`);
TaskFraming stays flat. No mapping to Philos Dimensions/Departments. Verified:
Phase 1 test 7/7, essence suite 694/694, no new tsc errors.

## Out of Scope

This ADR decides the **Essence orientation ↔ Philos relationship only**. It does NOT:
- Define the **Philos ontology** itself (Dimensions/Departments live in the engine +
  `docs/nexus-ontology-v1.md`).
- Change **inference, calibration, schema**, or the Python mirror.
- Decide the **Experience Layer** (globe / daily brief / Merlin).
- Define a future **`resolved`** mapping — it only records that the binding is
  `independent` for now, revisitable if the vision changes.
