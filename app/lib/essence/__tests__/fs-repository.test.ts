/**
 * M0-12 — FileSystemEssenceRepository unit tests.
 *
 * Each test creates an isolated temp directory. The key invariant verified is
 * cross-instance persistence: data written by one instance must be readable
 * by a second instance pointing at the same directory (simulating a restart).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemEssenceRepository } from '../../essence-fs-repository';
import type { Observation, Conflict, EssenceEvolutionEntry } from '../schema';

let dataDir: string;
let repo: FileSystemEssenceRepository;

function freshRepo(): FileSystemEssenceRepository {
  return new FileSystemEssenceRepository(dataDir);
}

function stubObs(id: string): Observation {
  return {
    id,
    source: 'agent_inference',
    recordedBy: 'philos',
    content: `observation ${id}`,
    sessionId: 'sess-1',
    observedAt: '2026-01-01T00:00:00.000Z',
    evidenceIds: [],
    correctsObservationId: null,
  };
}

function stubConflict(id: string): Conflict {
  return {
    id,
    type: 'temporal_change',
    detectedAt: '2026-01-01T00:00:00.000Z',
    existingInterpretationIds: ['interp-1'],
    triggeringObservationId: 'obs-1',
    resolvedAt: null,
    resolution: null,
    resolutionNote: null,
  };
}

function stubEvolution(id: string): EssenceEvolutionEntry {
  return {
    id,
    nodeId: 'OrientationResponseDepth',
    previousInterpretationId: null,
    newInterpretationId: `interp-${id}`,
    triggeredBy: 'agent_inference',
    agentName: 'philos',
    timestamp: '2026-01-01T00:00:00.000Z',
    note: null,
  };
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'essence-fs-'));
  repo = freshRepo();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

// ── profileExists ─────────────────────────────────────────────────────────────

describe('profileExists', () => {
  it('returns false before creation', async () => {
    expect(await repo.profileExists('p1')).toBe(false);
  });

  it('returns true after createProfile', async () => {
    await repo.createProfile('p1');
    expect(await repo.profileExists('p1')).toBe(true);
  });

  it('is false for a different profileId', async () => {
    await repo.createProfile('p1');
    expect(await repo.profileExists('p2')).toBe(false);
  });
});

// ── getProfile ────────────────────────────────────────────────────────────────

describe('getProfile', () => {
  it('returns null for an unknown profile', async () => {
    expect(await repo.getProfile('p1')).toBeNull();
  });

  it('returns the profile after creation', async () => {
    const created = await repo.createProfile('p1');
    const got = await repo.getProfile('p1');
    expect(got).not.toBeNull();
    expect(got!.profileId).toBe('p1');
    expect(got!.schemaVersion).toBe('1');
    expect(got).toMatchObject(created);
  });

  it('returns independent copies (mutating returned value does not affect storage)', async () => {
    await repo.createProfile('p1');
    const a = await repo.getProfile('p1');
    a!.observations.push(stubObs('obs-x'));

    const b = await repo.getProfile('p1');
    expect(b!.observations).toHaveLength(0);
  });
});

// ── createProfile ─────────────────────────────────────────────────────────────

describe('createProfile', () => {
  it('returns a profile with correct shape and empty arrays', async () => {
    const profile = await repo.createProfile('p1');
    expect(profile.profileId).toBe('p1');
    expect(profile.schemaVersion).toBe('1');
    expect(profile.observations).toEqual([]);
    expect(profile.conflicts).toEqual([]);
    expect(profile.evolution).toEqual([]);
    expect(profile.core).toEqual({});
    expect(profile.expression).toEqual({});
  });

  it('persists across instances (survives restart)', async () => {
    await repo.createProfile('p1');

    const repo2 = freshRepo();
    const profile = await repo2.getProfile('p1');
    expect(profile).not.toBeNull();
    expect(profile!.profileId).toBe('p1');
  });

  it('creates each profile independently', async () => {
    await repo.createProfile('p1');
    await repo.createProfile('p2');
    expect(await repo.profileExists('p1')).toBe(true);
    expect(await repo.profileExists('p2')).toBe(true);
  });
});

// ── saveProfile ───────────────────────────────────────────────────────────────

describe('saveProfile', () => {
  it('overwrites the stored profile', async () => {
    const profile = await repo.createProfile('p1');
    profile.evolution = [stubEvolution('ev-1')];
    await repo.saveProfile(profile);

    const got = await repo.getProfile('p1');
    expect(got!.evolution).toHaveLength(1);
    expect(got!.evolution[0].nodeId).toBe('OrientationResponseDepth');
  });

  it('persists across instances', async () => {
    const profile = await repo.createProfile('p1');
    profile.evolution = [stubEvolution('ev-1')];
    await repo.saveProfile(profile);

    const got = await freshRepo().getProfile('p1');
    expect(got!.evolution).toHaveLength(1);
  });

  it('stores whatever profile content is provided (no silent updatedAt mutation)', async () => {
    const profile = await repo.createProfile('p1');
    const fixedAt = '2000-01-01T00:00:00.000Z';
    const modified = { ...profile, updatedAt: fixedAt };
    await repo.saveProfile(modified);

    const got = await repo.getProfile('p1');
    expect(got!.updatedAt).toBe(fixedAt);
  });
});

// ── appendObservation ─────────────────────────────────────────────────────────

describe('appendObservation', () => {
  it('appends an observation to the profile', async () => {
    await repo.createProfile('p1');
    await repo.appendObservation('p1', stubObs('obs-1'));

    const got = await repo.getProfile('p1');
    expect(got!.observations).toHaveLength(1);
    expect(got!.observations[0].id).toBe('obs-1');
  });

  it('accumulates multiple observations in order', async () => {
    await repo.createProfile('p1');
    await repo.appendObservation('p1', stubObs('obs-1'));
    await repo.appendObservation('p1', stubObs('obs-2'));
    await repo.appendObservation('p1', stubObs('obs-3'));

    const got = await repo.getProfile('p1');
    expect(got!.observations.map((o) => o.id)).toEqual(['obs-1', 'obs-2', 'obs-3']);
  });

  it('throws when profile does not exist', async () => {
    await expect(repo.appendObservation('missing', stubObs('obs-1'))).rejects.toThrow(
      'Profile not found: missing',
    );
  });

  it('persists across instances', async () => {
    await repo.createProfile('p1');
    await repo.appendObservation('p1', stubObs('obs-1'));

    const got = await freshRepo().getProfile('p1');
    expect(got!.observations).toHaveLength(1);
  });
});

// ── appendConflict ────────────────────────────────────────────────────────────

describe('appendConflict', () => {
  it('appends a conflict to the profile', async () => {
    await repo.createProfile('p1');
    await repo.appendConflict('p1', stubConflict('conf-1'));

    const got = await repo.getProfile('p1');
    expect(got!.conflicts).toHaveLength(1);
    expect(got!.conflicts[0].id).toBe('conf-1');
  });

  it('throws when profile does not exist', async () => {
    await expect(repo.appendConflict('missing', stubConflict('conf-1'))).rejects.toThrow(
      'Profile not found: missing',
    );
  });

  it('persists across instances', async () => {
    await repo.createProfile('p1');
    await repo.appendConflict('p1', stubConflict('conf-1'));

    const got = await freshRepo().getProfile('p1');
    expect(got!.conflicts).toHaveLength(1);
  });
});

// ── Path traversal guard ──────────────────────────────────────────────────────

describe('path traversal guard', () => {
  it('rejects profileId containing a path separator', async () => {
    await expect(repo.getProfile('../evil')).rejects.toThrow('Invalid profileId');
  });

  it('rejects empty profileId', async () => {
    await expect(repo.getProfile('')).rejects.toThrow('Invalid profileId');
  });

  it('rejects profileId with a dot', async () => {
    await expect(repo.getProfile('foo.bar')).rejects.toThrow('Invalid profileId');
  });

  it('accepts alphanumeric and hyphen-underscore profileIds', async () => {
    await expect(repo.createProfile('user-123_abc')).resolves.not.toThrow();
  });
});

// ── Directory creation ────────────────────────────────────────────────────────

describe('constructor creates the data directory if absent', () => {
  it('creates nested directories', () => {
    const nested = join(dataDir, 'sub', 'dir');
    expect(() => new FileSystemEssenceRepository(nested)).not.toThrow();
  });
});
