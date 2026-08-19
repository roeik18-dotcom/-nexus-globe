# PHILOS — POSITIVE MELTING POT / כור ההיתוך החיובי
## Canonical Master — FULL_CANONICAL_LOCK

- **Concept (he):** כור ההיתוך החיובי — כור היתוך חיובי
- **Concept (en):** Positive Melting Pot
- **LOCK_STATUS:** FULL_CANONICAL_LOCK (paper / ontology / schema level)
- **IMPLEMENTATION_STATUS:** NOT_IMPLEMENTED
- **Scope:** This document is the single canonical statement of the Philos Positive Melting Pot. It supersedes the older 3·6·9 / 18-cell / Value-Forge material for this concept. It defines an *orientation* mechanism, **not** a ranking mechanism.

> This is the locked paper. It is knowledge for Merlin to KNOW and ADVISE from. Nothing here is implemented in runtime, engine, or UI.

---

## 1. Purpose
The Positive Melting Pot (כור ההיתוך החיובי) is an interpersonal/systemic mechanism that identifies where an entity holds a *local* deficit and another holds a *relevant* surplus/capacity, and permits an explicit, consented, non-depleting transfer of value between them. The whole may give to the individual, and the individual may give to the whole. Value comes from **complementarity between different structures**, never from making people uniform, and never from grading a human as "better" or "lesser".

## 2. Reality foundation (Level 0)
`Matter + Gap + Time`. Matter = what exists; Gap = separation/difference between states/entities; Time = the axis along which relations change. **A deficit is not a primitive** — it is an *interpretation* of a gap relative to a reference/target/frame. Generative chain: `Matter + Gap + Time → Interaction → Interpretation → Deficit/Tension → Force → Potential → Action → Effect → Learning`.

## 3. Canonical ontology — the 3×3 state space
Nine cells = **Domain × Frame** (exactly 9; **no fourth Domain**).

- **Domain** = kind of state: **G** Physical / **E** Emotional / **C** Cognitive.
- **Frame** = reference space: **I** Individual (intra-personal) / **R** Relational (interpersonal/group) / **S** Systemic.

|      | I (individual) | R (relational) | S (systemic) |
|------|----------------|----------------|--------------|
| **G** | G_I | G_R | G_S |
| **E** | E_I | E_R | E_S |
| **C** | C_I | C_R | C_S |

G/E/C are **domains of state**. Money, time, attention, knowledge, access, labor, connection, trust are **Resources** (transfer layer), never cell values. Both axes are state-classifying (each axis is internally type-consistent; the cells are uniformly typed). S-frame observations are keyed by **SystemicChannel**; this does not create additional cells.

## 4. CellState
`CellState = (Level, Stability)` — locked. **Tension is NOT part of CellState.**
- **Level:** signed `deficit ← equilibrium → surplus`, defined as `signed(observed − reference(frame))`; every Level is relative to `reference, context, target, time`.
- **Stability:** how well the state persists or destabilizes over time.

Behavior, action, flow, learning, outcome, confidence, and **Tension** are NOT cell state — they are process/interpretation layers.

## 5. DeficitType
`DeficitType = { RELATIVE, OBJECTIVE }`.
- **RELATIVE** — a gap relative to a reference/context/target/norm; requires an explicit reference/context.
- **OBJECTIVE** — a state below an explicitly defined critical functional/biological threshold; frame-independent; **must never be inferred from group norms**. OBJECTIVE thresholds are the single sanctioned frame-independent reference (a declared exception to frame-relativity).

## 6. Observation
`Observation` is a measurement of a cell, never a property of the person. Required fields:
`subject/entity, domain, frame, reference, context, time, provenance, confidence, expiry` (+ `Level, Stability, DeficitType`, and `SystemicChannel` when frame = S).
`provenance ∈ {self_reported, inferred, third_party}`. Confidence is measurement metadata, never part of a human's value.

## 7. Interpretation / Tension layer
`Tension` is a **derived relation**, computed in this layer from `(CellState, Target)` — not a stored cell value. It is the engine of flow: `gap → Tension → Action Pressure → Potential → Matching → Action`. Deficit/Surplus is the interpreted sign of Level.

## 8. Target (schema closure)
Tension is not derivable without an explicit reference object.
`Target = { target_id, subject, cell, desired_state, reference_type ∈ {self_goal | norm | peer | threshold}, provenance, consent_status, context, time, expiry }`.
`Observation.reference` (what Level is measured against) and `Target` (the desired/normative state used to derive Tension) are **distinct**. A Target whose source is `norm/peer` (not self-endorsed) is flagged external and cannot trigger automatic intervention.

## 9. Force / Potential / Flow (systemic terms, non-physical)
- **Force** = directional **action pressure** produced by an interpreted gap/tension.
- **Potential** = available **capacity to support change**.
- **Flow** = **realized transfer** through an explicit allowed mechanism over time.
- **Prohibited:** physical conservation-law semantics. These are Philos systemic terms, not physics. Clean separation: `State ≠ Tension ≠ Force ≠ Potential ≠ Flow ≠ Effect`.

## 10. Matching (boolean gate)
Matching is boolean eligibility, not an optimizer:
`Permitted(edge) ⇔ CAN ∧ WANTS ∧ ALLOWED ∧ APPROPRIATE ∧ AVAILABLE ∧ CONSENT`.
Consent, rights, appropriateness, and safety are **hard gates** and must never be encoded as soft optimizer costs. Output = permitted edges. **Matching ≠ Flow**: Matching answers "may and should these be connected?"; Flow answers "how much, from where, to where, at what cost, when?" — and runs only AFTER an edge is permitted.

## 11. Resource / Transfer
- **Resource** lives in the transfer layer, typed and costed independently. **Capacity ≠ Resource**: a Capacity (a cell surplus-state) becomes a Resource only through an explicit **conversion mechanism** — never automatically.
- **ResourceType ∈ {consumable, renewable, replicable, non-rival, time, attention, knowledge, emotional/social, ...}**.
- **Offer (schema closure, donor-side):**
`Offer = { offer_id, source, source_cell, systemic_channel_if_S, available_resource, resource_type, amount_or_capacity, competence, willingness, consent, availability, cost, constraints, expiry, provenance }`. Offer is **ephemeral / per-match** — never a permanent donor-capacity or contribution/reputation profile.
- **Transfer ⊂ Action.** `Transfer = { source, target, source_cell, target_cell, resource, resource_type, amount, conversion_mechanism, cost, consent, provenance, reversibility, expiry/validity, claimed_outcome, verified_outcome, time }`. No automatic cell→cell fill; every edge states its causal conversion (e.g. `Knowledge(A) → explanation/mentoring → understanding(B) → reduced uncertainty → emotional effect(B)`).

## 12. Need (schema closure)
`Need = subject-declared or subject-endorsed desired change`.
`Need = { need_id, subject, desired_change, cells_or_domain, provenance ∈ {self_reported, endorsed}, context, time, expiry, consent_scope }`.
**Need ≠ Deficit:** a Deficit may exist without a Need, and a Need may exist without an inferred Deficit. **Need is the sovereign subject-side entry into Matching.** An inferred Deficit without a corresponding Need cannot automatically trigger intervention.

## 13. Action (schema closure)
`Action = { action_id, type ∈ {transfer, non_transfer}, owner, mechanism_scope ∈ {self_regulation, melting_pot}, consent, inputs, effect_ref, reversibility, time, provenance }`.
Transfer is one subtype of Action, not synonymous with it. **non_transfer_action** must remain possible (removing a barrier, changing a boundary, creating access, changing an information environment). A `self_regulation` Action cannot create an interpersonal Transfer.

## 14. Positive Melting Pot mechanism
Strictly interpersonal/systemic. Permitted transfer is the conjunction:
`Need(B) + relevant Observation/Deficit(B) + Offer(A) + ConversionMechanism + Matching gates + Consent + Anti-Depletion → Permitted Action/Transfer A→B → Effect → OutcomeVerification → Learning → State'`.
Directions: `whole→individual, individual→whole, individual→individual, group→individual, individual→group`. Every transfer must be identified, explained, bounded, measurable, reversible when possible, and free of impermissible depletion. A transfer is **never assumed to have worked** merely because it executed.

## 15. Self-Regulation ≠ Melting Pot
- **Self-Regulation:** intra-personal change `Cell_x → action/conversion → Cell_y` within one person.
- **Positive Melting Pot:** `Person A → group/social field → Person B`.
They are type-separated; one positive cell does not automatically fill another negative cell within the same person.

## 16. Anti-Depletion
Applies to the **actually consumed resource**, not blindly to the source cell:
`TransferAllowed ⇔ Benefit(receiver) > Cost ∧ DonorPostState(consumed_resource) ≥ ResourceSpecificFloor ∧ SystemicExternality ≤ AcceptedRisk`.
Floors/costs belong to ResourceType/cost. Example: non-rival **knowledge** stays intact in the giver, but the giver's **time/attention/emotional** capacity is consumed — the floor sits on the spent resource. Not a universal physical conservation law.

## 17. Effect / Learning / OutcomeVerification (schema closure)
- **Effect:** measured change, `claimed_outcome` vs `verified_outcome`.
- **OutcomeVerification:** `claimed_outcome` and `verified_outcome` each carry `{ provenance, verifier_type ∈ {self, counterparty, third_party, observed_measured}, confidence, time, method }`. A claimed outcome must **never** update `State'` as though verified. Verification of a subject's internal state requires subject/self evidence or subject-consented verification.
- **Learning:** cross-cutting `State → State'`; home of the empirical question "did this raise future stability/capacity, or merely patch a symptom?" (an assumption to measure, not assert).

## 18. SystemicChannel (schema closure)
For `frame = S`, CellState is addressed **per (Cell, SystemicChannel)**. `SystemicChannel ∈ {institutional, material, economic, informational, environmental, other}`. There is **no silent reconciliation/aggregation across channels**. Any S-cell reference used by Tension, Matching, Need, Offer, Action, or Transfer must identify its SystemicChannel. This keeps 9 cells and the `(Level, Stability)` type unchanged.

## 19. Relative human state — no global score
`P = P(person, reference_group, context, time)`. There is no universal human profile; every value is relative to a stated frame. `Score(i,r,c,t)` is not transferable to `Score(i,r',c',t')`. The system is **Orientation**, not **Ranking**.

## 20. Reference-group safeguards
Reference groups must be **explicit and contestable** by the subject; there is **no default reference group**; multiple frames are held simultaneously; RELATIVE deficits are always tagged distinct from OBJECTIVE; a dominant group must never silently become the yardstick; a description in a frame must never be detached into a bare judgment of the person.

## 21. Anti-ranking invariants (architectural, type-level)
- `NO_GLOBAL_PERSON_SCORE`
- `NO_CROSS_FRAME_AGGREGATION`
- `NO_HELP_CONDITIONAL_ON_PRIOR_CONTRIBUTION`
- `NO_PERMANENT_DEFICIT_PROFILE`
- `NO_PERMANENT_DONOR_OR_CONTRIBUTION_PROFILE`
- `NO_DEFAULT_REFERENCE_GROUP`
- `NO_AUTOMATIC_THIRD_PARTY_PERSON_INFERENCE`
- `REFERENCE_GROUP_MUST_BE_EXPLICIT_AND_CONTESTABLE`
- `LOW_CONFIDENCE_CANNOT_TRIGGER_AUTOMATIC_INTERVENTION`
- `CONSENT_IS_A_HARD_GATE_NEVER_A_SOFT_COST`
- `NO_GLOBAL_HUMAN_OPTIMIZER`

Enforcement intent: no total order on persons; no per-person cumulative counter; cross-frame aggregation queries are unrepresentable; help is need-gated not contribution-gated; observations decay/expire; third-party observations require the subject's consent to be actionable.

## 22. Pattern / Syndrome layer
A higher-order, multi-cell, contestable, **non-identity** layer. Emergent phenomena (burnout, belonging, collapse, resilience) are recognized as configurations over cell-states + trajectories — never forced into one cell, never stored as an identity.

## 23. Worked illustration (relative, non-ranking)
A house-painter inside a hi-tech group is never "primitive". Relative to that group he may hold a local deficit in `C_R` (software knowledge) and a local surplus in `G_R` (execution/hands-on capability); the programmer may hold the inverse. When the office needs painting, the frame shifts and the painter is the resource-holder. The system asks *"in which cell is there a local deficit, in which a matching surplus, and what is the lowest-cost, highest-positive-impact transfer?"* — never *"who is worth more?"*.

## 24. Canonical pipeline
`Matter + Gap + Time → Observation → Cell → CellState(Level, Stability) → Interpretation → {Deficit/Surplus, Tension} → Action Pressure / Force → Potential → Matching → Action (including Transfer where applicable) → Effect → OutcomeVerification → Learning → State'`.
Feeders: `Target → Tension`; `Need + Offer + appropriately bounded Deficit → Matching`; `OutcomeVerification → determines whether Effect may update State'`.

## 25. Type boundaries (locked)
`Person ≠ Observation ≠ CellState ≠ Need ≠ Target ≠ Offer ≠ Resource ≠ Action ≠ Transfer ≠ Effect`. A human being must never be represented as a cell value or a deficit identity.

## 26. Open empirical assumptions (measure, don't assert)
1. Receiving support raises future stability/capacity.
2. Useful complementarity is reliably discoverable.
3. Level and Stability are empirically independent/sufficient.
4. Defensible OBJECTIVE thresholds exist outside clear physical cases.
5. Groups can successfully mediate these transfers.

## 27. Explicitly unresolved questions
- Value/Meaning/Morality coverage: test whether it fits `C` (cognitive-evaluative) before ever introducing a 4th Domain (none is added here).
- Donor-side and outcome-verification authority details beyond the closures above.

---

**FULL_CANONICAL_LOCK.** Ontology is locked; do not reopen without a demonstrable contradiction. **IMPLEMENTATION_STATUS = NOT_IMPLEMENTED.**
