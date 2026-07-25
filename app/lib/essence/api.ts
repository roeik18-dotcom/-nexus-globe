/**
 * Essence · API Surface v1
 *
 * 13 operations. All reads return summaries or structured views.
 * All writes go through the pipeline — no agent may write directly to
 * Canonical Essence. Proposals are subject to Write Policy evaluation.
 */

import type { EssenceLayer } from './ontology';
import type {
  ConfidenceLevel,
  Conflict,
  ConflictType,
  EssenceEvolutionEntry,
  EssenceProfile,
  EssenceStateItem,
  Interpretation,
  Observation,
  SensitivityLevel,
  TemporalKind,
  StateTemporalScope,
} from './schema';
import type { PipelineResult } from './pipeline';

// ── Retrieval Modes ────────────────────────────────────────────────────────────

/**
 * How much of the profile to load for a given query.
 * Agents request only what they need — Essence does not over-expose.
 */
export type RetrievalMode =
  | 'compact'       // high-confidence traits only; minimal payload
  | 'task_relevant' // nodes relevant to the current task context (default)
  | 'creative'      // Expression + CreativeDNA + Aesthetics + active state
  | 'strategic'     // Aspirations + Core Values + Principles
  | 'deep';         // full profile; only for Philos or explicit user request

// ── Read-Side Types ────────────────────────────────────────────────────────────

/**
 * A lightweight summary of the profile suitable for agent context injection.
 * Does not contain raw observations — only derived interpretations.
 */
export interface EssenceSummary {
  profileId: string;
  retrievedAt: string; // ISO 8601
  retrievalMode: RetrievalMode;
  /** The interpretations selected for this mode, keyed by ontology node ID. */
  nodes: Record<string, {
    nodeId: string;
    layer: EssenceLayer;
    content: string;
    confidence: ConfidenceLevel;
    sensitivity: SensitivityLevel;
    temporalKind: TemporalKind;
  }>;
  /** Active state items scoped to the current session or shorter. */
  activeState: EssenceStateItem[];
  /** Count of unresolved conflicts. Agents cannot read conflict details directly. */
  unresolvedConflictCount: number;
}

/** A view of one ontology layer. */
export interface EssenceLayerView {
  layer: EssenceLayer;
  nodes: Record<string, Interpretation[]>;
  retrievedAt: string;
}

// ── Write-Side Types ───────────────────────────────────────────────────────────

/**
 * An agent's proposal to update a node in Essence.
 * Agents do not write — they propose. The pipeline decides.
 */
export interface ProposedUpdate {
  nodeId: string;
  /** What the agent believes the interpretation should be. */
  proposedContent: string;
  /** The observation IDs this proposal is based on. Must reference ≥1. */
  evidenceObservationIds: string[];
  proposedBy: string;
  proposedAt: string; // ISO 8601
  rationale: string;
}

/**
 * A correction issued by the user.
 * User corrections always win; they are recorded as a new Observation
 * (source: 'user_correction') and feed the pipeline.
 */
export interface UserCorrection {
  nodeId: string;
  /** The interpretation ID the user is correcting. null = correcting a gap. */
  targetInterpretationId: string | null;
  correctedContent: string;
  correctedBy: 'user';
  correctedAt: string; // ISO 8601
  note: string | null;
}

/**
 * A package of evidence from the cross-domain Evidence Engine.
 * Passed in by agents; Essence holds IDs, never raw evidence.
 */
export interface EvidencePackage {
  evidenceIds: string[];
  sourceType: Observation['source'];
  confidenceAsserted: ConfidenceLevel;
  packagedBy: string;
  packagedAt: string;
}

// ── API Interface ──────────────────────────────────────────────────────────────

/**
 * The Essence API — the only interface agents use to read or propose changes
 * to the Human Model. Agents do not access EssenceProfile directly.
 *
 * Read operations: 7
 * Write operations (proposals only): 6
 */
export interface EssenceAPI {

  // ── Reads ──────────────────────────────────────────────────────────────────

  /**
   * 1. Get a summary of the profile, scoped to the retrieval mode.
   * The default mode is 'task_relevant'. Use 'deep' only for Philos-level
   * analysis or explicit user request.
   */
  getEssenceSummary(
    profileId: string,
    mode: RetrievalMode,
    requestedBy: string,
  ): Promise<EssenceSummary>;

  /**
   * 2. Get all interpretations in the Core layer.
   * Returns only interpretations the requesting agent is authorized to read.
   */
  getCore(profileId: string, requestedBy: string): Promise<EssenceLayerView>;

  /**
   * 3. Get all interpretations in the Expression layer.
   */
  getExpression(profileId: string, requestedBy: string): Promise<EssenceLayerView>;

  /**
   * 4. Get all interpretations in the Identity layer.
   */
  getIdentity(profileId: string, requestedBy: string): Promise<EssenceLayerView>;

  /**
   * 5. Get currently active state items, optionally filtered by scope.
   */
  getCurrentState(
    profileId: string,
    requestedBy: string,
    scope?: StateTemporalScope,
  ): Promise<EssenceStateItem[]>;

  /**
   * 6. Get observation IDs backing a specific interpretation.
   * Returns IDs only — raw observations are not exposed to agents.
   */
  getEvidence(
    profileId: string,
    interpretationId: string,
    requestedBy: string,
  ): Promise<{ observationIds: string[]; evidenceIds: string[] }>;

  /**
   * 7. Get unresolved conflicts. Returns summary only — agents see conflict
   * counts and types, not the full Conflict records.
   */
  getConflicts(
    profileId: string,
    requestedBy: string,
  ): Promise<{ count: number; types: ConflictType[] }>;

  // ── Proposals & Writes ─────────────────────────────────────────────────────

  /**
   * 8. Classify a piece of information to determine which ontology node it belongs to.
   * Returns the node ID and whether the pipeline accepts this as input.
   */
  classifyInformation(
    content: string,
    requestedBy: string,
  ): Promise<{
    nodeId: string;
    layer: EssenceLayer;
    classificationConfidence: 'certain' | 'probable' | 'ambiguous';
    requiresMoreContext: boolean;
  }>;

  /**
   * 9. Submit an update proposal. Goes through the full semantic pipeline.
   * Returns a PipelineResult — never writes directly to Canonical Essence.
   */
  proposeUpdate(
    profileId: string,
    proposal: ProposedUpdate,
    evidence: EvidencePackage | null,
  ): Promise<PipelineResult>;

  /**
   * 10. Confirm a pending interpretation (user approval of a queued proposal).
   * Uses the confirmationToken from a 'pending_user_confirmation' PipelineResult.
   */
  confirmUpdate(
    profileId: string,
    confirmationToken: string,
    confirmedBy: 'user',
  ): Promise<Interpretation>;

  /**
   * 11. Reject a pending interpretation.
   * Permanently discards the candidate and records the rejection as an observation.
   */
  rejectUpdate(
    profileId: string,
    confirmationToken: string,
    rejectedBy: 'user',
    reason: string | null,
  ): Promise<{ rejected: true; recordedAt: string }>;

  /**
   * 12. Submit a user correction.
   * Creates an Observation (source: 'user_correction') and immediately runs the
   * pipeline. User corrections bypass normal write thresholds.
   */
  correctItem(
    profileId: string,
    correction: UserCorrection,
  ): Promise<PipelineResult>;

  /**
   * 13. Archive an interpretation.
   * Moves it to history; no longer drives agent behavior.
   * Archival is recorded in the evolution log.
   */
  archiveItem(
    profileId: string,
    interpretationId: string,
    archivedBy: string,
    reason: string,
  ): Promise<{ archived: true; evolutionEntryId: string }>;
}

// ── Conflict type re-export for consumers of api.ts ───────────────────────────
export type { ConflictType } from './schema';
