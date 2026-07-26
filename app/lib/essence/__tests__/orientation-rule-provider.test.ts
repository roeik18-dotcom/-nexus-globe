/**
 * M0-8B — Rule-Based Orientation Provider
 *
 * Unit tests for RuleBasedOrientationProvider, plus one integration test
 * that feeds the provider's output into the real OrientationEvidenceAccumulator
 * to verify that the emitted signal fields satisfy downstream validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleBasedOrientationProvider } from '../orientation-rule-provider';
import { OrientationEvidenceAccumulator } from '../orientation-accumulator';
import type { OrientationInferenceInput } from '../orientation-inference';
import type { EssenceProfile } from '../schema';
import { createEmptyEssenceProfile } from '../schema';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOW = '2026-07-26T12:00:00.000Z';
const NOW_MS = new Date(NOW).getTime();

function makeClock() {
  return { now: vi.fn(() => NOW_MS) };
}

function makeInput(
  userMessage: string,
  assistantResponse = 'OK',
  overrides: Partial<OrientationInferenceInput> = {},
): OrientationInferenceInput {
  return {
    sessionId:           's1',
    profileId:           'u1',
    sourceObservationId: 'obs-1',
    exchange:            { userMessage, assistantResponse },
    ...overrides,
  };
}

function makeProfile(obsIds: string[] = ['obs-1']): EssenceProfile {
  const profile = createEmptyEssenceProfile('u1');
  for (const id of obsIds) {
    profile.observations.push({
      id,
      source:        'agent_inference',
      recordedBy:    'merlin',
      content:       `observation ${id}`,
      sessionId:     's1',
      observedAt:    NOW,
      evidenceIds:   [],
      correctsObservationId: null,
    });
  }
  return profile;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function extract(
  provider: RuleBasedOrientationProvider,
  userMessage: string,
  assistantResponse = 'OK',
  overrides: Partial<OrientationInferenceInput> = {},
) {
  return provider.extractSignals(
    makeInput(userMessage, assistantResponse, overrides),
    makeProfile() as Readonly<EssenceProfile>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RuleBasedOrientationProvider', () => {
  let provider: RuleBasedOrientationProvider;

  beforeEach(() => {
    provider = new RuleBasedOrientationProvider('merlin', makeClock());
  });

  // ── No match ──────────────────────────────────────────────────────────────

  it('empty user message → empty array', async () => {
    const signals = await extract(provider, '');
    expect(signals).toHaveLength(0);
  });

  it('unrelated text → empty array', async () => {
    const signals = await extract(provider, 'What is the weather in Tel Aviv?');
    expect(signals).toHaveLength(0);
  });

  // ── Phrase boundary: 'short' alone must not match ─────────────────────────

  it('"shortly after" does not trigger brief', async () => {
    expect(await extract(provider, 'I asked about this shortly after breakfast.')).toHaveLength(0);
  });

  it('"short-term" does not trigger brief', async () => {
    expect(await extract(provider, 'I need a short-term plan.')).toHaveLength(0);
  });

  it('"short circuit" does not trigger brief', async () => {
    expect(await extract(provider, 'There was a short circuit in the lab.')).toHaveLength(0);
  });

  // ── OrientationResponseDepth ──────────────────────────────────────────────

  it('"briefly" → brief', async () => {
    const signals = await extract(provider, 'Explain this briefly.');
    const match = signals.find(s => s.dimensionKey === 'OrientationResponseDepth' && s.candidateValue === 'brief');
    expect(match).toBeDefined();
  });

  it('"tl;dr" → brief', async () => {
    const signals = await extract(provider, 'tl;dr — what happened?');
    expect(signals.some(s => s.candidateValue === 'brief')).toBe(true);
  });

  it('"BRIEFLY" matches — case-insensitive', async () => {
    const signals = await extract(provider, 'Tell me BRIEFLY.');
    expect(signals.some(s => s.candidateValue === 'brief')).toBe(true);
  });

  it('"in detail" → explanatory', async () => {
    const signals = await extract(provider, 'Explain this in detail.');
    expect(signals.some(s => s.candidateValue === 'explanatory')).toBe(true);
  });

  it('"walk me through" → explanatory', async () => {
    const signals = await extract(provider, 'Can you walk me through how this works?');
    expect(signals.some(s => s.candidateValue === 'explanatory')).toBe(true);
  });

  // ── Competing candidates in same dimension ────────────────────────────────

  it('brief and explanatory can both fire from the same message', async () => {
    const signals = await extract(provider, 'Keep it brief, but explain the reasoning in detail.');
    const hasBreif      = signals.some(s => s.dimensionKey === 'OrientationResponseDepth' && s.candidateValue === 'brief');
    const hasExplanatory = signals.some(s => s.dimensionKey === 'OrientationResponseDepth' && s.candidateValue === 'explanatory');
    expect(hasBreif).toBe(true);
    expect(hasExplanatory).toBe(true);
  });

  // ── OrientationCommunicationStyle ─────────────────────────────────────────

  it('"straight to the point" → direct', async () => {
    const signals = await extract(provider, 'Just go straight to the point.');
    expect(signals.some(s => s.candidateValue === 'direct')).toBe(true);
  });

  it('"let\'s explore" → exploratory', async () => {
    const signals = await extract(provider, "Let's explore the options together.");
    expect(signals.some(s => s.candidateValue === 'exploratory')).toBe(true);
  });

  // ── OrientationTaskFraming ────────────────────────────────────────────────

  it('"what should I do" → action_first', async () => {
    const signals = await extract(provider, 'What should I do next?');
    expect(signals.some(s => s.candidateValue === 'action_first')).toBe(true);
  });

  it('"help me understand" → context_first', async () => {
    const signals = await extract(provider, 'Help me understand why this matters.');
    expect(signals.some(s => s.candidateValue === 'context_first')).toBe(true);
  });

  it('"what are my options" → options_first', async () => {
    const signals = await extract(provider, 'What are my options here?');
    expect(signals.some(s => s.candidateValue === 'options_first')).toBe(true);
  });

  // ── OrientationDecisionStyle ──────────────────────────────────────────────

  it('"what\'s the best option" → decisive', async () => {
    const signals = await extract(provider, "What's the best option here?");
    expect(signals.some(s => s.candidateValue === 'decisive')).toBe(true);
  });

  it('"pros and cons" → comparative', async () => {
    const signals = await extract(provider, 'Give me the pros and cons of each.');
    expect(signals.some(s => s.candidateValue === 'comparative')).toBe(true);
  });

  // ── OrientationTaskCadence ────────────────────────────────────────────────

  it('"step by step" → phased', async () => {
    const signals = await extract(provider, 'Walk me through this step by step.');
    expect(signals.some(s => s.candidateValue === 'phased')).toBe(true);
  });

  it('"break it down" → phased', async () => {
    const signals = await extract(provider, 'Break it down for me.');
    expect(signals.some(s => s.candidateValue === 'phased')).toBe(true);
  });

  // ── Hebrew patterns ───────────────────────────────────────────────────────

  it('"בקצרה" → brief', async () => {
    const signals = await extract(provider, 'תסביר לי בקצרה מה זה.');
    expect(signals.some(s => s.candidateValue === 'brief')).toBe(true);
  });

  it('"בפירוט" → explanatory', async () => {
    const signals = await extract(provider, 'תסביר לי בפירוט.');
    expect(signals.some(s => s.candidateValue === 'explanatory')).toBe(true);
  });

  it('"הסבר לי" → context_first', async () => {
    const signals = await extract(provider, 'הסבר לי למה זה קורה.');
    expect(signals.some(s => s.candidateValue === 'context_first')).toBe(true);
  });

  it('"שלב אחר שלב" → phased', async () => {
    const signals = await extract(provider, 'עשה את זה שלב אחר שלב.');
    expect(signals.some(s => s.candidateValue === 'phased')).toBe(true);
  });

  // ── assistantResponse does not affect output ──────────────────────────────

  it('matching phrase in assistantResponse only → no signals', async () => {
    const signals = await extract(provider, 'What happened?', 'I will explain briefly and in detail.');
    expect(signals).toHaveLength(0);
  });

  it('same result with different assistantResponse', async () => {
    const msg = 'Explain this briefly.';
    const a = await extract(provider, msg, 'Sure!');
    const b = await extract(provider, msg, 'Here is a very different response.');
    expect(a.map(s => s.candidateValue)).toEqual(b.map(s => s.candidateValue));
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('at most one signal per (dimensionKey, candidateValue) per call', async () => {
    // Both "tl;dr" and "briefly" match 'brief' — only one signal should be emitted.
    const signals = await extract(provider, 'tl;dr please, keep it brief.');
    const briefSignals = signals.filter(
      s => s.dimensionKey === 'OrientationResponseDepth' && s.candidateValue === 'brief',
    );
    expect(briefSignals).toHaveLength(1);
  });

  // ── Signal field correctness ──────────────────────────────────────────────

  it('emitted signal carries correct field values', async () => {
    const input = makeInput('Explain this briefly.', 'OK', {
      sessionId:           'session-42',
      profileId:           'profile-99',
      sourceObservationId: 'obs-77',
    });
    const signals = await provider.extractSignals(input, makeProfile(['obs-77']) as Readonly<EssenceProfile>);

    const s = signals.find(s => s.candidateValue === 'brief');
    expect(s).toBeDefined();
    expect(s!.sourceObservationId).toBe('obs-77');
    expect(s!.sessionId).toBe('session-42');
    expect(s!.inferredBy).toBe('merlin');
    expect(s!.signalWeight).toBe(1.0);
    expect(s!.inferredAt).toBe(NOW);
  });

  // ── One timestamp per call ────────────────────────────────────────────────

  it('all signals share one inferredAt timestamp per call', async () => {
    const signals = await extract(provider, 'Explain briefly and help me understand the context.');
    expect(signals.length).toBeGreaterThanOrEqual(2);
    const timestamps = new Set(signals.map(s => s.inferredAt));
    expect(timestamps.size).toBe(1);
  });

  it('clock called exactly once per extractSignals call', async () => {
    const clock = makeClock();
    const p = new RuleBasedOrientationProvider('merlin', clock);
    await extract(p, 'Explain briefly and help me understand the context.');
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  // ── signalWeight is uniform ───────────────────────────────────────────────

  it('all emitted signals have signalWeight 1.0', async () => {
    const signals = await extract(
      provider,
      'Briefly explain, step by step, what I should do and give me pros and cons.',
    );
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.signalWeight).toBe(1.0);
    }
  });
});

// ── Interface-Contract Integration Test ───────────────────────────────────────

describe('RuleBasedOrientationProvider → OrientationEvidenceAccumulator contract', () => {
  it('provider signals are accepted by the accumulator and produce a valid snapshot', async () => {
    const clock = { now: () => NOW_MS };
    const provider = new RuleBasedOrientationProvider('merlin', clock);
    const accumulator = new OrientationEvidenceAccumulator(clock);

    // Two observations are required (MINIMUM_CONTRIBUTING_OBSERVATIONS = 2).
    const profile = makeProfile(['obs-1', 'obs-2']);

    // Exchange 1 — obs-1
    const signals1 = await provider.extractSignals(
      makeInput('Explain this briefly.', 'OK', { sourceObservationId: 'obs-1' }),
      profile as Readonly<EssenceProfile>,
    );
    expect(signals1.some(s => s.candidateValue === 'brief')).toBe(true);

    let snapshot = null;
    for (const s of signals1) {
      snapshot = accumulator.accumulate(s, profile);
    }
    // After one observation, no snapshot yet (below minimum evidence threshold).
    expect(snapshot).toBeNull();

    // Exchange 2 — obs-2 (different sourceObservationId, same dimension/value)
    const signals2 = await provider.extractSignals(
      makeInput('Keep it brief please.', 'OK', { sourceObservationId: 'obs-2' }),
      profile as Readonly<EssenceProfile>,
    );
    expect(signals2.some(s => s.candidateValue === 'brief')).toBe(true);

    for (const s of signals2) {
      snapshot = accumulator.accumulate(s, profile);
    }

    // After two distinct observations, snapshot should be emitted.
    expect(snapshot).not.toBeNull();
    expect(snapshot!.dimensionKey).toBe('OrientationResponseDepth');

    const winner = snapshot!.candidates[0];
    expect(winner.candidateValue).toBe('brief');
    expect(winner.accumulatedWeight).toBeCloseTo(2.0);
    expect(winner.contributingObsIds.has('obs-1')).toBe(true);
    expect(winner.contributingObsIds.has('obs-2')).toBe(true);
    expect(winner.accumulatedConfidence).toBe('low');
  });
});
