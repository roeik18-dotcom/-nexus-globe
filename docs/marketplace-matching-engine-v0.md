# Marketplace Matching Engine — v0.1

**Status: Candidate Specification — not validated, not implemented**

*This document specifies the invariants, inputs, outputs, actor model, and audit
requirements that govern any write-path for `selected_for` relations in the Philos Marketplace.
No implementation may be started until a review confirms these invariants are complete and
internally consistent.*

*This document does not specify UI, OPM integration, or execution logic.*

*Independence note: These invariants do not confirm or refute D4 (sacred-value hysteresis).
They govern write-path correctness only.*

---

## §1 Scope

**In scope:**
- Rules and invariants for evaluating Candidate Providers against a Mission Gap
- Write conditions for `selected_for` PCR (ProviderCapabilityRelation)
- G-2 invariants that govern any `selected_for` write
- Actor model and audit requirements for selection actions

**Out of scope:**
- OPM decomposition or Gap derivation
- Marketplace UI or Graph Explorer
- Execution, delivery, or outcome measurement
- VCR write paths (Value ↔ Capability relations)
- Read-only queries of any kind

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

A Matching Engine invocation produces exactly one output state per candidate:

| Output | Condition | PCR write? |
|---|---|---|
| `candidate` | Provider passed eligibility checks; awaiting human approval | No |
| `rejected` | Provider failed a hard constraint | No |
| `selected_for` | Provider approved and written as execution relation | Yes |

Every output object carries:

| Field | Type | Description |
|---|---|---|
| providerId | string | The evaluated provider |
| capabilityId | string | The capability being covered |
| missionId | string | The mission context |
| gapId | string | The gap context |
| decision | `"candidate"` \| `"rejected"` \| `"selected_for"` | Result |
| rationale | string | Human-readable reason for this decision |
| evidenceIds | string[] | IDs of evidence records considered |
| auditEvent | AuditEvent | See §6 |

---

## §4 G-2 Invariants

These are **hard constraints**. No implementation may override them.
Each violation is a hard rejection with an explicit reason code (see §7).

**G-2-1 — `can_deliver` excludes missionId / gapId**
A PCR with `relationType: "can_deliver"` must have `missionId = null` and `gapId = null`.
Writing a `can_deliver` PCR with a non-null mission or gap context is rejected.

**G-2-2 — `selected_for` requires missionId**
A PCR with `relationType: "selected_for"` must carry a non-null `missionId` matching
the Mission in §2 Inputs. A `selected_for` without missionId is rejected.

**G-2-3 — `selected_for` requires gapId when a Gap is in context**
When a Gap is provided as input, the resulting `selected_for` PCR must carry the
`gapId` of that gap. A `selected_for` written without gapId when a Gap exists is rejected.

**G-2-4 — `selected_for` requires Behavior or Outcome evidence**
A `selected_for` PCR may not be written unless the provider's evidence set includes
at least one record with `signal = "behavior"` or `signal = "outcome"`.
Intent-only evidence does not satisfy this invariant (I5).

**G-2-5 — Intent alone is insufficient**
No variable update, trust increment, or selection write may result solely from a
declared intent record. An intent record registers a prior only.

**G-2-6 — No silent overwrite**
If a `selected_for` PCR already exists for the tuple
(`providerId`, `capabilityId`, `missionId`, `gapId`), the write must either:

a) fail with `CONFLICTING_SELECTION`, or
b) succeed only when an authorized actor explicitly sets `replace: true`, which
   produces a new audit event recording the previous state.

Silently overwriting an existing `selected_for` relation is rejected.

---

## §5 Actor Model

| Role | Can propose (`candidate`) | Can approve (`selected_for`) | Notes |
|---|---|---|---|
| Mission Owner | Yes | Yes | The actor who created the Mission |
| Value Office Governor | No | Yes (or veto) | May block any selection that violates a Value constraint; veto overrides consensus |
| Expert | Yes | No | Domain authority; proposes, does not finalize |
| Auditor | No | No | Read-only; verifies post-selection |
| AI Agent | Yes | No | May recommend candidates and attach evidence; may not write `selected_for` directly |
| Observer | No | No | Read-only |

**Agent autonomy constraint:** An AI Agent may produce a `candidate` output and attach
supporting evidence, but the final write of `selected_for` requires a human actor with
Mission Owner or Governor role.

**Human approval requirement:** Every `selected_for` write must carry a non-null
`humanActorId` in its audit event. A selection approved solely by an agent is rejected.

**Governor veto:** A Value Office Governor block rejects a `selected_for` write
regardless of consensus or evidence score. This implements Invariant I2: Value constraints
are exclusion filters, not items in a utility sum.

---

## §6 Audit Trail

Every Matching Engine action that produces a write or a rejection must generate an
AuditEvent. AuditEvents are append-only and may not be modified after creation.

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Yes | Unique event identifier |
| actionType | enum | Yes | `"proposed"` \| `"approved"` \| `"rejected"` \| `"overwritten"` |
| actorId | string | Yes | Actor who triggered this action |
| humanActorId | string | Yes (for `approved`, `overwritten`) | Human actor who confirmed the write |
| timestamp | ISO 8601 | Yes | Wall-clock time at write |
| previousState | PCR \| null | Yes | Relation state before this action; null if new |
| newState | PCR \| null | Yes | Relation state after this action; null if rejected |
| evidenceIds | string[] | Yes | All evidence records considered |
| reason | string | Yes | Human-readable rationale |
| sourceTool | string | Yes | Identifier of the system or agent that initiated the action |
| missionId | string | Yes | Mission context |
| gapId | string | Yes | Gap context |

---

## §7 Failure and Rejection Rules

A hard rejection produces an AuditEvent with `actionType: "rejected"` and a specific
reason code. Processing stops; no partial writes occur.

| Failure condition | Reason code |
|---|---|
| Provider has no `can_deliver` PCR for this Capability | `NO_CAN_DELIVER_RELATION` |
| No Behavior or Outcome evidence for this provider | `INSUFFICIENT_EVIDENCE` |
| Actor does not hold the required role for this action | `UNAUTHORIZED_ACTOR` |
| `selected_for` already exists for this tuple and `replace` not set | `CONFLICTING_SELECTION` |
| Version token does not match current relation state | `STALE_RELATION` |
| Provider state is marked unavailable | `PROVIDER_UNAVAILABLE` |
| Value Office consent required but not obtained | `MISSING_CONSENT` |
| `missionId` is null on a `selected_for` write | `MISSING_MISSION_CONTEXT` |
| `gapId` is null when Gap is in input context | `MISSING_GAP_CONTEXT` |
| A required input field is missing or invalid (§2) | `INVALID_INPUT` |

---

## §8 Idempotency and Concurrency

**Idempotency:** A duplicate request for the same
(`providerId`, `capabilityId`, `missionId`, `gapId`, `relationType`) with
identical evidence and actor returns the existing state without creating a new audit event.
A request that differs in any field is not idempotent and follows the normal write rules.

**Version check:** Every write request for an existing relation must include a version
token (ETag or `updatedAt`). If the token does not match the persisted state, the
request is rejected with `STALE_RELATION`.

**Concurrent writes:** Two concurrent requests for the same tuple are serialized at the
repository layer. The second write observes the first as an existing relation and either:

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
