/**
 * Essence · Philos Review Consumer (M0-10A)
 *
 * Owner of the pending_review queue. Applies the deterministic Philos Review
 * Policy (v1.0) to each queued proposal and executes the resulting decision.
 *
 * Stateless between calls — all mutable state lives in proposalRecords via
 * EssencePhilosReviewAPI. Idempotent: see §3.6 of m0-10-write-completion.md.
 *
 * Trigger: per-exchange, invoked immediately after pending_review is persisted.
 * Failure: must NOT propagate — callers log and leave the proposal for retry.
 */

import type { ConfidenceLevel } from './schema';
import type {
  EssencePhilosReviewAPI,
  EssenceTimelineRepository,
  PendingEssenceProposal,
  PhilosReviewDecision,
} from './api';
import type { Clock, IdGenerator } from './pipeline-runner';
import { systemClock, defaultIdGenerator } from './pipeline-runner';
import { TIMELINE_SCHEMA_VERSION } from './timeline';
import { noopTimelineRepository } from './in-memory-timeline-repository';

export const PHILOS_POLICY_VERSION = '1.0';
export const MAX_DEFER_COUNT = 1;

export class PhilosReviewConsumer {
  constructor(
    private readonly proposals: EssencePhilosReviewAPI,
    private readonly clock: Clock = systemClock,
    private readonly timelineRepo: EssenceTimelineRepository = noopTimelineRepository,
    private readonly idGen: IdGenerator = defaultIdGenerator,
  ) {}

  /**
   * Process all pending_review proposals for a profile.
   * Returns one PhilosReviewDecision per proposal processed (including no-ops).
   */
  async consumeProfile(profileId: string): Promise<PhilosReviewDecision[]> {
    const queue = await this.proposals.getReviewQueue(profileId);
    const decisions: PhilosReviewDecision[] = [];
    for (const proposal of queue) {
      const decision = await this.consume(profileId, proposal.proposalId);
      decisions.push(decision);
    }
    return decisions;
  }

  /**
   * Process a single pending_review proposal by ID.
   *
   * Idempotency:
   *   - If proposal is in a terminal status (confirmed/rejected/expired): return last decision.
   *   - If last reviewDecision.decision is not 'defer': return last decision (no re-process).
   *   - Otherwise: evaluate policy and apply decision.
   */
  async consume(profileId: string, proposalId: string): Promise<PhilosReviewDecision> {
    const proposal = await this.proposals.getProposalRecord(proposalId);
    if (!proposal) throw new Error(`Unknown proposalId: ${proposalId}`);
    if (proposal.profileId !== profileId) throw new Error('Profile ID mismatch');

    // Idempotency: terminal status → return last decision.
    if (
      proposal.status === 'confirmed' ||
      proposal.status === 'rejected' ||
      proposal.status === 'expired'
    ) {
      return this.lastOrFallback(proposal, 'already_terminal');
    }

    // Idempotency: last decision is not 'defer' → already processed, no re-run.
    const lastDecision = proposal.reviewDecisions.at(-1);
    if (lastDecision && lastDecision.decision !== 'defer') {
      return lastDecision;
    }

    // Expiry check (lazy, before policy runs).
    if (new Date(proposal.expiresAt).getTime() < this.clock.now()) {
      // Expire the proposal — return a synthetic terminal decision (not appended to reviewDecisions).
      (proposal as { status: string }).status = 'expired';
      return {
        decision: 'reject',
        reason: 'proposal_expired',
        reviewer: 'philos',
        reviewedAt: new Date(this.clock.now()).toISOString(),
        policyVersion: PHILOS_POLICY_VERSION,
      };
    }

    // Max-defer guard: if we've already deferred the maximum number of times,
    // override with reject on the next consume regardless of policy.
    if (proposal.deferCount >= MAX_DEFER_COUNT) {
      return this.applyAndCommit(proposal, {
        decision: 'reject',
        reason: 'review_policy_unresolved',
        reviewer: 'philos',
        reviewedAt: new Date(this.clock.now()).toISOString(),
        policyVersion: PHILOS_POLICY_VERSION,
      });
    }

    // Apply Philos Review Policy v1.0.
    const policyDecision = this.applyPolicy(proposal.accumulatedConfidence);
    return this.applyAndCommit(proposal, policyDecision);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Execute a review decision: persist it and act on the side-effects.
   */
  private async applyAndCommit(
    proposal: PendingEssenceProposal,
    decision: PhilosReviewDecision,
  ): Promise<PhilosReviewDecision> {
    const now = new Date(this.clock.now()).toISOString();
    switch (decision.decision) {
      case 'accept': {
        // Commit the Interpretation first (emits interpretation_committed), then mark confirmed.
        // review_decided fires after all effects — interpretation_committed precedes it in timeline.
        await this.proposals.commitReviewedProposal(proposal);
        await this.proposals.applyReviewDecision(proposal.proposalId, decision, 'confirmed');
        await this.timelineRepo.append({
          id: this.idGen.nextId('tevt'),
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          eventType: 'review_decided',
          occurredAt: now,
          profileId: proposal.profileId,
          nodeId: proposal.nodeId,
          proposalId: proposal.proposalId,
          interpretationId: proposal.committedInterpretationId ?? null,
          observationId: null,
          causationEventId: null,
          payload: {
            eventType: 'review_decided',
            proposalId: proposal.proposalId,
            decision: decision.decision,
            reason: decision.reason,
            reviewer: decision.reviewer,
            policyVersion: decision.policyVersion,
            newStatus: 'confirmed',
          },
        });
        break;
      }
      case 'reject': {
        await this.proposals.applyReviewDecision(proposal.proposalId, decision, 'rejected');
        const reviewEventId = this.idGen.nextId('tevt');
        await this.timelineRepo.append({
          id: reviewEventId,
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          eventType: 'review_decided',
          occurredAt: now,
          profileId: proposal.profileId,
          nodeId: proposal.nodeId,
          proposalId: proposal.proposalId,
          interpretationId: null,
          observationId: null,
          causationEventId: null,
          payload: {
            eventType: 'review_decided',
            proposalId: proposal.proposalId,
            decision: decision.decision,
            reason: decision.reason,
            reviewer: decision.reviewer,
            policyVersion: decision.policyVersion,
            newStatus: 'rejected',
          },
        });
        await this.timelineRepo.append({
          id: this.idGen.nextId('tevt'),
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          eventType: 'proposal_rejected',
          occurredAt: now,
          profileId: proposal.profileId,
          nodeId: proposal.nodeId,
          proposalId: proposal.proposalId,
          interpretationId: null,
          observationId: null,
          causationEventId: reviewEventId,
          payload: {
            eventType: 'proposal_rejected',
            proposalId: proposal.proposalId,
            reason: decision.reason,
            rejectedBy: 'philos',
          },
        });
        break;
      }
      case 'require_user_confirmation': {
        await this.proposals.applyReviewDecision(proposal.proposalId, decision, 'pending_user_confirmation');
        const reviewEventId = this.idGen.nextId('tevt');
        await this.timelineRepo.append({
          id: reviewEventId,
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          eventType: 'review_decided',
          occurredAt: now,
          profileId: proposal.profileId,
          nodeId: proposal.nodeId,
          proposalId: proposal.proposalId,
          interpretationId: null,
          observationId: null,
          causationEventId: null,
          payload: {
            eventType: 'review_decided',
            proposalId: proposal.proposalId,
            decision: decision.decision,
            reason: decision.reason,
            reviewer: decision.reviewer,
            policyVersion: decision.policyVersion,
            newStatus: 'pending_user_confirmation',
          },
        });
        await this.timelineRepo.append({
          id: this.idGen.nextId('tevt'),
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          eventType: 'user_confirmation_required',
          occurredAt: now,
          profileId: proposal.profileId,
          nodeId: proposal.nodeId,
          proposalId: proposal.proposalId,
          interpretationId: null,
          observationId: null,
          causationEventId: reviewEventId,
          payload: {
            eventType: 'user_confirmation_required',
            proposalId: proposal.proposalId,
            proposedContent: proposal.proposedContent,
            reason: decision.reason,
          },
        });
        break;
      }
      case 'defer': {
        // Status stays pending_review; deferCount incremented inside applyReviewDecision.
        await this.proposals.applyReviewDecision(proposal.proposalId, decision, 'pending_review');
        await this.timelineRepo.append({
          id: this.idGen.nextId('tevt'),
          schemaVersion: TIMELINE_SCHEMA_VERSION,
          eventType: 'review_decided',
          occurredAt: now,
          profileId: proposal.profileId,
          nodeId: proposal.nodeId,
          proposalId: proposal.proposalId,
          interpretationId: null,
          observationId: null,
          causationEventId: null,
          payload: {
            eventType: 'review_decided',
            proposalId: proposal.proposalId,
            decision: decision.decision,
            reason: decision.reason,
            reviewer: decision.reviewer,
            policyVersion: decision.policyVersion,
            newStatus: 'pending_review',
          },
        });
        break;
      }
    }
    return decision;
  }

  /**
   * Philos Review Policy v1.0.
   * Deterministic: confidence → decision, no side-effects.
   */
  private applyPolicy(confidence: ConfidenceLevel | null): PhilosReviewDecision {
    const now = new Date(this.clock.now()).toISOString();
    const base = { reviewer: 'philos' as const, reviewedAt: now, policyVersion: PHILOS_POLICY_VERSION };

    if (confidence === null) {
      return { ...base, decision: 'reject', reason: 'no_confidence_record' };
    }
    if (confidence === 'speculative') {
      return { ...base, decision: 'reject', reason: 'speculative_confidence' };
    }
    if (confidence === 'low') {
      return { ...base, decision: 'require_user_confirmation', reason: 'low_confidence_requires_user' };
    }
    if (confidence === 'medium') {
      return { ...base, decision: 'accept', reason: 'medium_confidence_auto_accepted' };
    }
    if (confidence === 'high') {
      return { ...base, decision: 'accept', reason: 'high_confidence_auto_accepted' };
    }
    if (confidence === 'verified') {
      return { ...base, decision: 'accept', reason: 'verified_confidence_auto_accepted' };
    }
    // Unreachable with the current ConfidenceLevel enum.
    return { ...base, decision: 'defer', reason: 'policy_fallback_defer' };
  }

  /**
   * Return the last PhilosReviewDecision on the proposal, or a synthetic one if none exist.
   * Used for idempotency returns when the proposal is already in a terminal/non-defer state.
   */
  private lastOrFallback(
    proposal: PendingEssenceProposal,
    fallbackReason: string,
  ): PhilosReviewDecision {
    const last = proposal.reviewDecisions.at(-1);
    if (last) return last;
    // Synthetic fallback for terminal proposals that were not reviewed by this consumer.
    return {
      decision: 'reject',
      reason: fallbackReason,
      reviewer: 'philos',
      reviewedAt: new Date(this.clock.now()).toISOString(),
      policyVersion: PHILOS_POLICY_VERSION,
    };
  }
}
