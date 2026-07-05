# Philos — Case Pattern Engine v0

**Layer 4 (Application) | Evidence status: D — Hypothesis**

*The Case Pattern Engine is the first Layer 4 application of the Philos stack.
It is grounded in: Reality Flow Model (Layer 0), OPM (Layer 1), Human Reality Engine
(Layer 2), and Marketplace architecture (Layer 3). Its output is a map of possibilities,
not a prescription.*

*This document defines the data schema, similarity function, pattern structure, MVP scope,
and open design questions.*

---

## §1 Core Idea

A person arrives with a situation. The system has seen thousands of situations before.
Rather than telling the person what to do, it shows them:

- What patterns their situation resembles
- Which values are in tension in those patterns
- What actions people in similar situations took
- What outcomes those actions produced
- What risks each path carries

**The system does not decide. It maps.**

---

## §2 Case Schema

Every case — past or new — is a structured object with nine fields.

| Field | Type | Description |
|---|---|---|
| `situation` | text | What happened, in the person's own words |
| `participants` | list\<ActorType\> | Who is involved (from Marketplace §3.3 actor taxonomy) |
| `values` | list\<OfficeID\> | Which Value Offices are active (from marketplace-core-v0.md §3.2) |
| `gap` | text + GapType | The primary מרווח: between what current state and what desired state |
| `interpretation` | text | How the person interpreted the gap (RFM Interpretation Principle) |
| `pressure` | list\<PressureType\> | Active pressures: social / emotional / economic / legal / physical |
| `action` | list\<ActionType\> | What was done (can be empty — no action is also an action) |
| `outcome` | text + OutcomeClass | What happened after. OutcomeClass: resolved / partial / unresolved / escalated |
| `pattern` | list\<PatternID\> | Assigned pattern labels (see §4) |

### Controlled vocabulary (initial)

**GapType**: identity_gap | resource_gap | relational_gap | epistemic_gap | value_gap | safety_gap | legal_gap

**PressureType**: family_pressure | peer_pressure | institutional_pressure | financial_pressure | emotional_pressure | physical_threat | social_shame | legal_threat

**ActionType**: sought_community | sought_legal | sought_professional | stayed_silent | confronted | fled | sought_therapy | sought_mediation | sought_spiritual

**OutcomeClass**: resolved | partial | unresolved | escalated | unknown

These vocabularies are initial proposals. They will evolve with real case data.

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

**Gap type match** — exact or category-level:

```
sim_gap(A, B) = 1 if GapType(A) == GapType(B), 0.5 if same category, 0 otherwise
```

**Participant type overlap** — Jaccard on participant types (not individual identities):

```
sim_participants(A, B) = |participant_types(A) ∩ participant_types(B)| / |participant_types(A) ∪ participant_types(B)|
```

### §3.2 Composite similarity

```
sim(A, B) = w_values    · sim_values(A, B)
           + w_pressure  · sim_pressure(A, B)
           + w_gap       · sim_gap(A, B)
           + w_part      · sim_participants(A, B)
```

Default weights: `w_values = 0.40, w_pressure = 0.30, w_gap = 0.20, w_part = 0.10`

These are initial estimates. They require calibration against user feedback.

### §3.3 Optional: semantic similarity

For MVP, structured tag matching is sufficient. In v0.2+, the `situation` and `interpretation`
free-text fields can be embedded and their similarity added as a fifth component.

---

## §4 Patterns

A pattern is a named, recurring configuration of values + pressures + gap type that appears
in multiple cases.

### §4.1 Pattern structure

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `name` | Short human-readable label |
| `description` | 1–2 sentence description of the configuration |
| `core_values` | Value Offices typically in tension |
| `core_pressures` | Pressure types typically active |
| `gap_types` | Gap types typically present |
| `case_count` | Number of cases assigned to this pattern |
| `action_distribution` | % of cases taking each ActionType |
| `outcome_distribution` | % of cases in each OutcomeClass |
| `risk_notes` | Known risks associated with each action path |

### §4.2 Initial pattern set (proposed — not validated)

These are hypotheses based on the case space, not data-derived clusters. They will be
revised or replaced as real cases accumulate.

| ID | Name | Core configuration |
|---|---|---|
| P1 | Value Conflict + Institutional Silence | Justice + Ethics ← legal_threat + institutional_pressure |
| P2 | Relational Gap + Family Pressure | Community + Ethics ← family_pressure + social_shame |
| P3 | Safety Gap + Epistemic Gap | Health + Justice ← physical_threat + legal_threat |
| P4 | Recognition Deficit + Peer Pressure | Justice + Community ← peer_pressure + social_shame |
| P5 | Resource Gap + Isolation | Economy + Community ← financial_pressure + emotional_pressure |
| P6 | Value Collapse + Identity Threat | Ethics + Truth ← institutional_pressure + family_pressure |

These six patterns are illustrative starting points. A real MVP requires at least 20–50
annotated cases before pattern-to-case matching becomes meaningful.

### §4.3 Pattern assignment

For MVP: human-annotated (case contributor assigns patterns from controlled vocabulary).
For v0.2+: supervised classifier trained on annotated cases.

---

## §5 System Output

When a new case is submitted, the engine returns:

### §5.1 Top-K similar patterns (K=5 for MVP)

For each pattern:
- Pattern name and description
- Similarity score
- Which of the person's values / pressures / gap type drove the match
- Number of historical cases in this pattern

### §5.2 Action distribution

For the matched patterns, aggregate across all similar cases:

```
"In 1,000 similar cases:
  32% sought community support first
  21% sought legal channels
  18% stayed silent initially, returned later
  14% received peer support
   9% experienced additional social pressure
   6% chose individual therapy first"
```

This is a probability distribution, not a recommendation. The system shows what happened,
not what should happen.

### §5.3 Outcome distribution per action path

For each action type, show the outcome distribution among cases that took that path:
- resolved / partial / unresolved / escalated
- Known risk factors that amplified negative outcomes

### §5.4 Active values map

Show which Value Offices are in tension in the matched patterns, and which were most
frequently the axis of resolution.

---

## §6 MVP Scope

**What is built first:**

1. **Case input form** — captures all nine schema fields; free-text situation + structured tags
2. **Pattern matcher** — returns top-5 patterns using composite similarity (§3)
3. **Output view** — shows patterns, action distribution, outcome distribution, value map
4. **Manual case annotation** — team annotates an initial dataset of 50–100 synthetic cases
   before handling real submissions

**What is explicitly NOT in MVP:**

- Real-time case data from users (requires privacy infrastructure first)
- Semantic / embedding-based similarity
- Automated pattern classification
- Prescriptive recommendations ("you should do X")
- Identity of any case participant (all cases are anonymized at input)

---

## §7 Data Requirements

The engine is meaningless without cases. Before MVP can be demonstrated:

| Stage | Requirement |
|---|---|
| Proof of concept | 20 synthetic cases, manually annotated across 6 initial patterns |
| Internal demo | 50–100 synthetic + illustrative cases |
| External demo | 200+ real anonymized cases or validated synthetic cases |
| Production | 1,000+ real cases with outcome tracking |

**Data structure for each case entry** (stored, not displayed):
All nine schema fields + annotator ID + date + anonymization flag + consent record.

---

## §8 Design Constraints

**The system maps, it does not prescribe.**
Every output is framed as "in similar cases, people did X and outcomes were Y," never
"you should do X."

**Anonymization is total.**
No case is stored with any identifying information. Situation descriptions are paraphrased
before storage. Participants are described by type only (family member, institution, etc.),
never by name or relationship detail.

**Trauma-informed presentation.**
Outcome distributions must not read as statistics that minimize harm. "9% experienced
additional social pressure" is a risk warning, not a data point to scroll past.

**No single correct answer.**
The output is always a map of possibilities. Multiple paths are shown with their
associated distributions. The person chooses; the system informs.

**Value constraints take priority.**
If a matched pattern includes actions that would violate a hard Value Office constraint
(e.g., encouraging silence in a safety context), those actions are flagged explicitly as
contra-indicated, not presented neutrally.

---

## §9 Connection to Philos Stack

| Philos layer | Case Pattern Engine uses |
|---|---|
| Layer 0 (RFM) | Gap, Interpretation, Pressure fields map directly to RFM primitives |
| Layer 1 (OPM) | Case schema is an OPM-extended variable set |
| Layer 2 (Human Systems) | Six departments map to: situation (personal), pressure (social), analysis (cognitive), interpretation (emotional), action (behavioral), outcome (learning) |
| Layer 3 (Marketplace) | Values use Value Office taxonomy; participants use Actor taxonomy |
| Layer 4 (this) | First concrete application |

---

## §10 What This Tests

The Case Pattern Engine is also a validation instrument for the broader Philos theory.

If the engine produces outputs that people in the situations find useful and accurate —
if the pattern matches feel right — this is evidence that the RFM schema captures something
real about how situations structure themselves.

If patterns fail to match, or users report that the output is irrelevant, this is a falsification
signal: either the schema is wrong, the similarity function is wrong, or the pattern vocabulary
is wrong.

**The engine is not just a product. It is a test of whether the conceptual framework
generates useful structure when applied to real human situations.**

---

## §11 Open Questions

| Question | Blocker for |
|---|---|
| How are synthetic cases generated without introducing researcher bias? | Proof of concept |
| How is "outcome" defined in cases where the situation is ongoing? | Schema |
| Should `interpretation` be captured in the person's own words or standardized? | Similarity function |
| What is the right K (number of patterns returned)? | UX |
| How are conflicting Value Office constraints handled in output? | Design constraints |
| Who annotates patterns in production — trained team, community, or algorithm? | Scalability |
| How does the engine handle a case that matches no existing pattern well? | Edge cases |

---

*Layer 4 (Application) | Evidence: D — Hypothesis*
*This spec defines the MVP scope. No cases exist yet. No similarity function has been validated.*
*The engine generates testable predictions about whether RFM schema captures real situation structure.*
