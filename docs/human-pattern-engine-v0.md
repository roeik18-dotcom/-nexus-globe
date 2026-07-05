# Philos — Human Pattern Engine (HPE) v0

**Layer 4 (Application) | Evidence status: D — Hypothesis**

*The Human Pattern Engine is the first Layer 4 application of the Philos stack.
It is grounded in: Reality Flow Model (Layer 0), OPM (Layer 1), Human Reality Engine
(Layer 2), and Marketplace architecture (Layer 3).*

*The engine maps possibilities. It does not prescribe.*

*The engine learns from data. It can refine the theory that generated it.*

---

## §1 Core Idea

A person arrives with a situation. The system has seen thousands of situations before.
Rather than telling the person what to do, it shows them:

- What human patterns their situation resembles
- Which values are in tension in those patterns
- What actions people in similar situations took — and what they did not take
- What outcomes resulted — and what outcomes were possible but did not materialize
- What factors caused trajectories to diverge

**The system does not decide. It maps — including the paths not taken.**

The engine also runs in reverse. Accumulated cases can surface patterns that the
theory did not anticipate, which can then challenge or refine the theory.

---

## §2 Case Schema

Every case — past or new — is a structured object with ten fields: nine descriptive
and one counterfactual.

### §2.1 Descriptive fields

| Field | Type | Description |
|---|---|---|
| `situation` | text | What happened, in the person's own words |
| `participants` | list\<ActorType\> | Who is involved (from Marketplace §3.3 actor taxonomy) |
| `values` | list\<OfficeID\> | Which Value Offices are active (from marketplace-core-v0.md §3.2) |
| `gap` | text + GapType | The primary מרווח: between what current state and what desired state |
| `interpretation` | text | How each participant interpreted the gap (RFM Interpretation Principle) |
| `pressure` | list\<PressureType\> | Active pressures: social / emotional / economic / legal / physical |
| `action` | list\<ActionType\> | What was done (no action is also an action) |
| `outcome` | text + OutcomeClass | What happened after. OutcomeClass: resolved / partial / unresolved / escalated |
| `pattern` | list\<PatternID\> | Assigned pattern labels (see §4) |

### §2.2 Counterfactual field

Every case must also record what did not happen.

| Subfield | Type | Description |
|---|---|---|
| `paths_not_taken` | list\<ActionType\> | Actions that were available but not chosen |
| `values_not_activated` | list\<OfficeID\> | Values present in the situation that did not become decisive |
| `outcomes_not_realized` | list\<{OutcomeClass, description}\> | Outcomes that were structurally possible but did not occur |

**Why counterfactuals are required:**

Standard pattern data tells you the path taken. Counterfactual data reveals the possibility
space. Without it, the engine can only say "this is what happened in similar cases." With it,
it can say "this is what was available and what blocked it."

This is the difference between a pattern recognizer and a branching-point analyzer.

Example: A case that ended in escalation had a path to compromise available. The counterfactual
field records that path. When 1,000 similar cases are aggregated: "In 73% of escalated cases,
a compromise path existed but was closed by family_pressure." That is an intervention target,
not just a statistic.

Counterfactual fields require human annotation — they cannot be inferred from the outcome alone.

---

## §3 Similarity Function

When a new case arrives, the engine computes similarity to all existing cases and returns
the top-K most similar patterns.

### §3.1 Component similarities

**Value overlap** — Jaccard similarity on Value Office sets:

```
sim_values(A, B) = |values(A) ∩ values(B)| / |values(A) ∪ values(B)|
```

**Pressure overlap** — Jaccard similarity on pressure type sets:

```
sim_pressure(A, B) = |pressure(A) ∩ pressure(B)| / |pressure(A) ∪ pressure(B)|
```

**Gap type match:**

```
sim_gap(A, B) = 1 if GapType(A) == GapType(B), 0.5 if same category, 0 otherwise
```

**Participant type overlap:**

```
sim_participants(A, B) = |participant_types(A) ∩ participant_types(B)| / |participant_types(A) ∪ participant_types(B)|
```

### §3.2 Composite similarity

```
sim(A, B) = 0.40 · sim_values(A, B)
           + 0.30 · sim_pressure(A, B)
           + 0.20 · sim_gap(A, B)
           + 0.10 · sim_participants(A, B)
```

Weights are initial estimates. They require calibration against user feedback.

---

## §4 Patterns

A pattern is a named, recurring configuration of values + pressures + gap type that appears
across multiple cases.

### §4.1 Pattern structure

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `name` | Short human-readable label |
| `description` | 1–2 sentence description |
| `core_values` | Value Offices typically in tension |
| `core_pressures` | Pressure types typically active |
| `gap_types` | Gap types typically present |
| `case_count` | Number of cases assigned |
| `action_distribution` | % of cases taking each ActionType |
| `outcome_distribution` | % of cases in each OutcomeClass |
| `pivot_factors` | Variables most correlated with outcome divergence |
| `paths_blocked` | Most common `paths_not_taken` and what blocked them |
| `risk_notes` | Known risks on each action path |

`pivot_factors` and `paths_blocked` are derived from the counterfactual field — they
cannot be populated without counterfactual annotations.

### §4.2 Initial pattern set (proposed — not data-derived)

| ID | Name | Core configuration |
|---|---|---|
| P1 | Value Conflict + Institutional Silence | Justice + Ethics ← legal_threat + institutional_pressure |
| P2 | Relational Gap + Family Pressure | Community + Ethics ← family_pressure + social_shame |
| P3 | Safety Gap + Epistemic Isolation | Health + Justice ← physical_threat + legal_threat |
| P4 | Recognition Deficit + Peer Pressure | Justice + Community ← peer_pressure + social_shame |
| P5 | Resource Gap + Isolation | Economy + Community ← financial_pressure + emotional_pressure |
| P6 | Value Collapse + Identity Threat | Ethics + Truth ← institutional_pressure + family_pressure |

These are hypotheses. They will be revised as real cases accumulate.

---

## §5 System Output

When a new case is submitted, the engine returns five views.

### §5.1 Top-K similar patterns (K=5 for MVP)

For each pattern: name, description, similarity score, which of the person's values /
pressures / gap type drove the match, case count.

### §5.2 Outcome distribution

Aggregated across all similar cases:

```
"We found 1,842 similar situations.

  41% ended in compromise
  27% in escalation
  18% in disengagement
   9% in third-party intervention
   5% in other outcomes"
```

This is a distribution, not a recommendation. The system shows what happened.

### §5.3 Action distribution

For each action path: outcome distribution among cases that took that path,
known risk factors that amplified negative outcomes.

### §5.4 Turning points

Which variables, when present, most strongly shifted trajectory:

```
"In cases that moved from escalation to resolution, the most common turning points were:
  — Third-party intervention by a trusted community member (38%)
  — Evidence introduction that changed the epistemic gap (24%)
  — Value Office activation: Justice (explicitly named) shifted energy (19%)"
```

Derived from cross-case counterfactual analysis.

### §5.5 Possibility space

What paths were available but not taken in similar cases — and what blocked them:

```
"In 73% of similar cases that escalated, a compromise path was structurally available.
 In 61% of those, it was closed by family_pressure before it was attempted.
 In 29%, it was available throughout but not chosen."
```

This is what counterfactual data enables. Without it, the engine cannot produce this view.

### §5.6 Active values map

Which Value Offices are in tension in the matched patterns, and which most frequently
became the axis of resolution vs. the axis of escalation.

---

## §6 Bidirectional Learning: Data ↔ Theory

Until now, Philos has operated top-down:

```
Theory (RFM + OPM + Human Reality Engine)
    → Schema (what to measure)
    → Cases (instances)
    → Patterns (named configurations)
    → Output (map for the person)
```

The Human Pattern Engine enables the reverse direction:

```
Cases (accumulated data)
    → Pattern discovery (unsupervised clustering)
    → Emergent patterns (not anticipated by theory)
    → Theory update (RFM schema revision or extension)
```

**This is significant.** The theory no longer only explains the data. The data can
shape the theory.

### §6.1 Theory-challenging signals

The engine flags cases that do not fit any existing pattern (low max similarity score).
When these accumulate, they are candidates for a new pattern — which may require
new schema fields, new value categories, or revision of the RFM chain.

### §6.2 Counterfactual-derived hypotheses

If the counterfactual data shows that a particular pressure type consistently closes
off compromise paths, that is a new falsifiable hypothesis: "PressureType X is a
systematic path-closer in GapType Y." This hypothesis can be tested against new cases.

### §6.3 Schema evolution protocol

- **Schema additions** (new fields): require minimum 50 cases where the missing field
  would have changed the similarity score.
- **Schema revisions** (redefining existing fields): require theoretical justification
  + evidence from at least 20 miscategorized cases.
- **Pattern additions**: require minimum 30 cases with mutual similarity > 0.7 that
  do not fit existing patterns.

This is the mechanism by which the HPE feeds back into the falsification program.

---

## §7 MVP Scope

**What is built first:**

1. **Case input form** — captures all ten schema fields including counterfactuals
2. **Pattern matcher** — returns top-5 patterns using composite similarity (§3)
3. **Output views** — outcome distribution, action distribution, turning points, possibility space
4. **Manual case annotation** — 50–100 synthetic cases before real submissions

**What is NOT in MVP:**

- Real-time user submissions (requires privacy infrastructure)
- Semantic / embedding-based similarity
- Automated pattern discovery (requires minimum 200 cases)
- Prescriptive recommendations

---

## §8 Data Requirements

| Stage | Cases needed |
|---|---|
| Proof of concept | 20 synthetic, annotated across 6 patterns |
| Internal demo | 50–100 synthetic + illustrative |
| Counterfactual views active | 100+ cases with counterfactual fields annotated |
| External demo | 200+ real anonymized or validated synthetic |
| Pattern discovery enabled | 500+ cases |
| Production | 1,000+ real cases with outcome tracking |

---

## §9 Design Constraints

**Maps, does not prescribe.** Every output is framed as "in similar situations, X% of people
did Y and outcomes were Z." Never "you should do Y."

**Anonymization is total.** Situations are paraphrased at input. Participants are actor
types only — never names or identifying details.

**Trauma-informed presentation.** Outcome distributions are risk information, not data points
to scroll past. "27% ended in escalation" must include what risk factors amplified escalation.

**Counterfactual fields are annotator responsibility.** The system cannot infer what didn't
happen. A trained annotator must identify available paths not taken.

**Value constraints override neutral display.** If a matched pattern includes paths that
violate a hard Value Office constraint (e.g., encouraging silence in a safety context),
those paths are flagged as contra-indicated, not presented neutrally.

---

## §10 Connection to Philos Stack

| Layer | HPE uses |
|---|---|
| Layer 0 (RFM) | Gap, Interpretation, Pressure fields map directly to RFM primitives. Possibility-space output maps to RFM energy branching. |
| Layer 1 (OPM) | Case schema is OPM-extended; counterfactual field extends OPM flow record with the unrealized branch |
| Layer 2 (Human Systems) | Six departments map to: situation (personal), pressure (social), interpretation (cognitive + emotional), action (behavioral), outcome + learning (learning dept.) |
| Layer 3 (Marketplace) | Values use Value Office taxonomy; participants use Actor taxonomy; patterns feed Trust/Reputation update |
| Layer 4 (this) | First concrete application |

---

## §11 Open Questions

| Question | Blocker for |
|---|---|
| Who annotates counterfactual fields — and how is bias controlled? | Counterfactual views |
| How are synthetic cases generated without importing researcher assumptions? | Proof of concept |
| Is counterfactual annotation reliable without structured protocols? | Data quality |
| What minimum similarity score makes a match meaningful vs. misleading? | Output validity |
| How does the engine present "no good matches found" without discouraging the person? | Edge cases |
| When does data-driven pattern discovery override a theory-derived pattern? | §6.3 protocol |
| How is "outcome" captured for situations that are still ongoing? | Schema |

---

*Version 0.1 | Layer 4 (Application) | Evidence: D — Hypothesis*
*No cases exist yet. No similarity function has been validated.*
*The counterfactual field is the key distinguishing feature: it enables branching-point
analysis, not just pattern recognition.*
