/**
 * Essence · API Surface v1
 *
 * Operations for reading from and proposing changes to the Human Model.
 * All writes go through the semantic pipeline — no agent writes directly.
 *
 * Split into four sub-interfaces so each service can declare precise `implements`:
 *   EssenceReadAPI          → EssenceReadService
 *   EssenceProposalAPI      → EssenceProposalService
 *   EssenceUserActionAPI    → EssenceProposalService
 *   EssenceClassificationAPI → EssenceClassificationService
 */

import type { EssenceLayer } from './ontology';
import type {
  ConfidenceLevel,
  ConflictType,
  EssenceStateItem,
  EvidenceStatus,
  Interpretation,
  Observation,
  RetrievalMode,
  SensitivityLevel,
  TemporalKind,
  StateTemporalScope,
} from './schema';
import type { PipelineResult, PipelineStageSummary } from './pipeline';
import type { AgentName } from './access';

// Re-export RetrievalMode so existing consumers of api.ts still compile.
export type { RetrievalMode } from './schema';

// Re-export ConflictType for consumers.
export type { ConflictType } from './schema';

// ── Authorization ──────────────────────────────────────────────────────────────

// UserAuthorizedActionContext lives in actor.ts to break the pipeline-runner → api.ts
// upward dependency. Re-exported here for backwards compatibility.
export type { UserAuthorizedActionContext } from './actor';

// ── Context ────────────────────────────────────────────────────────────────────

/**
 * Optional context a requesting agent provides to scope the summary.
 * Essence uses this to return the most relevant interpretations.
 */
export interface EssenceContextView {
  sessionId?: string;
  role?: string;
  audience?: string;
  relationship?: string;
  culture?: string;
  environment?: string;
  activeDomain?: string;
  temporalContext?: string;
  currentIntent?: string;
  recentTopics?: string[];
}

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
    evidenceStatus: EvidenceStatus;
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
  proposedContent: string;
  /** The observation IDs this proposal is based on. Must reference ≥1. */
  evidenceObservationIds: string[];
  proposedBy: AgentName;
  proposedAt: string; // ISO 8601
  rationale: string;
}

/**
 * A correction issued by the user.
 * User corrections always win; they are recorded as a new Observation
 * (source: 'user_correction') and feed the pipeline with UserAuthorizedActionContext.
 */
export interface UserCorrection {
  nodeId: string;
  /** The interpretation ID the user is correcting. null = correcting a gap. */
  targetInterpretationId: string | null;
  correctedContent: string;
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

// ── Proposal Lifecycle ─────────────────────────────────────────────────────────

export type ProposalStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';

/**
 * A pending or terminal proposal record.
 *
 * Records are permanent — never removed after reaching a terminal state
 * (confirmed, rejected, expired). Confirmation and rejection are idempotent.
 */
export interface PendingEssenceProposal {
  readonly proposalId: string;
  readonly profileId: string;
  readonly nodeId: string;
  readonly layer: EssenceLayer;
  readonly proposedContent: string;
  readonly proposedBy: AgentName;
  readonly evidenceStatus: EvidenceStatus;
  readonly proposedAt: string; // ISO 8601
  readonly expiresAt: string;  // ISO 8601
  status: ProposalStatus;
  conflictsWith: string[]; // existing interpretation IDs that conflict
  pipelineStages: PipelineStageSummary[];
  committedInterpretationId?: string;
  rejectionReason?: string;
}

// ── Sub-Interface: Read ────────────────────────────────────────────────────────

/** Implemented by EssenceReadService. */
export interface EssenceReadAPI {
  /** Get a summary of the profile, scoped to the retrieval mode. */
  getEssenceSummary(
    profileId: string,
    mode: RetrievalMode,
    requestedBy: AgentName,
    context?: EssenceContextView,
  ): Promise<EssenceSummary>;

  /** Get all interpretations in a specific layer. */
  getLayerView(
    profileId: string,
    layer: EssenceLayer,
    requestedBy: AgentName,
  ): Promise<EssenceLayerView>;

  /** Get currently active state items, optionally filtered by scope. */
  getCurrentState(
    profileId: string,
    requestedBy: AgentName,
    scope?: StateTemporalScope,
  ): Promise<EssenceStateItem[]>;

  /**
   * Get observation IDs backing a specific interpretation.
   * Returns IDs only — raw observations are never exposed to agents.
   */
  getEvidence(
    profileId: string,
    interpretationId: string,
    requestedBy: AgentName,
  ): Promise<{ observationIds: string[]; evidenceIds: string[] }>;

  /**
   * Get unresolved conflicts.
   * Agents see counts and types only — not full Conflict records.
   */
  getConflicts(
    profileId: string,
    requestedBy: AgentName,
  ): Promise<{ count: number; types: ConflictType[] }>;
}

// ── Sub-Interface: Proposals ───────────────────────────────────────────────────

/** Implemented by EssenceProposalService. */
export interface EssenceProposalAPI {
  /**
   * Submit an update proposal. Goes through the full semantic pipeline.
   * Returns a PipelineResult — never writes directly to Canonical Essence.
   */
  proposeUpdate(
    profileId: string,
    proposal: ProposedUpdate,
    evidence: EvidencePackage | null,
  ): Promise<PipelineResult>;

  /**
   * Get pending proposals for this profile visible to the requesting agent.
   * Agents see only their own proposals; Philos sees all.
   */
  getPendingProposals(
    profileId: string,
    requestedBy: AgentName,
  ): Promise<PendingEssenceProposal[]>;
}

// ── Sub-Interface: User Actions ────────────────────────────────────────────────

import type { UserAuthorizedActionContext } from './actor';

/** Implemented by EssenceProposalService. */
export interface EssenceUserActionAPI {
  /**
   * Confirm a pending interpretation (user approval of a queued proposal).
   * Idempotent — confirming an already-confirmed proposal returns the
   * existing Interpretation without re-running the pipeline.
   */
  confirmUpdate(
    profileId: string,
    confirmationToken: string,
    context: UserAuthorizedActionContext,
  ): Promise<Interpretation>;

  /**
   * Reject a pending interpretation.
   * Idempotent — rejecting an already-rejected proposal is a no-op.
   */
  rejectUpdate(
    profileId: string,
    confirmationToken: string,
    context: UserAuthorizedActionContext,
    reason: string | null,
  ): Promise<{ rejected: true; recordedAt: string }>;

  /**
   * Submit a user correction.
   * Creates an Observation (source: 'user_correction') and immediately runs the
   * pipeline with UserAuthorizedActionContext — bypassing normal write thresholds.
   * The superseded interpretation is archived, not deleted.
   */
  correctItem(
    profileId: string,
    correction: UserCorrection,
    context: UserAuthorizedActionContext,
  ): Promise<PipelineResult>;

  /**
   * Archive an interpretation.
   * Moves it to history; no longer drives agent behavior.
   * Archival is recorded in the evolution log.
   * Only Philos and user corrections may archive.
   */
  archiveItem(
    profileId: string,
    interpretationId: string,
    archivedBy: AgentName,
    reason: string,
  ): Promise<{ archived: true; evolutionEntryId: string }>;
}

// ── Sub-Interface: Classification ─────────────────────────────────────────────

export type ClassificationResult =
  | {
      status: 'classified';
      nodeId: string;
      layer: EssenceLayer;
      classificationConfidence: 'certain' | 'probable' | 'ambiguous';
      requiresMoreContext: boolean;
    }
  | {
      status: 'unsupported';
      reason: string;
    };

/** Implemented by EssenceClassificationService. */
export interface EssenceClassificationAPI {
  classifyInformation(
    content: string,
    requestedBy: AgentName,
  ): Promise<ClassificationResult>;
}

