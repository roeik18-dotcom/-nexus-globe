/**
 * Essence · Repository Interfaces
 *
 * EssenceReadRepository  — read-only access (for ReadService and all query paths)
 * EssenceRepository      — writable access (for ProposalService ONLY)
 *
 * The writable repository must never be injected into any agent directly.
 */

import type { Conflict, EssenceProfile, Observation } from './schema';

export interface EssenceReadRepository {
  getProfile(profileId: string): Promise<EssenceProfile | null>;
  profileExists(profileId: string): Promise<boolean>;
}

export interface EssenceRepository extends EssenceReadRepository {
  saveProfile(profile: EssenceProfile): Promise<void>;
  createProfile(profileId: string): Promise<EssenceProfile>;
  /** Append an observation to the profile's immutable observation log. */
  appendObservation(profileId: string, observation: Observation): Promise<void>;
  /** Append a detected conflict record to the profile. */
  appendConflict(profileId: string, conflict: Conflict): Promise<void>;
}
