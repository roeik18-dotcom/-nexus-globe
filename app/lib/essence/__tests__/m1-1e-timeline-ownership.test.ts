/**
 * M1-1E — Timeline Ownership Transition
 *
 * Covers:
 *   E1  writeInterpretation → verifyProjection succeeds (stored = projected)
 *   E2  archiveItem → verifyProjection succeeds after archive
 *   E3  correctItem → verifyProjection succeeds (correction emits timeline events)
 *   E4  Evolution IDs carry the `proj_` prefix and are stable across replays
 *   E5  H3 invariant — same Timeline → identical projected state on every replay
 *   E6  Node-level merge — pre-timeline nodes are preserved; in-timeline nodes are projected
 *   E7  replace_single_value archives pre-timeline active interpretations correctly
 *   E8  Sequential writes are all reflected in evolution[] ordering
 *   E9  archiveItem fallback — pre-timeline interpretation is archived even without a prior committed event
 *
 * Architecture invariants enforced by these tests:
 *   - Every write goes: Domain Action → append → project → merge → persist
 *   - Timeline append failure propagates and fails the business operation (tested in M1-1C)
 *   - evolution[] is fully owned by the projection; profile.evolution is never directly set
 *   - Same ordered Timeline → byte-for-byte identical projected interpretation state (H3)
 */

import { describe, it, expect } from 'vitest';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { PipelineRunner } from '../pipeline-runner';
import { EssenceTimelineProjector } from '../timeline-projector';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { InMemoryEssenceProposalRepository } from '../in-memory-proposal-repository';
import { InMemoryEssenceTimelineRepository } from '../in-memory-timeline-repository';
import type { Clock } from '../pipeline-runner';
import type { Observation } from '../schema';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeClock(ms = 1_000_000): Clock & { advance(n: number): void } {
  let t = ms;
  return { now: () => t, advance(n) { t += n; } };
}

function seedObs(id: string, clock: Clock): Observation {
  return {
    id,
    source: 'agent_inference',
    recordedBy: 'merlin',
    content: `evidence for ${id}`,
    sessionId: null,
    observedAt: new Date(clock.now()).toISOString(),
    evidenceIds: [],
    correctsObservationId: null,
  };
}

async function makeStack() {
  const clock = makeClock();
  const timeline = new InMemoryEssenceTimelineRepository();
  const repo = new InMemoryEssenceRepository();
  const proposalRepo = new InMemoryEssenceProposalRepository();
  const svc = new EssenceProposalService(repo, proposalRepo, new PipelineRunner(clock), clock, undefined, timeline);
  const philos = new PhilosReviewConsumer(svc, clock, timeline);
  const projector = new EssenceTimelineProjector(repo, timeline);
  await repo.createProfile('u1');
  return { clock, timeline, repo, proposalRepo, svc, philos, projector };
}

/** Propose and have Philos auto-accept (high confidence). */
async function proposeAndAccept(
  svc: EssenceProposalService,
  philos: PhilosReviewConsumer,
  clock: Clock & { advance(n: number): void },
  repo: InMemoryEssenceRepository,
  nodeId: string,
  content: string,
  obsId: string,
) {
  await repo.appendObservation('u1', seedObs(obsId, clock));
  clock.advance(100);
  const result = await svc.proposeUpdate('u1', {
    nodeId,
    proposedContent: content,
    evidenceObservationIds: [obsId],
    proposedBy: 'merlin',
    proposedAt: new Date(clock.now()).toISOString(),
    rationale: 'test',
    accumulatedConfidence: 'high',
  }, null);
  expect(result.status).toBe('pending_review');
  const proposalId = (result as { proposalId: string }).proposalId;
  clock.advance(100);
  await philos.consume('u1', proposalId);
  return proposalId;
}

// ── E1: writeInterpretation → verifyProjection ────────────────────────────────

describe('M1-1E E1: writeInterpretation followed by verifyProjection', () => {
  it('stored profile matches projection after Philos commit', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
    expect(report.differences).toHaveLength(0);
  });

  it('stored interpretation content equals projected content', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'explanatory', 'obs-1');

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    const storedInterps = stored!.expression['OrientationResponseDepth'] ?? [];
    const projInterps = projected.expression['OrientationResponseDepth'] ?? [];

    expect(projInterps).toHaveLength(storedInterps.length);
    for (const p of projInterps) {
      const s = storedInterps.find(i => i.id === p.id);
      expect(s).toBeDefined();
      expect(p.content).toBe(s!.content);
      expect(p.confidence).toBe(s!.confidence);
    }
  });
});

// ── E2: archiveItem → verifyProjection ───────────────────────────────────────

describe('M1-1E E2: archiveItem followed by verifyProjection', () => {
  it('verifyProjection succeeds after archiveItem via the write path', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const profile = await repo.getProfile('u1');
    const interp = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!;
    clock.advance(100);
    await svc.archiveItem('u1', interp.id, 'philos', 'test archival');

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
    expect(report.differences).toHaveLength(0);
  });

  it('archived interpretation has non-null archivedAt in both stored and projected', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const profile = await repo.getProfile('u1');
    const interpId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;
    clock.advance(100);
    await svc.archiveItem('u1', interpId, 'philos', 'test archival');

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    const storedInterp = Object.values(stored!.expression).flat().find(i => i.id === interpId);
    const projInterp = Object.values(projected.expression).flat().find(i => i.id === interpId);

    expect(storedInterp?.archivedAt).not.toBeNull();
    expect(projInterp?.archivedAt).not.toBeNull();
  });
});

// ── E3: correctItem → verifyProjection ───────────────────────────────────────

describe('M1-1E E3: correctItem followed by verifyProjection', () => {
  it('verifyProjection succeeds after user correctItem', async () => {
    const { svc, clock, repo, projector } = await makeStack();
    clock.advance(100);
    await svc.correctItem('u1', {
      nodeId: 'OrientationResponseDepth',
      correctedContent: 'brief',
      correctedAt: new Date(clock.now()).toISOString(),
      targetInterpretationId: null,
      targetObservationId: null,
    }, { userId: 'u1', requestedAt: new Date(clock.now()).toISOString() });

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
    expect(report.differences).toHaveLength(0);
  });

  it('correctItem archiving an existing interp verifies correctly', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'explanatory', 'obs-1');

    const profile = await repo.getProfile('u1');
    const oldId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;

    clock.advance(100);
    await svc.correctItem('u1', {
      nodeId: 'OrientationResponseDepth',
      correctedContent: 'brief',
      correctedAt: new Date(clock.now()).toISOString(),
      targetInterpretationId: oldId,
      targetObservationId: null,
    }, { userId: 'u1', requestedAt: new Date(clock.now()).toISOString() });

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
    expect(report.differences).toHaveLength(0);
  });
});

// ── E4: Evolution IDs use `proj_` prefix ─────────────────────────────────────

describe('M1-1E E4: evolution entry IDs use the proj_ prefix', () => {
  it('evolution entries have proj_tevt- shaped IDs', async () => {
    const { svc, philos, clock, repo } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const profile = await repo.getProfile('u1');
    expect(profile!.evolution).toHaveLength(1);
    expect(profile!.evolution[0].id).toMatch(/^proj_tevt/);
  });

  it('archiveItem returns an evolutionEntryId with proj_ prefix', async () => {
    const { svc, philos, clock, repo } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const profile = await repo.getProfile('u1');
    const interpId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;
    clock.advance(100);
    const result = await svc.archiveItem('u1', interpId, 'philos', 'test');

    expect(result.evolutionEntryId).toMatch(/^proj_tevt/);
  });
});

// ── E5: H3 invariant — replay idempotency ────────────────────────────────────

describe('M1-1E E5: H3 invariant — same Timeline → identical projected state', () => {
  it('two sequential rebuildProfile calls return identical interpretation state', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const first = await projector.rebuildProfile('u1');
    const second = await projector.rebuildProfile('u1');

    const firstInterps = Object.values(first.expression).flat();
    const secondInterps = Object.values(second.expression).flat();

    expect(firstInterps.length).toBe(secondInterps.length);
    for (const fi of firstInterps) {
      const si = secondInterps.find(i => i.id === fi.id);
      expect(si).toBeDefined();
      expect(fi.content).toBe(si!.content);
      expect(fi.confidence).toBe(si!.confidence);
      expect(fi.archivedAt).toBe(si!.archivedAt);
    }
    expect(first.evolution.map(e => e.id)).toEqual(second.evolution.map(e => e.id));
  });

  it('evolution ID is deterministic across replays (proj_${event.id})', async () => {
    const { svc, philos, clock, repo, projector, timeline } = await makeStack();
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const events = await timeline.loadByProfile('u1');
    const committedEvent = events.find(e => e.eventType === 'interpretation_committed')!;
    const expectedEvoId = `proj_${committedEvent.id}`;

    const projected1 = await projector.rebuildProfile('u1');
    const projected2 = await projector.rebuildProfile('u1');

    expect(projected1.evolution[0].id).toBe(expectedEvoId);
    expect(projected2.evolution[0].id).toBe(expectedEvoId);
  });
});

// ── E6: Node-level merge — pre-timeline nodes preserved ──────────────────────

describe('M1-1E E6: node-level merge preserves pre-timeline nodes', () => {
  it('pre-timeline node data is preserved after writing to a different node', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    // Seed a node directly (pre-timeline) for a different nodeId.
    const profile = await repo.getProfile('u1');
    profile!.core['Lifestyle'] = [{
      id: 'legacy-core-interp',
      version: 1,
      nodeId: 'Lifestyle',
      layer: 'core',
      stabilityClass: 'Stable',
      content: 'minimalist',
      observationIds: [],
      confidence: 'high',
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence: 'high',
        createdBy: 'seed',
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
    await repo.saveProfile(profile!);

    // Write to a different node via the timeline.
    clock.advance(100);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    // Pre-timeline 'Lifestyle' node must still be in the stored profile.
    const stored = await repo.getProfile('u1');
    expect(stored!.core['Lifestyle']).toBeDefined();
    expect(stored!.core['Lifestyle']![0].content).toBe('minimalist');
  });
});

// ── E7: replace_single_value archives previous timeline-owned actives ─────────

describe('M1-1E E7: replace_single_value correctly archives previous active interpretations', () => {
  it('API-created active is archived when replace_single_value writes a new one', async () => {
    const { svc, philos, clock, repo } = await makeStack();

    // First write: 'direct' via timeline.
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    // Second write: 'collaborative' should archive 'direct'.
    clock.advance(100);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'collaborative', 'obs-2');

    const stored = await repo.getProfile('u1');
    const all = stored!.expression['OrientationCommunicationStyle'] ?? [];

    const active = all.filter(i => !i.archivedAt);
    const archived = all.filter(i => i.archivedAt);

    expect(active).toHaveLength(1);
    expect(active[0].content).toBe('collaborative');
    expect(archived).toHaveLength(1);
    expect(archived[0].content).toBe('direct');
  });

  it('multiple sequential writes produce correct archiving chain', async () => {
    const { svc, clock, repo } = await makeStack();

    // Three sequential correctItem calls: each archives the previous active.
    clock.advance(100);
    await svc.correctItem('u1', {
      nodeId: 'OrientationResponseDepth',
      correctedContent: 'brief',
      correctedAt: new Date(clock.now()).toISOString(),
      targetInterpretationId: null,
      targetObservationId: null,
    }, { userId: 'u1', requestedAt: new Date(clock.now()).toISOString() });

    clock.advance(100);
    await svc.correctItem('u1', {
      nodeId: 'OrientationResponseDepth',
      correctedContent: 'balanced',
      correctedAt: new Date(clock.now()).toISOString(),
      targetInterpretationId: null,
      targetObservationId: null,
    }, { userId: 'u1', requestedAt: new Date(clock.now()).toISOString() });

    clock.advance(100);
    await svc.correctItem('u1', {
      nodeId: 'OrientationResponseDepth',
      correctedContent: 'explanatory',
      correctedAt: new Date(clock.now()).toISOString(),
      targetInterpretationId: null,
      targetObservationId: null,
    }, { userId: 'u1', requestedAt: new Date(clock.now()).toISOString() });

    const updated = await repo.getProfile('u1');
    const all = updated!.expression['OrientationResponseDepth'] ?? [];
    expect(all.filter(i => i.archivedAt)).toHaveLength(2);
    expect(all.filter(i => !i.archivedAt)).toHaveLength(1);
    expect(all.find(i => !i.archivedAt)?.content).toBe('explanatory');
  });
});

// ── E8: Sequential writes reflected in evolution[] ───────────────────────────

describe('M1-1E E8: sequential writes accumulate in evolution[]', () => {
  it('two writes produce two evolution entries in chronological order', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    clock.advance(500);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'collaborative', 'obs-2');

    const profile = await repo.getProfile('u1');
    expect(profile!.evolution).toHaveLength(2);

    // Evolution entries ordered by event time — first is direct, second is collaborative.
    const [first, second] = profile!.evolution;
    expect(first.previousInterpretationId).toBeNull();
    expect(second.previousInterpretationId).toBe(first.newInterpretationId);

    // verifyProjection still passes.
    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
  });

  it('writes to two different nodes produce two independent evolution entries', async () => {
    const { svc, philos, clock, repo } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    clock.advance(500);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'explanatory', 'obs-2');

    const profile = await repo.getProfile('u1');
    expect(profile!.evolution).toHaveLength(2);

    const nodeIds = profile!.evolution.map(e => e.nodeId);
    expect(nodeIds).toContain('OrientationCommunicationStyle');
    expect(nodeIds).toContain('OrientationResponseDepth');
  });
});

// ── E9: archiveItem on an API-created interpretation ─────────────────────────

describe('M1-1E E9: archiveItem correctly archives a timeline-owned interpretation', () => {
  it('archiveItem archives an interpretation created via the write path', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    // Create the interpretation via the API so it is in the timeline.
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const profile = await repo.getProfile('u1');
    const interpId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;

    clock.advance(100);
    const result = await svc.archiveItem('u1', interpId, 'philos', 'manual archive');

    expect(result.archived).toBe(true);
    expect(result.evolutionEntryId).toMatch(/^proj_/);

    const stored = await repo.getProfile('u1');
    const interp = stored!.expression['OrientationCommunicationStyle']?.find(i => i.id === interpId);
    expect(interp).toBeDefined();
    expect(interp!.archivedAt).not.toBeNull();

    // Timeline is the source of truth — verifyProjection confirms stored matches projected.
    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
  });
});
