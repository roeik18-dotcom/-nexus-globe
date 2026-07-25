/**
 * Essence · In-Memory Repository
 *
 * Used in tests and local development. Not for production persistence.
 */

import type { EssenceProfile } from './schema';
import { createEmptyEssenceProfile } from './schema';
import type { EssenceReadRepository, EssenceRepository } from './repository';

export class InMemoryEssenceRepository implements EssenceRepository {
  private readonly store = new Map<string, EssenceProfile>();

  async getProfile(profileId: string): Promise<EssenceProfile | null> {
    return this.store.get(profileId) ?? null;
  }

  async profileExists(profileId: string): Promise<boolean> {
    return this.store.has(profileId);
  }

  async saveProfile(profile: EssenceProfile): Promise<void> {
    this.store.set(profile.profileId, profile);
  }

  async createProfile(profileId: string): Promise<EssenceProfile> {
    const profile = createEmptyEssenceProfile(profileId);
    this.store.set(profileId, profile);
    return profile;
  }

  asReadRepository(): EssenceReadRepository {
    return this;
  }

  /** Test helper — direct access to the internal store. */
  snapshot(): Map<string, EssenceProfile> {
    return new Map(this.store);
  }
}
