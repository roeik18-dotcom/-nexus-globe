# M0-10 — Write Completion & State Integrity

**Status:** Design spec — M0-10A locked pending owner decision (§3.1). M0-10B locked. M0-10C deferred.  
**Scope:** `pending_review` lifecycle, proposal state machine, audit chain, repository durability boundary  
**Invariants inherited from:** M0-8C (write-before-inference), M0-9B (provenance identity)  
**Depends on:** M0-9C (behavioral validation and CI gates locked)

---

## 1. Purpose

M0-10 makes the orientation write path complete. As of M0-9C, the system can extract orientation signals, accumulate evidence, and generate proposals — but agent-derived proposals never reach an `Interpretation`. The path ends at `pending_review → ∅`. No Lifecycle feature (decay, versioning, recalculation) is meaningful until a state transition that writes an `Interpretation` actually exists and is auditable end-to-end.

This spec is intentionally limited. It does not introduce decay, expiry, recency weighting, or accumulator persistence. Those belong in M0-10C after the write path and audit chain are provably stable.

---

## 2. Current Write Path (as-built)

The complete data path from exchange to profile state, as observed in the codebase at the time of this spec.

```
Exchange (userMessage + assistantResponse)
  ↓ observe/route.ts
  │ input:   HTTP body { sessionId, userMessage, assistantResponse }
  │ output:  Observation { id, source='agent_inference', recordedBy='merlin',
  │            content=userMessage, observedAt, evidenceIds=[], sessionId }
  │ owner:   observe/route.ts
  │ scope:   process-scoped singleton (InMemoryEssenceRepository)
  │ write:   appendObservation() — append-only, immutable
  │ failure: 400 before write; write precedes inference (M0-8C invariant)
  ↓
Provider signals
  │ input:   OrientationInferenceInput { sessionId, profileId, sourceObservationId, exchange }
  │ output:  OrientationSignal[] { dimensionKey, candidateValue, signalWeight ∈ (0,1],
  │            sourceObservationId, inferredBy, inferredAt }
  │ owner:   OrientationInferenceProvider (Rule/LLM/Composite)
  │ scope:   transient — lives only inside processExchange()
  │ write:   none
  │ failure: exception propagates to route → 500 (observation already committed)
  ↓
Accumulator
  │ input:   OrientationSignal, EssenceProfile (for obsId validation)
  │ output:  AccumulatorSnapshot | null
  │            { profileId, dimensionKey,
  │              candidates: DimensionEvidenceState[] sorted desc,
  │              snapshotAt }
  │ owner:   OrientationEvidenceAccumulator (instantiated in orchestrator constructor)
  │ scope:   PROCESS-SCOPED, NOT session-scoped — survives across sessions;
  │            resets on process restart
  │ store:   Map<profileId, Map<dimensionKey, Map<candidateValue, InternalEvidenceState>>>
  │ write:   additive only; dedup by sourceObservationId; never decrements
  │ emit:    snapshot only when winner.contributingObsIds.size
  │            ≥ MINIMUM_CONTRIBUTING_OBSERVATIONS (2)
  │ failure: silent discard on invalid obsId / dimension / value / weight / duplicate
  ↓
Proposal engine
  │ input:   AccumulatorSnapshot, OrientationProposalContext { activeValue,
  │            pendingEquivalentProposal, lastEmittedWeight }
  │ output:  OrientationProposalDecision { shouldPropose, reason, candidate? }
  │ owner:   OrientationProposalEngine (stateless, pure)
  │ scope:   none
  │ suppression checks (first match wins):
  │   1. no_candidates
  │   2. below_minimum_evidence  (contributingObsIds.size < MINIMUM_CONTRIBUTING_OBSERVATIONS)
  │   3. below_confidence_threshold  (winner.confidence === 'speculative')
  │   4. same_as_active_value
  │   5. weight_unchanged_while_pending  (equivalent pending + weight not increased)
  │   6. equivalent_pending  (equivalent pending, weight increased)
  ↓
proposeUpdate()
  │ input:   ProposedUpdate { nodeId, proposedContent, evidenceObservationIds,
  │            proposedBy='merlin', rationale }
  │          evidence: null  (EvidencePackage always null from orchestrator)
  │ output:  PipelineResult
  │ writes:  (1) backing Observation (unconditional, before pipeline runs)
  │          (2) Conflict records if blocked_by_conflict
  │          (3) proposalRecords Map entry ONLY for pending_user_confirmation
  │ failure: structuredReject() returned; backing Observation already committed
  ↓
PipelineRunner — 8-stage pure computation
  │ Stage 1  validate       nodeId, content, valid orientation value, agent access
  │ Stage 2  classify       (pass-through in Phase 1)
  │ Stage 3  normalize      redundancy check vs active interpretations
  │ Stage 4  evaluate_evidence  evidenceStatus = 'referenced' | 'unavailable'
  │ Stage 5  detect_conflicts   orientation: type='preference_shift', auto_resolvable
  │ Stage 6  write policy   agent + evidenceStatus='referenced'
  │            → queue_for_review → pending_review  (the normal orientation path)
  │ Stage 7  create_proposal   confirmationToken, expiresAt = now + 24 h
  │ Stage 8  commit         pending_review: no Interpretation written
  │ owner:   PipelineRunner (stateless, no I/O)
  ↓
pending_review → ∅  (MISSING — see §2.1)
```

### 2.1 Gap inventory

| ID | Description | Severity |
|----|-------------|----------|
| G1 | `pending_review` has no consumer — orientation Interpretations never written from agent inference | P0 |
| G2 | `EssenceEvolutionEntry.previousInterpretationId` always `null` — audit chain broken | P0 |
| G3 | `Interpretation.expiresAt` always `null`; no enforcement | P2 (deferred M0-10C) |
| G4 | Accumulator is process-scoped; resets on restart | P2 (deferred M0-10C) |
| G5 | `pending_review` proposals not stored in `proposalRecords` — no way to query or consume | P0 |
| G6 | `Conflict.resolvedAt` / `resolution` never populated; auto-resolvable conflicts stay open | P1 |
| G7 | Session registry grows without bound — no TTL eviction | P2 (deferred M0-10C) |
| G8 | Repository durability not explicitly decided — see §5 | P1 |

P0 = blocks end-to-end write path. P1 = blocks audit integrity. P2 = deferred to M0-10C.

---

## 3. M0-10A — Write-path completion

**Goal:** every valid orientation proposal reaches an unambiguous terminal state.

### 3.1 Architectural decision: `pending_review` owner

This decision must be made before any M0-10A implementation begins.

#### Three legitimate options

**Option 1 — Human reviewer**  
Change orientation write policy (`requiresUserConfirmation = true` in the ontology) so proposals skip `queue_for_review` and go directly to `pending_user_confirmation`. The existing `confirmUpdate()` consumer handles the rest.  
- Pros: no new consumer code; reuses the working `pending_user_confirmation` path; preserves Phase 1A invariant.  
- Cons: every orientation inference requires explicit user confirmation — high friction; passive learning is blocked; user must manually confirm inferences Merlin derives automatically.

**Option 2 — Background reviewer (Philos)**  
Keep `queue_for_review` for orientation. Add a `promotePendingReview()` API on `EssenceProposalService`. Philos (or a review pipeline triggered by Philos) evaluates queued proposals and promotes qualifying ones to `pending_user_confirmation` or archives disqualified ones. The promotion calls `confirmUpdate()` with a `UserAuthorizedActionContext` backed by Philos, not the original agent.  
- Pros: clean separation of concerns (Merlin infers, Philos reviews, user confirms or profile auto-updates); existing `confirmUpdate()` consumer reused for the final step; Phase 1A invariant preserved for user-facing writes; opens natural path to automating Philos's policy in M0-10C.  
- Cons: requires new API surface and a trigger mechanism for when Philos runs the review.

**Option 3 — Policy engine (confidence-threshold auto-promotion)**  
When an agent proposal's accumulated confidence meets a defined threshold (e.g., `accumulatedWeight ≥ 3.0`, `ConfidenceLevel ≥ 'medium'`) and no blocking conflicts exist, a privileged system actor promotes it directly to `accepted` without user confirmation. Requires a new actor type (e.g., `'policy_engine'`) or relaxation of the Phase 1A invariant for orientation nodes.  
- Pros: lowest user friction; enables fully passive learning.  
- Cons: relaxes Phase 1A invariant; introduces policy risk (automated writes to the human model without any human in the loop); harder to audit.

#### Decision: Option 2 (Philos as background reviewer) — **REQUIRES EXPLICIT CONFIRMATION**

**Recommendation:** Option 2. Rationale:

- Phase 1A invariant ("no agent proposal reaches `accepted` without `UserAuthorizedActionContext`") is preserved. The `promotePendingReview()` call carries a Philos-issued context, not an agent context.
- `confirmUpdate()` is already tested and functional. Option 2 adds only the promotion step, not a new write path.
- Philos's promotion policy can start simple (promote when `accumulatedConfidence ≥ 'low'`, no blocking conflicts) and be tightened or automated in M0-10C without changing the write path architecture.
- Option 1 blocks passive learning permanently without a phase boundary. Option 3 requires a policy decision about automated writes to the human model — that decision is not ready.

**This decision must be confirmed before implementation.** The remainder of §3 assumes Option 2.

---

### 3.2 Proposal state machine (locked once §3.1 is confirmed)

```
                    ┌─────────────────────────────┐
                    │         PROPOSAL             │
                    │  (created by proposeUpdate)  │
                    └──────────────┬──────────────┘
                                   │ pipeline result
                ┌──────────────────┼───────────────────┐
                ↓                  ↓                   ↓
         pending_review   pending_user_confirmation  rejected ──── terminal
         (G5: must be      (stored in proposalRecords;  (structuredReject or
          stored — see §3.3)  auto-expires after 24 h)  blocked_by_conflict)
                │                  │
      Philos review (NEW)    user action
                │            (confirmUpdate / rejectUpdate)
                ├── promote ──► pending_user_confirmation
                │                  │
                ├── archive ──►  rejected ──────────────── terminal
                │
                ↓ time passes (lazy check on access)
             expired ────────────────────────────────── terminal

        pending_user_confirmation
                ↓ user confirms
             accepted ──────────────────────────────── terminal
             (Interpretation written, evolution entry appended)
                ↓ user rejects
             rejected ──────────────────────────────── terminal
```

**Terminal states:** `accepted`, `rejected`, `expired`.  
**Non-terminal:** `pending_review`, `pending_user_confirmation`.  

No proposal transitions from `expired` → anything. Expiry is terminal even if the user later acts; a new inference cycle must produce a fresh proposal.

---

### 3.3 `pending_review` storage (fixes G5)

`proposeUpdate()` currently stores a record in `proposalRecords` only for `pending_user_confirmation`. For M0-10A, it must also store a record for `pending_review`.

The record shape is the same `PendingEssenceProposal` type, with `status: 'pending_review'`. The distinction from `pending_user_confirmation`:
- `confirmationToken` is present but not surfaced to the user — it is an internal handle for the Philos promotion step.
- `proposalId` is the same value as `confirmationToken` (no change to the existing type).

`getPendingProposals()` must return `pending_review` records to Philos (currently filtered to `status === 'pending'` which already includes them once stored). It must **not** return `pending_review` records to the requesting user via the standard confirmation flow — those are Philos-internal.

`EmissionTracker.syncTracker()` must treat confirmed `proposalId` values correctly for both statuses. After promotion (when a `pending_review` record is promoted to `pending_user_confirmation`), the tracker entry must be updated with the new status so future signal accumulation is not incorrectly suppressed.

---

### 3.4 `promotePendingReview()` API

New method on `EssenceProposalService` (and added to `EssenceProposalAPI`):

```typescript
/**
 * Promote a pending_review proposal to pending_user_confirmation.
 * Only callable by Philos (enforced via UserAuthorizedActionContext).
 *
 * The promotion does NOT write an Interpretation. It moves the proposal
 * to pending_user_confirmation, which the user then confirms or rejects.
 *
 * @returns the confirmationToken the user needs to call confirmUpdate()
 * @throws if the proposal does not exist, is not in pending_review status,
 *         or the caller is not Philos
 */
promotePendingReview(
  profileId: string,
  proposalId: string,
  context: UserAuthorizedActionContext,
): Promise<{ confirmationToken: string; expiresAt: string }>;
```

The implementation transitions the `proposalRecords` entry from `status: 'pending_review'` to `status: 'pending'` (reusing the existing pending_user_confirmation path), preserving the existing `expiresAt` or resetting it to `now + 24h`.

---

### 3.5 M0-10A deliverables

| # | Deliverable | File(s) |
|---|-------------|---------|
| A1 | Store `pending_review` proposals in `proposalRecords` | `proposal-service.ts` |
| A2 | `promotePendingReview()` method + interface entry | `proposal-service.ts`, `api.ts` |
| A3 | `EmissionTracker` correctly handles promoted proposals | `orientation-orchestrator.ts` |
| A4 | `getPendingProposals()` visibility rules for `pending_review` vs `pending_user_confirmation` | `proposal-service.ts` |
| A5 | Unit tests: full state machine round-trip (pending_review → promotion → confirmed → Interpretation written) | `__tests__/proposal-service.test.ts` |
| A6 | Update orientation integration tests to assert a complete write path exists | `__tests__/orientation-integration.test.ts` |

---

## 4. M0-10B — Audit integrity

**Goal:** every state transition is reconstructable from the evolution log.

### 4.1 Fix: `previousInterpretationId` (fixes G2)

**Location:** `proposal-service.ts:writeInterpretation()` line 366.

**Current behavior:** `previousInterpretationId: null` always — the archived interpretation's ID is never captured.

**Required behavior:** when `writeDisposition === 'replace_single_value'`, capture the ID of each interpretation being archived before archiving it. Use the first archived interpretation's ID as `previousInterpretationId` in the evolution entry. If multiple interpretations are archived (edge case: multiple active interpretations for the same node), record all of them — the evolution entry schema supports only one `previousInterpretationId`; additional IDs must be stored in the `note` field until the schema is extended.

```typescript
// Before:
const entry: EssenceEvolutionEntry = {
  ...
  previousInterpretationId: null,
  ...
};

// After:
// Capture archived IDs before archiveInterpretation() mutates them.
const archivedIds = (layerData[interp.nodeId] ?? [])
  .filter(p => !p.archivedAt)
  .map(p => p.id);
// ... archive loop ...
const entry: EssenceEvolutionEntry = {
  ...
  previousInterpretationId: archivedIds[0] ?? null,
  note: archivedIds.length > 1
    ? `Additional archived: ${archivedIds.slice(1).join(', ')}`
    : null,
  ...
};
```

**Invariant (locked):** every `EssenceEvolutionEntry` where `writeDisposition === 'replace_single_value'` and a prior interpretation existed MUST have a non-null `previousInterpretationId`. A null value is only valid when no prior active interpretation existed for the node.

---

### 4.2 Fix: conflict resolution on auto-resolvable writes (fixes G6)

**Context:** orientation nodes produce `ConflictType = 'preference_shift'`, `severity = 'auto_resolvable'` in the pipeline. `Conflict` records are created for blocking conflicts (not for auto-resolvable ones — checked at Stage 5). However, `Conflict.resolvedAt` is never set even when the underlying interpretation is later superseded.

**Required behavior:** when `writeInterpretation()` commits a new interpretation with `replace_single_value`, any open `Conflict` record whose `existingInterpretationIds` contains an archived interpretation ID must be resolved:

```typescript
conflict.resolvedAt = now;
conflict.resolution = 'accepted_newer';
conflict.resolutionNote = `Superseded by interpretation ${newInterp.id}`;
```

This requires a `resolveConflictsForArchived(profile, archivedId, newInterpId, now)` helper called from `writeInterpretation()` after archiving.

**Scope:** only `preference_shift` conflicts (orientation nodes, auto-resolvable). `unresolved_contradiction` conflicts remain open until explicit user resolution — not touched by M0-10B.

---

### 4.3 Proposal traceability

After M0-10A, every proposal that reaches `accepted` has a traceable path:

```
Observation (exchange)
  → backing Observation (proposal backing, source='agent_inference')
    → PendingEssenceProposal record (stored in proposalRecords)
      → EssenceEvolutionEntry {
           triggeredBy, agentName, timestamp,
           previousInterpretationId (non-null if prior existed),
           newInterpretationId
         }
        → Interpretation {
             provenance.evidenceIds (contributing obsIds from accumulator),
             provenance.createdBy,
             provenance.firstObservedAt
           }
```

No new fields are required. The fix in §4.1 is the only schema change. The traceability gap is code, not schema.

---

### 4.4 M0-10B deliverables

| # | Deliverable | File(s) |
|---|-------------|---------|
| B1 | Capture archived IDs before archive loop; populate `previousInterpretationId` | `proposal-service.ts` |
| B2 | `resolveConflictsForArchived()` helper; called from `writeInterpretation()` | `proposal-service.ts` |
| B3 | Unit tests: evolution entry has non-null `previousInterpretationId` after replace | `__tests__/proposal-service.test.ts` |
| B4 | Unit tests: `preference_shift` conflicts resolved on supersession write | `__tests__/proposal-service.test.ts` |
| B5 | Integration test: full chain reconstructable from evolution log alone | `__tests__/orientation-integration.test.ts` |

---

## 5. G8 — Repository durability boundary

**Decision:** the `InMemoryEssenceRepository` is an explicit M0 limitation, not an architectural choice. The decision is recorded here so it is not confused with intent.

**What is lost on process restart:**
- All `Observation` records
- All `Interpretation` records
- All `EssenceEvolutionEntry` records
- All `Conflict` records
- Accumulator evidence (separate, also in-memory)
- `proposalRecords` (in-memory Map on `EssenceProposalService`)
- `orientation-session-registry` entries

**What this means for M0-10:**  
M0-10A and M0-10B are still meaningful within a process lifetime. The write path will be complete and auditable for the duration of a running server. Cross-restart durability is explicitly out of scope until M1.

**M1 requirement (stated here for forward planning):**  
M1 must replace `InMemoryEssenceRepository` with a durable backend. The `EssenceRepository` interface is already persistence-agnostic — a drop-in replacement is architecturally possible. The M1 spec must also address: accumulator persistence (whether evidence weights survive restart), `proposalRecords` persistence (whether pending proposals survive restart), and session registry durability.

**No code change required for G8 in M0-10.** The boundary must be documented in comments at the relevant sites — currently present on `OrientationEvidenceAccumulator` (line 66) and `server-repository.ts` — and this spec is the authoritative reference.

---

## 6. M0-10C — Lifecycle (deferred)

The following features are explicitly out of scope for M0-10. They belong in M0-10C, after M0-10A and M0-10B are complete and tested.

| Feature | Blocker for deferral |
|---------|---------------------|
| `Interpretation.expiresAt` enforcement | Requires stable write path (G1) first |
| Signal recency weighting / decay | Requires stable audit chain (G2) first |
| Accumulator persistence across restarts | Requires repository durability decision (G8) |
| Session registry TTL eviction | Low urgency; affects memory, not correctness |
| Supersede / revoke / explicit expiry API | Requires stable state machine (M0-10A) first |
| Recalculation of profile state | Requires complete audit chain (M0-10B) first |

**Invariant:** no M0-10C feature is permitted to merge before M0-10A and M0-10B are fully landed and passing CI.

---

## 7. Non-goals (entire M0-10)

- LLM provider changes or calibration threshold updates (those are M0-9C work).
- Changes to the corpus or behavioral validation pipeline.
- Accumulator algorithm changes (weight function, confidence thresholds).
- Multi-process or distributed write scenarios — in-memory repository is single-process by design through M0.
- User-facing UI for proposal review — M0-10A defines the API surface; UI is a separate milestone.
- `expiresAt` on `EssenceStateItem.ttlMs` — this is state-layer TTL, separate from orientation lifecycle.

---

## 8. Open questions (must be resolved before M0-10A implementation)

| # | Question | Stakes |
|---|----------|--------|
| Q1 | Confirm §3.1 decision: Option 2 (Philos as reviewer)? | Blocks all of M0-10A |
| Q2 | When does Philos run the review — on every `processExchange()` call, on a schedule, or triggered by the user session ending? | Determines trigger mechanism for `promotePendingReview()` |
| Q3 | What is Philos's promotion policy — any non-speculative confidence, or a higher bar? | Determines how many proposals reach the user |
| Q4 | Should `pending_review` records be visible to Philos only, or also surfaced to the user in a "proposed but unreviewed" state? | Determines `getPendingProposals()` visibility contract |
