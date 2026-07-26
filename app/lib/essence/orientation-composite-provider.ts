/**
 * Essence · Composite Orientation Provider (M0-9B)
 *
 * Runs all registered providers in parallel (Promise.allSettled) and merges
 * their signals. Best-effort: a failed provider is silently ignored — its
 * signals are absent from the merged result. The Orchestrator is unaffected
 * by individual provider failures.
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

export class CompositeOrientationProvider implements OrientationInferenceProvider {
  constructor(private readonly providers: readonly OrientationInferenceProvider[]) {}

  async extractSignals(
    input: OrientationInferenceInput,
    profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]> {
    const results = await Promise.allSettled(
      this.providers.map(p => p.extractSignals(input, profile)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<OrientationSignal[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }
}
