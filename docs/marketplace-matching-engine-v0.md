# Marketplace Matching Engine — v0.2

**Status: Candidate Specification — not validated, not implemented**

*This document specifies the invariants, inputs, outputs, actor model, and audit
requirements that govern any write-path for `selected_for` relations in the Philos Marketplace.
No implementation may be started until a review confirms these invariants are complete and
internally consistent.*

*This document does not specify UI, OPM integration, or execution logic.*

*Independence note: These invariants do not confirm or refute D4 (sacred-value hysteresis).
They govern write-path correctness only.*

---

## §0 Phase 0 — Contextual Qualification (`required_for`)

*Added in v0.2. Specifies the read-only `required_for` VCR relation and its invariants.*

### §0.1 Purpose

`required_for` is a `ValueCapabilityRelation` (`relationType = "required_for"`) that
contextually narrows a general `can_address` VCR to a specific (Mission, Gap) context.
It records *which capability is required* to address a value in the context of a
particular mission and gap — not which provider has been selected.

### §0.2 Chain

```
Mission
→ mission.gaps
→ Gap.requiredValues
→ required_for where:
     missionId = selected mission
     gapId ∈ selected mission gaps
     valueId matches that Gap requirement
→ Capability
→ can_deliver PCR
→ Provider (example only — no selection implied)
```

### §0.3 Invariants

Every `required_for` record **must** satisfy all of the following:

| # | Invariant |
|---|-----------|
| RF-1 | `missionId` is present and references a known Mission |
| RF-2 | `gapId` is present and references a known Gap |
| RF-3 | `valueId` is present and references a known Value |
| RF-4 | `capabilityId` is present and references a known Capability |
| RF-5 | The Gap identified by `gapId` belongs to the Mission identified by `missionId` |
| RF-6 | The `valueId` appears in `Gap.requiredValues` for the identified Gap |
| RF-7 | A `can_address` VCR exists for the same (`valueId`, `capabilityId`) pair |
| RF-8 | No duplicate `(missionId, gapId, valueId, capabilityId)` tuple exists |

### §0.4 What `required_for` does NOT imply

- No provider has been selected, contacted, or evaluated.
- No `selected_for` PCR exists or is implied.
- No execution, delivery, or outcome is implied.
- No claim of matching, eligibility, or ranking is made.
- `required_for` is not a `selected_for` precursor — selection requires a
  separate `SelectionDecision` entity (§2).

### §0.5 Deferred

`selected_for` VCR write-path is deferred to a future phase. No write-path
for `required_for` records exists in Phase 0 — all records are authored
offline and validated by `scripts/validate-required-for.js`.

---

## §1 Scope

**In scope:**
- Rules and invariants for evaluating Candidate Providers against a Mission Gap
- The SelectionDecision entity and its write conditions
- Write conditions for `selected_for` PCR (ProviderCapabilityRelation)
- G-2 invariants that govern SelectionDecision creation and PCR writes
- Actor model and audit requirements for selection actions

**Out of scope:**
- OPM decomposition or Gap derivation
- Marketplace UI or Graph Explorer
- Execution, delivery, or outcome measurement
- VCR write paths (Value ↔ Capability relations)
- Read-only queries of any kind

### Phase Model

```
Mission → Gap → Matching Engine → Candidate Evaluation → SelectionDecision → selected_for PCR → Execution → Outcome
```

The Matching Engine operates in two structurally separate phases:

**Phase 1 — Candidate Evaluation:** The Engine computes eligibility and ranks
candidates. This phase is deterministic, produces no PCR writes, and may be driven
by an AI Agent. Output: one evaluation record per candidate (`candidate` or `rejected`).

**Phase 2 — SelectionDecision:** An authorized human actor reviews Phase 1 output and
creates a SelectionDecision entity. If the decision is approved, it causes a
`selected_for` PCR to be written. The PCR is the graph-layer artifact; the
SelectionDecision is the decision record with full context.

Separating the phases ensures:
- The Engine remains deterministic and independently auditable.
- Governance (G-2) gates only Phase 2 — not the computation.
- Decision history is preserved in SelectionDecision without overloading the PCR schema.

---

## §2 Inputs

A Matching Engine invocation requires **all** of the following. A missing or invalid
input is a hard rejection — no partial processing.

| Input | Type | Required | Description |
|---|---|---|---|
| Mission | Mission | Yes | The mission the selection serves |
| Gap | Gap | Yes | The specific gap being addressed |
| Value | Value | Yes | The value node the gap requires |
| Capability | Capability | Yes | The capability to be covered |
| Candidate Providers | Provider[] | Yes (≥ 1) | Providers to evaluate; each must already hold a `can_deliver` PCR for this Capability |
| Evidence | EvidenceRecord[] | Yes (≥ 1 per candidate) | At least one Behavior or Outcome evidence record per candidate |
| Actor authorization | AuthorizationContext | Yes | Identity and role of the actor requesting the selection |

**Evidence floor (I5):** Each Candidate Provider must carry at least one evidence record
with `signal = "behavior"` or `signal = "outcome"`. A record with `signal = "intent"` alone
does not satisfy this requirement. An intent record registers a prior; it is not evidence of
performance.

---

## §3 Outputs

### §3.1 Phase 1 — Candidate Evaluation

The Matching Engine produces one evaluation record per candidate. **No PCR is written
in Phase 1.**

| Result | Condition | PCR write? |
|---|---|---|
| `candidate` | Provider passed all eligibility checks | No |
| `rejected` | Provider failed a hard constraint | No |

Each evaluation record carries:

| Field | Type | Description |
|---|---|---|
| providerId | string | The evaluated provider |
| capabilityId | string | The capability being covered |
| result | `"candidate"` \| `"rejected"` | Eligibility outcome |
| score | number \| null | Relative rank among candidates (null if rejected) |
| rationale | string | Human-readable reason |
| evidenceIds | string[] | Evidence records considered in evaluation |

### §3.2 Phase 2 — SelectionDecision

A `SelectionDecision` is a first-class entity created when an authorized human actor
approves one of the Phase 1 candidates. It is the source of truth for why a
`selected_for` PCR was written.

```
SelectionDecision
    └── creates
            ↓
ProviderCapabilityRelation (relationType = "selected_for")
```

The PCR receives `missionId` and `gapId` from the SelectionDecision.
The PCR is the graph-layer artifact; the SelectionDecision holds the decision context
and is the object that Governance and Audit operate against.

**SelectionDecision schema:**

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Unique decision identifier |
| missionId | string | Yes | Mission context |
| gapId | string | Yes | Gap context |
| capabilityId | string | Yes | The capability being covered |
| candidateProviders | CandidateResult[] | Yes | Phase 1 evaluation records for all candidates |
| selectedProviderId | string | Yes | The approved provider |
| decisionActorId | string | Yes | Human actor who made the selection |
| decisionReason | string | Yes | Rationale for this provider over others |
| evidenceIds | string[] | Yes | Evidence records that grounded the decision |
| previousDecisionId | UUID \| null | Yes | The SelectionDecision this one supersedes; null if first decision for this tuple |
| createdAt | ISO 8601 | Yes | Timestamp of the decision |
| auditEvent | AuditEvent | Yes | See §6 |

**SelectionDecision records are immutable.** Replacing a provider creates a new
SelectionDecision (with `previousDecisionId` pointing to the prior record) and a
corresponding AuditEvent. The prior SelectionDecision and its PCR state are preserved
as part of the audit history. No existing SelectionDecision may be modified after creation.

---

## §4 G-2 Invariants

These are **hard constraints** that gate SelectionDecision creation (Phase 2).
A SelectionDecision that violates any invariant is rejected before the PCR is written.
No implementation may override them. Each violation produces a hard rejection with
an explicit reason code (see §7).

**G-2-1 — `can_deliver` excludes missionId / gapId**
A PCR with `relationType: "can_deliver"` must have `missionId = null` and `gapId = null`.
Writing a `can_deliver` PCR with a non-null mission or gap context is rejected.

**G-2-2 — SelectionDecision requires missionId**
A SelectionDecision must carry a non-null `missionId` matching the Mission in §2 Inputs.
The resulting `selected_for` PCR inherits this `missionId`. A SelectionDecision without
missionId is rejected.

**G-2-3 — SelectionDecision requires gapId when a Gap is in context**
When a Gap is provided as input, the SelectionDecision must carry the `gapId` of that gap.
The resulting `selected_for` PCR inherits this `gapId`. A SelectionDecision without gapId
when a Gap exists is rejected.

**G-2-4 — SelectionDecision requires Behavior or Outcome evidence**
A SelectionDecision may not be created unless the selected provider's `evidenceIds`
include at least one record with `signal = "behavior"` or `signal = "outcome"`.
Intent-only evidence does not satisfy this invariant (I5).

**G-2-5 — Intent alone is insufficient**
No variable update, trust increment, or selection may result solely from a declared
intent record. An intent record registers a prior only.

**G-2-6 — No silent overwrite**
If a `selected_for` PCR already exists for the tuple
(`providerId`, `capabilityId`, `missionId`, `gapId`), a new SelectionDecision for
the same tuple must either:

a) be rejected with `CONFLICTING_SELECTION`, or
b) succeed only when an authorized actor explicitly sets `replace: true`, which creates
   a new SelectionDecision recording `previousDecisionId` and a new AuditEvent recording
   the previous PCR state.

Silently overwriting an existing `selected_for` relation is rejected.

---

## §5 Actor Model

| Role | Phase 1: Can evaluate | Phase 2: Can create SelectionDecision | Notes |
|---|---|---|---|
| Mission Owner | Yes | Yes | The actor who created the Mission |
| Value Office Governor | No | Yes (or veto) | May block any SelectionDecision that violates a Value constraint; veto overrides consensus |
| Expert | Yes | No | Domain authority; evaluates, does not finalize |
| Auditor | No | No | Read-only; verifies post-selection |
| AI Agent | Yes | No | May run Phase 1 and attach evidence; may not create a SelectionDecision |
| Observer | No | No | Read-only |

**Agent autonomy constraint:** An AI Agent may run Phase 1 (Candidate Evaluation) and
attach supporting evidence, but creating a SelectionDecision — and the resulting
`selected_for` PCR — requires a human actor with Mission Owner or Governor role.

**Human approval requirement:** Every SelectionDecision must carry a non-null
`decisionActorId` that resolves to a human actor. A SelectionDecision with only an
agent as actor is rejected.

**Governor veto:** A Value Office Governor block rejects a SelectionDecision regardless
of consensus or evidence score. This implements Invariant I2: Value constraints are
exclusion filters, not items in a utility sum.

---

## §6 Audit Trail

Every Matching Engine action that produces a write or a rejection must generate an
AuditEvent. AuditEvents are append-only and may not be modified after creation.

Phase 1 rejections (eligibility failures) produce AuditEvents.
Phase 2 actions (SelectionDecision creation, approval, rejection, overwrite) produce
AuditEvents that reference the SelectionDecision by ID.

**Immutability enforcement:** AuditEvents and SelectionDecision records may not be
modified after creation. This is a storage-layer constraint, not a business-logic
constraint. A system that allows post-hoc modification of either record violates
the audit chain and invalidates G-2 enforcement.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Unique event identifier |
| actionType | enum | Yes | `"evaluated"` \| `"approved"` \| `"rejected"` \| `"overwritten"` |
| phase | `1` \| `2` | Yes | Which phase produced this event |
| actorId | string | Yes | Actor who triggered this action |
| humanActorId | string | Yes (Phase 2 `approved`, `overwritten`) | Human actor who confirmed the write |
| selectionDecisionId | UUID \| null | Yes (Phase 2 only) | The SelectionDecision that caused this event |
| timestamp | ISO 8601 | Yes | Wall-clock time at write |
| previousState | PCR \| SelectionDecision \| null | Yes | State before this action; null if new |
| newState | PCR \| SelectionDecision \| null | Yes | State after this action; null if rejected |
| evidenceIds | string[] | Yes | All evidence records considered |
| reason | string | Yes | Human-readable rationale |
| sourceTool | string | Yes | Identifier of the system or agent that initiated the action |
| missionId | string | Yes | Mission context |
| gapId | string | Yes | Gap context |

---

## §7 Failure and Rejection Rules

A hard rejection produces an AuditEvent with `actionType: "rejected"` and a specific
reason code. Processing stops; no partial writes occur.

Phase 1 rejections halt evaluation of that candidate only; other candidates continue.
Phase 2 rejections halt the entire SelectionDecision; no PCR is written.

| Failure condition | Phase | Reason code |
|---|---|---|
| Provider has no `can_deliver` PCR for this Capability | 1 | `NO_CAN_DELIVER_RELATION` |
| No Behavior or Outcome evidence for this provider | 1 | `INSUFFICIENT_EVIDENCE` |
| Actor does not hold the required role for this action | 2 | `UNAUTHORIZED_ACTOR` |
| SelectionDecision actor is not a human actor | 2 | `AGENT_CANNOT_APPROVE` |
| `selected_for` already exists for this tuple and `replace` not set | 2 | `CONFLICTING_SELECTION` |
| Version token does not match current relation state | 2 | `STALE_RELATION` |
| Provider state is marked unavailable | 1 or 2 | `PROVIDER_UNAVAILABLE` |
| Value Office consent required but not obtained | 2 | `MISSING_CONSENT` |
| `missionId` is null on the SelectionDecision | 2 | `MISSING_MISSION_CONTEXT` |
| `gapId` is null when Gap is in input context | 2 | `MISSING_GAP_CONTEXT` |
| A required input field is missing or invalid (§2) | 1 | `INVALID_INPUT` |

---

## §8 Idempotency and Concurrency

**Idempotency — Phase 1:** A duplicate Phase 1 evaluation for the same
(`providerId`, `capabilityId`, `missionId`, `gapId`) with identical evidence returns
the cached evaluation result without re-running or generating a new AuditEvent.

**Idempotency — Phase 2:** A duplicate SelectionDecision for the same tuple with
identical `selectedProviderId`, `decisionActorId`, and `evidenceIds` returns the
existing SelectionDecision without creating a new one or a new AuditEvent.

**Version check:** Every Phase 2 request that targets an existing `selected_for` PCR
must include a version token (ETag or `updatedAt`). If the token does not match the
persisted PCR state, the SelectionDecision is rejected with `STALE_RELATION`.

**Concurrent writes:** Two concurrent SelectionDecisions for the same tuple are
serialized at the repository layer. The second observes the first as an existing
relation and either:

- succeeds as idempotent (if identical in all fields), or
- fails with `CONFLICTING_SELECTION` (if any field differs).

---

## §9 Non-Claims

These are architectural constraints, not disclaimers.

| Statement | Operational meaning |
|---|---|
| Selection ≠ recommendation | A `selected_for` PCR records that an authorized actor chose this provider for a specific mission context. It does not imply that Philos endorses the provider for any other context. |
| Selection ≠ availability | A `selected_for` PCR does not confirm that the provider is available, contactable, or willing to engage. |
| Selection ≠ successful delivery | A `selected_for` PCR records an intent to engage. Delivery outcome is a separate event with separate evidence. |
| Success ≠ proof of matching quality | A resolved mission does not validate the matching algorithm. Matching quality requires controlled comparison against a counterfactual. |

---

## §10 Open Questions

These must be resolved before the write-path implementation is considered complete.
They are not blockers for this specification, but must be addressed before G-2 can
advance beyond Candidate.

| Question | Impact |
|---|---|
| **Minimum evidence threshold:** Is one Behavior/Outcome record sufficient, or does the floor need to be higher? The current floor (§2, G-2-4) is one record. | Affects G-2-4 strictness |
| **Revocation:** Can a `selected_for` PCR be revoked? If yes: what actor role, what evidence level? Does revocation produce a tombstone, revert to `can_deliver`, or delete the relation? | Affects G-2-6, idempotency, audit trail |
| **Multiple providers per capability:** Is it valid to hold more than one active `selected_for` PCR for the same (`capabilityId`, `missionId`, `gapId`) pointing to different providers? If yes, the uniqueness assumption in G-2-6 must be revised. | Affects G-2-6, output schema |
| **Ranking vs eligibility:** Does the engine rank candidates (ordered score list) or determine eligibility (binary pass/fail per candidate)? A ranking algorithm requires a calibrated score function not yet specified. | Affects output schema, §8.2 of marketplace-dynamics-v0.md |
| **Agent autonomy ceiling:** Is the current ceiling (agent proposes, human approves) the permanent rule, or can it be relaxed for specific capability types or value offices? | Affects §5 Actor Model, Governor veto |

---

*Candidate Specification v0.1 — not validated, not implemented*
*Created from session record 2026-07-14*
*Evidence grade: Candidate — framework specified, not externally reviewed*

*Activation condition: G-2 invariants become active the moment any `selected_for` write
path or `POST /provider-capability-relations` endpoint is introduced. Until then, this
document is a precondition for implementation, not a live enforcement mechanism.*
