/**
 * M0-6B — Orientation Inference: Accumulator + ProposalEngine
 *
 * Tests for OrientationEvidenceAccumulator and OrientationProposalEngine.
 * The accumulator and engine are exercised independently; integration with
 * EssenceProposalService is out of scope for these unit tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrientationEvidenceAccumulator, mapConfidence } from '../orientation-accumulator';
import { OrientationProposalEngine } from '../orientation-proposal-engine';
import type {
  OrientationSignal,
  AccumulatorSnapshot,
  OrientationProposalContext,
  DimensionEvidenceState,
  AccumulatorDiagnostics,
} from '../orientation-inference';
import { MINIMUM_CONTRIBUTING_OBSERVATIONS } from '../orientation-inference';
import type { EssenceProfile } from '../schema';
import { createEmptyEssenceProfile } from '../schema';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeProfile(obsIds: string[] = []): EssenceProfile {
  const profile = createEmptyEssenceProfile('u1');
  for (const id of obsIds) {
    profile.observations.push({
      id,
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: `observation ${id}`,
      sessionId: 's1',
      observedAt: '2026-07-26T00:00:00.000Z',
      evidenceIds: [],
      correctsObservationId: null,
    });
  }
  return profile;
}

function signal(
  overrides: Partial<OrientationSignal> = {},
): OrientationSignal {
  return {
    dimensionKey:        'OrientationResponseDepth',
    candidateValue:      'brief',
    sourceObservationId: 'obs-1',
    signalWeight:        1.0,
    inferredBy:          'merlin',
    sessionId:           's1',
    inferredAt:          '2026-07-26T00:00:00.000Z',
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<{
  profileId: string;
  candidateValue: string;
  accumulatedWeight: number;
  contributingObsIds: string[];
  accumulatedConfidence: DimensionEvidenceState['accumulatedConfidence'];
}>): AccumulatorSnapshot {
  const {
    profileId = 'u1',
    candidateValue = 'brief',
    accumulatedWeight = 2.0,
    contributingObsIds = ['obs-1', 'obs-2'],
    accumulatedConfidence = 'low',
  } = overrides ?? {};

  const state: DimensionEvidenceState = {
    dimensionKey: 'OrientationResponseDepth',
    candidateValue,
    accumulatedWeight,
    contributingObsIds: new Set(contributingObsIds),
    accumulatedConfidence,
    lastUpdatedAt: '2026-07-26T00:00:00.000Z',
  };

  return {
    profileId,
    dimensionKey: 'OrientationResponseDepth',
    candidates: [state],
    snapshotAt: '2026-07-26T00:00:00.000Z',
  };
}

function defaultContext(overrides: Partial<OrientationProposalContext> = {}): OrientationProposalContext {
  return {
    activeValue:                undefined,
    pendingEquivalentProposal:  false,
    lastEmittedWeight:          null,
    ...overrides,
  };
}

// ── mapConfidence ──────────────────────────────────────────────────────────────

describe('mapConfidence — continuous interval mapping', () => {
  it('weight 0 → speculative', () => {
    expect(mapConfidence(0)).toBe('speculative');
  });

  it('fractional weight near zero (0.1) → low', () => {
    expect(mapConfidence(0.1)).toBe('low');
  });

  it('weight 1 → low', () => {
    expect(mapConfidence(1)).toBe('low');
  });

  it('weight 2.9 → low (just below medium threshold)', () => {
    expect(mapConfidence(2.9)).toBe('low');
  });

  it('weight 3 → medium (at threshold)', () => {
    expect(mapConfidence(3)).toBe('medium');
  });

  it('weight 4.5 → medium', () => {
    expect(mapConfidence(4.5)).toBe('medium');
  });

  it('weight 5.99 → medium (just below high threshold)', () => {
    expect(mapConfidence(5.99)).toBe('medium');
  });

  it('weight 6 → high (at threshold)', () => {
    expect(mapConfidence(6)).toBe('high');
  });

  it('weight 9.2 → high (above all thresholds)', () => {
    expect(mapConfidence(9.2)).toBe('high');
  });
});

// ── OrientationEvidenceAccumulator ─────────────────────────────────────────────

describe('OrientationEvidenceAccumulator', () => {
  let acc: OrientationEvidenceAccumulator;

  beforeEach(() => {
    acc = new OrientationEvidenceAccumulator();
  });

  it('single valid signal below minimum evidence — no snapshot', () => {
    const profile = makeProfile(['obs-1']);
    const result = acc.accumulate(signal(), profile);
    expect(result).toBeNull();
  });

  it('minimum evidence met — snapshot emitted', () => {
    const profile = makeProfile(['obs-1', 'obs-2']);
    acc.accumulate(signal({ sourceObservationId: 'obs-1' }), profile);
    const snapshot = acc.accumulate(signal({ sourceObservationId: 'obs-2' }), profile);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.dimensionKey).toBe('OrientationResponseDepth');
    expect(snapshot!.candidates).toHaveLength(1);
    expect(snapshot!.candidates[0].candidateValue).toBe('brief');
    expect(snapshot!.candidates[0].accumulatedWeight).toBe(2.0);
    expect(snapshot!.candidates[0].accumulatedConfidence).toBe('low');
  });

  it('same observationId does not stack — deduplication', () => {
    const profile = makeProfile(['obs-1', 'obs-2']);
    acc.accumulate(signal({ sourceObservationId: 'obs-1' }), profile);
    // Second call with the same obsId — must return null, no mutation
    const result = acc.accumulate(signal({ sourceObservationId: 'obs-1' }), profile);
    expect(result).toBeNull();

    const state = acc.getState('u1', 'OrientationResponseDepth');
    expect(state[0].contributingObsIds.size).toBe(1);
    expect(state[0].accumulatedWeight).toBe(1.0);
  });

  it('invalid sourceObservationId is discarded — no mutation, diagnostics called', () => {
    const profile = makeProfile(['obs-1']); // obs-999 does not exist
    const diag: AccumulatorDiagnostics = { onInvalidObservationReference: vi.fn() };

    const result = acc.accumulate(
      signal({ sourceObservationId: 'obs-999' }),
      profile,
      diag,
    );

    expect(result).toBeNull();
    expect(diag.onInvalidObservationReference).toHaveBeenCalledOnce();
    expect(acc.getState('u1', 'OrientationResponseDepth')).toHaveLength(0);
  });

  it('invalid sourceObservationId is discarded silently when no diagnostics provided', () => {
    const profile = makeProfile(['obs-1']);
    // must not throw even with no diagnostics
    expect(() =>
      acc.accumulate(signal({ sourceObservationId: 'obs-999' }), profile),
    ).not.toThrow();
  });

  it('fractional signalWeights accumulate correctly', () => {
    const profile = makeProfile(['obs-1', 'obs-2', 'obs-3']);
    acc.accumulate(signal({ sourceObservationId: 'obs-1', signalWeight: 0.6 }), profile);
    acc.accumulate(signal({ sourceObservationId: 'obs-2', signalWeight: 0.8 }), profile);
    const snapshot = acc.accumulate(
      signal({ sourceObservationId: 'obs-3', signalWeight: 0.7 }), profile,
    );

    const winner = snapshot!.candidates[0];
    expect(winner.accumulatedWeight).toBeCloseTo(2.1);
    expect(winner.contributingObsIds.size).toBe(3);
    expect(winner.accumulatedConfidence).toBe('low'); // 2.1 < 3
  });

  it('contributingObsIds on snapshot is a copy — mutations do not affect prior snapshots', () => {
    const profile = makeProfile(['obs-1', 'obs-2', 'obs-3']);
    acc.accumulate(signal({ sourceObservationId: 'obs-1' }), profile);
    const snapshot1 = acc.accumulate(signal({ sourceObservationId: 'obs-2' }), profile);

    // Add a third signal — must not retroactively change snapshot1
    acc.accumulate(signal({ sourceObservationId: 'obs-3' }), profile);

    expect(snapshot1!.candidates[0].contributingObsIds.size).toBe(2);
  });

  it('snapshot candidates sorted by accumulatedWeight descending', () => {
    const profile = makeProfile(['obs-1', 'obs-2', 'obs-3']);
    // Accumulate for 'brief' (weight 1.0) and 'explanatory' (weight 2.0)
    acc.accumulate(
      signal({ sourceObservationId: 'obs-1', candidateValue: 'brief', signalWeight: 1.0 }),
      profile,
    );
    acc.accumulate(
      signal({ sourceObservationId: 'obs-2', candidateValue: 'explanatory', signalWeight: 1.0 }),
      profile,
    );
    const snapshot = acc.accumulate(
      signal({ sourceObservationId: 'obs-3', candidateValue: 'explanatory', signalWeight: 1.0 }),
      profile,
    );

    expect(snapshot!.candidates[0].candidateValue).toBe('explanatory');
    expect(snapshot!.candidates[0].accumulatedWeight).toBe(2.0);
    expect(snapshot!.candidates[1].candidateValue).toBe('brief');
  });

  it('accumulator is keyed by profileId — different profiles are isolated', () => {
    const profileA = makeProfile(['obs-1', 'obs-2']);
    profileA.observations[0] = { ...profileA.observations[0] };
    // make profile B share the same obsIds so we can test isolation
    const profileB = { ...makeProfile(['obs-1', 'obs-2']), profileId: 'u2' };

    acc.accumulate(signal({ sourceObservationId: 'obs-1' }), profileA);
    acc.accumulate(signal({ sourceObservationId: 'obs-2' }), profileA);

    // profileB has no evidence yet
    expect(acc.getState('u2', 'OrientationResponseDepth')).toHaveLength(0);
  });

  it('getState returns empty array for unknown profile/dimension', () => {
    expect(acc.getState('nonexistent', 'OrientationResponseDepth')).toEqual([]);
  });
});

// ── OrientationProposalEngine ──────────────────────────────────────────────────

describe('OrientationProposalEngine', () => {
  let engine: OrientationProposalEngine;

  beforeEach(() => {
    engine = new OrientationProposalEngine();
  });

  it('empty snapshot → no_candidates', () => {
    const snapshot: AccumulatorSnapshot = {
      profileId: 'u1',
      dimensionKey: 'OrientationResponseDepth',
      candidates: [],
      snapshotAt: '2026-07-26T00:00:00.000Z',
    };
    const decision = engine.evaluate(snapshot, defaultContext());
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'no_candidates' });
  });

  it('winner has fewer than MINIMUM_CONTRIBUTING_OBSERVATIONS → below_minimum_evidence', () => {
    const snapshot = makeSnapshot({ contributingObsIds: ['obs-1'] }); // only 1
    const decision = engine.evaluate(snapshot, defaultContext());
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'below_minimum_evidence' });
  });

  it('winner confidence is speculative → below_confidence_threshold', () => {
    const snapshot = makeSnapshot({
      accumulatedWeight: 0,
      accumulatedConfidence: 'speculative',
    });
    const decision = engine.evaluate(snapshot, defaultContext());
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'below_confidence_threshold' });
  });

  it('winner value matches activeValue → same_as_active_value', () => {
    const snapshot = makeSnapshot({ candidateValue: 'brief' });
    const decision = engine.evaluate(snapshot, defaultContext({ activeValue: 'brief' }));
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'same_as_active_value' });
  });

  it('different activeValue does not suppress', () => {
    const snapshot = makeSnapshot({ candidateValue: 'brief' });
    const decision = engine.evaluate(snapshot, defaultContext({ activeValue: 'explanatory' }));
    expect(decision.shouldPropose).toBe(true);
  });

  it('no activeValue — same_as_active_value check skipped', () => {
    const snapshot = makeSnapshot({ candidateValue: 'brief' });
    const decision = engine.evaluate(snapshot, defaultContext({ activeValue: undefined }));
    expect(decision.shouldPropose).toBe(true);
  });

  it('pending + weight unchanged → weight_unchanged_while_pending', () => {
    const snapshot = makeSnapshot({ accumulatedWeight: 2.0 });
    const decision = engine.evaluate(snapshot, defaultContext({
      pendingEquivalentProposal: true,
      lastEmittedWeight: 2.0,
    }));
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'weight_unchanged_while_pending' });
  });

  it('pending + weight increased → equivalent_pending (not weight_unchanged)', () => {
    const snapshot = makeSnapshot({ accumulatedWeight: 3.0 });
    const decision = engine.evaluate(snapshot, defaultContext({
      pendingEquivalentProposal: true,
      lastEmittedWeight: 2.0, // weight did increase: 2.0 → 3.0
    }));
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'equivalent_pending' });
  });

  it('pending + no prior emission (lastEmittedWeight null) → equivalent_pending', () => {
    const snapshot = makeSnapshot({});
    const decision = engine.evaluate(snapshot, defaultContext({
      pendingEquivalentProposal: true,
      lastEmittedWeight: null,
    }));
    expect(decision.shouldPropose).toBe(false);
    expect(decision).toMatchObject({ reason: 'equivalent_pending' });
  });

  it('prior proposal resolved — lastEmittedWeight null resets suppression, new proposal allowed', () => {
    const snapshot = makeSnapshot({ accumulatedWeight: 2.0 });
    // Prior proposal was at weight 2.0 but has since been resolved (null = reset)
    const decision = engine.evaluate(snapshot, defaultContext({
      pendingEquivalentProposal: false,
      lastEmittedWeight: null,
    }));
    expect(decision.shouldPropose).toBe(true);
  });

  it('all checks pass — returns candidate with correct fields', () => {
    const snapshot = makeSnapshot({
      profileId: 'u1',
      candidateValue: 'brief',
      accumulatedWeight: 2.0,
      contributingObsIds: ['obs-1', 'obs-2'],
      accumulatedConfidence: 'low',
    });
    const decision = engine.evaluate(snapshot, defaultContext());

    expect(decision.shouldPropose).toBe(true);
    if (!decision.shouldPropose) throw new Error('type narrowing');

    expect(decision.candidate.profileId).toBe('u1');
    expect(decision.candidate.dimensionKey).toBe('OrientationResponseDepth');
    expect(decision.candidate.proposedValue).toBe('brief');
    expect(decision.candidate.accumulatedConfidence).toBe('low');
    expect(decision.candidate.evidenceObservationIds).toHaveLength(2);
    expect(decision.candidate.evidenceObservationIds).toContain('obs-1');
    expect(decision.candidate.evidenceObservationIds).toContain('obs-2');
    expect(decision.candidate.proposedAt).toBeTruthy();
  });

  it('rationale cites observation count and IDs', () => {
    const snapshot = makeSnapshot({
      contributingObsIds: ['obs-1', 'obs-2'],
      accumulatedWeight: 2.0,
    });
    const decision = engine.evaluate(snapshot, defaultContext());

    expect(decision.shouldPropose).toBe(true);
    if (!decision.shouldPropose) throw new Error('type narrowing');

    const { rationale } = decision.candidate;
    expect(rationale).toContain('2 independent observations');
    expect(rationale).toContain('obs-1');
    expect(rationale).toContain('obs-2');
    expect(rationale).toContain('brief');
    expect(rationale).toContain('low');
  });

  it('MINIMUM_CONTRIBUTING_OBSERVATIONS constant matches policy', () => {
    // Verify the policy constant matches what both components use.
    expect(MINIMUM_CONTRIBUTING_OBSERVATIONS).toBe(2);
  });
});
