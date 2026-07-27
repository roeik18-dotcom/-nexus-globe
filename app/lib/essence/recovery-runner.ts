/**
 * Essence · Recovery Runner (M0-14)
 *
 * Runs once on server startup to resume any non-terminal proposals that were
 * in-flight when the previous process exited.
 *
 * Routing logic:
 *   pending_review            → Philos (idempotent via consume())
 *   pending_user_confirmation → skipped (user must act)
 *   past expiresAt            → marked expired and persisted before routing
 *   terminal (confirmed/rejected/expired) → skipped
 *
 * Returns a RecoveryReport with counts for observability.
 * Errors from individual proposal processing are logged and do not abort the run.
 */

import type { EssenceProposalRepository } from './api';
import type { PhilosReviewConsumer } from './philos-review-consumer';
import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';

export interface RecoveryReport {
  scanned: number;
  reviewed: number;
  expired: number;
  skipped: number;
}

export class EssenceRecoveryRunner {
  constructor(
    private readonly proposalRepo: EssenceProposalRepository,
    private readonly philos: PhilosReviewConsumer,
    private readonly clock: Clock = systemClock,
  ) {}

  async run(): Promise<RecoveryReport> {
    const all = await this.proposalRepo.loadAllProposals();
    const report: RecoveryReport = { scanned: all.length, reviewed: 0, expired: 0, skipped: 0 };
    const now = this.clock.now();

    for (const proposal of all) {
      // Already terminal — nothing to do.
      if (
        proposal.status === 'confirmed' ||
        proposal.status === 'rejected' ||
        proposal.status === 'expired'
      ) {
        continue;
      }

      // Expiry check (applies to any non-terminal status).
      if (new Date(proposal.expiresAt).getTime() < now) {
        (proposal as { status: string }).status = 'expired';
        await this.proposalRepo.saveProposal(proposal);
        report.expired += 1;
        continue;
      }

      // pending_user_confirmation: user must act — leave it alone.
      if (proposal.status === 'pending_user_confirmation') {
        report.skipped += 1;
        continue;
      }

      // pending_review: hand off to Philos.
      if (proposal.status === 'pending_review') {
        try {
          await this.philos.consume(proposal.profileId, proposal.proposalId);
          report.reviewed += 1;
        } catch (err) {
          console.error(`[essence] recovery: failed to process proposal ${proposal.proposalId}`, err);
        }
      }
    }

    return report;
  }
}
