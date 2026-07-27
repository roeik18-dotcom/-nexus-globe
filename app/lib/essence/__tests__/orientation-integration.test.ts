/**
 * Integration: InMemoryEssenceRepository → EssenceReadService.getEssenceSummary
 * verifies that orientation nodes saved in a profile survive the full read path
 * and appear in the summary with correct field values.
 *
 * Also covers A10 (M0-10A): Merlin inference → accumulate → propose →
 * Philos accept → Interpretation in profile.
 *
 * This test does NOT require a Next.js server or HTTP layer.
 * The Python renderer's behavior is covered separately in test_essence_context_orientation.py.
 */

import { describe, it, expect } from 'vitest';
import { EssenceReadService } from '../read-service';
import { EssenceProposalService } from '../proposal-service';
import { PipelineRunner } from '../pipeline-runner';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import type { Observation } from '../schema';
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

// ── A10: End-to-end write path ─────────────────────────────────────────────────

describe('M0-10A — end-to-end write path (A10)', () => {
  function seedObservation(id: string): Observation {
    return {
      id,
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'exchange content',
      sessionId: null,
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    };
  }

  it('Merlin inference → proposeUpdate → Philos accept → Interpretation in profile', async () => {
    const repo = new InMemoryEssenceRepository();
    const runner = new PipelineRunner();
    const svc = new EssenceProposalService(repo, runner);
    const philos = new PhilosReviewConsumer(svc);
    const readSvc = new EssenceReadService(repo.asReadRepository());

    await repo.createProfile('u1');
    // Seed an observation to serve as evidence (M0-8C: write before inference).
    await repo.appendObservation('u1', seedObservation('obs-exchange-1'));

    // Step 1: Agent proposes (simulating the orchestrator proposeUpdate call).
    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-exchange-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'user asked for detailed explanations twice',
      accumulatedConfidence: 'high',
    }, null);

    expect(result.status).toBe('pending_review');
    const proposalId = (result as { proposalId: string }).proposalId;

    // Step 2: Philos reviews and accepts.
    const decision = await philos.consume('u1', proposalId);
    expect(decision.decision).toBe('accept');
    expect(decision.reason).toBe('high_confidence_auto_accepted');
    expect(decision.reviewer).toBe('philos');

    // Step 3: Interpretation is now in the profile.
    const profile = await repo.getProfile('u1');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).find(i => !i.archivedAt);
    expect(active).toBeDefined();
    expect(active!.content).toBe('explanatory');
    expect(active!.confidence).toBe('high');
    expect(active!.provenance.createdBy).toBe('philos');
    expect(active!.provenance.source).toBe('agent_inference');

    // Step 4: Interpretation appears in the read summary.
    const summary = await readSvc.getEssenceSummary('u1', 'task_relevant', 'merlin');
    expect(summary.nodes['OrientationResponseDepth']?.content).toBe('explanatory');

    // Step 5: Evolution log is complete and traceable.
    expect(profile!.evolution).toHaveLength(1);
    const entry = profile!.evolution[0];
    expect(entry.newInterpretationId).toBe(active!.id);
    expect(entry.agentName).toBe('philos');
    expect(entry.triggeredBy).toBe('agent_inference');
  });

  it('Philos reject: Interpretation NOT written to profile', async () => {
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceProposalService(repo, new PipelineRunner());
    const philos = new PhilosReviewConsumer(svc);

    await repo.createProfile('u1');
    await repo.appendObservation('u1', seedObservation('obs-reject-1'));

    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-reject-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'speculative',
    }, null);
    expect(result.status).toBe('pending_review');

    const decision = await philos.consume('u1', (result as any).proposalId);
    expect(decision.decision).toBe('reject');

    const profile = await repo.getProfile('u1');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).find(i => !i.archivedAt);
    expect(active).toBeUndefined();
    expect(profile!.evolution).toHaveLength(0);
  });

  it('Philos require_user_confirmation: proposal moves to pending_user_confirmation', async () => {
    const repo = new InMemoryEssenceRepository();
    const svc = new EssenceProposalService(repo, new PipelineRunner());
    const philos = new PhilosReviewConsumer(svc);

    await repo.createProfile('u1');
    await repo.appendObservation('u1', seedObservation('obs-low-1'));

    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-low-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'low',
    }, null);
    expect(result.status).toBe('pending_review');
    const proposalId = (result as any).proposalId;

    const decision = await philos.consume('u1', proposalId);
    expect(decision.decision).toBe('require_user_confirmation');

    // Proposal is now in pending_user_confirmation — visible to merlin via getPendingProposals.
    const pending = await svc.getPendingProposals('u1', 'merlin');
    expect(pending.some(p => p.proposalId === proposalId && p.status === 'pending_user_confirmation')).toBe(true);

    // Profile has no Interpretation yet.
    const profile = await repo.getProfile('u1');
    expect((profile!.expression['OrientationResponseDepth'] ?? []).length).toBe(0);
  });
});
