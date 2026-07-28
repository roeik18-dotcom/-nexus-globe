/**
 * Essence · In-Memory Timeline Repository (M1-1B)
 *
 * Test / development implementation of EssenceTimelineRepository.
 * Stores events in an array in insertion order.
 * Not durable — data is lost when the process exits.
 *
 * For durable storage use FileSystemEssenceTimelineRepository.
 */

import type { EssenceTimelineRepository } from './api';
import type { EssenceTimelineEvent } from './timeline';

export class InMemoryEssenceTimelineRepository implements EssenceTimelineRepository {
  private readonly events: EssenceTimelineEvent[] = [];

  async append(event: EssenceTimelineEvent): Promise<void> {
    this.events.push(event);
  }

  async loadByProfile(profileId: string): Promise<EssenceTimelineEvent[]> {
    return this.events.filter(e => e.profileId === profileId);
  }

  async loadByProposal(proposalId: string): Promise<EssenceTimelineEvent[]> {
    return this.events.filter(e => e.proposalId === proposalId);
  }

  async loadByInterpretation(interpretationId: string): Promise<EssenceTimelineEvent[]> {
    return this.events.filter(e => e.interpretationId === interpretationId);
  }

  async loadAll(): Promise<EssenceTimelineEvent[]> {
    return [...this.events];
  }

  /** Test helper: return all events regardless of profile. */
  all(): EssenceTimelineEvent[] {
    return [...this.events];
  }
}

/**
 * No-op implementation for use as the default when no Timeline is wired up.
 * All writes are silently discarded; all reads return empty arrays.
 * Used as the default value for optional timelineRepo parameters so that
 * existing code and tests require no changes until M1-1C instruments the write path.
 */
export const noopTimelineRepository: EssenceTimelineRepository = {
  async append(_event): Promise<void> {},
  async loadByProfile(_profileId): Promise<EssenceTimelineEvent[]> { return []; },
  async loadByProposal(_proposalId): Promise<EssenceTimelineEvent[]> { return []; },
  async loadByInterpretation(_interpretationId): Promise<EssenceTimelineEvent[]> { return []; },
  async loadAll(): Promise<EssenceTimelineEvent[]> { return []; },
};
