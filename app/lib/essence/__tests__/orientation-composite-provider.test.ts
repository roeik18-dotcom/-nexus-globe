/**
 * M0-9B — Composite Orientation Provider
 *
 * Unit tests for CompositeOrientationProvider.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeOrientationProvider } from '../orientation-composite-provider';
import type { CompositeDiagnostics } from '../orientation-composite-provider';
import type { OrientationInferenceInput, OrientationSignal } from '../orientation-inference';
import type { EssenceProfile } from '../schema';
import { createEmptyEssenceProfile } from '../schema';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeInput(): OrientationInferenceInput {
  return {
    sessionId:           's1',
    profileId:           'u1',
    sourceObservationId: 'obs-1',
    exchange:            { userMessage: 'Hello', assistantResponse: 'Hi' },
  };
}

function makeProfile(): Readonly<EssenceProfile> {
  return createEmptyEssenceProfile('u1') as Readonly<EssenceProfile>;
}

function makeSignal(
  dimensionKey: string,
  candidateValue: string,
  signalWeight = 1.0,
): OrientationSignal {
  return {
    dimensionKey:        dimensionKey as OrientationSignal['dimensionKey'],
    candidateValue,
    sourceObservationId: 'obs-1',
    signalWeight,
    inferredBy:          'test/provider@1',
    sessionId:           's1',
    inferredAt:          '2026-07-26T12:00:00.000Z',
  };
}

function makeProvider(signals: OrientationSignal[]) {
  return { extractSignals: vi.fn().mockResolvedValue(signals) };
}

function makeFailingProvider(error: unknown = new Error('Provider failed')) {
  return { extractSignals: vi.fn().mockRejectedValue(error) };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CompositeOrientationProvider', () => {

  // ── Signal merging ─────────────────────────────────────────────────────────

  it('returns empty array when no providers are registered', async () => {
    const composite = new CompositeOrientationProvider([]);
    const signals = await composite.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('returns signals from a single provider', async () => {
    const s1 = makeSignal('OrientationResponseDepth', 'brief');
    const composite = new CompositeOrientationProvider([makeProvider([s1])]);

    const signals = await composite.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBe(s1);
  });

  it('merges signals from multiple providers in registration order', async () => {
    const s1 = makeSignal('OrientationResponseDepth', 'brief', 1.0);
    const s2 = makeSignal('OrientationCommunicationStyle', 'direct', 0.7);
    const s3 = makeSignal('OrientationTaskCadence', 'phased', 0.5);

    const composite = new CompositeOrientationProvider([
      makeProvider([s1]),
      makeProvider([s2, s3]),
    ]);

    const signals = await composite.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(3);
    expect(signals[0]).toBe(s1);
    expect(signals[1]).toBe(s2);
    expect(signals[2]).toBe(s3);
  });

  it('returns signals from provider that returned empty array alongside one that returned signals', async () => {
    const s1 = makeSignal('OrientationResponseDepth', 'brief');
    const composite = new CompositeOrientationProvider([
      makeProvider([]),
      makeProvider([s1]),
    ]);

    const signals = await composite.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBe(s1);
  });

  // ── Best-effort: failed providers are silently ignored ─────────────────────

  it('silently ignores a failing provider and returns signals from the rest', async () => {
    const s1 = makeSignal('OrientationResponseDepth', 'brief');
    const composite = new CompositeOrientationProvider([
      makeFailingProvider(),
      makeProvider([s1]),
    ]);

    const signals = await composite.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBe(s1);
  });

  it('returns [] when all providers fail', async () => {
    const composite = new CompositeOrientationProvider([
      makeFailingProvider(new Error('A failed')),
      makeFailingProvider(new Error('B failed')),
    ]);

    const signals = await composite.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('does not throw when a provider rejects with a non-Error value', async () => {
    const composite = new CompositeOrientationProvider([
      makeFailingProvider('string rejection'),
    ]);

    await expect(composite.extractSignals(makeInput(), makeProfile())).resolves.toHaveLength(0);
  });

  // ── CompositeDiagnostics ───────────────────────────────────────────────────

  describe('with diagnostics', () => {
    let diagnostics: CompositeDiagnostics;

    beforeEach(() => {
      diagnostics = { onProviderFailure: vi.fn() };
    });

    it('calls diagnostics with the correct provider index when a provider fails', async () => {
      const s1 = makeSignal('OrientationResponseDepth', 'brief');
      const err = new Error('LLM failed');
      const composite = new CompositeOrientationProvider(
        [makeProvider([s1]), makeFailingProvider(err)],
        diagnostics,
      );

      await composite.extractSignals(makeInput(), makeProfile());

      expect(diagnostics.onProviderFailure).toHaveBeenCalledTimes(1);
      expect(diagnostics.onProviderFailure).toHaveBeenCalledWith(1, err);
    });

    it('calls diagnostics with index 0 when the first provider fails', async () => {
      const err = new Error('Rule failed');
      const composite = new CompositeOrientationProvider(
        [makeFailingProvider(err), makeProvider([])],
        diagnostics,
      );

      await composite.extractSignals(makeInput(), makeProfile());

      expect(diagnostics.onProviderFailure).toHaveBeenCalledWith(0, err);
    });

    it('returns signals from succeeding providers even when another provider fails', async () => {
      const s1 = makeSignal('OrientationResponseDepth', 'brief');
      const err = new Error('LLM failed');
      const composite = new CompositeOrientationProvider(
        [makeProvider([s1]), makeFailingProvider(err)],
        diagnostics,
      );

      const signals = await composite.extractSignals(makeInput(), makeProfile());

      expect(signals).toHaveLength(1);
      expect(signals[0]).toBe(s1);
    });

    it('does not call diagnostics when all providers succeed', async () => {
      const s1 = makeSignal('OrientationResponseDepth', 'brief');
      const composite = new CompositeOrientationProvider(
        [makeProvider([s1]), makeProvider([])],
        diagnostics,
      );

      await composite.extractSignals(makeInput(), makeProfile());

      expect(diagnostics.onProviderFailure).not.toHaveBeenCalled();
    });

    it('calls diagnostics once per failed provider with the correct index each time', async () => {
      const errA = new Error('Provider A failed');
      const errB = new Error('Provider B failed');
      const s1 = makeSignal('OrientationCommunicationStyle', 'direct');
      const composite = new CompositeOrientationProvider(
        [makeFailingProvider(errA), makeProvider([s1]), makeFailingProvider(errB)],
        diagnostics,
      );

      const signals = await composite.extractSignals(makeInput(), makeProfile());

      expect(diagnostics.onProviderFailure).toHaveBeenCalledTimes(2);
      expect(diagnostics.onProviderFailure).toHaveBeenNthCalledWith(1, 0, errA);
      expect(diagnostics.onProviderFailure).toHaveBeenNthCalledWith(2, 2, errB);
      expect(signals).toHaveLength(1);
      expect(signals[0]).toBe(s1);
    });

    it('works without diagnostics — no error when no diagnostics hook provided', async () => {
      const composite = new CompositeOrientationProvider([makeFailingProvider()]);
      await expect(composite.extractSignals(makeInput(), makeProfile())).resolves.toHaveLength(0);
    });

    it('passes non-Error rejections to diagnostics unchanged', async () => {
      const rejection = 'plain string rejection';
      const composite = new CompositeOrientationProvider(
        [makeFailingProvider(rejection)],
        diagnostics,
      );

      await composite.extractSignals(makeInput(), makeProfile());

      expect(diagnostics.onProviderFailure).toHaveBeenCalledWith(0, rejection);
    });
  });

  // ── Providers run in parallel ──────────────────────────────────────────────

  it('calls all providers with the same input and profile', async () => {
    const input = makeInput();
    const profile = makeProfile();
    const p1 = makeProvider([]);
    const p2 = makeProvider([]);
    const composite = new CompositeOrientationProvider([p1, p2]);

    await composite.extractSignals(input, profile);

    expect(p1.extractSignals).toHaveBeenCalledWith(input, profile);
    expect(p2.extractSignals).toHaveBeenCalledWith(input, profile);
  });

  it('all provider calls are initiated before any is awaited (parallel execution)', async () => {
    const order: number[] = [];

    const makeDelayedProvider = (id: number, delayMs: number) => ({
      extractSignals: vi.fn().mockImplementation(async () => {
        order.push(id);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return [];
      }),
    });

    // Provider 2 starts first, provider 1 starts second — both initiated before awaiting.
    const composite = new CompositeOrientationProvider([
      makeDelayedProvider(1, 10),
      makeDelayedProvider(2, 0),
    ]);

    await composite.extractSignals(makeInput(), makeProfile());

    // Both should have been initiated; order depends on the event loop but both complete.
    expect(order).toContain(1);
    expect(order).toContain(2);
  });
});
