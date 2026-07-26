/**
 * Essence · Orientation Evidence Accumulator (M0-6B)
 *
 * Stateful component keyed by profileId. Accumulates cross-signal evidence for
 * orientation dimensions and emits an AccumulatorSnapshot when the minimum
 * evidence threshold is crossed for a given (dimensionKey, candidateValue) pair.
 *
 * Owns:
 *   - weight accumulation
 *   - deduplication by sourceObservationId (same ID never stacks)
 *   - confidence mapping (weight → ConfidenceLevel)
 *   - snapshot emission (immutable copies — internal Set never leaked)
 *
 * Does NOT own:
 *   - idempotency checking (integration caller)
 *   - proposal construction (OrientationProposalEngine)
 *   - any write to Essence
 */

import type { ConfidenceLevel } from './schema';
import type { EssenceProfile } from './schema';
import type { OrientationDimensionKey } from './orientation';
import { isOrientationNode, isValidOrientationValue } from './orientation';
import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';
import type {
  OrientationSignal,
  DimensionEvidenceState,
  AccumulatorSnapshot,
  AccumulatorDiagnostics,
} from './orientation-inference';
import { MINIMUM_CONTRIBUTING_OBSERVATIONS } from './orientation-inference';

// ── Internal State (never exposed) ────────────────────────────────────────────

interface InternalEvidenceState {
  dimensionKey:       OrientationDimensionKey;
  candidateValue:     string;
  accumulatedWeight:  number;
  contributingObsIds: Set<string>; // mutable; snapshot-copied on emit
  lastUpdatedAt:      string;
}

// ── Confidence Mapping ─────────────────────────────────────────────────────────

/**
 * Authoritative confidence mapping. Lives here and only here.
 * Uses continuous half-open intervals so every float resolves unambiguously.
 * 'verified' is never assigned — reserved for direct user confirmation.
 */
export function mapConfidence(weight: number): ConfidenceLevel {
  if (weight === 0)  return 'speculative';
  if (weight < 3)    return 'low';
  if (weight < 6)    return 'medium';
  return 'high';
}

// ── Accumulator ────────────────────────────────────────────────────────────────

export class OrientationEvidenceAccumulator {
  /**
   * Store keyed by profileId only. sessionId is metadata on OrientationSignal,
   * never part of the storage key — evidence accumulates across the process
   * lifetime for a given profile.
   *
   * M0-6 limitation: accumulator is in-memory; evidence does not survive
   * process restarts. Persistence across restarts is out of scope for M0-6.
   */
  private readonly store = new Map<
    string,                                                    // profileId
    Map<OrientationDimensionKey, Map<string, InternalEvidenceState>> // dimension → value → state
  >();

  constructor(private readonly clock: Clock = systemClock) {}

  /**
   * Incorporate one signal into the accumulator.
   *
   * Returns an AccumulatorSnapshot if the minimum evidence threshold is met for
   * the signal's dimension after this accumulation; returns null otherwise.
   *
   * Discard conditions (no mutation, no throw):
   *   - signal.sourceObservationId does not exist in profile.observations
   *   - signal.dimensionKey is not a known orientation node
   *   - signal.candidateValue is not valid for the dimension
   *   - signal.signalWeight is outside (0, 1]
   *   - signal.sourceObservationId already contributed to this (dimension, value) pair
   */
  accumulate(
    signal: OrientationSignal,
    profile: EssenceProfile,
    diagnostics?: AccumulatorDiagnostics,
  ): AccumulatorSnapshot | null {
    // Contract 4: validate sourceObservationId before any mutation.
    const knownObsIds = new Set(profile.observations.map(o => o.id));
    if (!knownObsIds.has(signal.sourceObservationId)) {
      diagnostics?.onInvalidObservationReference(signal, profile.profileId);
      return null;
    }

    // Validate dimension and value.
    if (!isOrientationNode(signal.dimensionKey)) return null;
    if (!isValidOrientationValue(signal.dimensionKey, signal.candidateValue)) return null;
    if (signal.signalWeight <= 0 || signal.signalWeight > 1) return null;

    // Get or create profile store.
    let profileStore = this.store.get(profile.profileId);
    if (!profileStore) {
      profileStore = new Map();
      this.store.set(profile.profileId, profileStore);
    }

    // Get or create dimension store.
    let dimensionStore = profileStore.get(signal.dimensionKey);
    if (!dimensionStore) {
      dimensionStore = new Map();
      profileStore.set(signal.dimensionKey, dimensionStore);
    }

    // Get or create evidence state for this (dimension, candidateValue) pair.
    let state = dimensionStore.get(signal.candidateValue);
    if (!state) {
      state = {
        dimensionKey:       signal.dimensionKey,
        candidateValue:     signal.candidateValue,
        accumulatedWeight:  0,
        contributingObsIds: new Set(),
        lastUpdatedAt:      new Date(this.clock.now()).toISOString(),
      };
      dimensionStore.set(signal.candidateValue, state);
    }

    // Deduplication: same obsId never stacks.
    if (state.contributingObsIds.has(signal.sourceObservationId)) return null;

    state.contributingObsIds.add(signal.sourceObservationId);
    state.accumulatedWeight += signal.signalWeight;
    state.lastUpdatedAt = new Date(this.clock.now()).toISOString();

    // Only emit snapshot when the dimension's current winner meets minimum evidence.
    const winner = this.getWinner(dimensionStore);
    if (!winner || winner.contributingObsIds.size < MINIMUM_CONTRIBUTING_OBSERVATIONS) {
      return null;
    }

    return this.buildSnapshot(profile.profileId, signal.dimensionKey, dimensionStore);
  }

  /**
   * Read current evidence state for a dimension without triggering snapshot emission.
   * Returns an empty array if no evidence has been accumulated.
   */
  getState(
    profileId: string,
    dimensionKey: OrientationDimensionKey,
  ): DimensionEvidenceState[] {
    const dimensionStore = this.store.get(profileId)?.get(dimensionKey);
    if (!dimensionStore) return [];
    return Array.from(dimensionStore.values()).map(s => this.toExternalState(s));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getWinner(
    dimensionStore: Map<string, InternalEvidenceState>,
  ): InternalEvidenceState | null {
    let winner: InternalEvidenceState | null = null;
    for (const state of dimensionStore.values()) {
      if (!winner || state.accumulatedWeight > winner.accumulatedWeight) {
        winner = state;
      }
    }
    return winner;
  }

  private buildSnapshot(
    profileId: string,
    dimensionKey: OrientationDimensionKey,
    dimensionStore: Map<string, InternalEvidenceState>,
  ): AccumulatorSnapshot {
    const candidates = Array.from(dimensionStore.values())
      .map(s => this.toExternalState(s))
      .sort((a, b) => b.accumulatedWeight - a.accumulatedWeight);

    return {
      profileId,
      dimensionKey,
      candidates,
      snapshotAt: new Date(this.clock.now()).toISOString(),
    };
  }

  private toExternalState(state: InternalEvidenceState): DimensionEvidenceState {
    return {
      dimensionKey:          state.dimensionKey,
      candidateValue:        state.candidateValue,
      accumulatedWeight:     state.accumulatedWeight,
      // Snapshot copy — mutations to the internal Set never affect emitted state.
      contributingObsIds:    new Set(state.contributingObsIds),
      accumulatedConfidence: mapConfidence(state.accumulatedWeight),
      lastUpdatedAt:         state.lastUpdatedAt,
    };
  }
}
