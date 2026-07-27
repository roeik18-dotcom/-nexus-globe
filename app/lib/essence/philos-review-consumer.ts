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
  PendingEssenceProposal,
  PhilosReviewDecision,
} from './api';
import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';

export const PHILOS_POLICY_VERSION = '1.0';
export const MAX_DEFER_COUNT = 1;

export class PhilosReviewConsumer {
  constructor(
    private readonly proposals: EssencePhilosReviewAPI,
    private readonly clock: Clock = systemClock,
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
    const proposal = this.proposals.getProposalRecord(proposalId);
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
    switch (decision.decision) {
      case 'accept': {
        // Commit the Interpretation first, then mark proposal confirmed.
        await this.proposals.commitReviewedProposal(proposal);
        this.proposals.applyReviewDecision(proposal.proposalId, decision, 'confirmed');
        break;
      }
      case 'reject': {
        this.proposals.applyReviewDecision(proposal.proposalId, decision, 'rejected');
        break;
      }
      case 'require_user_confirmation': {
        this.proposals.applyReviewDecision(proposal.proposalId, decision, 'pending_user_confirmation');
        break;
      }
      case 'defer': {
        // Status stays pending_review; deferCount incremented inside applyReviewDecision.
        this.proposals.applyReviewDecision(proposal.proposalId, decision, 'pending_review');
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
