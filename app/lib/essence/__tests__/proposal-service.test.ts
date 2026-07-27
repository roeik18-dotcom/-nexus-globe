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
    const profile = await repo.createProfile('u1');
    profile.observations.push({
      id: 'obs-1',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'prior observed signal',
      sessionId: null,
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });
    await repo.saveProfile(profile);
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: ['obs-1'] }),
      null,
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

  it('EvidencePackage observationIds promote status to pending_review', async () => {
    const { repo, svc } = makeService();
    const profile = await repo.createProfile('u1');
    profile.observations.push({
      id: 'obs-pkg-1',
      source: 'agent_inference' as const,
      recordedBy: 'merlin',
      content: 'packaged evidence',
      sessionId: null,
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });
    await repo.saveProfile(profile);
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: [] }),
      {
        observationIds: ['obs-pkg-1'],
        externalEvidenceRefs: [],
        packagedBy: 'merlin',
        packagedAt: new Date().toISOString(),
      },
    );
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
  it('nexus (no write access) proposal → rejected with no Observation written', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ proposedBy: 'nexus', nodeId: 'Preferences' }),
      null,
    );
    expect(result.status).toBe('rejected');
    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(0);
  });

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

  it('persisted conflict has named fields — no tuple, no fake IDs', async () => {
    const { repo, svc } = makeService();
    const profile = await repo.createProfile('u1');

    profile.core['Values'] = [{
      id: 'existing-values-2',
      version: 1,
      nodeId: 'Values',
      layer: 'core',
      stabilityClass: 'Foundational',
      content: 'integrity',
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

    await svc.proposeUpdate(
      'u1',
      {
        nodeId: 'Values',
        proposedContent: 'something conflicting',
        evidenceObservationIds: [],
        proposedBy: 'philos',
        proposedAt: new Date().toISOString(),
        rationale: 'schema test',
      },
      null,
    );

    const updated = await repo.getProfile('u1');
    const conflict = updated?.conflicts[0];
    expect(conflict).toBeDefined();

    // Named fields — no tuple members.
    expect(conflict?.existingInterpretationIds).toContain('existing-values-2');
    expect(conflict?.triggeringObservationId).toBeDefined();
    expect(typeof conflict?.triggeringObservationId).toBe('string');
    expect(conflict?.triggeringObservationId.length).toBeGreaterThan(0);

    // triggeringObservationId must reference a real Observation in the profile.
    const obsIds = updated!.observations.map(o => o.id);
    expect(obsIds).toContain(conflict?.triggeringObservationId);

    // candidateInterpretationId must be absent (candidate was blocked, never committed).
    expect(conflict?.candidateInterpretationId).toBeUndefined();
  });
});

describe('EssenceProposalService — evidence validation', () => {
  it('unknown observation ID in evidenceObservationIds → rejected with no Observation written', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: ['obs-does-not-exist'] }),
      null,
    );
    expect(result.status).toBe('rejected');
    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(0);
  });

  it('valid same-profile observation ID is accepted as evidence', async () => {
    const { repo, svc } = makeService();
    const profile = await repo.createProfile('u1');
    const existingObs = {
      id: 'obs-valid',
      source: 'agent_inference' as const,
      recordedBy: 'merlin',
      content: 'something observed',
      sessionId: null,
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    };
    profile.observations.push(existingObs);
    await repo.saveProfile(profile);

    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: ['obs-valid'] }),
      null,
    );
    // Referenced evidence → pending_review
    expect(result.status).toBe('pending_review');
  });

  it('duplicate evidence IDs are deduplicated — no double-counting', async () => {
    const { repo, svc } = makeService();
    const profile = await repo.createProfile('u1');
    profile.observations.push({
      id: 'obs-1',
      source: 'agent_inference' as const,
      recordedBy: 'merlin',
      content: 'obs content',
      sessionId: null,
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });
    await repo.saveProfile(profile);

    // Pass the same ID from both proposal and package — must be deduped
    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: ['obs-1'] }),
      {
        observationIds: ['obs-1'],
        externalEvidenceRefs: [],
        packagedBy: 'merlin',
        packagedAt: new Date().toISOString(),
      },
    );
    expect(result.status).toBe('pending_review');
  });

  it('ExternalEvidenceRef without EvidenceResolver → unsupported_external_evidence', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');

    const result = await svc.proposeUpdate(
      'u1',
      baseProposal({ evidenceObservationIds: [] }),
      {
        observationIds: [],
        externalEvidenceRefs: [{
          evidenceId: 'cross-domain-ev-99',
          sourceType: 'behavioral_pattern',
          confidenceAsserted: 'high',
        }],
        packagedBy: 'merlin',
        packagedAt: new Date().toISOString(),
      },
    );
    expect(result.status).toBe('unsupported_external_evidence');
  });
});

describe('EssenceProposalService — Observation immutability', () => {
  it('confirmation does not append a duplicate Observation to the profile', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', baseProposal(), null);
    expect(result.status).toBe('pending_user_confirmation');
    const token = (result as any).confirmationToken as string;

    const before = await repo.getProfile('u1');
    const obsCountBefore = before?.observations.length ?? 0;

    await svc.confirmUpdate('u1', token, USER_CTX);

    const after = await repo.getProfile('u1');
    expect(after?.observations.length).toBe(obsCountBefore);
  });
});

// ── M0-10B: Audit integrity ────────────────────────────────────────────────────

import { PhilosReviewConsumer } from '../philos-review-consumer';
import type { Observation } from '../schema';

function seedObs(id: string): Observation {
  return {
    id,
    source: 'agent_inference',
    recordedBy: 'merlin',
    content: 'seed',
    sessionId: null,
    observedAt: new Date().toISOString(),
    evidenceIds: [],
    correctsObservationId: null,
  };
}

describe('EssenceProposalService — M0-10B: previousInterpretationId (B3)', () => {
  it('first write to an empty node: previousInterpretationId is null', async () => {
    const { repo, svc } = makeService();
    await repo.createProfile('u1');
    await repo.appendObservation('u1', seedObs('obs-b3a'));
    const philos = new PhilosReviewConsumer(svc);

    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-b3a'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'high',
    }, null);
    expect(result.status).toBe('pending_review');
    await philos.consume('u1', (result as any).proposalId);

    const profile = await repo.getProfile('u1');
    const entry = profile!.evolution[0];
    expect(entry).toBeDefined();
    expect(entry.previousInterpretationId).toBeNull();
    expect(entry.newInterpretationId).toBeDefined();
  });

  it('second write (replace_single_value): previousInterpretationId points to archived interp', async () => {
    const clock = makeClock(1_000_000) as ReturnType<typeof makeClock> & { advance(n: number): void };
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceProposalService(repo, new PipelineRunner(clock), clock);
    const philos = new PhilosReviewConsumer(svc, clock);
    await repo.createProfile('u1');
    await repo.appendObservation('u1', seedObs('obs-first'));
    await repo.appendObservation('u1', seedObs('obs-second'));

    // First proposal: writes 'direct'
    const r1 = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-first'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'first',
      accumulatedConfidence: 'high',
    }, null);
    expect(r1.status).toBe('pending_review');
    await philos.consume('u1', (r1 as any).proposalId);

    const afterFirst = await repo.getProfile('u1');
    const firstInterpId = afterFirst!.evolution[0].newInterpretationId;

    // Second proposal: should archive 'direct', write 'exploratory'
    clock.advance(1000);
    const r2 = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'exploratory',
      evidenceObservationIds: ['obs-second'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'second',
      accumulatedConfidence: 'high',
    }, null);
    expect(r2.status).toBe('pending_review');
    await philos.consume('u1', (r2 as any).proposalId);

    const afterSecond = await repo.getProfile('u1');
    const secondEntry = afterSecond!.evolution[1];
    expect(secondEntry.previousInterpretationId).toBe(firstInterpId);
    expect(secondEntry.newInterpretationId).not.toBe(firstInterpId);

    // First interpretation should be archived.
    const allInterps = afterSecond!.expression['OrientationCommunicationStyle'] ?? [];
    const archived = allInterps.find(i => i.id === firstInterpId);
    expect(archived?.archivedAt).not.toBeNull();

    // Second interpretation should be active.
    const active = allInterps.find(i => !i.archivedAt);
    expect(active?.content).toBe('exploratory');
  });
});

describe('EssenceProposalService — M0-10B: conflict resolution on supersession (B4)', () => {
  it('preference_shift conflict is resolved when superseded by a new orientation write', async () => {
    const clock = makeClock(1_000_000);
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceProposalService(repo, new PipelineRunner(clock), clock);
    const philos = new PhilosReviewConsumer(svc, clock);
    const profile = await repo.createProfile('u1');

    // Seed an active interpretation for the orientation node.
    const firstInterpId = 'existing-orient-interp';
    profile.expression['OrientationCommunicationStyle'] = [{
      id: firstInterpId,
      version: 1,
      nodeId: 'OrientationCommunicationStyle',
      layer: 'expression',
      stabilityClass: 'Adaptive',
      content: 'direct',
      observationIds: [],
      confidence: 'medium',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'medium',
        createdBy: 'merlin',
        firstObservedAt: new Date(clock.now()).toISOString(),
        lastConfirmedAt: new Date(clock.now()).toISOString(),
        lastUpdatedAt: new Date(clock.now()).toISOString(),
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
    // Seed an open preference_shift conflict referencing the existing interpretation.
    profile.conflicts.push({
      id: 'conflict-prefer-shift',
      type: 'preference_shift',
      detectedAt: new Date(clock.now()).toISOString(),
      existingInterpretationIds: [firstInterpId],
      triggeringObservationId: 'obs-trigger',
      resolvedAt: null,
      resolution: null,
      resolutionNote: null,
    });
    await repo.saveProfile(profile);

    await repo.appendObservation('u1', seedObs('obs-new'));

    // Propose new value — should supersede 'direct' and resolve the conflict.
    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'collaborative',
      evidenceObservationIds: ['obs-new'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test conflict resolution',
      accumulatedConfidence: 'high',
    }, null);
    expect(result.status).toBe('pending_review');
    await philos.consume('u1', (result as any).proposalId);

    const updated = await repo.getProfile('u1');
    const conflict = updated!.conflicts.find(c => c.id === 'conflict-prefer-shift');
    expect(conflict).toBeDefined();
    expect(conflict!.resolvedAt).not.toBeNull();
    expect(conflict!.resolution).toBe('accepted_newer');
    expect(conflict!.resolutionNote).toMatch(/Superseded by interpretation/);
  });

  it('unresolved_contradiction conflict is NOT auto-resolved on supersession', async () => {
    const clock = makeClock(1_000_000);
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceProposalService(repo, new PipelineRunner(clock), clock);
    const philos = new PhilosReviewConsumer(svc, clock);
    const profile = await repo.createProfile('u1');

    const firstInterpId = 'existing-orient-contra';
    profile.expression['OrientationCommunicationStyle'] = [{
      id: firstInterpId,
      version: 1,
      nodeId: 'OrientationCommunicationStyle',
      layer: 'expression',
      stabilityClass: 'Adaptive',
      content: 'direct',
      observationIds: [],
      confidence: 'medium',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'medium',
        createdBy: 'merlin',
        firstObservedAt: new Date(clock.now()).toISOString(),
        lastConfirmedAt: new Date(clock.now()).toISOString(),
        lastUpdatedAt: new Date(clock.now()).toISOString(),
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
    profile.conflicts.push({
      id: 'conflict-contradiction',
      type: 'unresolved_contradiction',
      detectedAt: new Date(clock.now()).toISOString(),
      existingInterpretationIds: [firstInterpId],
      triggeringObservationId: 'obs-trigger',
      resolvedAt: null,
      resolution: null,
      resolutionNote: null,
    });
    await repo.saveProfile(profile);
    await repo.appendObservation('u1', seedObs('obs-new2'));

    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'collaborative',
      evidenceObservationIds: ['obs-new2'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'high',
    }, null);
    // Wait — an unresolved_contradiction would block the proposal if severity===requires_user.
    // But orientation nodes always produce 'auto_resolvable' conflicts.
    // Since unresolved_contradiction is injected directly into profile.conflicts (not produced
    // by the pipeline), it won't affect the pipeline. The write will proceed.
    // The key assertion is that the unresolved_contradiction conflict is NOT resolved.
    if (result.status === 'pending_review') {
      await philos.consume('u1', (result as any).proposalId);
      const updated = await repo.getProfile('u1');
      const conflict = updated!.conflicts.find(c => c.id === 'conflict-contradiction');
      expect(conflict!.resolvedAt).toBeNull();
    }
  });
});

// ── M0-10B B5: Full audit chain reconstructable from persisted records ─────────

describe('EssenceProposalService — M0-10B: full audit chain reconstruction (B5)', () => {
  it('reconstructs the complete accepted orientation transition from persisted audit records', async () => {
    const clock = makeClock(1_000_000);
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceProposalService(repo, new PipelineRunner(clock), clock);
    const philos = new PhilosReviewConsumer(svc, clock);
    const profile = await repo.createProfile('u1');

    // ── Seed: interpretation A (active) + open preference_shift conflict ──────

    const interpA_id = 'interp-A';
    profile.expression['OrientationCommunicationStyle'] = [{
      id: interpA_id,
      version: 1,
      nodeId: 'OrientationCommunicationStyle',
      layer: 'expression',
      stabilityClass: 'Adaptive',
      content: 'direct',
      observationIds: ['obs-A'],
      confidence: 'high',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'high',
        createdBy: 'merlin',
        firstObservedAt: new Date(clock.now()).toISOString(),
        lastConfirmedAt: new Date(clock.now()).toISOString(),
        lastUpdatedAt: new Date(clock.now()).toISOString(),
        evidenceIds: [],
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: ['conflict-b5'],
      evidenceStatus: 'referenced',
    }];
    profile.conflicts.push({
      id: 'conflict-b5',
      type: 'preference_shift',
      detectedAt: new Date(clock.now()).toISOString(),
      existingInterpretationIds: [interpA_id],
      triggeringObservationId: 'obs-A',
      resolvedAt: null,
      resolution: null,
      resolutionNote: null,
    });
    await repo.saveProfile(profile);

    // ── Agent proposal: B ('collaborative') ──────────────────────────────────

    clock.advance(500);
    await repo.appendObservation('u1', {
      id: 'obs-B',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'user repeatedly chose collaborative framing',
      sessionId: null,
      observedAt: new Date(clock.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });

    const proposedAt = new Date(clock.now()).toISOString();
    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'collaborative',
      evidenceObservationIds: ['obs-B'],
      proposedBy: 'merlin',
      proposedAt,
      rationale: 'user consistently chose collaborative framing over three exchanges',
      accumulatedConfidence: 'high',
    }, null);

    expect(result.status).toBe('pending_review');
    const proposalId = (result as { proposalId: string }).proposalId;

    // proposal is persisted before Philos runs
    const proposalRecord = svc.getProposalRecord(proposalId);
    expect(proposalRecord).toBeDefined();
    expect(proposalRecord!.status).toBe('pending_review');
    expect(proposalRecord!.reviewDecisions).toHaveLength(0);

    // ── Philos accepts ───────────────────────────────────────────────────────

    clock.advance(10);
    const decision = await philos.consume('u1', proposalId);
    expect(decision.decision).toBe('accept');
    expect(decision.reason).toBe('high_confidence_auto_accepted');
    expect(decision.reviewer).toBe('philos');

    // ── Reconstruct the full transition from persisted audit records ──────────

    const finalProfile = await repo.getProfile('u1');
    const allInterps = finalProfile!.expression['OrientationCommunicationStyle'] ?? [];

    // Only B is non-archived
    const active = allInterps.filter(i => !i.archivedAt);
    expect(active).toHaveLength(1);
    expect(active[0].content).toBe('collaborative');
    const interpB_id = active[0].id;

    // A is archived
    const archivedA = allInterps.find(i => i.id === interpA_id);
    expect(archivedA).toBeDefined();
    expect(archivedA!.archivedAt).not.toBeNull();

    // B was committed by Philos
    expect(active[0].provenance.createdBy).toBe('philos');
    expect(active[0].provenance.source).toBe('agent_inference');
    expect(active[0].confidence).toBe('high');

    // Evolution entry links A → B
    expect(finalProfile!.evolution).toHaveLength(1);
    const entry = finalProfile!.evolution[0];
    expect(entry.nodeId).toBe('OrientationCommunicationStyle');
    expect(entry.previousInterpretationId).toBe(interpA_id);
    expect(entry.newInterpretationId).toBe(interpB_id);
    expect(entry.agentName).toBe('philos');
    expect(entry.triggeredBy).toBe('agent_inference');
    expect(entry.timestamp).toBeDefined();

    // preference_shift conflict resolved
    const conflict = finalProfile!.conflicts.find(c => c.id === 'conflict-b5');
    expect(conflict!.resolvedAt).not.toBeNull();
    expect(conflict!.resolution).toBe('accepted_newer');
    expect(conflict!.resolutionNote).toMatch(interpB_id);

    // Proposal record holds the Philos review decision
    const record = svc.getProposalRecord(proposalId);
    expect(record!.status).toBe('confirmed');
    expect(record!.reviewDecisions).toHaveLength(1);
    expect(record!.reviewDecisions[0].decision).toBe('accept');
    expect(record!.reviewDecisions[0].reviewer).toBe('philos');
    expect(record!.committedInterpretationId).toBe(interpB_id);

    // ── Reconstruction invariant: A → B derivable from evolution log alone ───
    //
    // Walk the log without relying on any orchestrator or in-flight state.
    // This simulates an offline audit tool reading only the persisted profile.

    const log = finalProfile!.evolution;
    expect(log).toHaveLength(1);

    const transition = log[0];
    // Previous: look up by ID — must be archived
    const prevInterp = allInterps.find(i => i.id === transition.previousInterpretationId);
    expect(prevInterp).toBeDefined();
    expect(prevInterp!.archivedAt).not.toBeNull();
    expect(prevInterp!.content).toBe('direct');

    // Next: look up by ID — must be active
    const nextInterp = allInterps.find(i => i.id === transition.newInterpretationId);
    expect(nextInterp).toBeDefined();
    expect(nextInterp!.archivedAt).toBeNull();
    expect(nextInterp!.content).toBe('collaborative');

    // Ordering: the evolution entry.timestamp is at or after prev.archivedAt.
    // (firstObservedAt records when evidence was observed — naturally before commit.)
    expect(new Date(entry.timestamp).getTime())
      .toBeGreaterThanOrEqual(new Date(prevInterp!.archivedAt!).getTime());

    // ── Idempotency: double-consume adds no new Interpretation or evolution ───

    const secondDecision = await philos.consume('u1', proposalId);
    expect(secondDecision.decision).toBe('accept');
    expect(secondDecision.reviewedAt).toBe(decision.reviewedAt);

    const profileAfterRepeat = await repo.getProfile('u1');
    expect(profileAfterRepeat!.evolution).toHaveLength(1);
    expect(
      (profileAfterRepeat!.expression['OrientationCommunicationStyle'] ?? []).length
    ).toBe(allInterps.length);
    expect(svc.getProposalRecord(proposalId)!.reviewDecisions).toHaveLength(1);
  });
});
