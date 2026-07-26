/**
 * Essence · Orientation Integration Types (M0-7A, M0-8A)
 *
 * Shared types for the OrientationInferenceOrchestrator integration layer.
 * These bridge the M0-6/M0-8A inference primitives and the EssenceProposalService.
 *
 * Neither the Orchestrator nor its callers import peer files — all shared
 * contracts live here to prevent circular dependencies.
 *
 * M0-8A: ExchangeRecord moved to orientation-inference.ts (provider input type
 * lives there; keeping ExchangeRecord here would create a circular dependency).
 * Re-exported here for backwards compatibility with existing callers.
 */

import type { OrientationDimensionKey } from './orientation';
import type { SessionContext, OrientationProposalCandidate, ExchangeRecord } from './orientation-inference';
import type { EssenceProfile } from './schema';

export type { ExchangeRecord };

// ── Integration Context ────────────────────────────────────────────────────────

/**
 * Context for one OrientationInferenceOrchestrator.processExchange() call.
 *
 * Extends the frozen M0-6 SessionContext (sessionId + profileId) with the
 * exchange content and the backing Observation already appended by the
 * session handler. The Orchestrator is write-free: it receives a post-append
 * profile where sessionObservationId already exists in profile.observations.
 */
export interface OrientationIntegrationContext extends SessionContext {
  /** Verbatim exchange content for the provider to analyze. */
  readonly exchange: ExchangeRecord;
  /**
   * ID of the Essence Observation appended by the session handler for this
   * exchange. Must exist in the profile passed to processExchange().
   */
  readonly sessionObservationId: string;
}

// ── Results ────────────────────────────────────────────────────────────────────

/**
 * Outcome for one orientation dimension after one processExchange() call.
 * At most one entry per OrientationDimensionKey per call (two-phase invariant).
 */
export type OrientationDimensionResult =
  | {
      readonly dimensionKey: OrientationDimensionKey;
      readonly outcome: 'proposal_submitted';
      readonly candidate: OrientationProposalCandidate;
      /** Status returned by EssenceProposalService.proposeUpdate(). */
      readonly pipelineStatus: string;
    }
  | {
      readonly dimensionKey: OrientationDimensionKey;
      readonly outcome: 'suppressed';
      /** OrientationProposalSuppressionReason or 'no_candidates'. */
      readonly reason: string;
    };

/**
 * Full report from one processExchange() call.
 * results contains at most one entry per OrientationDimensionKey.
 */
export interface OrientationInferenceReport {
  readonly profileId: string;
  readonly sessionId: string;
  readonly sessionObservationId: string;
  readonly results: OrientationDimensionResult[];
  readonly processedAt: string; // ISO 8601
}

// ── Orchestrator API ───────────────────────────────────────────────────────────

/**
 * Public interface for the orchestrator.
 * The implementation is write-free: it calls proposeUpdate() on EssenceProposalService
 * but never appends observations, conflicts, or interpretations directly.
 */
export interface OrientationInferenceOrchestratorAPI {
  processExchange(
    context: OrientationIntegrationContext,
    profile: Readonly<EssenceProfile>,
  ): Promise<OrientationInferenceReport>;
}
