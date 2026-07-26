/**
 * Essence · Composite Orientation Provider (M0-9B)
 *
 * Runs all registered providers in parallel (Promise.allSettled) and merges
 * their signals. Best-effort: a failed provider does not abort the composite —
 * its signals are absent from the merged result and the failure is reported
 * through the optional diagnostics hook. The Orchestrator is unaffected by
 * individual provider failures.
 *
 * Signal ordering: provider order is preserved within each provider's output;
 * results are interleaved in registration order.
 */

import type {
  OrientationInferenceInput,
  OrientationInferenceProvider,
  OrientationSignal,
} from './orientation-inference';
import type { EssenceProfile } from './schema';

// ── Diagnostics ────────────────────────────────────────────────────────────────

/**
 * Content-free diagnostics sink for provider failures.
 * Callers may count, trace, or alert on failures without logging user content.
 * Production no-op is the default; telemetry implementations receive the index
 * and error for metadata-only reporting.
 */
export interface CompositeDiagnostics {
  onProviderFailure(providerIndex: number, error: unknown): void;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export class CompositeOrientationProvider implements OrientationInferenceProvider {
  constructor(
    private readonly providers: readonly OrientationInferenceProvider[],
    private readonly diagnostics?: CompositeDiagnostics,
  ) {}

  async extractSignals(
    input: OrientationInferenceInput,
    profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]> {
    const results = await Promise.allSettled(
      this.providers.map(p => p.extractSignals(input, profile)),
    );

    const signals: OrientationSignal[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        signals.push(...result.value);
      } else {
        this.diagnostics?.onProviderFailure(i, result.reason);
      }
    }
    return signals;
  }
}
