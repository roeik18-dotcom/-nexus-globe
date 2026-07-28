/**
 * M0-5B — Orientation write path
 *
 * Verifies the single-valued invariant: each orientation node has at most one
 * active (non-archived) Interpretation after any write completes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EssenceProposalService } from '../proposal-service';
import { EssenceReadService } from '../read-service';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { InMemoryEssenceProposalRepository } from '../in-memory-proposal-repository';
import { PipelineRunner } from '../pipeline-runner';
import type { EssencePipeline, PipelineRunnerInput, PipelineRunnerOutput } from '../pipeline-runner';
import type { Interpretation } from '../schema';
import type { UserAuthorizedActionContext } from '../actor';
import type { UserCorrection } from '../api';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const userCtx: UserAuthorizedActionContext = {
  actorType: 'user',
  actionId: 'test-action-1',
  authorizedAt: '2026-07-26T00:00:00.000Z',
};

function correction(
  nodeId: string,
  correctedContent: string,
  targetInterpretationId: string | null = null,
): UserCorrection {
  return {
    nodeId,
    targetInterpretationId,
    correctedContent,
    correctedAt: '2026-07-26T00:00:00.000Z',
    note: null,
  };
}

function makeInterpretation(id: string, nodeId: string, content: string): Interpretation {
  const now = '2026-07-26T00:00:00.000Z';
  return {
    id,
    version: 1,
    nodeId,
    layer: 'expression',
    stabilityClass: 'Adaptive',
    content,
    observationIds: [],
    confidence: 'high',
    interpretationKind: 'probable_interpretation',
    provenance: {
      source: 'agent_inference',
      confidence: 'high',
      createdBy: 'merlin',
      firstObservedAt: now,
      lastConfirmedAt: now,
      lastUpdatedAt: now,
      evidenceIds: [],
      conflictingInterpretationIds: [],
    },
    sensitivity: 'personal',
    temporalKind: 'trait',
    stateScope: null,
    expiresAt: null,
    archivedAt: null,
    conflictIds: [],
    evidenceStatus: 'referenced',
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('orientation write path — single-valued invariant', () => {
  let repo: InMemoryEssenceRepository;
  let svc: EssenceProposalService;

  beforeEach(async () => {
    repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    svc = new EssenceProposalService(repo, new InMemoryEssenceProposalRepository(), new PipelineRunner());
  });

  it('correctItem with valid value creates one active interpretation', async () => {
    const result = await svc.correctItem('u1', correction('OrientationResponseDepth', 'brief'), userCtx);

    expect(result.status).toBe('accepted');

    const profile = await repo.getProfile('u1');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).filter(i => !i.archivedAt);
    expect(active).toHaveLength(1);
    expect(active[0].content).toBe('brief');
  });

  it('second write archives the first — single-valued invariant', async () => {
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'brief'), userCtx);
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'explanatory'), userCtx);

    const profile = await repo.getProfile('u1');
    const all = profile!.expression['OrientationResponseDepth'] ?? [];
    const active = all.filter(i => !i.archivedAt);
    const archived = all.filter(i => i.archivedAt);

    expect(active).toHaveLength(1);
    expect(active[0].content).toBe('explanatory');
    expect(archived).toHaveLength(1);
    expect(archived[0].content).toBe('brief');
  });

  it('multiple pre-existing active interpretations are all archived on write', async () => {
    // Build two prior active interpretations via the API so they are in the timeline.
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'brief'), userCtx);
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'balanced'), userCtx);

    // A third write must archive both previous actives.
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'explanatory'), userCtx);

    const updated = await repo.getProfile('u1');
    const all = updated!.expression['OrientationResponseDepth'] ?? [];
    expect(all.filter(i => i.archivedAt)).toHaveLength(2);
    expect(all.filter(i => !i.archivedAt)).toHaveLength(1);
    expect(all.find(i => !i.archivedAt)?.content).toBe('explanatory');
  });

  it('invalid value for orientation node is rejected — no interpretation written', async () => {
    const result = await svc.correctItem('u1', correction('OrientationResponseDepth', 'verbose'), userCtx);

    expect(result.status).toBe('rejected');

    const profile = await repo.getProfile('u1');
    expect(profile!.expression['OrientationResponseDepth']).toBeUndefined();
  });

  it('proposeUpdate with an existing active orientation is not blocked by conflict', async () => {
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'brief'), userCtx);

    const profile = await repo.getProfile('u1');
    const evidenceObsId = profile!.observations[0].id;

    const result = await svc.proposeUpdate(
      'u1',
      {
        nodeId: 'OrientationResponseDepth',
        proposedContent: 'explanatory',
        proposedBy: 'merlin',
        proposedAt: '2026-07-26T00:00:00.000Z',
        evidenceObservationIds: [evidenceObsId],
        rationale: 'user signalled this in conversation',
      },
      null,
    );

    expect(result.status).not.toBe('blocked_by_conflict');
    expect(result.status).toBe('pending_review');
  });

  it('confirmUpdate archives existing active interpretation and writes the new one', async () => {
    await svc.correctItem('u1', correction('OrientationResponseDepth', 'brief'), userCtx);

    const propResult = await svc.proposeUpdate(
      'u1',
      {
        nodeId: 'OrientationResponseDepth',
        proposedContent: 'explanatory',
        proposedBy: 'merlin',
        proposedAt: '2026-07-26T00:00:00.000Z',
        evidenceObservationIds: [],
        rationale: 'observed preference shift',
      },
      null,
    );
    expect(propResult.status).toBe('pending_user_confirmation');
    const { confirmationToken } = propResult as Extract<typeof propResult, { status: 'pending_user_confirmation' }>;

    const interp = await svc.confirmUpdate('u1', confirmationToken, userCtx);
    expect(interp.content).toBe('explanatory');

    const profile = await repo.getProfile('u1');
    const all = profile!.expression['OrientationResponseDepth'] ?? [];
    const active = all.filter(i => !i.archivedAt);
    const archived = all.filter(i => i.archivedAt);

    expect(active).toHaveLength(1);
    expect(active[0].content).toBe('explanatory');
    expect(archived.length).toBeGreaterThanOrEqual(1);
    expect(archived.some(i => i.content === 'brief')).toBe(true);
  });

  it('non-orientation node is not subject to replace_single_value — both writes remain active', async () => {
    await svc.correctItem('u1', correction('Preferences', 'dark mode'), userCtx);
    await svc.correctItem('u1', correction('Preferences', 'compact layout'), userCtx);

    const profile = await repo.getProfile('u1');
    const active = (profile!.expression['Preferences'] ?? []).filter(i => !i.archivedAt);
    expect(active).toHaveLength(2);
  });

  it('full write→read cycle: written orientation node appears in essence summary', async () => {
    await svc.correctItem('u1', correction('OrientationCommunicationStyle', 'direct'), userCtx);

    const readSvc = new EssenceReadService(repo.asReadRepository());
    const summary = await readSvc.getEssenceSummary('u1', 'task_relevant', 'merlin');

    expect(summary.nodes['OrientationCommunicationStyle']?.content).toBe('direct');
    expect(summary.nodes['OrientationCommunicationStyle']?.layer).toBe('expression');
  });

  it('replace_single_value write disposition on a non-orientation node throws', async () => {
    const now = '2026-07-26T00:00:00.000Z';

    const fakePipeline: EssencePipeline = {
      run(_input: PipelineRunnerInput): PipelineRunnerOutput {
        return {
          result: {
            status: 'accepted',
            interpretation: {
              id: 'fake-interp',
              version: 1,
              nodeId: 'Preferences',
              layer: 'expression',
              stabilityClass: 'Adaptive',
              content: 'dark mode',
              observationIds: [],
              confidence: 'verified',
              interpretationKind: 'user_confirmed_understanding',
              provenance: {
                source: 'user_correction',
                confidence: 'verified',
                createdBy: 'user',
                firstObservedAt: now,
                lastConfirmedAt: now,
                lastUpdatedAt: now,
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
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            writePolicy: null as any,
            writeDisposition: 'replace_single_value',
            completedAt: now,
          },
          stages: [],
          detectedConflicts: [],
        };
      },
    };

    const badSvc = new EssenceProposalService(repo, new InMemoryEssenceProposalRepository(), fakePipeline);
    await expect(
      badSvc.correctItem('u1', correction('Preferences', 'dark mode'), userCtx),
    ).rejects.toThrow("replace_single_value is only valid for orientation nodes; got 'Preferences'");
  });
});
