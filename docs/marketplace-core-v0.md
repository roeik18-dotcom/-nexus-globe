# Marketplace Core Architecture — v0

**Layer 3 (Architecture) | Evidence status: D — Hypothesis**

*This document specifies the structural entities of the Philos Marketplace. None of these
specifications have been empirically validated. The architecture is designed to be testable;
see `docs/marketplace-dynamics-v0.md` for the dynamic model and convergence simulation plan.*

*Independence note: This architecture does not depend on the D4 hypothesis or the FEP
falsification program. A functioning Marketplace validates only the architecture, not the
sacred-value hysteresis claim. These are independent research tracks.*

---

## §1 Purpose

The Marketplace is a Global Value Operating System: a structured allocation mechanism that
turns real-world problems into missions, matches actors to those missions, executes, measures,
and improves through evidence.

It is NOT a discussion platform.
It is NOT a social network.
It is a resource allocation mechanism operating under value constraints.

---

## §2 Core Flow

```
Case → OPM Decomposition → Value Office Classification
     → Actor Matching → Role Assignment
     → Evidence Collection → Resolution
     → Resource Allocation → Execution
     → Outcome Measurement → Trust/Reputation Update → History
```

---

## §3 Entity Taxonomy

### §3.1 Cases (Problems)

The atomic unit of the Marketplace. Every interaction begins as a Case.

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique identifier |
| description | text | Natural-language problem statement |
| value_constraints | set\<OfficeID\> | Which Value Offices constrain this case |
| required_roles | set\<RoleID\> | Roles needed to resolve this case |
| budget | ResourceVector | Available resources |
| timeline | duration | Deadline or duration estimate |
| evidence | list\<EvidenceObject\> | Attached evidence |
| status | enum | open / matched / active / resolved / archived |
| history | ordered log | State transitions |

### §3.2 Value Offices

| Office | Domain |
|---|---|
| Truth | Epistemic integrity, accuracy, transparency |
| Justice | Fairness, rights, due process |
| Health | Physical and mental wellbeing |
| Education | Knowledge, development, capability |
| Economy | Resources, livelihoods, sustainability |
| Security | Safety, protection, stability |
| Environment | Ecological integrity, sustainability |
| Community | Social cohesion, belonging |
| Ethics | Moral norms, accountability, integrity |
| Governance | Rules, oversight, legitimacy |

Value Office constraints are **filters**, not utilities. They exclude outcomes regardless of
aggregate benefit — a resolution that violates a hard constraint is rejected even if it
maximizes the weighted sum of other values.

### §3.3 Actor Types

| Type | Description |
|---|---|
| Individual Expert | Doctor, lawyer, psychologist, teacher, researcher, engineer, developer, consultant, volunteer, mentor |
| Organization | Hospital, university, company, government, municipality, NGO, startup |
| Government | Regulatory and policy authority |
| AI System | Cloud or local LLM (GPT, Claude, Gemini, Grok, DeepSeek, local models) |
| Community | Geographically or identity-bounded group |

### §3.4 Role Types

| Role | Function |
|---|---|
| Support | Active advocate for a resolution direction |
| Opposition | Advocate against; raises blocking concerns |
| Reservation | Conditional support — conditions must be met |
| Expert | Domain authority providing evidence |
| Mediator | Facilitates between conflicting positions |
| Governor | Enforces rule-based hard constraints |
| Executor | Implements the resolution |
| Auditor | Verifies execution and outcomes |
| Reviewer | Evaluates quality of evidence and decisions |

### §3.5 Market Types

| Market | What it allocates |
|---|---|
| Services | Professional time and expertise |
| Resources | Budget, equipment, space, medicine, transport, communication |
| Organizations | Institutional capacity and authority |
| AI Systems | Computational resources and model access |
| Missions | Assembled teams for structured problem-solving |
| Value Messengers | Reputational standing and domain authority |

### §3.6 Trust Dimensions

Each actor carries a **6-dimensional trust vector**, not a scalar score. Trust dimensions are
independent: high scientific trust does not imply high execution trust.

| Dimension | What it measures |
|---|---|
| Professional | Domain expertise and outcomes |
| Ethical | Consistency with value constraints |
| Scientific | Evidence quality and rigor |
| Execution | Reliability in completing commitments |
| Community | Trust within affected communities |
| Financial | Responsible resource use |

### §3.7 Value Messengers

Actors earn Value Messenger status through demonstrated contribution, not credentials or titles.

Measured by:
- Problems solved (→ Execution trust)
- Community impact (→ Community trust)
- Evidence quality (→ Scientific trust)
- Value constraint adherence (→ Ethical trust)
- Consistency over time (→ Professional trust)
- Responsible resource use (→ Financial trust)

---

## §4 Constraint Graph (§6)

The aggregate Marketplace state depends on ten coupled variables. See §10 of
`marketplace-dynamics-v0.md` for the full update equations.

| Variable | Symbol | Primary dependencies |
|---|---|---|
| Trust | T | Reputation, Evidence, Outcomes, Governance |
| Evidence | E | Outcomes, Reputation |
| Support | S | Trust, Value alignment, Evidence |
| Outcomes | O | Match quality, Resolution confidence, Trust |
| Reputation | Rep | Evidence, Outcomes, Trust |
| Match quality | M | Trust, Value alignment, Resources, Reputation |
| Resolution confidence | R | Support, Evidence, Governance |
| Resource adequacy | RA | Trust, Reputation, Governance |
| Governance score | G | Evidence, Outcomes, Trust |
| Value alignment | V | Trust, Governance |

This graph contains cycles. Convergence is not guaranteed.
See `docs/marketplace-dynamics-v0.md §11` and the convergence simulator for formal analysis.

---

## §5 Invariants

These must hold at any valid Marketplace state:

**I1 — Trust monotonicity**: Trust scores increase only through positive evidence and outcomes.
Position, title, or social pressure alone cannot increase trust.

**I2 — Value constraint priority**: A Value Office hard constraint (Governor block) rejects a
resolution regardless of consensus score. Value constraints are not traded off against aggregate
benefit.

**I3 — Evidence precedence**: Every resolution must reference at least one evidence object.
No evidence → no valid resolution.

**I4 — Fixed-point validity**: A Marketplace state is valid only if it is a fixed point of the
constraint network, or if non-convergence is explicitly detected and reported.
Sequential update is valid only as a debugging variant; synchronous fixed-point iteration is
the primary dynamics.

---

## §6 Open Risks

| Risk | Description | Mitigation |
|---|---|---|
| Convergence | Cyclic dependencies may not converge | Stage 0d-arch convergence test |
| Multistability | Multiple stable states depending on initialization history | §7 sweep across N_INIT random starts |
| Manipulation | Actors gaming trust or evidence scores | Ethical trust dimension + Auditor role |
| Value conflict | Two Value Offices enforce mutually exclusive constraints | Governance layer + Mediator role |
| Coverage gap | No actors available for a required role | Resource adequacy variable |
| Coupling fragility | Weights are unchosen; real calibration unknown | Sensitivity sweep over α |

---

*Layer 3 (Architecture) | Evidence: D — Hypothesis*
*Independence note: This architecture does not confirm or refute D4 (sacred value hysteresis).
These are independent research tracks.*
