/**
 * Essence · In-Memory Proposal Repository (M0-13B)
 *
 * Development / test implementation of EssenceProposalRepository.
 * Stores proposal records in a plain Map keyed by proposalId.
 * Not durable — data is lost when the process exits.
 *
 * For durable storage use FileSystemEssenceProposalRepository.
 */

import type { EssenceProposalRepository } from './api';
import type { PendingEssenceProposal } from './api';

export class InMemoryEssenceProposalRepository implements EssenceProposalRepository {
  private readonly records = new Map<string, PendingEssenceProposal>();

  async saveProposal(proposal: PendingEssenceProposal): Promise<void> {
    this.records.set(proposal.proposalId, proposal);
  }

  async loadProposal(proposalId: string): Promise<PendingEssenceProposal | undefined> {
    return this.records.get(proposalId);
  }

  async loadProposalsByProfile(profileId: string): Promise<PendingEssenceProposal[]> {
    const results: PendingEssenceProposal[] = [];
    for (const proposal of this.records.values()) {
      if (proposal.profileId === profileId) results.push(proposal);
    }
    return results;
  }

  async loadAllProposals(): Promise<PendingEssenceProposal[]> {
    return [...this.records.values()];
  }
}
