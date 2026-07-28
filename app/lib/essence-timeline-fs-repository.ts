/**
 * Essence · File-System Timeline Repository (M1-1B)
 *
 * Durable implementation of EssenceTimelineRepository. Events are stored in
 * JSONL format (one JSON object per line) in <dataDir>/timeline.jsonl.
 *
 * Append is O(1) and does not require reading the existing file.
 * Queries (loadByProfile, loadByProposal, loadByInterpretation) scan the full
 * file. This is acceptable for single-process deployments at M1 scale; a
 * per-profile sharding or SQLite index can be layered on later.
 *
 * Lives outside app/lib/essence/ to satisfy the domain-purity constraint.
 * Node.js built-ins (fs, path) are forbidden inside the domain layer.
 *
 * Append durability:
 *   appendFileSync() is a single syscall; the OS guarantees that it either
 *   appends the full line or nothing. No partial-line corruption risk.
 *   A line that fails to parse on read (truncated crash) is skipped silently
 *   and logged — one corrupt event does not prevent loading the rest.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EssenceTimelineRepository } from './essence/api';
import type { EssenceTimelineEvent } from './essence/timeline';

export class FileSystemEssenceTimelineRepository implements EssenceTimelineRepository {
  private readonly filePath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, 'timeline.jsonl');
  }

  async append(event: EssenceTimelineEvent): Promise<void> {
    appendFileSync(this.filePath, JSON.stringify(event) + '\n', 'utf-8');
  }

  private readAll(): EssenceTimelineEvent[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, 'utf-8').split('\n');
    const events: EssenceTimelineEvent[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as EssenceTimelineEvent);
      } catch {
        console.warn('[essence-timeline] Skipping unparseable line in timeline.jsonl');
      }
    }
    return events;
  }

  async loadByProfile(profileId: string): Promise<EssenceTimelineEvent[]> {
    return this.readAll().filter(e => e.profileId === profileId);
  }

  async loadByProposal(proposalId: string): Promise<EssenceTimelineEvent[]> {
    return this.readAll().filter(e => e.proposalId === proposalId);
  }

  async loadByInterpretation(interpretationId: string): Promise<EssenceTimelineEvent[]> {
    return this.readAll().filter(e => e.interpretationId === interpretationId);
  }

  async loadAll(): Promise<EssenceTimelineEvent[]> {
    return this.readAll();
  }
}
