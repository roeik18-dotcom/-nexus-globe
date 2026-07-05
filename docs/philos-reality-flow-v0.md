# Philos — Reality Flow Model v0

**Layer 0 (Foundation) | Evidence status: D — Hypothesis**

*This document formalizes the foundational ontology proposed in the July 2026 design session.
It sits below all other Philos layers. Everything in OPM, Marketplace, and the falsification
program is derived from or constrained by this layer. None of the claims here have been
empirically validated. They are the axioms on which the architecture is built.*

*Independence note: The Reality Flow Model does not depend on the D4 hypothesis or the FEP
falsification program. However, it does produce implications for how D4 should be formalized.
See §6.*

---

## §0 Three Primitives (Level 0)

Every system — physical, social, cognitive, institutional — is built from exactly three
primitives and nothing else.

| Primitive | Hebrew | Definition |
|---|---|---|
| **Matter** | חומר | Any entity that exists: person, object, organization, information, idea, sound, community |
| **Space** | מרווח | Any separation between entities: physical, emotional, social, value-based, cognitive, economic, epistemic, temporal |
| **Time** | זמן | The dimension in which relationships change |

**Axiom (Philos Level 0):**

> Matter + Space + Time = any possible system

Nothing in the model is introduced from outside these three. Scarcity, force, energy, emotion,
decision — all are derived.

### Why this ordering matters

- Without Space: no distinction → no system.
- Without Time: no change → no process → no dynamics.
- Without Matter: nothing to distinguish → Space and Time are vacuous.

The three are jointly necessary. None is sufficient alone.

---

## §1 Derivation Chain

When matter exists in space across time, interaction arises.
Interaction produces contrast. Contrast produces tension. Tension produces force.
Force produces movement. Movement produces rhythm, beat, and stillness.
Over time, cycles of development, decay, and change emerge.

**Full chain:**

```
Matter + Space + Time
    │
    ▼
Interaction
    │
    ▼
Contrast / Opposition
    │
    ▼
Tension
    │
    ▼
Force
    │
    ▼
Energy (directed movement)
    │
    ▼
Rhythm / Beat / Stillness
    │
    ▼
Development / Decay / Cycles
```

The human appears only at the **Interpretation** layer. The human does not interpret matter
directly. The human interprets **relationships** between matters — that is, gaps (מרווח).

---

## §2 The Scarcity Claim — Five Laws

**Core claim:** Scarcity (מחסור) is NOT a primitive.

Scarcity is NOT:
- matter
- a force
- energy

Scarcity IS: **an interpretation of a gap**.

When a gap exists between current state and desired state, the person interprets that gap.
That interpretation is called scarcity.

### The Five Laws

**Law 1 — Scarcity is derived, not primary:**
```
Gap (מרווח) → Interpretation (פרשנות) → Scarcity (מחסור)
```
Not the reverse. The gap is ontologically prior to the scarcity.

**Law 2 — Scarcity produces force:**
```
Scarcity → Force
```

**Law 3 — Force produces directed energy:**
```
Scarcity → Force → Energy
```

**Law 4 — Energy seeks to reduce the gap:**
Energy is directional. Its attractor is the reduction of the gap that generated the scarcity.

**Law 5 — The cycle:**
After the gap changes, a new interpretation arises, which generates new scarcity.
The system is inherently cyclic.

### Corollary — Perception is relative

Intensity is interpreted relative to the observer's range. A very faint signal and a very
loud signal may both be perceived as silence — both lie outside the observer's detection
range. This means the same gap can produce different scarcities in different observers, or
none at all. The interpretation function is observer-dependent.

---

## §3 OPM Extension — Energy Flow Variables

The existing OPM specification tracks **variables** (what exists).

The Reality Flow Model requires OPM to also track **energy flows** (how state propagates
between variables).

Every variable now carries two records:

### 3a — Static record (existing OPM)
- Identity, type, current value, constraints

### 3b — Flow record (new)

| Field | Description |
|---|---|
| Source (מקור) | Which variable or event generated this energy |
| Target (יעד) | Which variable this energy is directed toward |
| Time (זמן) | When this flow was initiated and when it resolves |
| Intensity (עוצמה) | Magnitude of the energy flow |
| Direction (כיוון) | Constructive (closes gap) or destructive (widens gap) |
| Amplifiers (מגבירי אנרגיה) | Variables or actors that increase intensity in transit |
| Attenuators (מחלישי אנרגיה) | Variables or actors that decrease intensity |
| Blockers (חסמים) | Variables or actors that halt the flow entirely |
| Feedback loops (לולאות משוב) | Where output becomes new input |

**Goal:** not only "which variables exist?" but "where did this energy originate, through
which path did it travel, where was it amplified or blocked, and where is the highest-
leverage intervention point?"

---

## §4 Six-Department Flow Model (Human Systems)

For human systems, the energy flow passes through six functional departments.
These are not sequential stages — they are interactive subsystems with bidirectional
connections. The dominant flow direction for a single cycle is:

```
Personal → Social → Cognitive → Emotional → Behavioral → Learning → (back to Personal)
```

### Department 1 — Personal (מחלקה אישית)
**Energy source.** Gap interpretation happens here first.

Generates:
- Scarcity
- Desire
- Values and value constraints
- Identity
- Needs
- Goals

### Department 2 — Social (מחלקה חברתית)
Energy exits into the social field.

Encounters:
- Family, friends, culture, religion, social networks, norms

Produces:
- External pressure
- Comparisons
- Expectations
- Criticism

Generates a **new gap**: between personal desire and social expectation.
This secondary gap feeds new scarcity back into the cycle.

### Department 3 — Cognitive (מחלקה שכלית)
The cognitive system processes the energy.

Produces:
- Comparisons and rankings
- Analysis
- Probability estimates
- Risk assessment
- Alternatives

### Department 4 — Emotional (מחלקה רגשית)
Cognitive output returns as emotional energy.

Produces:
- Confidence / lack of confidence
- Fear / anxiety
- Hope
- Guilt
- Calm

### Department 5 — Behavioral (מחלקת התנהגות)
Energy resolves into action (or non-action).

Examples:
- Choose / avoid
- Speak / stay silent
- Approach / retreat

### Department 6 — Learning (מחלקת למידה)
The outcome of behavior re-enters the system.

Produces:
- Experience
- Memory
- New beliefs
- Value revision

The Learning department's output becomes new matter in the next cycle, which
resets the Personal department and opens new gaps.

### Closed example (loneliness / partner search)

```
Emotional gap (current vs desired state)
    │
    ▼ [Law 1: gap → interpretation]
Scarcity: "I lack connection"
    │
    ▼ [Law 2: scarcity → force]
Desire: seeking a partner
    │
    ▼
Encounter new person [new matter enters]
    │
    ├──► Cognitive: comparison, ranking, analysis
    │
    └──► Social: family/friends/networks introduce pressure
              │
              ▼
          New gap: personal desire vs social expectation
              │
              ▼
          Scarcity: "I am not enough"
              │
              ▼
          Cognitive: self-comparison, doubt
              │
              ▼
          Emotional: anxiety, low confidence
              │
              ▼
          Greater emotional scarcity than at start
              │
              ▼
          Loop: scarcity → seeking → comparison → criticism → scarcity
```

The loop is a feedback cycle. The gap is not necessarily closing — it may be widening
through the cycle. Intervention requires identifying which department is amplifying or
blocking the flow, not just which behavior appears at the output.

---

## §5 Marketplace Application

The Marketplace is the same energy flow model applied to institutional actors.
The primitives are identical; the energies differ.

| Human system | Marketplace |
|---|---|
| Emotional gap | Case (unresolved problem) |
| Scarcity | Resource gap, expertise gap, value conflict |
| Desire | Mission objective |
| Social pressure | Value Office constraints, Governance |
| Cognitive analysis | Matching Engine, Resolution Engine |
| Emotional response | Trust scores, reputation |
| Behavior | Resolution, resource allocation, execution |
| Learning | Evidence, outcome measurement, trust update |

Marketplace questions mapped to energy flow:
- Where did the energy start? (Which actor or case created the initial gap)
- Who amplified it? (Which actor increased urgency or complexity)
- Who attenuated it? (Which actor reduced pressure or contributed resolution)
- Where is it blocked? (Missing actor, missing resource, value conflict)
- Where is the feedback loop? (Trust→Evidence→Outcomes→Trust cycle)
- Where is the highest-leverage intervention? (Not necessarily the visible bottleneck)

The Marketplace convergence work (Stage 0b-arch through Stage 0d-arch) tests the structural
stability of these energy loops. A system where energy loops converge to a fixed point
(Type A) is a system where interventions have predictable effects.

---

## §6 Implications for the Falsification Program

The Reality Flow Model generates a more precise formulation of D4.

**D4 (current formulation):** Sacred values exhibit behavioral hysteresis — the system
does not return to its prior state along the same path when pressure toward violation is
applied and then removed.

**D4 (Reality Flow formulation):**

Sacred value violation creates a gap that activates a **qualitatively different
interpretation function** from ordinary preference gaps.

For ordinary preferences:
- Interpretation is continuous: larger gap → more scarcity → more force
- Removing the gap restores the previous state
- Hysteresis ≈ 0

For sacred values:
- Below the violation threshold: gap is interpreted as ordinary scarcity
- At threshold crossing: the interpretation function switches — the gap is re-interpreted
  as an identity threat or categorical violation, not a quantitative deficiency
- Above threshold: energy does not follow the same path back after the gap closes, because
  the interpretation function does not automatically revert

**This is the mechanism behind h > 0 in the sacred value case:**
Hysteresis is not stored in the gap itself. It is stored in the **interpretation function**
applied to the gap. The interpretation function has memory; the gap does not.

**Testable prediction (new, from this model):**
If interpretation-function switching is the mechanism, then:
- Agents who explicitly re-evaluate their interpretation after pressure removal should show
  lower h than agents who do not.
- The threshold for interpretation switch should be predictable from the agent's
  value-function structure, not from the gap magnitude alone.

These predictions are not yet tested. They belong to Stage 1 (behavioral dissociation)
and Stage 0e (FEP with action conditioning).

---

## §7 Open Questions

| Question | Status |
|---|---|
| Is the 3-primitive axiom falsifiable, or is it definitionally true? | Open — may be a framework choice, not an empirical claim |
| Does the interpretation function switch discretely at threshold, or continuously? | Open — testable in Stage 0c (non-linear landscape) |
| Are the 6 departments distinct enough to measure separately, or do they collapse? | Open — requires Stage 1 experimental design |
| Does the energy-flow OPM model produce different predictions from the variable-only OPM? | Open — requires simulation comparison |
| Is "gap" in the sacred value context the same kind of gap as in ordinary preference contexts? | Open — this is the core question of D4 |

---

*Layer 0 (Foundation) | Evidence: D — Hypothesis*
*This model is the proposed axiom layer. It generates predictions; it is not itself a
prediction. The falsification program tests what follows from it, not the axioms themselves.*
