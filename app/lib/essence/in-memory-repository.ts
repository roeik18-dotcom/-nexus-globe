/**
 * Essence · In-Memory Repository
 *
 * Used in tests and local development. Not for production persistence.
 *
 * Defensive-copy contract:
 *   getProfile / createProfile return independent copies.
 *   saveProfile stores an independent copy.
 *   appendObservation / appendConflict mutate the internal record directly
 *   (safe because callers never hold a reference to the internal record).
 */

import type { Conflict, EssenceProfile, Observation } from './schema';
import { createEmptyEssenceProfile } from './schema';
import type { EssenceReadRepository, EssenceRepository } from './repository';

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryEssenceRepository implements EssenceRepository {
  private readonly store = new Map<string, EssenceProfile>();

  async getProfile(profileId: string): Promise<EssenceProfile | null> {
    const profile = this.store.get(profileId);
    return profile ? deepCopy(profile) : null;
  }

  async profileExists(profileId: string): Promise<boolean> {
    return this.store.has(profileId);
  }

  async saveProfile(profile: EssenceProfile): Promise<void> {
    this.store.set(profile.profileId, deepCopy(profile));
  }

  async createProfile(profileId: string): Promise<EssenceProfile> {
    const profile = createEmptyEssenceProfile(profileId);
    this.store.set(profileId, deepCopy(profile));
    return profile; // caller gets a mutable copy; they must call saveProfile to persist changes
  }

  async appendObservation(profileId: string, observation: Observation): Promise<void> {
    const profile = this.store.get(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    profile.observations.push(deepCopy(observation));
  }

  async appendConflict(profileId: string, conflict: Conflict): Promise<void> {
    const profile = this.store.get(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    profile.conflicts.push(deepCopy(conflict));
  }

  asReadRepository(): EssenceReadRepository {
    return this;
  }

  /** Test helper — direct access to the internal store (no defensive copy). */
  snapshot(): Map<string, EssenceProfile> {
    return new Map(this.store);
  }
}
