# M0-10 — Write Completion & State Integrity

**Status:** Design spec — M0-10A locked (§3.1 owner decision confirmed). M0-10B locked. M0-10C deferred.  
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

### 3.1 `pending_review` owner — CONFIRMED (2026-07-27)

**Decision: Option 2 — Philos as background reviewer.**

Philos is the owner of the `pending_review` queue. His responsibility and its limits are locked:

| Philos IS | Philos IS NOT |
|-----------|---------------|
| The executor of a deterministic review policy | A new inference engine |
| The owner of every `pending_review` transition | Capable of generating new evidence |
| The author of an explainable, auditable decision | Capable of re-running orientation inference |
| Working only on: existing ProposalDecision, Evidence, Policy | A replacement for the semantic pipeline |

Every Philos decision:
- Is derived solely from fields already present on the `PendingEssenceProposal` record (evidence IDs, accumulated confidence, node ID, proposed content).
- Records `{ decision, reason, reviewer='philos', reviewedAt, policyVersion }`.
- Is idempotent (see §3.6).

---

### 3.2 Proposal state machine (locked)

```
                proposeUpdate()
                    │
                    ▼ pipeline result
         ┌──────────┴──────────────┐
         ↓                         ↓
  pending_review             pending_user_confirmation
  (Philos queue)             (user-visible; stored in proposalRecords)
         │                         │
  Philos Review Policy        user action
  (§3.5 — deterministic)     (confirmUpdate / rejectUpdate)
         │                         │
    ┌────┼────────┬────┐            ├──► accepted ──────── terminal
    ↓    ↓        ↓    ↓            │    (Interpretation written)
 accept reject  req_  defer         └──► rejected ──────── terminal
         │      user   │
         │      conf   │ (non-terminal; TTL still applies)
         ▼      │      └──► pending_review (deferCount++)
      rejected  ▼
      terminal  pending_user_confirmation
                │
                ├──► accepted ──────── terminal
                │    (Interpretation written)
                └──► rejected ──────── terminal

    ─────────────────────────────────────────────────────
    expired (expiresAt < now, lazy-checked)  ─── terminal
    ─────────────────────────────────────────────────────
```

**Terminal states (exactly four):** `accepted | rejected | expired | (user_rejected_after_confirmation)`.  
For the `ProposalStatus` type, these map to: `'confirmed' | 'rejected' | 'expired'`.  
`pending_user_confirmation` is non-terminal from the system's perspective; it is the terminal outcome of Philos's involvement — the user action phase is independent.

**`ProposalStatus` extension** (breaking change to `api.ts`):

```typescript
// Before:
export type ProposalStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';

// After:
export type ProposalStatus =
  | 'pending_review'              // in Philos queue; Philos-internal
  | 'pending_user_confirmation'   // user-visible; awaiting user action
  | 'confirmed'                   // Interpretation written
  | 'rejected'                    // rejected (by Philos or user)
  | 'expired';                    // expiresAt elapsed; terminal
```

Old `'pending'` value is removed. The two concrete pending states make the queue boundaries explicit and unambiguous.

**TTL guarantee:** `defer` does NOT extend `expiresAt`. A deferred proposal expires on its original TTL. Philos must not defer a proposal indefinitely — if conditions for `accept`, `reject`, or `require_user_confirmation` are not met and the proposal nears expiry, the policy must produce a definitive decision before `expiresAt`.

---

### 3.3 `PendingEssenceProposal` extensions (fixes G5)

Two new fields are required. Both are optional on the existing type (backward-compatible read; non-optional for new `pending_review` records):

```typescript
export interface PendingEssenceProposal {
  // ... existing fields unchanged ...

  /**
   * Accumulated confidence at the time of proposal creation.
   * Populated for pending_review proposals from orientation inference.
   * Used by Philos Review Policy (§3.5). null for other proposal types.
   */
  accumulatedConfidence: ConfidenceLevel | null;

  /**
   * Append-only audit log of every Philos review decision on this proposal.
   * Empty for proposals that never entered pending_review.
   * Each entry is immutable once appended.
   */
  reviewDecisions: PhilosReviewDecision[];
}
```

The `reviewDecisions` array provides the full Philos audit trail per proposal. It is the source of truth for `why` a proposal transitioned — not an external log.

---

### 3.4 `PhilosReviewDecision` type (new)

```typescript
/**
 * A single decision made by the Philos Review Policy on a pending_review proposal.
 * Appended to PendingEssenceProposal.reviewDecisions; never mutated after append.
 *
 * Fields:
 *   decision     — the policy outcome for this review pass
 *   reason       — human-readable explanation, derivable from the policy rule that fired
 *   reviewer     — always 'philos'; no other agent may create PhilosReviewDecision records
 *   reviewedAt   — ISO 8601 timestamp of the policy evaluation
 *   policyVersion — the version string of the Philos Review Policy that produced this decision
 */
export interface PhilosReviewDecision {
  readonly decision: 'accept' | 'reject' | 'require_user_confirmation' | 'defer';
  readonly reason: string;
  readonly reviewer: 'philos';
  readonly reviewedAt: string;      // ISO 8601
  readonly policyVersion: string;   // e.g. '1.0'
}
```

`PhilosReviewDecision` is defined in `api.ts`. It is distinct from `PipelineStageSummary` — the pipeline evaluated the proposal at creation time; the review decision evaluates whether to act on it.

---

### 3.5 Philos Review Policy v1.0 (locked)

The policy is a pure, deterministic function of the fields present on `PendingEssenceProposal`. It receives no new evidence, no new signals, no profile reads beyond what is already encoded in the proposal record.

**Policy version:** `'1.0'`  
**Applies to:** proposals with `status: 'pending_review'` and orientation node IDs only.

**Rules (evaluated in order; first match fires):**

| Priority | Condition | Decision | Reason string |
|----------|-----------|----------|---------------|
| 0 | `expiresAt < now` | `expire` (not a policy decision; handled before policy runs) | — |
| 1 | `accumulatedConfidence === null` | `reject` | `'no_confidence_record'` |
| 2 | `accumulatedConfidence === 'speculative'` | `reject` | `'speculative_confidence'` |
| 3 | `accumulatedConfidence === 'low'` | `require_user_confirmation` | `'low_confidence_requires_user'` |
| 4 | `accumulatedConfidence === 'medium'` | `accept` | `'medium_confidence_auto_accepted'` |
| 5 | `accumulatedConfidence === 'high'` | `accept` | `'high_confidence_auto_accepted'` |
| 6 | `accumulatedConfidence === 'verified'` | `accept` | `'verified_confidence_auto_accepted'` |
| 7 | (unreachable with current enum) | `defer` | `'policy_fallback_defer'` |

**Effect of each decision:**

- **`accept`** — Philos commits the already-pipeline-approved candidate directly. No pipeline re-run. The proposal's `proposedContent` and `evidenceObservationIds` are used to build and persist the `Interpretation` via `commitReviewedProposal()` (§3.7). Provenance: `source='agent_inference'`, `confidence=accumulatedConfidence`, `createdBy='philos'` (Philos as the committing actor, not the original proposing agent). `status` → `'confirmed'`.

- **`reject`** — proposal `status` → `'rejected'`. No Interpretation written. `EmissionTracker` entry deleted so a future, better-evidenced proposal can be submitted.

- **`require_user_confirmation`** — proposal `status` → `'pending_user_confirmation'`. The user sees this proposal via the standard confirmation flow. `EmissionTracker` entry updated with the real `proposalId` so `syncTracker()` can detect when the user acts.

- **`defer`** — proposal `status` stays `'pending_review'`. `deferCount` incremented (tracked on the record). A `PhilosReviewDecision` entry is appended with `decision='defer'` and reason. The original `expiresAt` is NOT extended.

**Policy upgrade:** when the policy version changes, the `policyVersion` field on all new `PhilosReviewDecision` records changes. Old decisions on existing proposals retain their original `policyVersion`. No backfill of existing decisions is required.

---

### 3.6 Idempotency invariant (locked)

Philos's consumer (`PhilosReviewConsumer.consume()`) MUST be idempotent:

> If `consume(proposalId)` is called when the proposal's most recent `reviewDecision.decision` is not `'defer'`, the method MUST return the existing decision without creating a new write, new `PhilosReviewDecision`, or new `EssenceEvolutionEntry`.

Implementation:
1. `consume()` reads `proposal.reviewDecisions.at(-1)`.
2. If the last decision is non-`'defer'`, or `status` is already `'confirmed' | 'rejected' | 'expired'`, return early with the last decision (no-op).
3. Otherwise, run the policy and append the new `PhilosReviewDecision`.

Consequence: processing the same `pending_review` proposal twice produces at most one `EssenceEvolutionEntry` and one `Interpretation`.

---

### 3.7 `PhilosReviewConsumer` API and `commitReviewedProposal()`

**New service class** `PhilosReviewConsumer` (separate from `EssenceProposalService`; reads from the same `proposalRecords` Map via `EssenceProposalAPI`):

```typescript
/**
 * Owner of the pending_review queue. Applies Philos Review Policy to each
 * queued proposal and executes the resulting decision.
 *
 * Stateless between calls — all state lives in proposalRecords.
 * Idempotent: see §3.6.
 */
export class PhilosReviewConsumer {
  constructor(
    private readonly proposals: EssenceProposalAPI,
    private readonly repo: EssenceRepository,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
    private readonly policyVersion: string = '1.0',
  ) {}

  /**
   * Process all pending_review proposals for a profile.
   * Returns one PhilosReviewDecision per proposal processed (including no-ops).
   */
  async consumeProfile(profileId: string): Promise<PhilosReviewDecision[]>;

  /**
   * Process a single pending_review proposal.
   * Idempotent: returns the existing last decision if the proposal is not in defer state.
   */
  async consume(profileId: string, proposalId: string): Promise<PhilosReviewDecision>;
}
```

**`commitReviewedProposal()`** — new private method on `EssenceProposalService`:

```typescript
/**
 * Commit a proposal that Philos Review Policy accepted.
 * Builds the Interpretation from the stored candidate, calls writeInterpretation(),
 * and sets proposal.status = 'confirmed'.
 *
 * Does NOT re-run the pipeline. The proposal already passed the pipeline at creation.
 * Provenance: source='agent_inference', createdBy='philos', confidence=accumulatedConfidence.
 *
 * @throws if proposal status is not 'pending_review', or profile not found.
 */
private async commitReviewedProposal(
  proposal: PendingEssenceProposal,
): Promise<Interpretation>;
```

This avoids re-running the 8-stage pipeline (already ran at proposal creation) while still calling `writeInterpretation()` so the `EssenceEvolutionEntry` and `archivedAt` mechanics are reused.

---

### 3.8 M0-10A deliverables

| # | Deliverable | File(s) |
|---|-------------|---------|
| A1 | `ProposalStatus` expanded; `accumulatedConfidence` + `reviewDecisions` fields added to `PendingEssenceProposal` | `api.ts` |
| A2 | `PhilosReviewDecision` type defined | `api.ts` |
| A3 | Store `pending_review` proposals in `proposalRecords` with `accumulatedConfidence` populated from the `OrientationProposalCandidate` | `proposal-service.ts` |
| A4 | `PhilosReviewConsumer` class with `consume()` + `consumeProfile()` | `philos-review-consumer.ts` (new file) |
| A5 | `commitReviewedProposal()` on `EssenceProposalService` | `proposal-service.ts` |
| A6 | `getPendingProposals()` visibility: `pending_review` visible to Philos only; `pending_user_confirmation` visible to proposing agent + Philos | `proposal-service.ts` |
| A7 | `EmissionTracker.syncTracker()` handles `pending_review` status correctly; resets on `reject`; updates proposalId on `require_user_confirmation` | `orientation-orchestrator.ts` |
| A8 | Unit tests: full state machine round-trip for each Philos decision | `__tests__/philos-review-consumer.test.ts` (new) |
| A9 | Unit tests: idempotency invariant — double consume produces no duplicate writes | `__tests__/philos-review-consumer.test.ts` |
| A10 | Integration test: Merlin inference → accumulate → propose → Philos accept → Interpretation in profile | `__tests__/orientation-integration.test.ts` |

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

## 8. Open questions (resolved)

| # | Question | Stakes | Status |
|---|----------|--------|--------|
| Q1 | Confirm §3.1 decision: Option 2 (Philos as reviewer)? | Blocks all of M0-10A | ✅ Confirmed 2026-07-27 |
| Q2 | When does Philos run the review — on every `processExchange()` call, on a schedule, or triggered by the user session ending? | Determines trigger mechanism for `PhilosReviewConsumer.consumeProfile()` | ✅ Resolved 2026-07-27: per-exchange |
| Q3 | Max `deferCount` before Philos must produce a definitive decision? | Bounds proposal lifetime in `pending_review`; prevents TTL as the only termination mechanism | ✅ Resolved 2026-07-27: `MAX_DEFER_COUNT = 1` |
| Q4 | Should `pending_review` records be visible to Philos only, or also surfaced to the user in a "proposed but unreviewed" state? | Determines `getPendingProposals()` visibility contract | ✅ Resolved: Philos-internal only. Users see `pending_user_confirmation` only. (§3.8 A6) |

### Q2 detail — per-exchange trigger

Philos runs immediately after `pending_review` is persisted, in the same execution flow but as a distinct step. The execution sequence is:

```
inference → accumulation → proposal → pending_review persisted → PhilosReviewConsumer.consume(proposalId) → terminal state / pending_user_confirmation
```

**Failure handling:** if Philos throws after `pending_review` is persisted, the error must NOT propagate as a 500. Log a diagnostic warning and leave the proposal in `pending_review` for retry on the next exchange. The observation and proposal are already durably committed.

### Q3 detail — maxDeferCount = 1

`MAX_DEFER_COUNT = 1`. Invariant: if policy would fire `defer` and `deferCount >= MAX_DEFER_COUNT`, override with `reject(reason='review_policy_unresolved')`.

- First consume: `deferCount = 0` → policy may fire `defer` → `deferCount` incremented to 1.
- Second consume: `deferCount = 1 >= MAX_DEFER_COUNT` → reject immediately, no policy run.

`defer` never extends `expiresAt`. Idempotency check must verify proposal status AND last `reviewDecision.decision` (not just whether `reviewDecisions` is non-empty).
