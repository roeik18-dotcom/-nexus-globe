/**
 * In-memory repository — create, read, save, isolation, defensive copies,
 * appendObservation, appendConflict.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import type { Conflict, Observation } from '../schema';

function makeObs(id = 'obs-1'): Observation {
  return {
    id,
    source: 'agent_inference',
    recordedBy: 'merlin',
    content: 'test signal',
    sessionId: null,
    observedAt: new Date().toISOString(),
    evidenceIds: [],
    correctsObservationId: null,
  };
}

function makeConflict(id = 'conflict-1'): Conflict {
  return {
    id,
    type: 'unresolved_contradiction',
    detectedAt: new Date().toISOString(),
    existingInterpretationIds: ['interp-a'],
    triggeringObservationId: 'obs-trigger-1',
    resolvedAt: null,
    resolution: null,
    resolutionNote: null,
  };
}

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

describe('InMemoryEssenceRepository — defensive copies', () => {
  it('mutating the profile returned by getProfile does not affect the store', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');

    const profile = await repo.getProfile('u1');
    profile!.updatedAt = '2099-01-01T00:00:00.000Z'; // mutate without save

    const loaded = await repo.getProfile('u1');
    expect(loaded?.updatedAt).not.toBe('2099-01-01T00:00:00.000Z');
  });

  it('mutating the profile returned by createProfile does not affect the store', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.updatedAt = '2099-01-01T00:00:00.000Z'; // mutate without save

    const loaded = await repo.getProfile('u1');
    expect(loaded?.updatedAt).not.toBe('2099-01-01T00:00:00.000Z');
  });

  it('two calls to getProfile return independent copies', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');

    const a = await repo.getProfile('u1');
    const b = await repo.getProfile('u1');
    expect(a).not.toBe(b); // different object references
    expect(a).toEqual(b);  // same content
  });
});

describe('InMemoryEssenceRepository — appendObservation', () => {
  it('appends an observation to the profile', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    await repo.appendObservation('u1', makeObs('obs-a'));

    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(1);
    expect(profile?.observations[0].id).toBe('obs-a');
  });

  it('appending multiple observations accumulates them in order', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    await repo.appendObservation('u1', makeObs('obs-1'));
    await repo.appendObservation('u1', makeObs('obs-2'));

    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(2);
    expect(profile?.observations.map(o => o.id)).toEqual(['obs-1', 'obs-2']);
  });

  it('appended observation is isolated — external mutation does not affect the store', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    const obs = makeObs('obs-x');
    await repo.appendObservation('u1', obs);

    (obs as { content: string }).content = 'mutated after append'; // mutate the original

    const profile = await repo.getProfile('u1');
    expect(profile?.observations[0].content).toBe('test signal'); // not mutated
  });

  it('throws when profile does not exist', async () => {
    const repo = new InMemoryEssenceRepository();
    await expect(repo.appendObservation('no-such-profile', makeObs())).rejects.toThrow(/not found/i);
  });
});

describe('InMemoryEssenceRepository — appendConflict', () => {
  it('appends a conflict to the profile', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    await repo.appendConflict('u1', makeConflict('c-1'));

    const profile = await repo.getProfile('u1');
    expect(profile?.conflicts).toHaveLength(1);
    expect(profile?.conflicts[0].id).toBe('c-1');
  });

  it('appending multiple conflicts accumulates them', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    await repo.appendConflict('u1', makeConflict('c-1'));
    await repo.appendConflict('u1', makeConflict('c-2'));

    const profile = await repo.getProfile('u1');
    expect(profile?.conflicts).toHaveLength(2);
  });

  it('throws when profile does not exist', async () => {
    const repo = new InMemoryEssenceRepository();
    await expect(repo.appendConflict('no-such', makeConflict())).rejects.toThrow(/not found/i);
  });
});
