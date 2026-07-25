/**
 * In-memory repository — create, read, save, isolation.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryEssenceRepository } from '../in-memory-repository';

describe('InMemoryEssenceRepository', () => {
  it('returns null for a non-existent profile', async () => {
    const repo = new InMemoryEssenceRepository();
    expect(await repo.getProfile('missing')).toBeNull();
  });

  it('profileExists returns false before creation', async () => {
    const repo = new InMemoryEssenceRepository();
    expect(await repo.profileExists('x')).toBe(false);
  });

  it('createProfile returns a profile with the given ID', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('user-1');
    expect(profile.profileId).toBe('user-1');
  });

  it('profileExists returns true after creation', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('user-1');
    expect(await repo.profileExists('user-1')).toBe(true);
  });

  it('getProfile returns the created profile', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('user-1');
    const p = await repo.getProfile('user-1');
    expect(p?.profileId).toBe('user-1');
  });

  it('saveProfile overwrites the stored profile', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('user-1');
    const modified = { ...profile, updatedAt: '2099-01-01T00:00:00.000Z' };
    await repo.saveProfile(modified);
    const loaded = await repo.getProfile('user-1');
    expect(loaded?.updatedAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('two profiles are stored independently', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('a');
    await repo.createProfile('b');
    const a = await repo.getProfile('a');
    const b = await repo.getProfile('b');
    expect(a?.profileId).toBe('a');
    expect(b?.profileId).toBe('b');
  });

  it('asReadRepository returns a read-only view', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('user-1');
    const readRepo = repo.asReadRepository();
    expect(await readRepo.getProfile('user-1')).not.toBeNull();
    expect(await readRepo.profileExists('user-1')).toBe(true);
  });
});
