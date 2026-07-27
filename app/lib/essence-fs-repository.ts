/**
 * Essence · File-System Repository (M0-12)
 *
 * Durable implementation of EssenceRepository. One JSON file per profile.
 * Writes are atomic: data is written to a .tmp sibling, then renamed into place
 * (POSIX rename is atomic, so readers never see a partially-written file).
 *
 * Suitable for single-process Next.js deployments with a writable filesystem.
 * Not suitable for multi-process or serverless deployments — use a database
 * implementation for those.
 *
 * Lives outside app/lib/essence/ to satisfy the domain-purity constraint:
 * Node.js built-ins (fs, path) are forbidden inside the domain layer.
 *
 * Security: profileId is validated against an allowlist charset before use
 * in file paths to prevent path traversal.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { Conflict, EssenceProfile, Observation } from './essence/schema';
import { createEmptyEssenceProfile } from './essence/schema';
import type { EssenceRepository } from './essence/repository';

const PROFILE_ID_RE = /^[\w-]+$/;

export class FileSystemEssenceRepository implements EssenceRepository {
  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
  }

  private profilePath(profileId: string): string {
    if (!PROFILE_ID_RE.test(profileId)) {
      throw new Error(`Invalid profileId: ${JSON.stringify(profileId)}`);
    }
    return join(this.dataDir, `${profileId}.json`);
  }

  private read(profileId: string): EssenceProfile | null {
    const path = this.profilePath(profileId);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as EssenceProfile;
  }

  private write(profile: EssenceProfile): void {
    const path = this.profilePath(profile.profileId);
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(profile), 'utf-8');
    renameSync(tmp, path);
  }

  async getProfile(profileId: string): Promise<EssenceProfile | null> {
    return this.read(profileId);
  }

  async profileExists(profileId: string): Promise<boolean> {
    return existsSync(this.profilePath(profileId));
  }

  async createProfile(profileId: string): Promise<EssenceProfile> {
    const profile = createEmptyEssenceProfile(profileId);
    this.write(profile);
    return profile;
  }

  async saveProfile(profile: EssenceProfile): Promise<void> {
    this.write(profile);
  }

  async appendObservation(profileId: string, observation: Observation): Promise<void> {
    const profile = this.read(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    this.write({ ...profile, observations: [...profile.observations, observation] });
  }

  async appendConflict(profileId: string, conflict: Conflict): Promise<void> {
    const profile = this.read(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    this.write({ ...profile, conflicts: [...profile.conflicts, conflict] });
  }
}
