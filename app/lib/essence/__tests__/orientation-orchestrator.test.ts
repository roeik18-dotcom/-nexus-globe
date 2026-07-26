/**
 * M0-7B — Orientation Inference Orchestrator
 *
 * End-to-end tests for OrientationInferenceOrchestrator.
 * Uses a deterministic rule-based provider stub and real infrastructure:
 *   InMemoryEssenceRepository → EssenceProposalService (PipelineRunner)
 *
 * Integration scope:
 *   OrientationInferenceOrchestrator
 *     → StubOrientationProvider (test-only)
 *     → OrientationEvidenceAccumulator
 *     → OrientationProposalEngine
 *     → EssenceProposalService.proposeUpdate()
 *     → EssenceProposalService.getPendingProposals()
 *
 * Out of scope: EssenceReadService, voice gateway, HTTP layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { EssenceProposalService } from '../proposal-service';
import { PipelineRunner } from '../pipeline-runner';
import { OrientationInferenceOrchestrator } from '../orientation-orchestrator';
import type {
  OrientationIntegrationContext,
  ExchangeRecord,
} from '../orientation-integration';
import type {
  OrientationInferenceProvider,
  OrientationSignal,
  OrientationInferenceInput,
} from '../orientation-inference';
import type { EssenceProfile, Interpretation } from '../schema';
import type { OrientationDimensionKey } from '../orientation';

// ── Stub Provider ─────────────────────────────────────────────────────────────

/**
 * Deterministic rule-based OrientationInferenceProvider for tests.
 * Configured with a list of signals to return; never accesses the exchange content.
 */
class StubOrientationProvider implements OrientationInferenceProvider {
  private configured: OrientationSignal[] = [];

  setSignals(signals: OrientationSignal[]): void {
    this.configured = [...signals];
  }

  async extractSignals(
    _input: OrientationInferenceInput,
    _profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]> {
    return [...this.configured];
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = '2026-07-26T00:00:00.000Z';

function makeSignal(overrides: Partial<OrientationSignal> = {}): OrientationSignal {
  return {
    dimensionKey:        'OrientationResponseDepth',
    candidateValue:      'brief',
    sourceObservationId: 'obs-1',
    signalWeight:        1.0,
    inferredBy:          'merlin',
    sessionId:           's1',
    inferredAt:          NOW,
    ...overrides,
  };
}

function makeContext(overrides: Partial<OrientationIntegrationContext> = {}): OrientationIntegrationContext {
  const exchange: ExchangeRecord = { userMessage: 'hello', assistantResponse: 'hi' };
  return {
    profileId:            'u1',
    sessionId:            's1',
    sessionObservationId: 'obs-1',
    exchange,
    ...overrides,
  };
}

function makeActiveInterpretation(
  dimensionKey: OrientationDimensionKey,
  content: string,
): Interpretation {
  return {
    id:                 `interp-${dimensionKey}`,
    version:            1,
    nodeId:             dimensionKey,
    layer:              'expression',
    stabilityClass:     'Adaptive',
    content,
    observationIds:     ['obs-legacy'],
    confidence:         'high',
    interpretationKind: 'probable_interpretation',
    provenance: {
      source:                       'agent_inference',
      confidence:                   'high',
      createdBy:                    'merlin',
      firstObservedAt:              NOW,
      lastConfirmedAt:              NOW,
      lastUpdatedAt:                NOW,
      evidenceIds:                  [],
      conflictingInterpretationIds: [],
    },
    sensitivity:   'personal',
    temporalKind:  'trait',
    stateScope:    null,
    expiresAt:     null,
    archivedAt:    null,
    conflictIds:   [],
    evidenceStatus: 'referenced',
  };
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

interface TestFixture {
  repo:        InMemoryEssenceRepository;
  proposalSvc: EssenceProposalService;
  provider:    StubOrientationProvider;
  orchestrator: OrientationInferenceOrchestrator;
}

function buildFixture(): TestFixture {
  const repo        = new InMemoryEssenceRepository();
  const runner      = new PipelineRunner();
  const proposalSvc = new EssenceProposalService(repo, runner);
  const provider    = new StubOrientationProvider();
  const orchestrator = new OrientationInferenceOrchestrator(provider, proposalSvc, 'merlin');
  return { repo, proposalSvc, provider, orchestrator };
}

/**
 * Create a profile in the repo with the given observation IDs.
 * Returns the profile object (matches what's in the repo).
 */
async function createProfile(
  repo: InMemoryEssenceRepository,
  profileId: string,
  obsIds: string[],
): Promise<EssenceProfile> {
  const profile = await repo.createProfile(profileId);
  for (const id of obsIds) {
    profile.observations.push({
      id,
      source:                   'agent_inference',
      recordedBy:               'merlin',
      content:                  `observation ${id}`,
      sessionId:                's1',
      observedAt:               NOW,
      evidenceIds:              [],
      correctsObservationId:    null,
    });
  }
  await repo.saveProfile(profile);
  // Return a copy that matches the stored state.
  return (await repo.getProfile(profileId))!;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrientationInferenceOrchestrator', () => {
  let fix: TestFixture;

  beforeEach(() => {
    fix = buildFixture();
  });

  // ── Basic emission ────────────────────────────────────────────────────────

  it('no signals → empty report with correct metadata', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1']);
    fix.provider.setSignals([]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    expect(report.profileId).toBe('u1');
    expect(report.sessionId).toBe('s1');
    expect(report.sessionObservationId).toBe('obs-1');
    expect(report.results).toHaveLength(0);
    expect(report.processedAt).toBeTruthy();
  });

  it('single signal (below minimum evidence) → no results', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2']);
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    expect(report.results).toHaveLength(0);
  });

  it('two signals meet minimum evidence → proposal submitted', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2']);
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
      makeSignal({ sourceObservationId: 'obs-2' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    expect(report.results).toHaveLength(1);
    const result = report.results[0];
    expect(result.outcome).toBe('proposal_submitted');
    if (result.outcome !== 'proposal_submitted') throw new Error('type narrowing');

    expect(result.dimensionKey).toBe('OrientationResponseDepth');
    expect(result.candidate.proposedValue).toBe('brief');
    expect(result.candidate.evidenceObservationIds).toContain('obs-1');
    expect(result.candidate.evidenceObservationIds).toContain('obs-2');
    // Orientation node proposals from agents with evidence → 'pending_review'
    expect(result.pipelineStatus).toBe('pending_review');
  });

  it('signal with unknown obs ID discarded — no crash, no result', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1']);
    fix.provider.setSignals([
      // obs-999 does not exist in the profile
      makeSignal({ sourceObservationId: 'obs-999' }),
      makeSignal({ sourceObservationId: 'obs-1' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    // obs-999 discarded; obs-1 accepted (1 signal < minimum 2) → no snapshot
    expect(report.results).toHaveLength(0);
  });

  // ── Two-phase uniqueness invariant ────────────────────────────────────────

  it('multiple signals for same dimension in one exchange → exactly one result', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2', 'obs-3']);
    // Three signals for the same dimension — all accepted, all contributing
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
      makeSignal({ sourceObservationId: 'obs-2' }),
      makeSignal({ sourceObservationId: 'obs-3' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    // At most one result per dimension per exchange (two-phase invariant)
    expect(report.results).toHaveLength(1);
    expect(report.results[0].dimensionKey).toBe('OrientationResponseDepth');
    expect(report.results[0].outcome).toBe('proposal_submitted');
  });

  it('dimension keys in results are unique even across mixed dimensions', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2', 'obs-3', 'obs-4']);
    // Two signals each for two different dimensions
    fix.provider.setSignals([
      makeSignal({ dimensionKey: 'OrientationResponseDepth',      candidateValue: 'brief',   sourceObservationId: 'obs-1' }),
      makeSignal({ dimensionKey: 'OrientationResponseDepth',      candidateValue: 'brief',   sourceObservationId: 'obs-2' }),
      makeSignal({ dimensionKey: 'OrientationCommunicationStyle', candidateValue: 'direct',  sourceObservationId: 'obs-3' }),
      makeSignal({ dimensionKey: 'OrientationCommunicationStyle', candidateValue: 'direct',  sourceObservationId: 'obs-4' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    const keys = report.results.map(r => r.dimensionKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
    expect(uniqueKeys.has('OrientationResponseDepth')).toBe(true);
    expect(uniqueKeys.has('OrientationCommunicationStyle')).toBe(true);
  });

  // ── Multi-dimension ───────────────────────────────────────────────────────

  it('signals across two dimensions produce two results', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2', 'obs-3', 'obs-4']);
    fix.provider.setSignals([
      makeSignal({ dimensionKey: 'OrientationResponseDepth',      candidateValue: 'brief',  sourceObservationId: 'obs-1' }),
      makeSignal({ dimensionKey: 'OrientationResponseDepth',      candidateValue: 'brief',  sourceObservationId: 'obs-2' }),
      makeSignal({ dimensionKey: 'OrientationTaskFraming',        candidateValue: 'action_first', sourceObservationId: 'obs-3' }),
      makeSignal({ dimensionKey: 'OrientationTaskFraming',        candidateValue: 'action_first', sourceObservationId: 'obs-4' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    expect(report.results).toHaveLength(2);
    const outcomes = report.results.map(r => r.outcome);
    expect(outcomes.every(o => o === 'proposal_submitted')).toBe(true);
    const dimKeys = report.results.map(r => r.dimensionKey);
    expect(dimKeys).toContain('OrientationResponseDepth');
    expect(dimKeys).toContain('OrientationTaskFraming');
  });

  // ── Suppression — active value ────────────────────────────────────────────

  it('winner matches active interpretation → suppressed with same_as_active_value', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2']);
    // Pre-populate an active interpretation for OrientationResponseDepth = 'brief'
    profile.expression['OrientationResponseDepth'] = [
      makeActiveInterpretation('OrientationResponseDepth', 'brief'),
    ];
    // Note: this mutates the local copy; the repo still has the old state.
    // The orchestrator uses the profile passed to it (not the repo).
    // proposeUpdate() would fail on evidence validation if called, but it's suppressed.

    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1', candidateValue: 'brief' }),
      makeSignal({ sourceObservationId: 'obs-2', candidateValue: 'brief' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    expect(report.results).toHaveLength(1);
    const result = report.results[0];
    expect(result.outcome).toBe('suppressed');
    if (result.outcome !== 'suppressed') throw new Error('type narrowing');
    expect(result.reason).toBe('same_as_active_value');
  });

  it('winner differs from active interpretation → not suppressed', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2']);
    // Active value is 'explanatory'; signals favor 'brief'
    profile.expression['OrientationResponseDepth'] = [
      makeActiveInterpretation('OrientationResponseDepth', 'explanatory'),
    ];
    // Save the profile so proposeUpdate() can validate evidence IDs against the repo.
    await fix.repo.saveProfile(profile);

    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1', candidateValue: 'brief' }),
      makeSignal({ sourceObservationId: 'obs-2', candidateValue: 'brief' }),
    ]);

    const report = await fix.orchestrator.processExchange(makeContext(), profile);

    expect(report.results).toHaveLength(1);
    expect(report.results[0].outcome).toBe('proposal_submitted');
  });

  // ── Suppression — emission tracker ────────────────────────────────────────

  it('equivalent_pending: second exchange with more evidence suppresses re-submission', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2', 'obs-3']);

    // Exchange 1: two signals → proposal submitted → tracker has emittedWeight: 2.0
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1', signalWeight: 1.0 }),
      makeSignal({ sourceObservationId: 'obs-2', signalWeight: 1.0 }),
    ]);
    const report1 = await fix.orchestrator.processExchange(makeContext({ sessionObservationId: 'obs-1' }), profile);
    expect(report1.results[0]?.outcome).toBe('proposal_submitted');

    // Exchange 2: one more signal → accumulator emits snapshot at weight 3.0
    // Tracker has pending entry with emittedWeight: 2.0, weight increased → equivalent_pending
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-3', signalWeight: 1.0 }),
    ]);
    const report2 = await fix.orchestrator.processExchange(makeContext({ sessionObservationId: 'obs-3' }), profile);

    expect(report2.results).toHaveLength(1);
    const result2 = report2.results[0];
    expect(result2.outcome).toBe('suppressed');
    if (result2.outcome !== 'suppressed') throw new Error('type narrowing');
    expect(result2.reason).toBe('equivalent_pending');
  });

  it('below_minimum_evidence: single signal never produces a result', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1', 'obs-2', 'obs-3']);

    // Only one signal → accumulator doesn't emit a snapshot → latestSnapshots is empty
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
    ]);
    const report = await fix.orchestrator.processExchange(makeContext(), profile);
    expect(report.results).toHaveLength(0);
  });

  // ── Candidate richness ────────────────────────────────────────────────────

  it('submitted candidate has correct profileId and dimensionKey', async () => {
    const profile = await createProfile(fix.repo, 'u2', ['obs-1', 'obs-2']);
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
      makeSignal({ sourceObservationId: 'obs-2' }),
    ]);
    const ctx = makeContext({ profileId: 'u2', sessionObservationId: 'obs-1' });

    const report = await fix.orchestrator.processExchange(ctx, profile);

    expect(report.results).toHaveLength(1);
    const result = report.results[0];
    expect(result.outcome).toBe('proposal_submitted');
    if (result.outcome !== 'proposal_submitted') throw new Error('type narrowing');
    expect(result.candidate.profileId).toBe('u2');
    expect(result.candidate.dimensionKey).toBe('OrientationResponseDepth');
    expect(result.candidate.accumulatedConfidence).toBe('low'); // weight 2.0 < 3.0
  });

  it('report metadata matches the context passed in', async () => {
    const profile = await createProfile(fix.repo, 'u1', ['obs-1']);
    fix.provider.setSignals([]);
    const ctx = makeContext({ profileId: 'u1', sessionId: 's42', sessionObservationId: 'obs-x' });
    // obs-x not in profile, but no signals reference it, so no validation error

    const report = await fix.orchestrator.processExchange(ctx, profile);

    expect(report.profileId).toBe('u1');
    expect(report.sessionId).toBe('s42');
    expect(report.sessionObservationId).toBe('obs-x');
  });

  // ── Profile isolation ─────────────────────────────────────────────────────

  it('accumulator is keyed by profileId — different profiles are independent', async () => {
    // Profile A and profile B each have their own evidence accumulation.
    const profileA = await createProfile(fix.repo, 'u-a', ['obs-1', 'obs-2']);
    const profileB = await createProfile(fix.repo, 'u-b', ['obs-1']);

    // Exchange for profile A: meets minimum evidence → proposal
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
      makeSignal({ sourceObservationId: 'obs-2' }),
    ]);
    const reportA = await fix.orchestrator.processExchange(
      makeContext({ profileId: 'u-a', sessionObservationId: 'obs-1' }),
      profileA,
    );
    expect(reportA.results[0]?.outcome).toBe('proposal_submitted');

    // Exchange for profile B: only 1 obs → below minimum
    fix.provider.setSignals([
      makeSignal({ sourceObservationId: 'obs-1' }),
    ]);
    const reportB = await fix.orchestrator.processExchange(
      makeContext({ profileId: 'u-b', sessionObservationId: 'obs-1' }),
      profileB,
    );
    expect(reportB.results).toHaveLength(0);
  });
});
