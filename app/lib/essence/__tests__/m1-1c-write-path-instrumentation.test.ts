/**
 * M1-1C — Write-Path Instrumentation
 *
 * Covers:
 *   C1  Each of the 7 event types emitted from the correct trigger
 *   C2  Deterministic event ordering within each workflow
 *   C3  Correlation IDs (proposalId, interpretationId, observationId, causationEventId)
 *   C4  FS durability — events survive after a new repository instance
 *   C5  Failure policy — timeline append failure fails the business operation
 *
 * Architecture decision encoded in tests:
 *   - Timeline append failure MUST propagate — no silent swallow.
 *   - For the Philos accept path, interpretation_committed fires BEFORE review_decided
 *     (effects-first ordering within applyAndCommit).
 *   - For reject/require_user_confirmation, review_decided fires before the secondary event,
 *     and the secondary event carries causationEventId pointing to review_decided.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { EssenceRecoveryRunner } from '../recovery-runner';
import { PipelineRunner } from '../pipeline-runner';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { InMemoryEssenceProposalRepository } from '../in-memory-proposal-repository';
import { InMemoryEssenceTimelineRepository } from '../in-memory-timeline-repository';
import { FileSystemEssenceTimelineRepository } from '../../essence-timeline-fs-repository';
import type { EssenceTimelineRepository } from '../api';
import type { Clock } from '../pipeline-runner';
import type { ConfidenceLevel } from '../schema';
import type { UserAuthorizedActionContext } from '../api';
import type { PendingEssenceProposal } from '../api';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const USER_CTX: UserAuthorizedActionContext = {
  actorType: 'user',
  actionId: 'test-action',
  authorizedAt: '2026-07-28T10:00:00.000Z',
};

function makeClock(ms = 1_000_000): Clock & { advance(n: number): void } {
  let t = ms;
  return { now: () => t, advance(n) { t += n; } };
}

/**
 * Set up a full stack with a pending_review proposal already in the store.
 * Returns the timeline so tests can inspect all emitted events.
 */
async function setupPendingReview(confidence: ConfidenceLevel | null = 'high', extraTimeline?: InMemoryEssenceTimelineRepository) {
  const timeline = extraTimeline ?? new InMemoryEssenceTimelineRepository();
  const clock = makeClock();
  const repo = new InMemoryEssenceRepository();
  const proposalRepo = new InMemoryEssenceProposalRepository();
  const runner = new PipelineRunner(clock);
  const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);
  const philos = new PhilosReviewConsumer(svc, clock, timeline);

  await repo.createProfile('u1');
  await repo.appendObservation('u1', {
    id: 'obs-seed',
    source: 'agent_inference',
    recordedBy: 'merlin',
    content: 'seed',
    sessionId: null,
    observedAt: new Date(clock.now()).toISOString(),
    evidenceIds: [],
    correctsObservationId: null,
  });

  const result = await svc.proposeUpdate('u1', {
    nodeId: 'OrientationCommunicationStyle',
    proposedContent: 'direct',
    evidenceObservationIds: ['obs-seed'],
    proposedBy: 'merlin',
    proposedAt: new Date(clock.now()).toISOString(),
    rationale: 'test',
    accumulatedConfidence: confidence,
  }, null);

  expect(result.status).toBe('pending_review');
  const proposalId = (result as { proposalId: string }).proposalId;

  return { repo, proposalRepo, svc, philos, clock, proposalId, timeline };
}

// ── C1: Each event type emitted by the correct trigger ─────────────────────────

describe('M1-1C C1: observation_received', () => {
  it('emitted by proposeUpdate after appendObservation', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { proposalId } = await setupPendingReview('high', timeline);
    // proposeUpdate emits observation_received for the backing observation.
    const events = timeline.all();
    const e = events.find(ev => ev.eventType === 'observation_received');
    expect(e).toBeDefined();
    expect(e!.observationId).toBeDefined();
    expect(e!.profileId).toBe('u1');
    expect(e!.nodeId).toBe('OrientationCommunicationStyle');
    expect(e!.proposalId).toBeNull();
    expect(e!.payload.eventType).toBe('observation_received');
    expect(proposalId).toBeTruthy(); // guard: setup succeeded
  });

  it('emitted by correctItem with source user_correction', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    await svc.correctItem('u1', {
      nodeId: 'Preferences',
      targetInterpretationId: null,
      correctedContent: 'dark mode',
      correctedAt: new Date(clock.now()).toISOString(),
      note: null,
    }, USER_CTX);

    const events = timeline.all();
    const e = events.find(ev => ev.eventType === 'observation_received');
    expect(e).toBeDefined();
    expect(e!.payload.eventType).toBe('observation_received');
    if (e!.payload.eventType === 'observation_received') {
      expect(e!.payload.source).toBe('user_correction');
      expect(e!.payload.recordedBy).toBe('user');
    }
    expect(e!.nodeId).toBe('Preferences');
    expect(e!.causationEventId).toBeNull();
  });
});

describe('M1-1C C1: proposal_created', () => {
  it('emitted with pending_review status after saveProposal', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    await setupPendingReview('high', timeline);
    const e = timeline.all().find(ev => ev.eventType === 'proposal_created');
    expect(e).toBeDefined();
    expect(e!.proposalId).toBeTruthy();
    expect(e!.profileId).toBe('u1');
    if (e!.payload.eventType === 'proposal_created') {
      expect(e!.payload.proposedBy).toBe('merlin');
      expect(e!.payload.accumulatedConfidence).toBe('high');
    }
  });

  it('emitted with pending_user_confirmation status when pipeline routes directly to user', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    // No evidence → pipeline routes to pending_user_confirmation.
    const result = await svc.proposeUpdate('u1', {
      nodeId: 'Preferences',
      proposedContent: 'dark mode',
      evidenceObservationIds: [],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
    }, null);

    expect(result.status).toBe('pending_user_confirmation');
    const events = timeline.all();
    const pc = events.find(ev => ev.eventType === 'proposal_created');
    const ucr = events.find(ev => ev.eventType === 'user_confirmation_required');
    expect(pc).toBeDefined();
    expect(ucr).toBeDefined();
  });
});

describe('M1-1C C1: review_decided', () => {
  it('emitted for Philos accept decision', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);
    const e = timeline.all().find(ev => ev.eventType === 'review_decided');
    expect(e).toBeDefined();
    expect(e!.proposalId).toBe(proposalId);
    if (e!.payload.eventType === 'review_decided') {
      expect(e!.payload.decision).toBe('accept');
      expect(e!.payload.reviewer).toBe('philos');
      expect(e!.payload.newStatus).toBe('confirmed');
    }
  });

  it('emitted for Philos reject decision', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('speculative', timeline);
    await philos.consume('u1', proposalId);
    const e = timeline.all().find(ev => ev.eventType === 'review_decided');
    expect(e).toBeDefined();
    if (e!.payload.eventType === 'review_decided') {
      expect(e!.payload.decision).toBe('reject');
      expect(e!.payload.newStatus).toBe('rejected');
    }
  });

  it('emitted for Philos require_user_confirmation decision', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('low', timeline);
    await philos.consume('u1', proposalId);
    const e = timeline.all().find(ev => ev.eventType === 'review_decided');
    expect(e).toBeDefined();
    if (e!.payload.eventType === 'review_decided') {
      expect(e!.payload.decision).toBe('require_user_confirmation');
      expect(e!.payload.newStatus).toBe('pending_user_confirmation');
    }
  });
});

describe('M1-1C C1: interpretation_committed', () => {
  it('emitted when Philos accepts and commits the interpretation', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);
    const e = timeline.all().find(ev => ev.eventType === 'interpretation_committed');
    expect(e).toBeDefined();
    expect(e!.proposalId).toBe(proposalId);
    expect(e!.interpretationId).toBeTruthy();
    if (e!.payload.eventType === 'interpretation_committed') {
      expect(e!.payload.proposalId).toBe(proposalId);
      expect(e!.payload.interpretationId).toBeTruthy();
      expect(e!.payload.content).toBe('direct');
      expect(e!.payload.confidence).toBe('high');
      expect(e!.payload.committedBy).toBe('philos');
      expect(e!.payload.previousInterpretationId).toBeNull();
    }
  });

  it('previousInterpretationId is set when an existing interpretation was archived', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    // First acceptance commits an interpretation.
    const { philos, svc, proposalRepo, repo, proposalId: p1 } = await setupPendingReview('high', timeline);
    await philos.consume('u1', p1);

    // Clear timeline so we only see events from the second commit.
    const timeline2 = new InMemoryEssenceTimelineRepository();
    const clock2 = makeClock(2_000_000);
    const runner2 = new PipelineRunner(clock2);
    const svc2 = new EssenceProposalService(repo, proposalRepo, runner2, clock2, undefined, timeline2);
    const philos2 = new PhilosReviewConsumer(svc2, clock2, timeline2);

    // Add a new observation and propose again.
    await repo.appendObservation('u1', {
      id: 'obs-seed2',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'seed2',
      sessionId: null,
      observedAt: new Date(clock2.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });
    const r2 = await svc2.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'collaborative',
      evidenceObservationIds: ['obs-seed2'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock2.now()).toISOString(),
      rationale: 'updated',
      accumulatedConfidence: 'high',
    }, null);
    expect(r2.status).toBe('pending_review');
    const p2 = (r2 as { proposalId: string }).proposalId;

    await philos2.consume('u1', p2);

    const e = timeline2.all().find(ev => ev.eventType === 'interpretation_committed');
    expect(e).toBeDefined();
    if (e!.payload.eventType === 'interpretation_committed') {
      expect(e!.payload.previousInterpretationId).toBeTruthy();
    }
  });

  it('emitted with proposalId null when committed via user correction (correctItem)', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    await svc.correctItem('u1', {
      nodeId: 'Preferences',
      targetInterpretationId: null,
      correctedContent: 'light mode',
      correctedAt: new Date(clock.now()).toISOString(),
      note: null,
    }, USER_CTX);

    const e = timeline.all().find(ev => ev.eventType === 'interpretation_committed');
    expect(e).toBeDefined();
    if (e!.payload.eventType === 'interpretation_committed') {
      expect(e!.payload.proposalId).toBeNull();
      expect(e!.payload.committedBy).not.toBe('philos');
    }
  });
});

describe('M1-1C C1: proposal_rejected', () => {
  it('emitted by Philos reject decision', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('speculative', timeline);
    await philos.consume('u1', proposalId);
    const e = timeline.all().find(ev => ev.eventType === 'proposal_rejected');
    expect(e).toBeDefined();
    expect(e!.proposalId).toBe(proposalId);
    if (e!.payload.eventType === 'proposal_rejected') {
      expect(e!.payload.rejectedBy).toBe('philos');
      expect(e!.payload.reason).toBe('speculative_confidence');
    }
  });

  it('emitted by user rejectUpdate with rejectedBy=user', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    const result = await svc.proposeUpdate('u1', {
      nodeId: 'Preferences',
      proposedContent: 'dark mode',
      evidenceObservationIds: [],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
    }, null);
    expect(result.status).toBe('pending_user_confirmation');
    const token = (result as { confirmationToken: string }).confirmationToken;

    await svc.rejectUpdate('u1', token, USER_CTX, 'changed_mind');

    const e = timeline.all().find(ev => ev.eventType === 'proposal_rejected');
    expect(e).toBeDefined();
    if (e!.payload.eventType === 'proposal_rejected') {
      expect(e!.payload.rejectedBy).toBe('user');
      expect(e!.payload.reason).toBe('changed_mind');
    }
  });
});

describe('M1-1C C1: proposal_expired', () => {
  it('emitted by recovery runner when proposal is past expiresAt', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const proposalRepo = new InMemoryEssenceProposalRepository();

    const pastExpiry = new Date(clock.now() - 10_000).toISOString();
    const expiredProposal: PendingEssenceProposal = {
      proposalId: 'prop-expired',
      profileId: 'u1',
      nodeId: 'OrientationCommunicationStyle',
      layer: 'core',
      proposedContent: 'direct',
      proposedBy: 'merlin',
      evidenceStatus: 'unavailable',
      proposedAt: new Date(clock.now() - 20_000).toISOString(),
      expiresAt: pastExpiry,
      status: 'pending_review',
      conflictsWith: [],
      pipelineStages: [],
      accumulatedConfidence: 'high',
      reviewDecisions: [],
      deferCount: 0,
      evidenceObservationIds: [],
    };
    await proposalRepo.saveProposal(expiredProposal);

    const repo = new InMemoryEssenceRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);
    const philos = new PhilosReviewConsumer(svc, clock, timeline);
    const recovery = new EssenceRecoveryRunner(proposalRepo, philos, clock, timeline);

    const report = await recovery.run();
    expect(report.expired).toBe(1);

    const e = timeline.all().find(ev => ev.eventType === 'proposal_expired');
    expect(e).toBeDefined();
    expect(e!.proposalId).toBe('prop-expired');
    if (e!.payload.eventType === 'proposal_expired') {
      expect(e!.payload.proposalId).toBe('prop-expired');
      expect(e!.payload.expiredAt).toBe(pastExpiry);
    }
  });
});

describe('M1-1C C1: user_confirmation_required', () => {
  it('emitted by proposeUpdate when pipeline routes directly to pending_user_confirmation', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', {
      nodeId: 'Preferences',
      proposedContent: 'dark mode',
      evidenceObservationIds: [],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
    }, null);

    const e = timeline.all().find(ev => ev.eventType === 'user_confirmation_required');
    expect(e).toBeDefined();
    if (e!.payload.eventType === 'user_confirmation_required') {
      expect(e!.payload.proposedContent).toBe('dark mode');
      expect(e!.payload.reason).toBe('low_confidence_requires_user');
    }
  });

  it('emitted by Philos when low-confidence proposal routed to user', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('low', timeline);
    await philos.consume('u1', proposalId);
    const events = timeline.all().filter(ev => ev.eventType === 'user_confirmation_required');
    // One from proposeUpdate path (low confidence + evidence → pending_review, not p_u_c)
    // Actually with evidence → pending_review, so only one u_c_r from Philos.
    const philosEvent = events.find(ev => ev.causationEventId !== null);
    expect(philosEvent).toBeDefined();
    if (philosEvent!.payload.eventType === 'user_confirmation_required') {
      expect(philosEvent!.payload.proposalId).toBe(proposalId);
      expect(philosEvent!.payload.reason).toBe('low_confidence_requires_user');
    }
  });
});

// ── C2: Deterministic event ordering ──────────────────────────────────────────

describe('M1-1C C2: event ordering', () => {
  it('observation_received precedes proposal_created within proposeUpdate', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    await setupPendingReview('high', timeline);
    const events = timeline.all();
    const orIdx = events.findIndex(e => e.eventType === 'observation_received');
    const pcIdx = events.findIndex(e => e.eventType === 'proposal_created');
    expect(orIdx).toBeGreaterThanOrEqual(0);
    expect(pcIdx).toBeGreaterThan(orIdx);
  });

  it('Philos accept: interpretation_committed precedes review_decided (effects-first ordering)', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);
    const events = timeline.all();
    const icIdx = events.findIndex(e => e.eventType === 'interpretation_committed');
    const rdIdx = events.findIndex(e => e.eventType === 'review_decided');
    expect(icIdx).toBeGreaterThanOrEqual(0);
    expect(rdIdx).toBeGreaterThan(icIdx);
  });

  it('Philos reject: review_decided precedes proposal_rejected', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('speculative', timeline);
    await philos.consume('u1', proposalId);
    const events = timeline.all();
    const rdIdx = events.findIndex(e => e.eventType === 'review_decided');
    const prIdx = events.findIndex(e => e.eventType === 'proposal_rejected');
    expect(rdIdx).toBeGreaterThanOrEqual(0);
    expect(prIdx).toBeGreaterThan(rdIdx);
  });

  it('Philos require_user_confirmation: review_decided precedes user_confirmation_required', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('low', timeline);
    await philos.consume('u1', proposalId);
    const events = timeline.all();
    const rdIdx = events.findIndex(e => e.eventType === 'review_decided');
    // Filter for user_confirmation_required emitted by Philos (has causationEventId).
    const ucrIdx = events.findIndex(e => e.eventType === 'user_confirmation_required' && e.causationEventId !== null);
    expect(rdIdx).toBeGreaterThanOrEqual(0);
    expect(ucrIdx).toBeGreaterThan(rdIdx);
  });

  it('proposal_created precedes user_confirmation_required within proposeUpdate (p_u_c path)', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', {
      nodeId: 'Preferences',
      proposedContent: 'dark mode',
      evidenceObservationIds: [],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
    }, null);

    const events = timeline.all();
    const pcIdx = events.findIndex(e => e.eventType === 'proposal_created');
    const ucrIdx = events.findIndex(e => e.eventType === 'user_confirmation_required');
    expect(pcIdx).toBeGreaterThanOrEqual(0);
    expect(ucrIdx).toBeGreaterThan(pcIdx);
  });
});

// ── C3: Correlation IDs ────────────────────────────────────────────────────────

describe('M1-1C C3: correlation IDs', () => {
  it('proposal_created.causationEventId === observation_received.id', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    await setupPendingReview('high', timeline);
    const events = timeline.all();
    const or = events.find(e => e.eventType === 'observation_received');
    const pc = events.find(e => e.eventType === 'proposal_created');
    expect(or).toBeDefined();
    expect(pc).toBeDefined();
    expect(pc!.causationEventId).toBe(or!.id);
  });

  it('proposal_created.proposalId matches the proposal record in the store', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { proposalRepo, proposalId } = await setupPendingReview('high', timeline);
    const pc = timeline.all().find(e => e.eventType === 'proposal_created');
    expect(pc!.proposalId).toBe(proposalId);
    const record = await proposalRepo.loadProposal(proposalId);
    expect(record).toBeDefined();
    expect(record!.proposalId).toBe(pc!.proposalId);
  });

  it('interpretation_committed.interpretationId matches the interpretation written to the profile', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId, repo } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);

    const ic = timeline.all().find(e => e.eventType === 'interpretation_committed');
    expect(ic).toBeDefined();
    const interpId = ic!.interpretationId!;

    const profile = await repo.getProfile('u1');
    type Layer = Record<string, Array<{ id: string }>>;
    const layers = ['core', 'aspirations', 'expression', 'identity', 'state'] as const;
    const allInterps = layers.flatMap(l => Object.values((profile?.[l] as Layer | undefined) ?? {}).flat());
    const written = allInterps.find(i => i.id === interpId);
    expect(written).toBeDefined();
  });

  it('interpretation_committed.proposalId matches the originating proposal', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);

    const ic = timeline.all().find(e => e.eventType === 'interpretation_committed');
    expect(ic!.proposalId).toBe(proposalId);
    if (ic!.payload.eventType === 'interpretation_committed') {
      expect(ic!.payload.proposalId).toBe(proposalId);
    }
  });

  it('proposal_rejected.causationEventId === review_decided.id for Philos reject', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('speculative', timeline);
    await philos.consume('u1', proposalId);

    const events = timeline.all();
    const rd = events.find(e => e.eventType === 'review_decided');
    const pr = events.find(e => e.eventType === 'proposal_rejected');
    expect(pr!.causationEventId).toBe(rd!.id);
  });

  it('user_confirmation_required.causationEventId === review_decided.id for Philos routing', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('low', timeline);
    await philos.consume('u1', proposalId);

    const events = timeline.all();
    const rd = events.find(e => e.eventType === 'review_decided');
    const ucr = events.find(e => e.eventType === 'user_confirmation_required' && e.causationEventId !== null);
    expect(ucr!.causationEventId).toBe(rd!.id);
  });

  it('proposal_created.causationEventId === observation_received.id (p_u_c pipeline path)', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    await svc.proposeUpdate('u1', {
      nodeId: 'Preferences',
      proposedContent: 'dark mode',
      evidenceObservationIds: [],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
    }, null);

    const events = timeline.all();
    const or = events.find(e => e.eventType === 'observation_received');
    const pc = events.find(e => e.eventType === 'proposal_created');
    expect(pc!.causationEventId).toBe(or!.id);
  });

  it('interpretation_committed from correctItem has causationEventId === observation_received.id', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);

    await repo.createProfile('u1');
    await svc.correctItem('u1', {
      nodeId: 'Preferences',
      targetInterpretationId: null,
      correctedContent: 'light mode',
      correctedAt: new Date(clock.now()).toISOString(),
      note: null,
    }, USER_CTX);

    const events = timeline.all();
    const or = events.find(e => e.eventType === 'observation_received');
    const ic = events.find(e => e.eventType === 'interpretation_committed');
    expect(ic).toBeDefined();
    expect(ic!.causationEventId).toBe(or!.id);
  });

  it('all emitted events carry profileId', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);
    const events = timeline.all();
    for (const e of events) {
      expect(e.profileId).toBe('u1');
    }
  });

  it('all emitted events carry unique IDs', async () => {
    const timeline = new InMemoryEssenceTimelineRepository();
    const { philos, proposalId } = await setupPendingReview('high', timeline);
    await philos.consume('u1', proposalId);
    const ids = timeline.all().map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── C4: FS durability ──────────────────────────────────────────────────────────

describe('M1-1C C4: FS durability', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'm1-1c-fs-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('events survive after a fresh FileSystemEssenceTimelineRepository instance', async () => {
    const fsTimeline = new FileSystemEssenceTimelineRepository(dataDir);
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, fsTimeline);
    const philos = new PhilosReviewConsumer(svc, clock, fsTimeline);

    await repo.createProfile('u1');
    await repo.appendObservation('u1', {
      id: 'obs-seed',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'seed',
      sessionId: null,
      observedAt: new Date(clock.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });

    const result = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-seed'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'high',
    }, null);
    expect(result.status).toBe('pending_review');
    const proposalId = (result as { proposalId: string }).proposalId;
    await philos.consume('u1', proposalId);

    // New instance — simulates process restart.
    const fsTimeline2 = new FileSystemEssenceTimelineRepository(dataDir);
    const loaded = await fsTimeline2.loadByProfile('u1');

    const types = loaded.map(e => e.eventType);
    expect(types).toContain('observation_received');
    expect(types).toContain('proposal_created');
    expect(types).toContain('interpretation_committed');
    expect(types).toContain('review_decided');
  });

  it('events are in insertion order after reload', async () => {
    const fsTimeline = new FileSystemEssenceTimelineRepository(dataDir);
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, fsTimeline);
    const philos = new PhilosReviewConsumer(svc, clock, fsTimeline);

    await repo.createProfile('u1');
    await repo.appendObservation('u1', {
      id: 'obs-s',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'seed',
      sessionId: null,
      observedAt: new Date(clock.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });

    const r = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-s'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'speculative',
    }, null);
    const proposalId = (r as { proposalId: string }).proposalId;
    await philos.consume('u1', proposalId);

    const fsTimeline2 = new FileSystemEssenceTimelineRepository(dataDir);
    const loaded = await fsTimeline2.loadByProfile('u1');

    // observation_received, proposal_created, review_decided, proposal_rejected
    const orIdx = loaded.findIndex(e => e.eventType === 'observation_received');
    const pcIdx = loaded.findIndex(e => e.eventType === 'proposal_created');
    const rdIdx = loaded.findIndex(e => e.eventType === 'review_decided');
    const prIdx = loaded.findIndex(e => e.eventType === 'proposal_rejected');
    expect(orIdx).toBeLessThan(pcIdx);
    expect(rdIdx).toBeLessThan(prIdx);
  });
});

// ── C5: Failure policy ────────────────────────────────────────────────────────

describe('M1-1C C5: failure policy — timeline append failure fails the business operation', () => {
  function failingTimelineRepo(): EssenceTimelineRepository {
    return {
      async append(_event) { throw new Error('timeline write failed'); },
      async loadByProfile(_p) { return []; },
      async loadByProposal(_p) { return []; },
      async loadByInterpretation(_i) { return []; },
    };
  }

  it('proposeUpdate throws when observation_received timeline append fails', async () => {
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, failingTimelineRepo());

    await repo.createProfile('u1');
    await repo.appendObservation('u1', {
      id: 'obs-seed',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'seed',
      sessionId: null,
      observedAt: new Date(clock.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });

    await expect(svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-seed'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'high',
    }, null)).rejects.toThrow('timeline write failed');
  });

  it('rejectUpdate throws when proposal_rejected timeline append fails', async () => {
    // We need a real timeline to get through proposeUpdate, then swap to failing.
    const workingTimeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);

    // Use working timeline to set up the proposal.
    const svcSetup = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, workingTimeline);
    await repo.createProfile('u1');
    const r = await svcSetup.proposeUpdate('u1', {
      nodeId: 'Preferences',
      proposedContent: 'dark mode',
      evidenceObservationIds: [],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
    }, null);
    expect(r.status).toBe('pending_user_confirmation');
    const token = (r as { confirmationToken: string }).confirmationToken;

    // Now use failing timeline for rejectUpdate.
    const svcFailing = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, failingTimelineRepo());
    await expect(svcFailing.rejectUpdate('u1', token, USER_CTX, null)).rejects.toThrow('timeline write failed');
  });

  it('philos.consume throws when review_decided timeline append fails', async () => {
    // Set up with real timeline.
    const workingTimeline = new InMemoryEssenceTimelineRepository();
    const clock = makeClock();
    const repo = new InMemoryEssenceRepository();
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const runner = new PipelineRunner(clock);

    const svcSetup = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, workingTimeline);
    await repo.createProfile('u1');
    await repo.appendObservation('u1', {
      id: 'obs-seed',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'seed',
      sessionId: null,
      observedAt: new Date(clock.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });
    const r = await svcSetup.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-seed'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'speculative',
    }, null);
    expect(r.status).toBe('pending_review');
    const proposalId = (r as { proposalId: string }).proposalId;

    // Now use failing timeline for Philos.
    const svcFailing = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, failingTimelineRepo());
    const philosFailing = new PhilosReviewConsumer(svcFailing, clock, failingTimelineRepo());

    // The failing timeline is on the proposal service too, so commitReviewedProposal/applyReviewDecision
    // on svcFailing would fail if called with interpretation_committed. For speculative (reject),
    // review_decided is the first Philos event — it throws immediately.
    await expect(philosFailing.consume('u1', proposalId)).rejects.toThrow('timeline write failed');
  });

  it('recovery runner throws when proposal_expired timeline append fails', async () => {
    const clock = makeClock();
    const proposalRepo = new InMemoryEssenceProposalRepository();

    const pastExpiry = new Date(clock.now() - 10_000).toISOString();
    await proposalRepo.saveProposal({
      proposalId: 'prop-x',
      profileId: 'u1',
      nodeId: 'OrientationCommunicationStyle',
      layer: 'core',
      proposedContent: 'direct',
      proposedBy: 'merlin',
      evidenceStatus: 'unavailable',
      proposedAt: new Date(clock.now() - 20_000).toISOString(),
      expiresAt: pastExpiry,
      status: 'pending_review',
      conflictsWith: [],
      pipelineStages: [],
      accumulatedConfidence: 'high',
      reviewDecisions: [],
      deferCount: 0,
      evidenceObservationIds: [],
    });

    const repo = new InMemoryEssenceRepository();
    const runner = new PipelineRunner(clock);
    const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, failingTimelineRepo());
    const philos = new PhilosReviewConsumer(svc, clock, failingTimelineRepo());
    const recovery = new EssenceRecoveryRunner(proposalRepo, philos, clock, failingTimelineRepo());

    // Recovery runner catches individual proposal errors (per-proposal isolation),
    // but the expiry path throws because proposal_expired append fails.
    // The error propagates up from recovery.run() because expiry errors are not caught.
    await expect(recovery.run()).rejects.toThrow('timeline write failed');
  });
});
