/**
 * Essence · Orientation Inference Orchestrator (M0-10A)
 *
 * Stateful integration component that drives the orientation inference cycle
 * for one logical session. Owns:
 *   - cross-exchange evidence accumulation (via OrientationEvidenceAccumulator)
 *   - two-phase signal processing (accumulate all → evaluate each dimension once)
 *   - EmissionTracker: prevents duplicate proposal submission within a process lifetime
 *   - OrientationProposalContext assembly from tracker + profile active value
 *   - proposeUpdate() submission to EssenceProposalService
 *   - per-exchange Philos review trigger (PhilosReviewConsumer.consume())
 *
 * Does NOT own:
 *   - signal extraction (OrientationInferenceProvider)
 *   - proposal evaluation logic (OrientationProposalEngine, stateless)
 *   - any write to Essence other than via proposeUpdate() → Philos → commitReviewedProposal()
 *   - any read from EssenceRepository directly
 *
 * EmissionTracker state after Philos review:
 *   - accept/reject       → entry deleted (suppression lifted)
 *   - require_user_conf   → entry updated with real proposalId; reset by syncTracker()
 *                           when the user acts
 *   - defer               → entry stays with proposalId: null (suppression maintained)
 *   - Philos error        → entry stays with proposalId: null; proposal retried next exchange
 */

import type { EssenceProfile } from './schema';
import type { EssenceProposalAPI } from './api';
import type { AgentName } from './access';
import type { OrientationInferenceProvider, AccumulatorSnapshot } from './orientation-inference';
import { OrientationEvidenceAccumulator } from './orientation-accumulator';
import { OrientationProposalEngine } from './orientation-proposal-engine';
import type { OrientationDimensionKey } from './orientation';
import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';
import type { PipelineResult } from './pipeline';
import type { PhilosReviewDecision } from './api';
import type { PhilosReviewConsumer } from './philos-review-consumer';
import type {
  OrientationIntegrationContext,
  OrientationDimensionResult,
  OrientationInferenceReport,
  OrientationInferenceOrchestratorAPI,
} from './orientation-integration';

// ── Emission Tracker ───────────────────────────────────────────────────────────

interface TrackerEntry {
  /**
   * Real PendingEssenceProposal.proposalId for 'pending_user_confirmation' outcomes.
   * null for 'pending_review' outcomes (not queryable via getPendingProposals()).
   */
  proposalId: string | null;
  /** accumulatedWeight at the time of submission — drives weight-based suppression. */
  emittedWeight: number;
}

function makeTrackerKey(
  profileId: string,
  dimensionKey: OrientationDimensionKey,
  proposedValue: string,
): string {
  return JSON.stringify([profileId, dimensionKey, proposedValue]);
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export class OrientationInferenceOrchestrator implements OrientationInferenceOrchestratorAPI {
  private readonly accumulator: OrientationEvidenceAccumulator;
  private readonly engine: OrientationProposalEngine;
  private readonly tracker = new Map<string, TrackerEntry>();

  constructor(
    private readonly provider: OrientationInferenceProvider,
    private readonly proposalService: EssenceProposalAPI,
    private readonly agentName: AgentName,
    private readonly clock: Clock = systemClock,
    private readonly philos: PhilosReviewConsumer | null = null,
  ) {
    this.accumulator = new OrientationEvidenceAccumulator(clock);
    this.engine = new OrientationProposalEngine(clock);
  }

  async processExchange(
    context: OrientationIntegrationContext,
    profile: Readonly<EssenceProfile>,
  ): Promise<OrientationInferenceReport> {
    // Sync tracker: reset entries whose confirmation-tracked proposals resolved.
    await this.syncTracker(context.profileId);

    // Phase 1 — Extract all signals; accumulate; record last snapshot per dimension.
    // The provider analyzes the exchange content; the accumulator validates that each
    // signal's sourceObservationId exists in the profile before accepting it.
    const signals = await this.provider.extractSignals(
      {
        sessionId:           context.sessionId,
        profileId:           context.profileId,
        sourceObservationId: context.sessionObservationId,
        exchange:            context.exchange,
      },
      profile,
    );

    const latestSnapshots = new Map<OrientationDimensionKey, AccumulatorSnapshot>();
    for (const signal of signals) {
      const snapshot = this.accumulator.accumulate(signal, profile as EssenceProfile);
      if (snapshot) {
        // Last snapshot per dimension wins — this is the most up-to-date evidence state.
        latestSnapshots.set(snapshot.dimensionKey as OrientationDimensionKey, snapshot);
      }
    }

    // Phase 2 — Evaluate each affected dimension exactly once.
    // Invariant: results has at most one entry per OrientationDimensionKey.
    const results: OrientationDimensionResult[] = [];
    for (const [dimensionKey, snapshot] of latestSnapshots) {
      const result = await this.evaluateDimension(
        dimensionKey,
        snapshot,
        context.profileId,
        profile as EssenceProfile,
      );
      results.push(result);
    }

    return {
      profileId:            context.profileId,
      sessionId:            context.sessionId,
      sessionObservationId: context.sessionObservationId,
      results,
      processedAt: new Date(this.clock.now()).toISOString(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Reset tracker entries for proposals that have left the pending queue.
   * Only resets entries with a real proposalId (pending_user_confirmation).
   * Entries with proposalId === null (pending_review) are not queryable and persist.
   */
  private async syncTracker(profileId: string): Promise<void> {
    const pending = await this.proposalService.getPendingProposals(profileId, this.agentName);
    const pendingIds = new Set(pending.map(p => p.proposalId));

    for (const [key, entry] of this.tracker) {
      if (entry.proposalId !== null && !pendingIds.has(entry.proposalId)) {
        this.tracker.delete(key);
      }
    }
  }

  private async evaluateDimension(
    dimensionKey: OrientationDimensionKey,
    snapshot: AccumulatorSnapshot,
    profileId: string,
    profile: EssenceProfile,
  ): Promise<OrientationDimensionResult> {
    const winner = snapshot.candidates[0];
    if (!winner) {
      return { dimensionKey, outcome: 'suppressed', reason: 'no_candidates' };
    }

    const key = makeTrackerKey(profileId, dimensionKey, winner.candidateValue);
    const trackerEntry = this.tracker.get(key) ?? null;

    const decision = this.engine.evaluate(snapshot, {
      activeValue:               this.getActiveValue(profile, dimensionKey),
      pendingEquivalentProposal: trackerEntry !== null,
      lastEmittedWeight:         trackerEntry?.emittedWeight ?? null,
    });

    if (!decision.shouldPropose) {
      return { dimensionKey, outcome: 'suppressed', reason: decision.reason };
    }

    const pipelineResult = await this.proposalService.proposeUpdate(
      profileId,
      {
        nodeId:                   dimensionKey,
        proposedContent:          decision.candidate.proposedValue,
        evidenceObservationIds:   decision.candidate.evidenceObservationIds,
        proposedBy:               this.agentName,
        proposedAt:               decision.candidate.proposedAt,
        rationale:                decision.candidate.rationale,
        accumulatedConfidence:    decision.candidate.accumulatedConfidence,
      },
      null,
    );

    // For non-pending_review outcomes, update tracker immediately.
    if (pipelineResult.status !== 'pending_review') {
      this.updateTracker(key, pipelineResult, winner.accumulatedWeight);
    } else {
      // pending_review: set tracker entry with null proposalId (suppresses re-proposal).
      // Then trigger Philos synchronously — failure must not propagate.
      this.tracker.set(key, { proposalId: null, emittedWeight: winner.accumulatedWeight });
      await this.runPhilosReview(key, pipelineResult.proposalId, profileId, winner.accumulatedWeight);
    }

    return {
      dimensionKey,
      outcome: 'proposal_submitted',
      candidate: decision.candidate,
      pipelineStatus: pipelineResult.status,
    };
  }

  /**
   * Invoke Philos review for a pending_review proposal.
   * Updates the tracker based on the Philos decision.
   * Any exception is caught, logged, and swallowed — the proposal is left
   * in pending_review for retry on the next exchange.
   */
  private async runPhilosReview(
    trackerKey: string,
    proposalId: string,
    profileId: string,
    emittedWeight: number,
  ): Promise<void> {
    if (!this.philos) return;
    try {
      const decision = await this.philos.consume(profileId, proposalId);
      this.updateTrackerAfterPhilos(trackerKey, proposalId, decision, emittedWeight);
    } catch (err) {
      // Non-fatal: proposal stays in pending_review. Will be retried on next exchange.
      console.warn(
        `[OrientationOrchestrator] Philos review failed for proposal ${proposalId}; ` +
        'leaving in pending_review for retry.',
        err,
      );
    }
  }

  /**
   * Update the tracker after a Philos review decision.
   *   accept/reject            → delete entry (suppression lifted; new evidence can propose)
   *   require_user_confirmation → update with real proposalId (syncTracker will reset on resolution)
   *   defer                    → leave entry as-is (proposalId: null, suppression maintained)
   */
  private updateTrackerAfterPhilos(
    key: string,
    proposalId: string,
    decision: PhilosReviewDecision,
    emittedWeight: number,
  ): void {
    switch (decision.decision) {
      case 'accept':
      case 'reject':
        this.tracker.delete(key);
        break;
      case 'require_user_confirmation':
        this.tracker.set(key, { proposalId, emittedWeight });
        break;
      case 'defer':
        // Tracker stays with proposalId: null — suppression maintained for this dimension.
        break;
    }
  }

  /** Return the content of the active (non-archived) interpretation for this dimension, if any. */
  private getActiveValue(profile: EssenceProfile, dimensionKey: OrientationDimensionKey): string | undefined {
    const interpretations = profile.expression[dimensionKey] ?? [];
    const active = interpretations.find(i => !i.archivedAt);
    return active?.content;
  }

  private updateTracker(key: string, result: PipelineResult, emittedWeight: number): void {
    switch (result.status) {
      case 'pending_review':
        // Not queryable via getPendingProposals() — track with null proposalId.
        this.tracker.set(key, { proposalId: null, emittedWeight });
        break;

      case 'pending_user_confirmation':
        // Real proposalId (equals confirmationToken in current implementation).
        // Will be reset by syncTracker() when the proposal leaves the pending queue.
        this.tracker.set(key, { proposalId: result.confirmationToken, emittedWeight });
        break;

      case 'accepted':
      case 'rejected':
      case 'blocked_by_conflict':
        // Proposal resolved — lift suppression so evidence can drive a new proposal.
        this.tracker.delete(key);
        break;

      default:
        // 'unsupported_external_evidence': caller passed null EvidencePackage (no-op here).
        break;
    }
  }
}
