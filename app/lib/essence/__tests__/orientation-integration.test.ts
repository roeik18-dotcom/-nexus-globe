/**
 * Integration: InMemoryEssenceRepository → EssenceReadService.getEssenceSummary
 * verifies that orientation nodes saved in a profile survive the full read path
 * and appear in the summary with correct field values.
 *
 * This test does NOT require a Next.js server or HTTP layer.
 * The Python renderer's behavior is covered separately in test_essence_context_orientation.py.
 */

import { describe, it, expect } from 'vitest';
import { EssenceReadService } from '../read-service';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import type { Interpretation } from '../schema';

function makeOrientationInterpretation(
  nodeId: string,
  content: string,
  overrides: Partial<Interpretation> = {},
): Interpretation {
  const now = new Date().toISOString();
  return {
    id: `interp-${nodeId}`,
    version: 1,
    nodeId,
    layer: 'expression',
    stabilityClass: 'Adaptive',
    content,
    observationIds: [],
    confidence: 'high',
    interpretationKind: 'probable_interpretation',
    provenance: {
      source: 'user_statement',
      confidence: 'high',
      createdBy: 'merlin',
      firstObservedAt: now,
      lastConfirmedAt: now,
      lastUpdatedAt: now,
      evidenceIds: ['ev-orientation-1'],
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

describe('orientation node integration — EssenceReadService.getEssenceSummary', () => {
  it('orientation node saved in repository appears in merlin summary', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['OrientationResponseDepth'] = [
      makeOrientationInterpretation('OrientationResponseDepth', 'brief'),
    ];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'merlin');

    expect(summary.nodes['OrientationResponseDepth']).toBeDefined();
    expect(summary.nodes['OrientationResponseDepth']?.content).toBe('brief');
    expect(summary.nodes['OrientationResponseDepth']?.layer).toBe('expression');
    expect(summary.nodes['OrientationResponseDepth']?.temporalKind).toBe('trait');
    expect(summary.nodes['OrientationResponseDepth']?.sensitivity).toBe('personal');
  });

  it('all five orientation nodes survive the read path', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');

    profile.expression['OrientationCommunicationStyle'] = [
      makeOrientationInterpretation('OrientationCommunicationStyle', 'direct'),
    ];
    profile.expression['OrientationResponseDepth'] = [
      makeOrientationInterpretation('OrientationResponseDepth', 'brief'),
    ];
    profile.expression['OrientationTaskFraming'] = [
      makeOrientationInterpretation('OrientationTaskFraming', 'action_first'),
    ];
    profile.expression['OrientationDecisionStyle'] = [
      makeOrientationInterpretation('OrientationDecisionStyle', 'decisive'),
    ];
    profile.expression['OrientationTaskCadence'] = [
      makeOrientationInterpretation('OrientationTaskCadence', 'single_step'),
    ];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'merlin');

    expect(summary.nodes['OrientationCommunicationStyle']?.content).toBe('direct');
    expect(summary.nodes['OrientationResponseDepth']?.content).toBe('brief');
    expect(summary.nodes['OrientationTaskFraming']?.content).toBe('action_first');
    expect(summary.nodes['OrientationDecisionStyle']?.content).toBe('decisive');
    expect(summary.nodes['OrientationTaskCadence']?.content).toBe('single_step');
  });

  it('archived orientation interpretation is excluded from summary', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['OrientationResponseDepth'] = [
      makeOrientationInterpretation('OrientationResponseDepth', 'brief', {
        archivedAt: new Date().toISOString(),
      }),
    ];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'merlin');

    expect(summary.nodes['OrientationResponseDepth']).toBeUndefined();
  });

  it('nexus cannot read orientation nodes (not in its readableNodeIds)', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['OrientationResponseDepth'] = [
      makeOrientationInterpretation('OrientationResponseDepth', 'brief'),
    ];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'nexus');

    expect(summary.nodes['OrientationResponseDepth']).toBeUndefined();
  });

  it('selectBest picks highest-confidence interpretation when multiple exist', async () => {
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');
    profile.expression['OrientationResponseDepth'] = [
      makeOrientationInterpretation('OrientationResponseDepth', 'brief', {
        id: 'interp-low',
        confidence: 'low',
      }),
      makeOrientationInterpretation('OrientationResponseDepth', 'explanatory', {
        id: 'interp-high',
        confidence: 'high',
      }),
    ];
    await repo.saveProfile(profile);

    const svc = new EssenceReadService(repo.asReadRepository());
    const summary = await svc.getEssenceSummary('u1', 'task_relevant', 'merlin');

    // selectBest() resolves by confidence — high wins over low
    expect(summary.nodes['OrientationResponseDepth']?.content).toBe('explanatory');
  });
});
