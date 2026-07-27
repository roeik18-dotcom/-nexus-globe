/**
 * Essence · File-System Proposal Repository (M0-13B)
 *
 * Durable implementation of EssenceProposalRepository. All proposals are
 * stored in a single <dataDir>/proposals.json file to allow O(1) lookup by
 * proposalId without knowing the profileId in advance.
 *
 * Writes are atomic: data is written to proposals.json.tmp, then renamed into
 * place (POSIX rename is atomic, so readers never see a partial write).
 *
 * Lives outside app/lib/essence/ to satisfy the domain-purity constraint:
 * Node.js built-ins (fs, path) are forbidden inside the domain layer.
 *
 * Suitable for single-process Next.js deployments with a writable filesystem.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { EssenceProposalRepository } from './essence/api';
import type { PendingEssenceProposal } from './essence/api';

type ProposalStore = Record<string, PendingEssenceProposal>;

export class FileSystemEssenceProposalRepository implements EssenceProposalRepository {
  private readonly filePath: string;
  private readonly tmpPath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, 'proposals.json');
    this.tmpPath = `${this.filePath}.tmp`;
  }

  private read(): ProposalStore {
    if (!existsSync(this.filePath)) return {};
    return JSON.parse(readFileSync(this.filePath, 'utf-8')) as ProposalStore;
  }

  private write(store: ProposalStore): void {
    writeFileSync(this.tmpPath, JSON.stringify(store), 'utf-8');
    renameSync(this.tmpPath, this.filePath);
  }

  async saveProposal(proposal: PendingEssenceProposal): Promise<void> {
    const store = this.read();
    store[proposal.proposalId] = proposal;
    this.write(store);
  }

  async loadProposal(proposalId: string): Promise<PendingEssenceProposal | undefined> {
    return this.read()[proposalId];
  }

  async loadProposalsByProfile(profileId: string): Promise<PendingEssenceProposal[]> {
    const store = this.read();
    return Object.values(store).filter((p) => p.profileId === profileId);
  }
}
