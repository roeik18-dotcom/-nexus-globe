/**
 * M1-1F — Projection Purity & Replay Verification
 *
 * Covers:
 *   F1  All data created via API — no fallback paths reached
 *   F2  Snapshot captures the projected profile at the correct timeline anchor
 *   F3  Delta replay from snapshot is identical to full replay
 *   F4  Snapshot with wrong projectorVersion triggers full replay
 *   F5  computeProjectionFingerprint is stable across multiple rebuildProfile calls
 *   F6  Stored fingerprint matches projected fingerprint after every write
 *   F7  verifyProjection report includes storedFingerprint and projectedFingerprint
 *
 * Invariants enforced:
 *   - H3: same ordered Timeline → byte-for-byte identical projected state
 *   - Snapshot validity is gated on PROJECTOR_VERSION
 *   - Delta replay produces the same result as full replay (no accumulated drift)
 */

import { describe, it, expect } from 'vitest';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { PipelineRunner } from '../pipeline-runner';
import { EssenceTimelineProjector, computeProjectionFingerprint } from '../timeline-projector';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { InMemoryEssenceProposalRepository } from '../in-memory-proposal-repository';
import { InMemoryEssenceTimelineRepository } from '../in-memory-timeline-repository';
import { InMemoryEssenceSnapshotRepository } from '../in-memory-snapshot-repository';
import { PROJECTOR_VERSION } from '../snapshot';
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

async function makeStack(withSnapshots = false) {
  const clock = makeClock();
  const timeline = new InMemoryEssenceTimelineRepository();
  const snapshotRepo = withSnapshots ? new InMemoryEssenceSnapshotRepository() : undefined;
  const repo = new InMemoryEssenceRepository();
  const proposalRepo = new InMemoryEssenceProposalRepository();
  const svc = new EssenceProposalService(repo, proposalRepo, new PipelineRunner(clock), clock, undefined, timeline);
  const philos = new PhilosReviewConsumer(svc, clock, timeline);
  const projector = new EssenceTimelineProjector(repo, timeline, snapshotRepo);
  await repo.createProfile('u1');
  return { clock, timeline, repo, proposalRepo, svc, philos, projector, snapshotRepo };
}

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

// ── F1: No fallback paths — API-created data archives correctly ───────────────

describe('M1-1F F1: API-created interpretations archive correctly without fallbacks', () => {
  it('replace_single_value archives the previous active via the projector (no fallback)', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    clock.advance(200);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'collaborative', 'obs-2');

    const profile = await repo.getProfile('u1');
    const all = profile!.expression['OrientationCommunicationStyle'] ?? [];
    expect(all.filter(i => !i.archivedAt)).toHaveLength(1);
    expect(all.filter(i => i.archivedAt)).toHaveLength(1);
    expect(all.find(i => !i.archivedAt)!.content).toBe('collaborative');
    expect(all.find(i => i.archivedAt)!.content).toBe('direct');

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
  });

  it('archiveItem on an API-created interpretation passes verifyProjection', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    const profile = await repo.getProfile('u1');
    const interpId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;

    clock.advance(200);
    await svc.archiveItem('u1', interpId, 'philos', 'test archival');

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
  });
});

// ── F2: Snapshot captures the correct timeline anchor ────────────────────────

describe('M1-1F F2: saveSnapshot captures the correct timeline anchor', () => {
  it('snapshot has correct projectorVersion, eventCount, and lastEventId', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack(true);

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const snap = await projector.saveSnapshot('u1');

    expect(snap.profileId).toBe('u1');
    expect(snap.projectorVersion).toBe(PROJECTOR_VERSION);
    expect(snap.eventCount).toBeGreaterThan(0);
    expect(snap.lastEventId).toBeDefined();
    expect(snap.lastEventOccurredAt).toBeDefined();
    expect(snap.profile).toBeDefined();
    expect(snap.snapshotId).toMatch(/^snap_/);
  });

  it('snapshot profile matches a fresh rebuildProfile', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack(true);

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'explanatory', 'obs-1');

    const snap = await projector.saveSnapshot('u1');
    const fresh = await projector.rebuildProfile('u1');

    // evolution[] should be identical
    expect(snap.profile.evolution.map(e => e.id)).toEqual(fresh.evolution.map(e => e.id));

    // interpretation state should match
    const snapInterps = Object.values(snap.profile.expression).flat();
    const freshInterps = Object.values(fresh.expression).flat();
    expect(snapInterps.length).toBe(freshInterps.length);
    for (const si of snapInterps) {
      const fi = freshInterps.find(i => i.id === si.id);
      expect(fi).toBeDefined();
      expect(si.content).toBe(fi!.content);
      expect(si.archivedAt).toBe(fi!.archivedAt);
    }
  });
});

// ── F3: Delta replay equals full replay ──────────────────────────────────────

describe('M1-1F F3: delta replay from snapshot yields identical result to full replay', () => {
  it('projector with snapshot repo produces same profile as projector without', async () => {
    const clock = makeClock();
    const timeline = new InMemoryEssenceTimelineRepository();
    const repo = new InMemoryEssenceRepository();
    const snapshotRepo = new InMemoryEssenceSnapshotRepository();
    const svc = new EssenceProposalService(repo, new InMemoryEssenceProposalRepository(), new PipelineRunner(clock), clock, undefined, timeline);
    const philos = new PhilosReviewConsumer(svc, clock, timeline);
    const projectorFull = new EssenceTimelineProjector(repo, timeline);
    const projectorSnap = new EssenceTimelineProjector(repo, timeline, snapshotRepo);
    await repo.createProfile('u1');

    // First write + snapshot.
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    await projectorSnap.saveSnapshot('u1');

    // Second write (delta events arrive after the snapshot).
    clock.advance(500);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'collaborative', 'obs-2');

    const full = await projectorFull.rebuildProfile('u1');
    const delta = await projectorSnap.rebuildProfile('u1');

    expect(computeProjectionFingerprint(delta)).toBe(computeProjectionFingerprint(full));
  });

  it('delta replay with no events after snapshot returns snapshot profile unchanged', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack(true);

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'brief', 'obs-1');
    const snap = await projector.saveSnapshot('u1');
    const snapFingerprint = computeProjectionFingerprint(snap.profile);

    // No new events — delta replay should return the snapshot profile.
    const rebuilt = await projector.rebuildProfile('u1');
    expect(computeProjectionFingerprint(rebuilt)).toBe(snapFingerprint);
  });
});

// ── F4: Wrong projectorVersion triggers full replay ───────────────────────────

describe('M1-1F F4: snapshot with wrong projectorVersion triggers full replay', () => {
  it('stale snapshot is ignored and full replay produces the correct result', async () => {
    const clock = makeClock();
    const timeline = new InMemoryEssenceTimelineRepository();
    const repo = new InMemoryEssenceRepository();
    const snapshotRepo = new InMemoryEssenceSnapshotRepository();
    const svc = new EssenceProposalService(repo, new InMemoryEssenceProposalRepository(), new PipelineRunner(clock), clock, undefined, timeline);
    const philos = new PhilosReviewConsumer(svc, clock, timeline);
    const projector = new EssenceTimelineProjector(repo, timeline, snapshotRepo);
    await repo.createProfile('u1');

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    // Save a snapshot with a stale projector version.
    const staleSnap = await projector.saveSnapshot('u1');
    const staleWithWrongVersion = { ...staleSnap, projectorVersion: 0 as never, profile: { ...staleSnap.profile, expression: {} as never } };
    await snapshotRepo.save(staleWithWrongVersion);

    // The projector should ignore the stale snapshot and do a full replay.
    const rebuilt = await projector.rebuildProfile('u1');
    const allInterps = Object.values(rebuilt.expression).flat();
    expect(allInterps).toHaveLength(1);
    expect(allInterps[0].content).toBe('direct');
  });
});

// ── F5: computeProjectionFingerprint is stable ────────────────────────────────

describe('M1-1F F5: computeProjectionFingerprint is stable across replays', () => {
  it('two rebuildProfile calls produce identical fingerprints', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    clock.advance(200);
    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'brief', 'obs-2');

    const first = await projector.rebuildProfile('u1');
    const second = await projector.rebuildProfile('u1');

    expect(computeProjectionFingerprint(first)).toBe(computeProjectionFingerprint(second));
  });

  it('fingerprint changes when an interpretation is archived', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    const before = computeProjectionFingerprint(await projector.rebuildProfile('u1'));

    const profile = await repo.getProfile('u1');
    const interpId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;
    clock.advance(100);
    await svc.archiveItem('u1', interpId, 'philos', 'test');

    const after = computeProjectionFingerprint(await projector.rebuildProfile('u1'));
    expect(after).not.toBe(before);
  });
});

// ── F6: Stored fingerprint matches projected fingerprint after write ───────────

describe('M1-1F F6: stored fingerprint matches projected fingerprint after every write', () => {
  it('fingerprints agree after proposeAndAccept', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    expect(computeProjectionFingerprint(stored!)).toBe(computeProjectionFingerprint(projected));
  });

  it('fingerprints agree after archiveItem', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');
    const profile = await repo.getProfile('u1');
    const interpId = Object.values(profile!.expression).flat().find(i => !i.archivedAt)!.id;
    clock.advance(100);
    await svc.archiveItem('u1', interpId, 'philos', 'test');

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    expect(computeProjectionFingerprint(stored!)).toBe(computeProjectionFingerprint(projected));
  });

  it('fingerprints agree after correctItem', async () => {
    const { svc, clock, repo, projector } = await makeStack();

    clock.advance(100);
    await svc.correctItem('u1', {
      nodeId: 'OrientationResponseDepth',
      correctedContent: 'explanatory',
      correctedAt: new Date(clock.now()).toISOString(),
      targetInterpretationId: null,
      targetObservationId: null,
    }, { userId: 'u1', requestedAt: new Date(clock.now()).toISOString() });

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    expect(computeProjectionFingerprint(stored!)).toBe(computeProjectionFingerprint(projected));
  });
});

// ── F7: verifyProjection report includes fingerprints ────────────────────────

describe('M1-1F F7: verifyProjection report includes storedFingerprint and projectedFingerprint', () => {
  it('report has non-empty fingerprint fields after a write', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationCommunicationStyle', 'direct', 'obs-1');

    const report = await projector.verifyProjection('u1');
    expect(report.storedFingerprint).toBeDefined();
    expect(report.projectedFingerprint).toBeDefined();
    expect(report.storedFingerprint.length).toBeGreaterThan(0);
    expect(report.projectedFingerprint.length).toBeGreaterThan(0);
  });

  it('storedFingerprint equals projectedFingerprint when match is true', async () => {
    const { svc, philos, clock, repo, projector } = await makeStack();

    await proposeAndAccept(svc, philos, clock, repo, 'OrientationResponseDepth', 'brief', 'obs-1');

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
    expect(report.storedFingerprint).toBe(report.projectedFingerprint);
  });
});
