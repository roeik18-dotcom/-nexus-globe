/**
 * Read service — access control, layer views, state.
 */

import { describe, it, expect } from 'vitest';
import { EssenceReadService } from '../read-service';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import type { Interpretation } from '../schema';

function makeInterpretation(overrides: Partial<Interpretation> = {}): Interpretation {
  const now = new Date().toISOString();
  return {
    id: 'interp-1',
    version: 1,
    nodeId: 'Preferences',
    layer: 'expression',
    stabilityClass: 'Adaptive',
    content: 'dark mode',
    observationIds: [],
    confidence: 'medium',
    interpretationKind: 'probable_interpretation',
    provenance: {
      source: 'agent_inference',
      confidence: 'medium',
      createdBy: 'merlin',
      firstObservedAt: now,
      lastConfirmedAt: now,
      lastUpdatedAt: now,
      evidenceIds: ['ev-1'],
      conflictingInterpretationIds: [],
    },
    sensitivity: 'personal',
    temporalKind: 'trait',
    stateScope: null,
    expiresAt: null,
    archivedAt: null,
    conflictIds: [],
    evidenceStatus: 'referenced',
    ...overrides,
  };
}

describe('EssenceReadService', () => {
  it('getLayerView returns empty nodes for profile with no interpretations', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    const svc = new EssenceReadService(repo.asReadRepository());
    const view = await svc.getLayerView('u1', 'expression', 'merlin');
    expect(view.nodes).toEqual({});
  });

  it('getLayerView returns interpretations the agent can read', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['Preferences'] = [makeInterpretation()];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const view = await svc.getLayerView('u1', 'expression', 'merlin');
    expect(view.nodes['Preferences']).toHaveLength(1);
  });

  it('nexus cannot read expression layer', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['Preferences'] = [makeInterpretation()];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const view = await svc.getLayerView('u1', 'expression', 'nexus');
    expect(view.nodes).toEqual({});
  });

  it('getEssenceSummary includes evidenceStatus in node records', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['Preferences'] = [makeInterpretation({ evidenceStatus: 'referenced' })];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'merlin');
    expect(summary.nodes['Preferences']?.evidenceStatus).toBe('referenced');
  });

  it('getEssenceSummary excludes archived interpretations', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['Preferences'] = [
      makeInterpretation({ id: 'archived-1', archivedAt: new Date().toISOString() }),
    ];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'merlin');
    expect(summary.nodes['Preferences']).toBeUndefined();
  });

  it('getConflicts returns count 0 on empty profile', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    const svc = new EssenceReadService(repo.asReadRepository());
    const result = await svc.getConflicts('u1', 'philos');
    expect(result.count).toBe(0);
    expect(result.types).toEqual([]);
  });

  it('getEvidence returns empty arrays for unknown interpretation', async () => {
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    const svc = new EssenceReadService(repo.asReadRepository());
    const ev = await svc.getEvidence('u1', 'no-such-interp', 'philos');
    expect(ev.observationIds).toEqual([]);
    expect(ev.evidenceIds).toEqual([]);
  });

  it('throws for missing profile', async () => {
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceReadService(repo.asReadRepository());
    await expect(svc.getLayerView('missing', 'core', 'philos')).rejects.toThrow(/not found/i);
  });
});
