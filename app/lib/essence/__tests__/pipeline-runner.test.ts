/**
 * Pipeline runner — write-policy matrix, conflict detection, stage audit.
 *
 * Phase 1A invariant: no agent proposal auto-accepts without UserAuthorizedActionContext.
 */

import { describe, it, expect } from 'vitest';
import { PipelineRunner } from '../pipeline-runner';
import { createEmptyEssenceProfile } from '../schema';
import type { PipelineRunnerInput } from '../pipeline-runner';
import type { UserAuthorizedActionContext } from '../api';
import type { EssenceProfile } from '../schema';

const USER_CTX: UserAuthorizedActionContext = {
  actorType: 'user',
  actionId: 'test-action-1',
  authorizedAt: new Date().toISOString(),
};

function baseInput(overrides: Partial<PipelineRunnerInput> = {}): PipelineRunnerInput {
  return {
    profileId: 'p1',
    nodeId: 'Preferences',
    proposedContent: 'dark mode',
    proposedBy: { type: 'agent', agentName: 'merlin' },
    evidenceObservationIds: [],
    rationale: 'observed from settings',
    currentProfile: createEmptyEssenceProfile('p1'),
    ...overrides,
  };
}

describe('PipelineRunner — validation failures', () => {
  const runner = new PipelineRunner();

  it('unknown nodeId → rejected', () => {
    const out = runner.run(baseInput({ nodeId: 'NonExistentNode' }));
    expect(out.result.status).toBe('rejected');
    expect((out.result as any).reason).toMatch(/Unknown nodeId/);
  });

  it('empty proposedContent → rejected', () => {
    const out = runner.run(baseInput({ proposedContent: '   ' }));
    expect(out.result.status).toBe('rejected');
  });

  it('empty proposedContent sets validate stage to blocked', () => {
    const out = runner.run(baseInput({ proposedContent: '' }));
    const validate = out.stages.find(s => s.stage === 'validate');
    expect(validate?.outcome).toBe('blocked');
  });

  it('nexus proposing to core → rejected (access denied)', () => {
    const out = runner.run(baseInput({ nodeId: 'Values', proposedBy: { type: 'agent', agentName: 'nexus' } }));
    expect(out.result.status).toBe('rejected');
    expect((out.result as any).reason).toMatch(/cannot propose to layer/i);
  });
});

describe('PipelineRunner — write-policy matrix (no UserAuthorizedActionContext)', () => {
  const runner = new PipelineRunner();

  it('Preferences + no evidence → pending_user_confirmation', () => {
    const out = runner.run(baseInput({ nodeId: 'Preferences', evidenceObservationIds: [] }));
    expect(out.result.status).toBe('pending_user_confirmation');
  });

  it('Preferences + evidence referenced → queue_for_review', () => {
    const out = runner.run(baseInput({
      nodeId: 'Preferences',
      evidenceObservationIds: ['obs-1'],
    }));
    expect(out.result.status).toBe('pending_review');
  });

  it('Values (requiresUserConfirmation) + evidence → still pending_user_confirmation', () => {
    const out = runner.run(baseInput({
      nodeId: 'Values',
      proposedBy: { type: 'agent', agentName: 'philos' },
      evidenceObservationIds: ['obs-1'],
    }));
    expect(out.result.status).toBe('pending_user_confirmation');
  });

  it('Psychology (requiresUserConfirmation) → pending_user_confirmation', () => {
    const out = runner.run(baseInput({
      nodeId: 'Psychology',
      proposedBy: { type: 'agent', agentName: 'philos' },
    }));
    expect(out.result.status).toBe('pending_user_confirmation');
  });

  it('Roles + no evidence → pending_user_confirmation (philos, all-layer access)', () => {
    const out = runner.run(baseInput({
      nodeId: 'Roles',
      proposedBy: { type: 'agent', agentName: 'philos' },
    }));
    expect(out.result.status).toBe('pending_user_confirmation');
  });
});

describe('PipelineRunner — UserAuthorizedActionContext → accepted', () => {
  const runner = new PipelineRunner();

  it('Preferences + user auth → accepted', () => {
    const out = runner.run(baseInput({
      nodeId: 'Preferences',
      proposedBy: { type: 'user', actionContext: USER_CTX },
    }));
    expect(out.result.status).toBe('accepted');
  });

  it('Values + user auth → accepted', () => {
    const out = runner.run(baseInput({
      nodeId: 'Values',
      proposedBy: { type: 'user', actionContext: USER_CTX },
    }));
    expect(out.result.status).toBe('accepted');
  });

  it('accepted result has an interpretation with the correct nodeId', () => {
    const out = runner.run(baseInput({ proposedBy: { type: 'user', actionContext: USER_CTX } }));
    expect(out.result.status).toBe('accepted');
    const interp = (out.result as any).interpretation;
    expect(interp.nodeId).toBe('Preferences');
    expect(interp.content).toBe('dark mode');
  });

  it('accepted interpretation has evidenceStatus', () => {
    const out = runner.run(baseInput({ proposedBy: { type: 'user', actionContext: USER_CTX } }));
    const interp = (out.result as any).interpretation;
    expect(['unavailable', 'referenced', 'evaluated']).toContain(interp.evidenceStatus);
  });
});

describe('PipelineRunner — conflict detection', () => {
  const runner = new PipelineRunner();

  it('existing active Preferences interpretation → auto_resolvable, still produces pending result', () => {
    const profile = createEmptyEssenceProfile('p1');
    profile.expression['Preferences'] = [{
      id: 'interp-existing',
      version: 1,
      nodeId: 'Preferences',
      layer: 'expression',
      stabilityClass: 'Adaptive',
      content: 'light mode',
      observationIds: [],
      confidence: 'medium',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'medium',
        createdBy: 'merlin',
        firstObservedAt: new Date().toISOString(),
        lastConfirmedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        evidenceIds: [],
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: [],
      evidenceStatus: 'unavailable',
    }];

    const out = runner.run(baseInput({ nodeId: 'Preferences', currentProfile: profile }));
    // Auto-resolvable conflict does not block
    expect(out.result.status).not.toBe('blocked_by_conflict');
  });

  it('existing active Values interpretation by agent → blocked_by_conflict', () => {
    const profile = createEmptyEssenceProfile('p1');
    profile.core['Values'] = [{
      id: 'interp-values',
      version: 1,
      nodeId: 'Values',
      layer: 'core',
      stabilityClass: 'Foundational',
      content: 'truth above all',
      observationIds: [],
      confidence: 'high',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'high',
        createdBy: 'philos',
        firstObservedAt: new Date().toISOString(),
        lastConfirmedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        evidenceIds: [],
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: [],
      evidenceStatus: 'unavailable',
    }];

    const out = runner.run(baseInput({
      nodeId: 'Values',
      proposedBy: { type: 'agent', agentName: 'philos' },
      proposedContent: 'justice over everything',
      currentProfile: profile,
    }));
    expect(out.result.status).toBe('blocked_by_conflict');
  });

  it('proposeUpdate with user auth still blocks on hard conflict — use correctItem to override', () => {
    // User auth in proposeUpdate changes the write policy to auto_accept but does NOT
    // bypass Stage 5 conflict detection. To override a conflicting interpretation, the
    // caller must use correctItem(), which archives the old interpretation first.
    const profile = createEmptyEssenceProfile('p1');
    profile.core['Values'] = [{
      id: 'interp-values',
      version: 1,
      nodeId: 'Values',
      layer: 'core',
      stabilityClass: 'Foundational',
      content: 'old value',
      observationIds: [],
      confidence: 'high',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'high',
        createdBy: 'philos',
        firstObservedAt: new Date().toISOString(),
        lastConfirmedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        evidenceIds: [],
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: [],
      evidenceStatus: 'unavailable',
    }];

    const out = runner.run(baseInput({
      nodeId: 'Values',
      proposedBy: { type: 'user', actionContext: USER_CTX },
      proposedContent: 'new value',
      currentProfile: profile,
    }));
    // Conflict detection (Stage 5) runs before write policy (Stage 6).
    // The pipeline returns blocked_by_conflict regardless of authContext.
    expect(out.result.status).toBe('blocked_by_conflict');
  });
});

describe('PipelineRunner — stage audit trail', () => {
  const runner = new PipelineRunner();

  it('all 8 stages appear in the output', () => {
    const out = runner.run(baseInput({ proposedBy: { type: 'user', actionContext: USER_CTX } }));
    const stageNames = out.stages.map(s => s.stage);
    const EXPECTED = ['validate', 'classify', 'normalize', 'evaluate_evidence', 'detect_conflict', 'apply_write_policy', 'create_proposal', 'commit'];
    for (const name of EXPECTED) {
      expect(stageNames).toContain(name);
    }
  });

  it('rejected run still produces 8 stage entries', () => {
    const out = runner.run(baseInput({ nodeId: 'DoesNotExist' }));
    expect(out.stages).toHaveLength(8);
  });

  it('successful run has validate: passed', () => {
    const out = runner.run(baseInput({ proposedBy: { type: 'user', actionContext: USER_CTX } }));
    const validate = out.stages.find(s => s.stage === 'validate');
    expect(validate?.outcome).toBe('passed');
  });
});

describe('PipelineRunner — conflict type classification', () => {
  const runner = new PipelineRunner();

  function makeExistingInterpretation(layer: 'core' | 'aspirations' | 'expression' | 'identity', nodeId: string): EssenceProfile {
    const profile = createEmptyEssenceProfile('p1');
    (profile[layer] as Record<string, any[]>)[nodeId] = [{
      id: 'existing-1',
      version: 1,
      nodeId,
      layer,
      stabilityClass: 'Stable',
      content: 'existing content',
      observationIds: [],
      confidence: 'medium',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'medium',
        createdBy: 'philos',
        firstObservedAt: new Date().toISOString(),
        lastConfirmedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        evidenceIds: [],
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: [],
      evidenceStatus: 'unavailable',
    }];
    return profile;
  }

  it('Preferences conflict is auto_resolvable (preference_shift)', () => {
    const profile = makeExistingInterpretation('expression', 'Preferences');
    const out = runner.run(baseInput({
      nodeId: 'Preferences',
      proposedContent: 'different preference',
      currentProfile: profile,
    }));
    expect(out.result.status).not.toBe('blocked_by_conflict');
  });

  it('Identity layer conflict with existing trait → blocked_by_conflict (role_difference)', () => {
    const profile = makeExistingInterpretation('identity', 'Roles');
    const out = runner.run(baseInput({
      nodeId: 'Roles',
      proposedBy: { type: 'agent', agentName: 'philos' }, // philos has write access to identity layer; merlin does not
      proposedContent: 'new role',
      currentProfile: profile,
    }));
    expect(out.result.status).toBe('blocked_by_conflict');
  });
});
