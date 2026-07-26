/**
 * Essence · Orientation Inference — Shared Types (M0-6A)
 *
 * All types shared between OrientationEvidenceAccumulator,
 * OrientationProposalEngine, and their callers.
 *
 * Neither the accumulator nor the engine imports from this file's peers —
 * all shared contracts live here to prevent circular dependencies.
 */

import type { ConfidenceLevel } from './schema';
import type { EssenceProfile } from './schema';
import type { OrientationDimensionKey } from './orientation';

// ── Input Signal ───────────────────────────────────────────────────────────────

/**
 * One inferred orientation signal from an agent or heuristic.
 * Not persisted independently — backed by a real Essence Observation.
 */
export interface OrientationSignal {
  dimensionKey:        OrientationDimensionKey;
  /** Must be a valid value in ORIENTATION_SCHEMA[dimensionKey]. */
  candidateValue:      string;
  /** ID of the Essence Observation that backs this signal. Must exist in the profile. */
  sourceObservationId: string;
  /** 0 < weight ≤ 1. Fractional values are valid. */
  signalWeight:        number;
  /** Agent name or rule identifier that produced this signal. */
  inferredBy:          string;
  /** Stored as signal metadata only — never used as a storage key. */
  sessionId:           string;
  inferredAt:          string; // ISO 8601
}

// ── Accumulator State ──────────────────────────────────────────────────────────

/**
 * External (read-only) view of evidence accumulated for one (dimensionKey, candidateValue) pair.
 * contributingObsIds is a snapshot copy — mutations to the accumulator's internal Set
 * never affect a previously emitted DimensionEvidenceState.
 */
export interface DimensionEvidenceState {
  readonly dimensionKey:    OrientationDimensionKey;
  readonly candidateValue:  string;
  readonly accumulatedWeight: number;
  /**
   * Snapshot copy of contributing observation IDs.
   * Signals from the same observationId never stack (deduplication by the accumulator).
   * The internal Set is never exposed — callers receive a new Set each time.
   */
  readonly contributingObsIds: ReadonlySet<string>;
  /**
   * Calculated by OrientationEvidenceAccumulator — never by OrientationProposalEngine.
   * Mapping (continuous):
   *   weight === 0          → speculative
   *   0 < weight < 3        → low
   *   3 ≤ weight < 6        → medium
   *   weight ≥ 6            → high
   * 'verified' is reserved for direct user confirmation; never assigned here.
   */
  readonly accumulatedConfidence: ConfidenceLevel;
  readonly lastUpdatedAt: string; // ISO 8601
}

/**
 * Emitted by the accumulator when a dimension's evidence crosses the minimum threshold.
 * Candidates are sorted by accumulatedWeight descending — index 0 is the current winner.
 */
export interface AccumulatorSnapshot {
  readonly profileId:    string;
  readonly dimensionKey: OrientationDimensionKey;
  readonly candidates:   DimensionEvidenceState[];
  readonly snapshotAt:   string; // ISO 8601
}

// ── Proposal Output ────────────────────────────────────────────────────────────

/** Built by OrientationProposalEngine; submitted by the integration caller to proposeUpdate. */
export interface OrientationProposalCandidate {
  readonly profileId:               string;
  readonly dimensionKey:            OrientationDimensionKey;
  readonly proposedValue:           string;
  /** From the winning DimensionEvidenceState.contributingObsIds. */
  readonly evidenceObservationIds:  string[];
  readonly accumulatedConfidence:   ConfidenceLevel;
  /** Synthesized by the engine; cites contributing observation IDs. */
  readonly rationale:               string;
  readonly proposedAt:              string; // ISO 8601
}

// ── Engine Context ─────────────────────────────────────────────────────────────

/**
 * Provided by the integration caller — the engine never reads Profile, Service, or Repository.
 * The caller is responsible for assembling this from external state.
 */
export interface OrientationProposalContext {
  /** Currently active (non-archived) interpretation value for this dimension, if any. */
  readonly activeValue?: string;
  /**
   * True if an equivalent proposal (same dimensionKey + proposedValue as the current winner)
   * is already pending in EssenceProposalService.
   */
  readonly pendingEquivalentProposal: boolean;
  /**
   * The accumulatedWeight at which the last proposal for the winning pair was emitted.
   * null when: no prior proposal has been emitted for this pair, OR the prior proposal
   * has reached a terminal state (accepted / rejected / withdrawn) — resetting suppression.
   */
  readonly lastEmittedWeight: number | null;
}

// ── Engine Decision ────────────────────────────────────────────────────────────

/**
 * All reasons a proposal may be suppressed.
 * The integration caller should log or count these for observability.
 */
export type OrientationProposalSuppressionReason =
  | 'no_candidates'               // snapshot has no evidence states
  | 'below_minimum_evidence'      // winner has fewer than MINIMUM_CONTRIBUTING_OBSERVATIONS
  | 'below_confidence_threshold'  // winner confidence is 'speculative'
  | 'same_as_active_value'        // winner matches the currently active interpretation
  | 'weight_unchanged_while_pending' // pending equivalent proposal AND weight has not increased
  | 'equivalent_pending';         // pending equivalent proposal (weight increased, still pending)

export type OrientationProposalDecision =
  | { readonly shouldPropose: true;  readonly candidate: OrientationProposalCandidate }
  | { readonly shouldPropose: false; readonly reason: OrientationProposalSuppressionReason };

// ── Provider Interface ─────────────────────────────────────────────────────────

/**
 * Minimum context provided to an inference provider.
 * Providers may extend this via intersection types for their own fields.
 */
export interface SessionContext {
  readonly sessionId: string;
  readonly profileId: string;
}

/**
 * Model-agnostic interface for extracting orientation signals from a session.
 * Implementations may be LLM-based, rule-based, or embedding-based.
 * Must not write to Essence. Must not call proposeUpdate.
 */
export interface OrientationInferenceProvider {
  extractSignals(
    sessionContext: SessionContext,
    profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]>;
}

// ── Diagnostics ────────────────────────────────────────────────────────────────

/**
 * Optional diagnostics sink injected into OrientationEvidenceAccumulator.
 * Called synchronously when a signal is discarded due to an invalid observationId.
 * Production behavior is no-op; telemetry implementations count or trace the event.
 */
export interface AccumulatorDiagnostics {
  onInvalidObservationReference(signal: OrientationSignal, profileId: string): void;
}

// ── Policy Constants ───────────────────────────────────────────────────────────

/**
 * Minimum number of independent contributing observations required before a snapshot
 * is emitted or a proposal is considered. Enforces the "single signal is never sufficient"
 * principle. With signalWeight ≤ 1, reaching medium confidence (weight ≥ 3) requires at
 * least 3 independent observations — this is a deliberate multi-evidence gate.
 */
export const MINIMUM_CONTRIBUTING_OBSERVATIONS = 2;
