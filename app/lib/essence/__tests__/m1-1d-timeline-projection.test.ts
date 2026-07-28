/**
 * M1-1D — Timeline Projection
 *
 * Covers:
 *   P1  Full replay — proposeUpdate → Philos accept → rebuildProfile matches stored profile
 *   P2  Empty timeline — rebuildProfile on empty timeline returns empty-ish profile
 *   P3  Duplicate replay — calling rebuildProfile twice gives identical result (idempotency)
 *   P4  Event ordering — same-timestamp events ordered by id as tiebreaker
 *   P5  Restart persistence — FS repo: events survive new instance, rebuild still works
 *   P6  Corrupted/unsupported event — unknown schemaVersion or eventType throws
 *   P7  Projection drift detection — stored profile modified outside Timeline → verifyProjection reports diff
 *   P8  All four profile layers — projection correct for core, aspirations, expression, identity
 *
 * Architecture decisions encoded in tests:
 *   - Evolution IDs are `proj_${event.id}` — stable across replays
 *   - Archival: previousInterpretationId in payload drives archive state
 *   - Only interpretation_committed events mutate the projected profile
 *   - Unknown schemaVersion OR unknown eventType throws immediately (fail-explicit)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EssenceTimelineProjector } from '../timeline-projector';
import type { ProjectionVerificationReport } from '../timeline-projector';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { PipelineRunner } from '../pipeline-runner';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { InMemoryEssenceProposalRepository } from '../in-memory-proposal-repository';
import { InMemoryEssenceTimelineRepository } from '../in-memory-timeline-repository';
import { FileSystemEssenceTimelineRepository } from '../../essence-timeline-fs-repository';
import { TIMELINE_SCHEMA_VERSION } from '../timeline';
import type { EssenceTimelineEvent } from '../timeline';
import type { Clock } from '../pipeline-runner';
import type { ConfidenceLevel } from '../schema';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeClock(ms = 1_000_000): Clock & { advance(n: number): void } {
  let t = ms;
  return { now: () => t, advance(n) { t += n; } };
}

function makeTimelineEvent(overrides: Partial<EssenceTimelineEvent> & { id: string }): EssenceTimelineEvent {
  return {
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    eventType: 'observation_received',
    occurredAt: '2026-07-28T10:00:00.000Z',
    profileId: 'u1',
    nodeId: null,
    proposalId: null,
    interpretationId: null,
    observationId: null,
    causationEventId: null,
    payload: {
      eventType: 'observation_received',
      observationId: 'obs-1',
      source: 'agent_inference',
      recordedBy: 'merlin',
    },
    ...overrides,
  };
}

/**
 * Full stack that emits real timeline events via the write path.
 * Returns the repo, proposalRepo, timeline, svc, and philos so tests can
 * drive the write path and then verify the projected state.
 */
async function fullStack(confidence: ConfidenceLevel = 'high', nodeId = 'OrientationCommunicationStyle') {
  const timeline = new InMemoryEssenceTimelineRepository();
  const clock = makeClock();
  const repo = new InMemoryEssenceRepository();
  const proposalRepo = new InMemoryEssenceProposalRepository();
  const runner = new PipelineRunner(clock);
  const svc = new EssenceProposalService(repo, proposalRepo, runner, clock, undefined, timeline);
  const philos = new PhilosReviewConsumer(svc, clock, timeline);
  const projector = new EssenceTimelineProjector(repo, timeline);

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
    nodeId,
    proposedContent: 'direct',
    evidenceObservationIds: ['obs-seed'],
    proposedBy: 'merlin',
    proposedAt: new Date(clock.now()).toISOString(),
    rationale: 'test',
    accumulatedConfidence: confidence,
  }, null);

  expect(result.status).toBe('pending_review');
  const proposalId = (result as { proposalId: string }).proposalId;

  return { repo, proposalRepo, svc, philos, projector, clock, proposalId, timeline };
}

// ── P1: Full replay ────────────────────────────────────────────────────────────

describe('M1-1D P1: full replay', () => {
  it('rebuildProfile matches stored profile after Philos accept', async () => {
    const { philos, proposalId, repo, projector } = await fullStack('high');
    await philos.consume('u1', proposalId);

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    // Same interpretation IDs and content
    const storedInterps = Object.values(stored!.expression).flat();
    const projInterps = Object.values(projected.expression).flat();
    expect(projInterps).toHaveLength(storedInterps.length);

    for (const projInterp of projInterps) {
      const storedMatch = storedInterps.find(i => i.id === projInterp.id);
      expect(storedMatch, `interpretation ${projInterp.id} not found in stored profile`).toBeDefined();
      expect(projInterp.content).toBe(storedMatch!.content);
      expect(projInterp.confidence).toBe(storedMatch!.confidence);
      expect(projInterp.nodeId).toBe(storedMatch!.nodeId);
    }
  });

  it('projected evolution[] has one entry matching the stored entry', async () => {
    const { philos, proposalId, repo, projector } = await fullStack('high');
    await philos.consume('u1', proposalId);

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    expect(projected.evolution).toHaveLength(stored!.evolution.length);
    expect(projected.evolution[0].nodeId).toBe(stored!.evolution[0].nodeId);
    expect(projected.evolution[0].newInterpretationId).toBe(stored!.evolution[0].newInterpretationId);
    expect(projected.evolution[0].previousInterpretationId).toBe(stored!.evolution[0].previousInterpretationId);
  });

  it('verifyProjection reports match: true after clean write+replay', async () => {
    const { philos, proposalId, projector } = await fullStack('high');
    await philos.consume('u1', proposalId);

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
    expect(report.differences).toHaveLength(0);
    expect(report.projectedEvolutionCount).toBe(1);
    expect(report.projectedInterpretationCount).toBe(1);
  });

  it('archived previous interpretation is reflected in projected profile', async () => {
    const { philos, proposalId: p1, svc, projector, repo, clock } = await fullStack('high');
    await philos.consume('u1', p1);

    // Write a second proposal for the same node to trigger replace_single_value (archives first).
    await repo.appendObservation('u1', {
      id: 'obs-2',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'second signal',
      sessionId: null,
      observedAt: new Date(clock.now()).toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });
    clock.advance(1000);
    const r2 = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'exploratory',
      evidenceObservationIds: ['obs-2'],
      proposedBy: 'merlin',
      proposedAt: new Date(clock.now()).toISOString(),
      rationale: 'updated',
      accumulatedConfidence: 'high',
    }, null);
    await philos.consume('u1', (r2 as { proposalId: string }).proposalId);

    const stored = await repo.getProfile('u1');
    const projected = await projector.rebuildProfile('u1');

    const storedNode = stored!.expression['OrientationCommunicationStyle'] ?? [];
    const projNode = projected.expression['OrientationCommunicationStyle'] ?? [];

    // Both should have 2 interpretations: one archived, one active.
    expect(projNode).toHaveLength(storedNode.length);
    const storedArchived = storedNode.find(i => i.archivedAt !== null);
    const projArchived = projNode.find(i => i.archivedAt !== null);
    expect(storedArchived?.id).toBeDefined();
    expect(projArchived?.id).toBe(storedArchived?.id);

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(true);
  });
});

// ── P2: Empty timeline ─────────────────────────────────────────────────────────

describe('M1-1D P2: empty timeline', () => {
  it('returns an empty profile when the timeline has no events for the profileId', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    const projector = new EssenceTimelineProjector(repo, timeline);

    const profile = await projector.rebuildProfile('u-unknown');
    expect(profile.profileId).toBe('u-unknown');
    expect(profile.evolution).toHaveLength(0);
    expect(Object.keys(profile.core)).toHaveLength(0);
    expect(Object.keys(profile.expression)).toHaveLength(0);
  });

  it('rebuildAllProfiles returns empty map when timeline is empty', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    const projector = new EssenceTimelineProjector(repo, timeline);

    const map = await projector.rebuildAllProfiles();
    expect(map.size).toBe(0);
  });
});

// ── P3: Duplicate replay (idempotency) ────────────────────────────────────────

describe('M1-1D P3: duplicate replay', () => {
  it('calling rebuildProfile twice on the same timeline produces identical profiles', async () => {
    const { philos, proposalId, projector } = await fullStack('high');
    await philos.consume('u1', proposalId);

    const first = await projector.rebuildProfile('u1');
    const second = await projector.rebuildProfile('u1');

    // Same evolution IDs
    expect(first.evolution.map(e => e.id)).toEqual(second.evolution.map(e => e.id));

    // Same interpretation IDs in each layer
    for (const layer of ['core', 'aspirations', 'expression', 'identity'] as const) {
      for (const nodeId of Object.keys(first[layer])) {
        const a = (first[layer] as Record<string, Array<{ id: string }>>)[nodeId].map(i => i.id);
        const b = (second[layer] as Record<string, Array<{ id: string }>>)[nodeId].map(i => i.id);
        expect(a).toEqual(b);
      }
    }
  });

  it('evolution entry IDs are derived from event IDs and therefore stable', async () => {
    const { philos, proposalId, projector, timeline } = await fullStack('high');
    await philos.consume('u1', proposalId);

    const ic = timeline.all().find(e => e.eventType === 'interpretation_committed')!;
    const profile = await projector.rebuildProfile('u1');
    expect(profile.evolution[0].id).toBe(`proj_${ic.id}`);
  });
});

// ── P4: Event ordering ─────────────────────────────────────────────────────────

describe('M1-1D P4: event ordering', () => {
  it('processes events by occurredAt (lex) — earlier timestamp first', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');
    const projector = new EssenceTimelineProjector(repo, timeline);

    // Append in reverse chronological order
    await timeline.append(makeTimelineEvent({
      id: 'tevt_b',
      eventType: 'interpretation_committed',
      occurredAt: '2026-07-28T11:00:00.000Z',
      nodeId: 'OrientationCommunicationStyle',
      interpretationId: 'interp_b',
      proposalId: null,
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp_b',
        proposalId: null,
        content: 'exploratory',
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: 'interp_a',
      },
    }));
    await timeline.append(makeTimelineEvent({
      id: 'tevt_a',
      eventType: 'interpretation_committed',
      occurredAt: '2026-07-28T10:00:00.000Z',
      nodeId: 'OrientationCommunicationStyle',
      interpretationId: 'interp_a',
      proposalId: null,
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp_a',
        proposalId: null,
        content: 'direct',
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: null,
      },
    }));

    const profile = await projector.rebuildProfile('u1');
    const node = profile.expression['OrientationCommunicationStyle'] ?? [];
    // interp_a was first; interp_b followed and archived it
    const a = node.find(i => i.id === 'interp_a');
    const b = node.find(i => i.id === 'interp_b');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.archivedAt).not.toBeNull();   // archived by interp_b
    expect(b!.archivedAt).toBeNull();       // active
    expect(profile.evolution).toHaveLength(2);
    expect(profile.evolution[0].newInterpretationId).toBe('interp_a');
    expect(profile.evolution[1].newInterpretationId).toBe('interp_b');
  });

  it('same-timestamp events are ordered by id (lex) as tiebreaker', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');
    const projector = new EssenceTimelineProjector(repo, timeline);
    const ts = '2026-07-28T10:00:00.000Z';

    // 'z-tevt' sorts after 'a-tevt' lexicographically
    await timeline.append(makeTimelineEvent({
      id: 'z-tevt',
      eventType: 'interpretation_committed',
      occurredAt: ts,
      nodeId: 'OrientationCommunicationStyle',
      interpretationId: 'interp_z',
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp_z',
        proposalId: null,
        content: 'second',
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: 'interp_a',
      },
    }));
    await timeline.append(makeTimelineEvent({
      id: 'a-tevt',
      eventType: 'interpretation_committed',
      occurredAt: ts,
      nodeId: 'OrientationCommunicationStyle',
      interpretationId: 'interp_a',
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp_a',
        proposalId: null,
        content: 'first',
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: null,
      },
    }));

    const profile = await projector.rebuildProfile('u1');
    // a-tevt sorts before z-tevt, so interp_a is processed first
    expect(profile.evolution[0].newInterpretationId).toBe('interp_a');
    expect(profile.evolution[1].newInterpretationId).toBe('interp_z');
    // interp_a is archived by interp_z
    const node = profile.expression['OrientationCommunicationStyle'] ?? [];
    expect(node.find(i => i.id === 'interp_a')!.archivedAt).not.toBeNull();
    expect(node.find(i => i.id === 'interp_z')!.archivedAt).toBeNull();
  });
});

// ── P5: Restart persistence (FS) ──────────────────────────────────────────────

describe('M1-1D P5: restart persistence', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'm1-1d-proj-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('rebuild works correctly after a new FS repository instance is created', async () => {
    // Write events using the first instance
    const repo = new InMemoryEssenceRepository();
    const timeline1 = new FileSystemEssenceTimelineRepository(dir);

    await repo.createProfile('u1');
    const ts = '2026-07-28T10:00:00.000Z';
    await timeline1.append(makeTimelineEvent({
      id: 'tevt-p',
      eventType: 'interpretation_committed',
      occurredAt: ts,
      nodeId: 'OrientationCommunicationStyle',
      interpretationId: 'interp-1',
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp-1',
        proposalId: null,
        content: 'direct',
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: null,
      },
    }));

    // Create a new FS repo instance pointing at the same directory
    const timeline2 = new FileSystemEssenceTimelineRepository(dir);
    const projector = new EssenceTimelineProjector(repo, timeline2);
    const profile = await projector.rebuildProfile('u1');

    expect(profile.evolution).toHaveLength(1);
    const node = profile.expression['OrientationCommunicationStyle'] ?? [];
    expect(node).toHaveLength(1);
    expect(node[0].content).toBe('direct');
  });

  it('insertion order of events in JSONL is preserved after reload', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline1 = new FileSystemEssenceTimelineRepository(dir);
    await repo.createProfile('u1');

    const events: EssenceTimelineEvent[] = [
      makeTimelineEvent({
        id: 'tevt-1',
        eventType: 'interpretation_committed',
        occurredAt: '2026-07-28T10:00:00.000Z',
        nodeId: 'OrientationCommunicationStyle',
        interpretationId: 'interp-1',
        payload: {
          eventType: 'interpretation_committed',
          interpretationId: 'interp-1',
          proposalId: null,
          content: 'first',
          confidence: 'high',
          committedBy: 'merlin',
          previousInterpretationId: null,
        },
      }),
      makeTimelineEvent({
        id: 'tevt-2',
        eventType: 'interpretation_committed',
        occurredAt: '2026-07-28T11:00:00.000Z',
        nodeId: 'OrientationCommunicationStyle',
        interpretationId: 'interp-2',
        payload: {
          eventType: 'interpretation_committed',
          interpretationId: 'interp-2',
          proposalId: null,
          content: 'second',
          confidence: 'medium',
          committedBy: 'philos',
          previousInterpretationId: 'interp-1',
        },
      }),
    ];
    for (const e of events) await timeline1.append(e);

    const timeline2 = new FileSystemEssenceTimelineRepository(dir);
    const loaded = await timeline2.loadByProfile('u1');
    expect(loaded[0].id).toBe('tevt-1');
    expect(loaded[1].id).toBe('tevt-2');

    const projector = new EssenceTimelineProjector(repo, timeline2);
    const profile = await projector.rebuildProfile('u1');
    expect(profile.evolution[0].newInterpretationId).toBe('interp-1');
    expect(profile.evolution[1].newInterpretationId).toBe('interp-2');
  });
});

// ── P6: Corrupted/unsupported event ───────────────────────────────────────────

describe('M1-1D P6: corrupted / unsupported event', () => {
  it('throws on unknown schemaVersion', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');

    await timeline.append({
      ...makeTimelineEvent({ id: 'bad-evt' }),
      schemaVersion: 99 as typeof TIMELINE_SCHEMA_VERSION,
    });

    const projector = new EssenceTimelineProjector(repo, timeline);
    await expect(projector.rebuildProfile('u1')).rejects.toThrow(/unsupported schemaVersion/);
  });

  it('throws on unknown eventType', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');

    await timeline.append({
      ...makeTimelineEvent({ id: 'bad-evt' }),
      eventType: 'some_future_event_type' as 'observation_received',
    });

    const projector = new EssenceTimelineProjector(repo, timeline);
    await expect(projector.rebuildProfile('u1')).rejects.toThrow(/unknown eventType/);
  });

  it('does not throw on known non-projection event types (observation_received, proposal_created, etc.)', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');

    for (const et of ['observation_received', 'proposal_created', 'review_decided', 'proposal_rejected', 'proposal_expired', 'user_confirmation_required'] as const) {
      await timeline.append(makeTimelineEvent({ id: `evt-${et}`, eventType: et }));
    }

    const projector = new EssenceTimelineProjector(repo, timeline);
    const profile = await projector.rebuildProfile('u1');
    // No interpretation_committed events → no mutations
    expect(profile.evolution).toHaveLength(0);
  });
});

// ── P7: Projection drift detection ────────────────────────────────────────────

describe('M1-1D P7: projection drift detection', () => {
  it('verifyProjection reports match: false when stored profile was modified outside Timeline', async () => {
    const { philos, proposalId, projector, repo } = await fullStack('high');
    await philos.consume('u1', proposalId);

    // Manually mutate stored profile content without emitting a timeline event
    const stored = await repo.getProfile('u1');
    const nodeInterps = stored!.expression['OrientationCommunicationStyle'] ?? [];
    (nodeInterps[nodeInterps.length - 1] as { content: string }).content = 'TAMPERED';
    await repo.saveProfile(stored!);

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(false);
    expect(report.differences.length).toBeGreaterThan(0);
    const contentDiff = report.differences.find(d => d.path.includes('content'));
    expect(contentDiff).toBeDefined();
    expect(contentDiff!.stored).toBe('TAMPERED');
    expect(contentDiff!.projected).toBe('direct');
  });

  it('verifyProjection reports evolution count mismatch when extra evolution entry exists in stored', async () => {
    const { philos, proposalId, projector, repo, clock } = await fullStack('high');
    await philos.consume('u1', proposalId);

    // Add a spurious evolution entry to the stored profile without a corresponding timeline event
    const stored = await repo.getProfile('u1');
    stored!.evolution.push({
      id: 'evo-ghost',
      nodeId: 'Values',
      previousInterpretationId: null,
      newInterpretationId: 'interp-ghost',
      triggeredBy: 'agent_inference',
      agentName: 'ghost',
      timestamp: new Date(clock.now()).toISOString(),
      note: null,
    });
    await repo.saveProfile(stored!);

    const report = await projector.verifyProjection('u1');
    expect(report.match).toBe(false);
    expect(report.storedEvolutionCount).toBe(2);
    expect(report.projectedEvolutionCount).toBe(1);
  });
});

// ── P8: All four profile layers ────────────────────────────────────────────────

describe('M1-1D P8: all four profile layers', () => {
  const LAYER_NODES: Record<string, string> = {
    core: 'Values',
    aspirations: 'Aspirations_Becoming',
    expression: 'OrientationCommunicationStyle',
    identity: 'Roles',
  };

  it.each(Object.entries(LAYER_NODES))('projects interpretation_committed for %s layer (%s node)', async (layer, nodeId) => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');

    const interpId = `interp-${layer}`;
    await timeline.append(makeTimelineEvent({
      id: `tevt-${layer}`,
      eventType: 'interpretation_committed',
      occurredAt: '2026-07-28T10:00:00.000Z',
      nodeId,
      interpretationId: interpId,
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: interpId,
        proposalId: null,
        content: `content for ${layer}`,
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: null,
      },
    }));

    const projector = new EssenceTimelineProjector(repo, timeline);
    const profile = await projector.rebuildProfile('u1');

    const layerData = profile[layer as 'core' | 'aspirations' | 'expression' | 'identity'];
    const node = layerData[nodeId] ?? [];
    expect(node).toHaveLength(1);
    expect(node[0].id).toBe(interpId);
    expect(node[0].content).toBe(`content for ${layer}`);
    expect(node[0].archivedAt).toBeNull();
    expect(profile.evolution).toHaveLength(1);
    expect(profile.evolution[0].newInterpretationId).toBe(interpId);
  });

  it('rebuildAllProfiles collects projections for multiple distinct profileIds', async () => {
    const repo = new InMemoryEssenceRepository();
    const timeline = new InMemoryEssenceTimelineRepository();
    await repo.createProfile('u1');
    await repo.createProfile('u2');

    await timeline.append(makeTimelineEvent({
      id: 'tevt-u1',
      profileId: 'u1',
      eventType: 'interpretation_committed',
      occurredAt: '2026-07-28T10:00:00.000Z',
      nodeId: 'Values',
      interpretationId: 'interp-u1',
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp-u1',
        proposalId: null,
        content: 'honesty',
        confidence: 'high',
        committedBy: 'merlin',
        previousInterpretationId: null,
      },
    }));
    await timeline.append(makeTimelineEvent({
      id: 'tevt-u2',
      profileId: 'u2',
      eventType: 'interpretation_committed',
      occurredAt: '2026-07-28T10:00:00.000Z',
      nodeId: 'Roles',
      interpretationId: 'interp-u2',
      payload: {
        eventType: 'interpretation_committed',
        interpretationId: 'interp-u2',
        proposalId: null,
        content: 'engineer',
        confidence: 'medium',
        committedBy: 'merlin',
        previousInterpretationId: null,
      },
    }));

    const projector = new EssenceTimelineProjector(repo, timeline);
    const map = await projector.rebuildAllProfiles();

    expect(map.size).toBe(2);
    const u1 = map.get('u1')!;
    const u2 = map.get('u2')!;
    expect(Object.keys(u1.core)).toContain('Values');
    expect(Object.keys(u2.identity)).toContain('Roles');
  });
});
