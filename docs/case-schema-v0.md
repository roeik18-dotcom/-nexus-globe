# Philos — Case Schema v0 (Locked)

**Layer 4 (Application) | Evidence: D — Hypothesis**
**Status: LOCKED — changes require the protocol in §7**
**Extends: human-pattern-engine-v0.md §2–§3**
**Implementation: app/lib/caseSchema.ts**

---

This document locks the minimum field structure, enum values, similarity function parameters,
and validation rules required to build and test the Case Pattern Engine. It does not
replace `human-pattern-engine-v0.md` — it pins the decisions that doc left open.

---

## §1 Required Fields

Every case in the database must have all six of these. A case without any one of them
is rejected by the validator and not inserted.

| Field | Type | Constraint |
|---|---|---|
| `id` | `string` | Non-empty, unique across database |
| `gap_type` | `GapType` | One value from enum (§3.1) |
| `pressure` | `PressureType[]` | At least 1 value from enum (§3.2) |
| `action` | `ActionType` | One value from enum (§3.3). Use `"none"` if nothing was done. |
| `outcome` | `OutcomeClass` | One value from enum (§3.4) |
| `values` | `ValueID[]` | At least 1 value from enum (§3.5) |

These six fields constitute the **similarity vector** used by the matching engine. A case
with all six filled is minimally queryable.

---

## §2 Optional Fields

These fields enrich the output and enable counterfactual views, but their absence does
not make a case invalid.

| Field | Type | Purpose |
|---|---|---|
| `situation_text` | `string` | The situation in the person's own words (paraphrased, anonymized) |
| `participants` | `ParticipantType[]` | Who is involved (§3.6) |
| `gap_description` | `string` | What specifically is missing — clarifies the gap_type |
| `outcome_description` | `string` | What actually happened — clarifies the outcome |
| `interpretation` | `string` | How each participant understood the gap |
| `intensity` | `number` | Pressure intensity, 0.0–1.0 |
| `duration_days` | `number` | How long the situation lasted, in days |
| `counterfactual` | `Counterfactual` | Paths not taken, values not activated, outcomes not realized |
| `pattern_ids` | `string[]` | Assigned after matching; not set at case creation |

The `counterfactual` field is what enables the "possibility space" output (HPE §5.5). Cases
without it produce outcome distribution and action paths, but not turning-point analysis.

**Counterfactual subfields:**

| Subfield | Type | Constraint |
|---|---|---|
| `paths_not_taken` | `ActionType[]` | Actions available but not chosen |
| `values_not_activated` | `ValueID[]` | Values present but not decisive |
| `outcomes_not_realized` | `Array<{class: OutcomeClass; description: string}>` | Structurally possible outcomes that did not occur |

---

## §3 Locked Enums

These are the only valid values for each enum field. No new values without the schema
evolution protocol (§7.2).

### §3.1 GapType — 6 values

| Value | Meaning |
|---|---|
| `value` | What I believe vs. what is demanded of me |
| `relational` | Connection sought vs. disconnection experienced |
| `resource` | What is needed vs. what is available |
| `identity` | Who I am vs. who I am expected to be |
| `power` | Self-determination vs. external control |
| `epistemic` | What I know vs. what I am permitted or able to know |

**Gap categories** (used for partial similarity credit, §4.2):

| Category | Contains |
|---|---|
| `normative` | `value`, `identity` |
| `interpersonal` | `relational`, `power` |
| `material` | `resource` |
| `epistemic` | `epistemic` |

### §3.2 PressureType — 6 values

| Value | Meaning |
|---|---|
| `social` | Group expectations, shame, reputation damage |
| `emotional` | Internal affect: fear, grief, anger, dread |
| `economic` | Financial pressure, resource scarcity |
| `physical` | Bodily safety, health, survival |
| `legal` | Institutional, regulatory, or juridical pressure |
| `moral` | Ethical demands, value violation, conscience |

### §3.3 ActionType — 6 values

| Value | Meaning |
|---|---|
| `approach` | Moved toward the source of tension |
| `avoid` | Withdrew from the situation |
| `transform` | Attempted to change the frame or relationship |
| `surrender` | Accepted the gap without addressing it |
| `mobilize` | Sought external support or resources |
| `none` | No action taken |

### §3.4 OutcomeClass — 5 values

| Value | Meaning |
|---|---|
| `resolved` | Gap closed |
| `partial` | Gap reduced, tension remains |
| `unresolved` | Gap unchanged |
| `escalated` | Situation worsened |
| `transformed` | Situation fundamentally restructured (neither resolution nor escalation) |

### §3.5 ValueID — 8 values

| Value | Domain |
|---|---|
| `truth` | Epistemic — accurate representation of reality |
| `justice` | Normative — fair treatment and accountability |
| `safety` | Physical/relational — freedom from harm |
| `dignity` | Identity — being treated as fully human |
| `autonomy` | Power — self-determination and agency |
| `belonging` | Relational — connection and acceptance |
| `loyalty` | Relational — commitment and trust |
| `growth` | Temporal — development, learning, change |

### §3.6 ParticipantType — 8 values

`self` · `partner` · `family` · `friend` · `colleague` · `employer` · `institution` · `society`

---

## §4 Similarity Function

From `human-pattern-engine-v0.md §3`, with three additions locked here:
the gap category partial-credit rule, the composite score threshold, and the minimum match count.

### §4.1 Component similarities

```
sim_values(A, B)       = jaccard(A.values, B.values)
sim_pressure(A, B)     = jaccard(A.pressure, B.pressure)
sim_gap(A, B)          = 1.0  if A.gap_type == B.gap_type
                         0.5  if GAP_CATEGORY[A.gap_type] == GAP_CATEGORY[B.gap_type]
                         0.0  otherwise
sim_participants(A, B) = jaccard(A.participants ?? [], B.participants ?? [])
```

Where `jaccard(S, T) = |S ∩ T| / |S ∪ T|`, returning 0.0 if both sets are empty.

### §4.2 Composite score

```
sim(A, B) = 0.40 · sim_values(A, B)
           + 0.30 · sim_pressure(A, B)
           + 0.20 · sim_gap(A, B)
           + 0.10 · sim_participants(A, B)
```

Weights are inherited from `human-pattern-engine-v0.md §3.2`. Require calibration
against user feedback before v1.

### §4.3 Thresholds (locked for v0)

| Threshold | Value | Meaning |
|---|---|---|
| `SIMILARITY_THRESHOLD` | `0.40` | Minimum score to include a case in results |
| `STRONG_MATCH` | `0.65` | Cases above this are surfaced as "closely similar" |
| `MIN_MATCHES` | `3` | Engine requires at least this many matches to produce output |

If fewer than `MIN_MATCHES` cases meet the threshold, the engine returns a
`confidence: "insufficient"` response instead of output.

---

## §5 Output Format

The engine's query response for a given case:

```typescript
MatchOutput {
  query_id:             string
  confidence:           "high" | "medium" | "low" | "insufficient"
  total_matches:        number
  matches: [{
    case_id:            string
    score:              number
    outcome:            OutcomeClass
    action:             ActionType
  }]
  outcome_distribution: Record<OutcomeClass, number>   // fractions, sum to 1
  action_paths: [{
    action:             ActionType
    frequency:          number                          // fraction of matches
    outcome_distribution: Record<OutcomeClass, number>
    risk_level:         "low" | "medium" | "high"
  }]
}
```

Confidence levels:
- `high` — ≥ 10 matches, at least 1 with score > 0.65
- `medium` — 5–9 matches
- `low` — 3–4 matches
- `insufficient` — fewer than 3 matches

---

## §6 Validation Rules

```
VALID(case) iff:
  id            is non-empty string
  gap_type      ∈ GapType enum
  pressure      is non-empty list, all items ∈ PressureType enum
  action        ∈ ActionType enum
  outcome       ∈ OutcomeClass enum
  values        is non-empty list, all items ∈ ValueID enum
  intensity     ∈ [0.0, 1.0]  (if present)
  duration_days ≥ 0            (if present)
  counterfactual.paths_not_taken       ⊆ ActionType enum   (if present)
  counterfactual.values_not_activated  ⊆ ValueID enum      (if present)
```

---

## §7 Schema Evolution Protocol

**Rule 1 — Use `"none"` before adding a new enum value.**
If a case does not fit existing enums, mark the closest existing value and note the
mismatch in a comment. New enum values require 20+ cases where the existing set
genuinely cannot represent the situation.

**Rule 2 — New required fields need 50+ cases.**
A new required field is only warranted if 50+ existing cases would have changed their
similarity scores with it present.

**Rule 3 — Weight changes need a comparative test.**
Before changing similarity weights, run both the old and new weights against the
existing case database and measure which produces lower average rank error on a
held-out set.

**Rule 4 — Locked means locked.**
During the first 20-case annotation phase, no schema changes. The goal is to test
whether the current schema can represent 20 real situations. If it cannot, document
exactly which field is missing and what it would need to say. Change only after 20
cases are annotated.

---

## §8 Example Case (minimal — required fields only)

```json
{
  "id": "case-001",
  "gap_type": "value",
  "pressure": ["moral", "social"],
  "action": "avoid",
  "outcome": "unresolved",
  "values": ["truth", "loyalty"]
}
```

**Reading:** A person faced a tension between truth and loyalty (values in conflict),
under moral and social pressure, chose to avoid the situation, and the gap remained open.

Minimally queryable. Does not produce counterfactual output. Does not appear in
"turning point" analysis.

---

## §9 What This Schema Cannot Represent (known gaps)

These are not bugs — they are deferred. Do not add fields to fix them before 20 cases.

1. **Duration of pressure**: `duration_days` exists but is optional. Long vs. short
   pressure may produce different patterns, but we do not yet have evidence.

2. **Severity of outcome**: `escalated` is binary. A case that resulted in severe
   harm is treated identically to mild escalation.

3. **Power asymmetry**: Whether the person had any real agency is not captured.
   The `power` gap_type partially proxies this but doesn't quantify it.

4. **Multiple distinct gaps**: A case can have one `gap_type`. Real situations often
   have two overlapping gaps. Deferred to v1.

5. **Temporal sequence**: The schema captures a snapshot, not a sequence of events.
   The full trajectory (escalation → partial resolution → re-escalation) is not
   representable in v0.

---

*Version 0 | Locked 2026-07-06*
*Evidence: D — Hypothesis. No cases validated against real data.*
*Implementation: app/lib/caseSchema.ts*
