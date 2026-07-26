/**
 * Proposal service — lifecycle, idempotency, expiry, corrections.
 */

import { describe, it, expect } from 'vitest';
import { EssenceProposalService } from '../proposal-service';
import { PipelineRunner } from '../pipeline-runner';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import type { UserAuthorizedActionContext, ProposedUpdate } from '../api';
import type { Clock } from '../pipeline-runner';

const USER_CTX: UserAuthorizedActionContext = {
  actorType: 'user',
  actionId: 'action-1',
  authorizedAt: new Date().toISOString(),
};

function makeClock(ms: number): Clock {
  let current = ms;
  return {
    now: () => current,
    advance(delta: number) { current += delta; },
  } as Clock & { advance: (n: number) => void };
}

function makeService(clockMs?: number) {
  const repo = new InMemoryEssenceRepository();
  const clock = clockMs !== undefined ? makeClock(clockMs) : undefined;
  const runner = new PipelineRunner(clock);
  const svc = new EssenceProposalService(repo, runner, clock);
  return { repo, svc, clock };
}

function baseProposal(overrides: Partial<ProposedUpdate> = {}): ProposedUpdate {
  return {
    nodeId: 'Preferences',
    proposedContent: 'dark mode',
    evidenceObservationIds: [],
    proposedBy: 'merlin',
    proposedAt: new Date().toISOString(),
    rationale: 'user selected dark mode',
    ...overrides,
  };
}

describe('EssenceProposalService — proposeUpdate', () => {
  it('returns rejected for unknown profile', async () => {
    const { svc } = makeService();
    const result = await svc.proposeUpdate('missing-profile', baseProposal(), null);
    expect(result.status).toBe('rejected');
  });

  it('unknown nodeId → rejected without persisting an observation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal({ nodeId: 'NonExistentNode' }), null);
    expect(result.status).toBe('rejected');
    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(0);
  });

  it('empty proposedContent → rejected without persisting an observation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal({ proposedContent: '   ' }), null);
    expect(result.status).toBe('rejected');
    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(0);
  });

  it('agent proposal with no evidence → pending_user_confirmation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    expect(result.status).toBe('pending_user_confirmation');
  });

  it('agent proposal with evidence → pending_review', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: ['obs-1'] }),
      null
    );
    expect(result.status).toBe('pending_review');
  });

  it('pending_user_confirmation result has a confirmationToken', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    expect(result.status).toBe('pending_user_confirmation');
    expect((result as any).confirmationToken).toBeDefined();
  });

  it('proposeUpdate persists a backing observation to the profile', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', baseProposal(), null);

    const profile = await repo.getProfile('u1');
    expect(profile?.observations.length).toBeGreaterThanOrEqual(1);
    expect(profile?.observations[0].source).toBe('agent_inference');
  });

  it('EvidencePackage evidenceIds are merged into the pipeline evidence set', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: [] }),
      {
        evidenceIds: ['ev-from-package'],
        sourceType: 'behavioral_pattern',
        confidenceAsserted: 'high',
        packagedBy: 'merlin',
        packagedAt: new Date().toISOString(),
      }
    );
    // Evidence IDs from the package promote status from unavailable → referenced → pending_review
    expect(result.status).toBe('pending_review');
  });
});

describe('EssenceProposalService — confirmUpdate', () => {
  it('confirms a pending proposal and returns an Interpretation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    expect(result.status).toBe('pending_user_confirmation');

    const token = (result as any).confirmationToken as string;
    const interp = await svc.confirmUpdate('u1', token, USER_CTX);
    expect(interp.nodeId).toBe('Preferences');
    expect(interp.content).toBe('dark mode');
  });

  it('interpretation is written to the profile after confirmation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;
    await svc.confirmUpdate('u1', token, USER_CTX);

    const profile = await repo.getProfile('u1');
    expect(profile?.expression['Preferences']).toHaveLength(1);
  });

  it('confirming twice is idempotent — returns same interpretation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;

    const first = await svc.confirmUpdate('u1', token, USER_CTX);
    const second = await svc.confirmUpdate('u1', token, USER_CTX);
    expect(second.id).toBe(first.id);
  });

  it('throws for unknown confirmation token', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    await expect(svc.confirmUpdate('u1', 'ct_invalid', USER_CTX)).rejects.toThrow(/unknown confirmation token/i);
  });

  it('throws for expired proposal (past 24-hour window)', async () => {
    const clock = makeClock(1000) as Clock & { advance: (n: number) => void };
    const repo = new InMemoryEssenceRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, runner, clock);
    await repo.createProfile('u1');

    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;

    // Advance past the 24-hour expiry window.
    (clock as any).advance(25 * 60 * 60 * 1000);

    await expect(svc.confirmUpdate('u1', token, USER_CTX)).rejects.toThrow(/expired/i);
  });
});

describe('EssenceProposalService — rejectUpdate', () => {
  it('rejects a pending proposal', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;

    const rejection = await svc.rejectUpdate('u1', token, USER_CTX, 'not accurate');
    expect(rejection.rejected).toBe(true);
  });

  it('rejecting twice is idempotent', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;

    await svc.rejectUpdate('u1', token, USER_CTX, 'first rejection');
    const second = await svc.rejectUpdate('u1', token, USER_CTX, 'second rejection');
    expect(second.rejected).toBe(true);
  });

  it('cannot confirm after rejection', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;

    await svc.rejectUpdate('u1', token, USER_CTX, null);
    await expect(svc.confirmUpdate('u1', token, USER_CTX)).rejects.toThrow(/rejected/i);
  });
});

describe('EssenceProposalService — correctItem', () => {
  it('user correction auto-accepts and writes to profile', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');

    const result = await svc.correctItem(
      'u1',
      {
        nodeId: 'Preferences',
        targetInterpretationId: null,
        correctedContent: 'always light mode',
        correctedAt: new Date().toISOString(),
        note: 'I prefer light mode actually',
      },
      USER_CTX,
    );

    expect(result.status).toBe('accepted');
    const profile = await repo.getProfile('u1');
    expect(profile?.expression['Preferences']).toHaveLength(1);
    expect(profile?.expression['Preferences'][0].content).toBe('always light mode');
  });

  it('correction records provenance as user, not as any agent', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');

    await svc.correctItem(
      'u1',
      {
        nodeId: 'Preferences',
        targetInterpretationId: null,
        correctedContent: 'always light mode',
        correctedAt: new Date().toISOString(),
        note: null,
      },
      USER_CTX,
    );

    const profile = await repo.getProfile('u1');
    const interp = profile?.expression['Preferences'][0];
    expect(interp?.provenance.createdBy).toBe('user');
  });

  it('correction persists a user_correction observation', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');

    await svc.correctItem(
      'u1',
      {
        nodeId: 'Preferences',
        targetInterpretationId: null,
        correctedContent: 'always light mode',
        correctedAt: new Date().toISOString(),
        note: null,
      },
      USER_CTX,
    );

    const profile = await repo.getProfile('u1');
    expect(profile?.observations.some(o => o.source === 'user_correction')).toBe(true);
  });

  it('correction archives the targeted interpretation', async () => {
    const { repo, svc } = makeService();
    const profile = await repo.createProfile('u1');
    profile.expression['Preferences'] = [{
      id: 'old-interp',
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
    await repo.saveProfile(profile);

    await svc.correctItem(
      'u1',
      {
        nodeId: 'Preferences',
        targetInterpretationId: 'old-interp',
        correctedContent: 'light mode',
        correctedAt: new Date().toISOString(),
        note: null,
      },
      USER_CTX,
    );

    const updated = await repo.getProfile('u1');
    const old = updated?.expression['Preferences'].find(i => i.id === 'old-interp');
    expect(old?.archivedAt).not.toBeNull();
  });
});

describe('EssenceProposalService — getPendingProposals', () => {
  it('returns pending proposals for the requesting agent', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', baseProposal(), null); // proposedBy: 'merlin'

    const pending = await svc.getPendingProposals('u1', 'merlin');
    expect(pending).toHaveLength(1);
  });

  it('agent cannot see another agent\'s proposals', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', baseProposal(), null); // proposedBy: 'merlin'

    const pending = await svc.getPendingProposals('u1', 'morgana');
    expect(pending).toHaveLength(0);
  });

  it('philos can see all pending proposals', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', baseProposal(), null); // proposedBy: 'merlin'

    const pending = await svc.getPendingProposals('u1', 'philos');
    expect(pending).toHaveLength(1);
  });

  it('confirmed proposals are not returned', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    const token = (result as any).confirmationToken as string;
    await svc.confirmUpdate('u1', token, USER_CTX);

    const pending = await svc.getPendingProposals('u1', 'merlin');
    expect(pending).toHaveLength(0);
  });

  it('expired proposals are marked expired and not returned', async () => {
    const clock = makeClock(1000) as Clock & { advance: (n: number) => void };
    const repo = new InMemoryEssenceRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, runner, clock);
    await repo.createProfile('u1');

    await svc.proposeUpdate('u1', baseProposal(), null);
    // Advance past the 24-hour expiry window.
    (clock as any).advance(25 * 60 * 60 * 1000);

    const pending = await svc.getPendingProposals('u1', 'merlin');
    expect(pending).toHaveLength(0);
  });
});

describe('EssenceProposalService — conflict persistence', () => {
  it('blocked_by_conflict persists a conflict record to the profile', async () => {
    const { repo, svc } = makeService();
    const profile = await repo.createProfile('u1');

    // Seed an existing interpretation that will cause a blocking conflict.
    profile.core['Values'] = [{
      id: 'existing-values',
      version: 1,
      nodeId: 'Values',
      layer: 'core',
      stabilityClass: 'Foundational',
      content: 'honesty',
      observationIds: [],
      confidence: 'high',
      interpretationKind: 'observed_pattern',
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
    await repo.saveProfile(profile);

    const result = await svc.proposeUpdate(
      'u1',
      {
        nodeId: 'Values',
        proposedContent: 'something different',
        evidenceObservationIds: [],
        proposedBy: 'philos',
        proposedAt: new Date().toISOString(),
        rationale: 'test conflict',
      },
      null
    );

    expect(result.status).toBe('blocked_by_conflict');

    const updated = await repo.getProfile('u1');
    expect(updated?.conflicts.length).toBeGreaterThanOrEqual(1);
  });
});
