/**
 * M1-1A+B — Essence Timeline domain model and repository.
 *
 * Covers:
 *   A1  EssenceTimelineEvent shape and schemaVersion
 *   A2  All 7 event types are constructable and round-trip through JSON
 *   B1  InMemoryEssenceTimelineRepository: append + load variants
 *   B2  FileSystemEssenceTimelineRepository: durability + crash-line tolerance
 *   B3  noopTimelineRepository: all reads return empty, append is silent
 *   B4  Append is insertion-ordered across all load variants
 *   B5  loadByProfile / loadByProposal / loadByInterpretation cross-filtering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InMemoryEssenceTimelineRepository, noopTimelineRepository } from '../in-memory-timeline-repository';
import { FileSystemEssenceTimelineRepository } from '../../essence-timeline-fs-repository';
import { TIMELINE_SCHEMA_VERSION } from '../timeline';
import type {
  EssenceTimelineEvent,
  ObservationReceivedPayload,
  ProposalCreatedPayload,
  ReviewDecidedPayload,
  InterpretationCommittedPayload,
  ProposalRejectedPayload,
  ProposalExpiredPayload,
  UserConfirmationRequiredPayload,
} from '../timeline';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = '2026-07-28T10:00:00.000Z';

function makeEvent(
  overrides: Partial<EssenceTimelineEvent> & Pick<EssenceTimelineEvent, 'id' | 'eventType' | 'payload'>,
): EssenceTimelineEvent {
  return {
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    occurredAt: NOW,
    profileId: 'u1',
    nodeId: 'OrientationResponseDepth',
    proposalId: null,
    interpretationId: null,
    observationId: null,
    causationEventId: null,
    ...overrides,
  };
}

const observationReceivedPayload: ObservationReceivedPayload = {
  eventType: 'observation_received',
  observationId: 'obs-1',
  source: 'agent_inference',
  recordedBy: 'merlin',
};

const proposalCreatedPayload: ProposalCreatedPayload = {
  eventType: 'proposal_created',
  proposalId: 'prop-1',
  proposedContent: 'explanatory',
  proposedBy: 'merlin',
  accumulatedConfidence: 'high',
  evidenceObservationIds: ['obs-1'],
};

const reviewDecidedPayload: ReviewDecidedPayload = {
  eventType: 'review_decided',
  proposalId: 'prop-1',
  decision: 'accept',
  reason: 'high_confidence_auto_accepted',
  reviewer: 'philos',
  policyVersion: '1.0',
  newStatus: 'confirmed',
};

const interpretationCommittedPayload: InterpretationCommittedPayload = {
  eventType: 'interpretation_committed',
  proposalId: 'prop-1',
  interpretationId: 'interp-1',
  content: 'explanatory',
  confidence: 'high',
  committedBy: 'philos',
  previousInterpretationId: null,
};

const proposalRejectedPayload: ProposalRejectedPayload = {
  eventType: 'proposal_rejected',
  proposalId: 'prop-r1',
  reason: 'speculative_confidence',
  rejectedBy: 'philos',
};

const proposalExpiredPayload: ProposalExpiredPayload = {
  eventType: 'proposal_expired',
  proposalId: 'prop-e1',
  expiredAt: '2026-07-28T09:00:00.000Z',
};

const userConfirmationRequiredPayload: UserConfirmationRequiredPayload = {
  eventType: 'user_confirmation_required',
  proposalId: 'prop-u1',
  proposedContent: 'brief',
  reason: 'low_confidence_requires_user',
};

// ── A1+A2: Domain model shape and JSON round-trip ─────────────────────────────

describe('M1-1A: EssenceTimelineEvent domain model', () => {
  it('schemaVersion constant is 1', () => {
    expect(TIMELINE_SCHEMA_VERSION).toBe(1);
  });

  it('event shape includes all required fields', () => {
    const event = makeEvent({
      id: 'tevt-1',
      eventType: 'observation_received',
      observationId: 'obs-1',
      payload: observationReceivedPayload,
    });

    expect(event.id).toBe('tevt-1');
    expect(event.schemaVersion).toBe(1);
    expect(event.eventType).toBe('observation_received');
    expect(event.occurredAt).toBe(NOW);
    expect(event.profileId).toBe('u1');
    expect(event.nodeId).toBe('OrientationResponseDepth');
    expect(event.proposalId).toBeNull();
    expect(event.interpretationId).toBeNull();
    expect(event.observationId).toBe('obs-1');
  });

  it.each([
    ['observation_received',       observationReceivedPayload,       { observationId: 'obs-1' }],
    ['proposal_created',           proposalCreatedPayload,           { proposalId: 'prop-1' }],
    ['review_decided',             reviewDecidedPayload,             { proposalId: 'prop-1' }],
    ['interpretation_committed',   interpretationCommittedPayload,   { interpretationId: 'interp-1', proposalId: 'prop-1' }],
    ['proposal_rejected',          proposalRejectedPayload,          { proposalId: 'prop-r1' }],
    ['proposal_expired',           proposalExpiredPayload,           { proposalId: 'prop-e1' }],
    ['user_confirmation_required', userConfirmationRequiredPayload,  { proposalId: 'prop-u1' }],
  ] as const)('all 7 event types round-trip through JSON: %s', (type, payload, linkage) => {
    const event = makeEvent({
      id: `tevt-${type}`,
      eventType: type,
      ...linkage,
      payload,
    });
    const serialized = JSON.stringify(event);
    const parsed = JSON.parse(serialized) as EssenceTimelineEvent;

    expect(parsed.eventType).toBe(type);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.payload.eventType).toBe(type);
  });

  it('previousInterpretationId is null when no prior interpretation exists', () => {
    const payload: InterpretationCommittedPayload = {
      ...interpretationCommittedPayload,
      previousInterpretationId: null,
    };
    expect(payload.previousInterpretationId).toBeNull();
  });

  it('previousInterpretationId carries the archived interpretation id when set', () => {
    const payload: InterpretationCommittedPayload = {
      ...interpretationCommittedPayload,
      previousInterpretationId: 'interp-old',
    };
    expect(payload.previousInterpretationId).toBe('interp-old');
  });
});

// ── B1: InMemoryEssenceTimelineRepository ─────────────────────────────────────

describe('M1-1B: InMemoryEssenceTimelineRepository', () => {
  let repo: InMemoryEssenceTimelineRepository;

  beforeEach(() => {
    repo = new InMemoryEssenceTimelineRepository();
  });

  it('append stores event, loadByProfile returns it', async () => {
    const event = makeEvent({ id: 'e1', eventType: 'proposal_created', proposalId: 'prop-1', payload: proposalCreatedPayload });
    await repo.append(event);
    const loaded = await repo.loadByProfile('u1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('e1');
  });

  it('loadByProfile filters by profileId', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'proposal_created', profileId: 'u1', proposalId: 'prop-1', payload: proposalCreatedPayload }));
    await repo.append(makeEvent({ id: 'e2', eventType: 'proposal_created', profileId: 'u2', proposalId: 'prop-2', payload: { ...proposalCreatedPayload, proposalId: 'prop-2' } }));

    const u1 = await repo.loadByProfile('u1');
    const u2 = await repo.loadByProfile('u2');
    expect(u1).toHaveLength(1);
    expect(u2).toHaveLength(1);
    expect(u1[0].profileId).toBe('u1');
  });

  it('loadByProposal returns only events for that proposalId', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'proposal_created', proposalId: 'prop-1', payload: proposalCreatedPayload }));
    await repo.append(makeEvent({ id: 'e2', eventType: 'review_decided', proposalId: 'prop-1', payload: reviewDecidedPayload }));
    await repo.append(makeEvent({ id: 'e3', eventType: 'proposal_created', proposalId: 'prop-2', payload: { ...proposalCreatedPayload, proposalId: 'prop-2' } }));

    const byProp1 = await repo.loadByProposal('prop-1');
    expect(byProp1).toHaveLength(2);
    expect(byProp1.map(e => e.id)).toEqual(['e1', 'e2']);
  });

  it('loadByInterpretation returns only events for that interpretationId', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'interpretation_committed', proposalId: 'prop-1', interpretationId: 'interp-1', payload: interpretationCommittedPayload }));
    await repo.append(makeEvent({ id: 'e2', eventType: 'interpretation_committed', proposalId: 'prop-2', interpretationId: 'interp-2', payload: { ...interpretationCommittedPayload, proposalId: 'prop-2', interpretationId: 'interp-2' } }));

    const byInterp = await repo.loadByInterpretation('interp-1');
    expect(byInterp).toHaveLength(1);
    expect(byInterp[0].id).toBe('e1');
  });

  it('insertion order is preserved across all load methods', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.append(makeEvent({ id: `e${i}`, eventType: 'proposal_created', proposalId: 'prop-1', payload: proposalCreatedPayload }));
    }
    const events = await repo.loadByProfile('u1');
    expect(events.map(e => e.id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
  });

  it('empty repository returns empty array for all load methods', async () => {
    expect(await repo.loadByProfile('u1')).toHaveLength(0);
    expect(await repo.loadByProposal('prop-1')).toHaveLength(0);
    expect(await repo.loadByInterpretation('interp-1')).toHaveLength(0);
  });

  it('all() helper returns all events regardless of profile', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'proposal_created', profileId: 'u1', proposalId: 'prop-1', payload: proposalCreatedPayload }));
    await repo.append(makeEvent({ id: 'e2', eventType: 'proposal_created', profileId: 'u2', proposalId: 'prop-2', payload: { ...proposalCreatedPayload, proposalId: 'prop-2' } }));
    expect(repo.all()).toHaveLength(2);
  });
});

// ── B2: FileSystemEssenceTimelineRepository ───────────────────────────────────

describe('M1-1B: FileSystemEssenceTimelineRepository', () => {
  let dataDir: string;
  let repo: FileSystemEssenceTimelineRepository;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'm1-1-timeline-'));
    repo = new FileSystemEssenceTimelineRepository(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('append persists event; loadByProfile reads it back after fresh instance', async () => {
    const event = makeEvent({ id: 'e1', eventType: 'proposal_created', proposalId: 'prop-1', payload: proposalCreatedPayload });
    await repo.append(event);

    const repo2 = new FileSystemEssenceTimelineRepository(dataDir);
    const loaded = await repo2.loadByProfile('u1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('e1');
    expect(loaded[0].payload).toEqual(proposalCreatedPayload);
  });

  it('multiple appends accumulate in insertion order', async () => {
    for (let i = 0; i < 4; i++) {
      await repo.append(makeEvent({ id: `e${i}`, eventType: 'proposal_created', proposalId: `prop-${i}`, payload: { ...proposalCreatedPayload, proposalId: `prop-${i}` } }));
    }
    const loaded = await repo.loadByProfile('u1');
    expect(loaded.map(e => e.id)).toEqual(['e0', 'e1', 'e2', 'e3']);
  });

  it('loadByProposal filters correctly on FS', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'proposal_created', proposalId: 'prop-A', payload: proposalCreatedPayload }));
    await repo.append(makeEvent({ id: 'e2', eventType: 'review_decided', proposalId: 'prop-A', payload: reviewDecidedPayload }));
    await repo.append(makeEvent({ id: 'e3', eventType: 'proposal_created', proposalId: 'prop-B', payload: { ...proposalCreatedPayload, proposalId: 'prop-B' } }));

    const byA = await repo.loadByProposal('prop-A');
    const byB = await repo.loadByProposal('prop-B');
    expect(byA).toHaveLength(2);
    expect(byB).toHaveLength(1);
  });

  it('loadByInterpretation filters correctly on FS', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'interpretation_committed', proposalId: 'prop-1', interpretationId: 'interp-1', payload: interpretationCommittedPayload }));
    await repo.append(makeEvent({ id: 'e2', eventType: 'interpretation_committed', proposalId: 'prop-2', interpretationId: 'interp-2', payload: { ...interpretationCommittedPayload, interpretationId: 'interp-2', proposalId: 'prop-2' } }));

    const byInterp1 = await repo.loadByInterpretation('interp-1');
    expect(byInterp1).toHaveLength(1);
    expect(byInterp1[0].interpretationId).toBe('interp-1');
  });

  it('corrupt JSONL line is skipped without crashing', async () => {
    await repo.append(makeEvent({ id: 'e1', eventType: 'proposal_created', proposalId: 'prop-1', payload: proposalCreatedPayload }));
    // Inject a corrupt line directly into the file.
    appendFileSync(join(dataDir, 'timeline.jsonl'), 'NOT VALID JSON\n', 'utf-8');
    await repo.append(makeEvent({ id: 'e2', eventType: 'proposal_created', proposalId: 'prop-2', payload: { ...proposalCreatedPayload, proposalId: 'prop-2' } }));

    const loaded = await repo.loadByProfile('u1');
    // Only the two valid events are returned; the corrupt line is skipped.
    expect(loaded.map(e => e.id)).toEqual(['e1', 'e2']);
  });

  it('loadByProfile returns empty when timeline.jsonl does not exist', async () => {
    const freshRepo = new FileSystemEssenceTimelineRepository(dataDir);
    const events = await freshRepo.loadByProfile('u1');
    expect(events).toHaveLength(0);
  });
});

// ── B3: noopTimelineRepository ────────────────────────────────────────────────

describe('M1-1B: noopTimelineRepository', () => {
  it('append is silent — no error thrown', async () => {
    const event = makeEvent({ id: 'e1', eventType: 'proposal_created', proposalId: 'prop-1', payload: proposalCreatedPayload });
    await expect(noopTimelineRepository.append(event)).resolves.toBeUndefined();
  });

  it('all load methods return empty arrays', async () => {
    expect(await noopTimelineRepository.loadByProfile('u1')).toHaveLength(0);
    expect(await noopTimelineRepository.loadByProposal('prop-1')).toHaveLength(0);
    expect(await noopTimelineRepository.loadByInterpretation('interp-1')).toHaveLength(0);
  });
});
