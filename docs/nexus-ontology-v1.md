# Nexus Ontology v1

Canonical vocabulary for all concepts in the Nexus / Philos system.
All code, agents, UI, and documentation must use these names.

Source of truth: `app/lib/ontology.ts`

---

## Layer 1 — Dimensions (Resources)

What the person **HAS**. Aggregated outputs of department loads.

| Name | Answers | Formula |
|------|---------|---------|
| **Physical** | How much physical capacity remains? | Σ(dept.negativeDominance × dept.weight.Physical) / Σ weights |
| **Emotional** | How much emotional capacity remains? | Σ(dept.negativeDominance × dept.weight.Emotional) / Σ weights |
| **Rational** | How much rational capacity remains? | Σ(dept.negativeDominance × dept.weight.Rational) / Σ weights |

---

## Layer 2 — Departments (Processors)

Where load is **registered** and **processed**. Visible names are distinct from Dimension names.

| Visible Name | Internal Key | Answers | Base Opposition |
|-------------|-------------|---------|----------------|
| **Body** | `Physical` | Where is physical load entering? | Existence ↔ Decay |
| **Drive** | `ID` | Where is survival-energy load entering? | Security ↔ Threat |
| **Heart** | `Emotional` | Where is relational load entering? | Connection ↔ Disconnection |
| **Mind** | `Rational` | Where is cognitive load entering? | Clarity ↔ Confusion |
| **Navigation** | `EGO` | Where is agency/orientation load entering? | Navigation ↔ Lostness |
| **Values** | `SUPEREGO` | Where is moral/meaning load entering? | Truth/Justice ↔ Falsehood/Injustice |
| **Communal** | `Communal` | How much is the community carrying? | — |

### Department → Dimension Weights

Each row sums to 1.0. Determines how department load contributes to each dimension.

```
              Physical  Emotional  Rational
Body            0.70      0.15      0.15
Drive           0.60      0.30      0.10
Heart           0.10      0.75      0.15
Mind            0.10      0.15      0.75
Navigation      0.20      0.25      0.55
Values          0.10      0.30      0.60
```

---

## Layer 3 — Burden Flow

The core causal chain per dimension.

```
dimensionPressure
      ↓
dimensionCapacity
      ↓
dimensionInflow
      ↓
dimensionDeficit
      ↓
failureType
```

| Concept | Answers | Formula |
|---------|---------|---------|
| **dimensionPressure** | How much force presses on this dimension? | Weighted average of dept loads → this dimension |
| **dimensionCapacity** | How much help could theoretically arrive? | Σ(helper.capacity × weight[dim]) |
| **dimensionInflow** | How much help actually arrived? | Σ(helper.allocated × weight[dim]) |
| **dimensionDeficit** | What remains unresolved? | max(0, pressure − inflow) |
| **mobilizationGap** | How much capacity is not being mobilized? | max(0, capacity − inflow) |
| **coveragePct** | What percentage of pressure is covered? | round((inflow / pressure) × 100) |

**Key constraint:** `dimensionInflow ≤ dimensionCapacity` always.

### failureType — Diagnostic Categories

Same deficit value, different root causes, different required actions.

| Type | Condition | Root Cause | Required Action |
|------|-----------|-----------|----------------|
| **capacity_shortage** | capacity < pressure × 0.40 | Real resource scarcity | Expand value network |
| **flow_disconnection** | inflow < capacity × 0.40 | Capacity not mobilized | Remove the barrier |
| **mobilization_gap** | else with deficit > 0 | Small residual gap | Targeted completion |
| **resolved** | deficit ≤ 0 | Fully covered | None |

**Critical insight:** Types `capacity_shortage` and `flow_disconnection` can produce identical deficit values but require completely different interventions. Without `dimensionCapacity`, the two are indistinguishable.

---

## Layer 4 — Action

First move only. No coercion. No plan. No decision on behalf of the person.

| Concept | Answers |
|---------|---------|
| **Action** | What is the single next recommended move? |
| **firstMove** | Why only one move? (principle) |
| **redistributionMove** | What kind of action? (principle: always redistribution) |
| **targetDimension** | Which dimension needs the first move most? |
| **targetDepartment** | Which department should the move target? |

### ActionId Options

| ActionId | Targets | Indicated When |
|----------|---------|----------------|
| **stabilize** | Physical | Physical deficit is strongest |
| **support** | Emotional | Emotional deficit is strongest |
| **clarify** | Rational | Rational deficit is strongest |
| **distribute** | All (collective) | Collective distribution is the priority |
| **amplify** | Orientation | mobilizationGap is high |

---

## Allocation — Alternative Scenarios

The system shows alternatives. The person chooses.

| Mode | Answers | Status |
|------|---------|--------|
| **currentAllocation** | What does the current redistribution look like? | stable |
| **maxCarryAllocation** | What if every helper gave as much as they could? | experimental |
| **balancedAllocation** | What if the load were spread equally? | experimental |
| **valuePreservingAllocation** | What if only value-aligned helpers were used? | experimental |
| **peakUtilization** | Is any helper carrying a disproportionate share? | experimental |
| **finalGap** | How much remains on the individual after this allocation? | experimental |

---

## v2 — Future Concepts (not yet wired)

The v2 chain introduces energy-gated absorption:

```
dimensionPressure
      ↓
dimensionCapacity
      ↓
dimensionInflow
      ↓
internalAbsorption (NEW)
      ↓
effectiveInflow (NEW)
      ↓
dimensionDeficit
      ↓
Action
```

| Concept | Answers | Status |
|---------|---------|--------|
| **internalAbsorption** | Can the person actually receive the support that arrives? | future |
| **absorptionFactor** | How efficiently does this person absorb support? | future |
| **effectiveInflow** | How much support actually landed and was processed? | future |
| **energyGatedAbsorption** | Why do identical external conditions produce different outcomes? | future |

**Core v2 insight:**

```
Person A: energy = 20%  → absorptionFactor ≈ 0.55 → effectiveInflow = 70 × 0.55 = 38 → deficit = 52
Person B: energy = 80%  → absorptionFactor ≈ 0.95 → effectiveInflow = 70 × 0.95 = 66 → deficit = 24
```

Same pressure. Same inflow. Different deficit. Different lived experience.

---

## Naming Rules

1. **Dimensions** keep their names: Physical, Emotional, Rational.
2. **Departments** use visible names: Body, Drive, Heart, Mind, Navigation, Values, Communal.
3. Never use internal keys (Physical, ID, EGO, SUPEREGO) in user-facing text.
4. `dimensionPressure` ≠ `dimensionDeficit` — never use "deficit" for pressure or vice versa.
5. `dimensionCapacity` ≠ `dimensionInflow` — capacity is potential, inflow is actual.
6. All Action outputs are recommendations, never commands.
