/**
 * Essence · Orientation Proposal Engine (M0-6B)
 *
 * Stateless component. Receives an AccumulatorSnapshot and a caller-assembled
 * OrientationProposalContext; returns an OrientationProposalDecision.
 *
 * Owns:
 *   - threshold evaluation
 *   - winner selection (highest accumulatedWeight)
 *   - idempotency decision (using context provided by the caller)
 *   - OrientationProposalCandidate construction
 *   - rationale synthesis
 *
 * Does NOT own:
 *   - weight accumulation (OrientationEvidenceAccumulator)
 *   - confidence calculation (OrientationEvidenceAccumulator)
 *   - pending proposal state (integration caller)
 *   - any read from EssenceProfile, Repository, or Service
 *   - any write to Essence
 *
 * The engine has no write path. The integration caller submits the returned
 * candidate via EssenceProposalService.proposeUpdate().
 */

import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';
import type {
  AccumulatorSnapshot,
  OrientationProposalContext,
  OrientationProposalDecision,
  OrientationProposalCandidate,
  DimensionEvidenceState,
} from './orientation-inference';
import { MINIMUM_CONTRIBUTING_OBSERVATIONS } from './orientation-inference';

export class OrientationProposalEngine {
  constructor(private readonly clock: Clock = systemClock) {}

  /**
   * Evaluate whether the accumulated evidence warrants a new proposal.
   *
   * Suppression order (checked in sequence; first match wins):
   *   1. no_candidates           — snapshot is empty
   *   2. below_minimum_evidence  — winner has fewer than MINIMUM_CONTRIBUTING_OBSERVATIONS
   *   3. below_confidence_threshold — winner confidence is 'speculative'
   *   4. same_as_active_value    — winner matches the currently active interpretation
   *   5. weight_unchanged_while_pending — equivalent proposal pending AND weight not increased
   *   6. equivalent_pending      — equivalent proposal pending (weight increased, still pending)
   *
   * If none of the above apply, returns shouldPropose: true with a fully populated candidate.
   */
  evaluate(
    snapshot: AccumulatorSnapshot,
    context: OrientationProposalContext,
  ): OrientationProposalDecision {
    if (snapshot.candidates.length === 0) {
      return { shouldPropose: false, reason: 'no_candidates' };
    }

    // Snapshot is sorted by accumulatedWeight desc — index 0 is the current winner.
    const winner = snapshot.candidates[0];

    if (winner.contributingObsIds.size < MINIMUM_CONTRIBUTING_OBSERVATIONS) {
      return { shouldPropose: false, reason: 'below_minimum_evidence' };
    }

    if (winner.accumulatedConfidence === 'speculative') {
      return { shouldPropose: false, reason: 'below_confidence_threshold' };
    }

    if (context.activeValue !== undefined && winner.candidateValue === context.activeValue) {
      return { shouldPropose: false, reason: 'same_as_active_value' };
    }

    // Idempotency: most specific check first.
    if (
      context.pendingEquivalentProposal &&
      context.lastEmittedWeight !== null &&
      winner.accumulatedWeight <= context.lastEmittedWeight
    ) {
      return { shouldPropose: false, reason: 'weight_unchanged_while_pending' };
    }

    if (context.pendingEquivalentProposal) {
      return { shouldPropose: false, reason: 'equivalent_pending' };
    }

    const candidate: OrientationProposalCandidate = {
      profileId:              snapshot.profileId,
      dimensionKey:           snapshot.dimensionKey,
      proposedValue:          winner.candidateValue,
      evidenceObservationIds: Array.from(winner.contributingObsIds),
      accumulatedConfidence:  winner.accumulatedConfidence,
      rationale:              this.buildRationale(winner),
      proposedAt:             new Date(this.clock.now()).toISOString(),
    };

    return { shouldPropose: true, candidate };
  }

  private buildRationale(winner: DimensionEvidenceState): string {
    const count = winner.contributingObsIds.size;
    const obsIds = Array.from(winner.contributingObsIds).join(', ');
    return (
      `${count} independent observation${count === 1 ? '' : 's'} support ` +
      `'${winner.candidateValue}' for ${winner.dimensionKey} ` +
      `(confidence: ${winner.accumulatedConfidence}, ` +
      `accumulated weight: ${winner.accumulatedWeight.toFixed(2)}). ` +
      `Contributing observations: [${obsIds}].`
    );
  }
}
