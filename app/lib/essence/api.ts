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
  ObservationSource,
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
  /**
   * Accumulated confidence from the orientation evidence accumulator.
   * Only populated when the proposal comes from orientation inference.
   * Used by Philos Review Policy to determine the review decision.
   */
  accumulatedConfidence?: ConfidenceLevel | null;
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
 * A reference to one item in the cross-domain Evidence Engine.
 * These IDs cannot be validated against Essence profile observations —
 * they require an injected EvidenceResolver (not available in Phase 1A).
 */
export interface ExternalEvidenceRef {
  evidenceId: string;
  sourceType: ObservationSource;
  confidenceAsserted: ConfidenceLevel;
}

/**
 * A typed package of evidence attached to a proposal.
 *
 * Two distinct evidence kinds are separated by design:
 *   observationIds      — Essence Observation IDs from this profile (validated before use).
 *   externalEvidenceRefs — Cross-domain Evidence Engine references (require EvidenceResolver).
 *
 * Mixing the two as undifferentiated strings is not permitted.
 */
export interface EvidencePackage {
  /** Essence Observation IDs that support this proposal. Must exist in the same profile. */
  observationIds: string[];
  /**
   * Cross-domain Evidence Engine references.
   * Validated only when an EvidenceResolver is injected; otherwise the proposal
   * returns status 'unsupported_external_evidence'.
   */
  externalEvidenceRefs: ExternalEvidenceRef[];
  packagedBy: string;
  packagedAt: string;
}

// ── Proposal Lifecycle ─────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'pending_review'              // in Philos queue; Philos-internal
  | 'pending_user_confirmation'   // user-visible; awaiting user action
  | 'confirmed'                   // Interpretation written
  | 'rejected'                    // rejected (by Philos or user)
  | 'expired';                    // expiresAt elapsed; terminal

/**
 * A single decision made by the Philos Review Policy on a pending_review proposal.
 * Appended to PendingEssenceProposal.reviewDecisions; never mutated after append.
 */
export interface PhilosReviewDecision {
  readonly decision: 'accept' | 'reject' | 'require_user_confirmation' | 'defer';
  readonly reason: string;
  readonly reviewer: 'philos';
  readonly reviewedAt: string;    // ISO 8601
  readonly policyVersion: string; // e.g. '1.0'
}

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
  /**
   * Accumulated confidence at proposal creation time.
   * Populated for pending_review proposals from orientation inference.
   * Used by Philos Review Policy. null for proposals that do not come
   * from the orientation accumulator.
   */
  accumulatedConfidence: ConfidenceLevel | null;
  /**
   * Append-only audit log of every Philos review decision on this proposal.
   * Empty for proposals that never entered pending_review.
   */
  reviewDecisions: PhilosReviewDecision[];
  /** Number of times this proposal has been deferred by Philos. */
  deferCount: number;
  /** The observation IDs that contributed to this proposal's evidence. */
  readonly evidenceObservationIds: readonly string[];
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

// ── Sub-Interface: Philos Review ──────────────────────────────────────────────

/** Implemented by EssenceProposalService. Used by PhilosReviewConsumer. */
export interface EssencePhilosReviewAPI {
  /** Get all pending_review proposals for a profile (Philos-internal queue). */
  getReviewQueue(profileId: string): Promise<PendingEssenceProposal[]>;
  /** Get any proposal record by ID, regardless of status. Returns undefined if not found. */
  getProposalRecord(proposalId: string): Promise<PendingEssenceProposal | undefined>;
  /**
   * Append a Philos review decision and update the proposal's status and deferCount.
   * Caller is responsible for idempotency; this method always appends.
   */
  applyReviewDecision(
    proposalId: string,
    decision: PhilosReviewDecision,
    newStatus: ProposalStatus,
  ): Promise<void>;
  /**
   * Commit a Philos-accepted pending_review proposal directly to the profile.
   * Builds the Interpretation from stored fields; does NOT re-run the pipeline.
   * Provenance: source='agent_inference', createdBy='philos', confidence=accumulatedConfidence.
   * Sets proposal.status = 'confirmed' and proposal.committedInterpretationId.
   */
  commitReviewedProposal(proposal: PendingEssenceProposal): Promise<Interpretation>;
}

// ── Repository: Proposals ─────────────────────────────────────────────────────

/**
 * Storage abstraction for proposal lifecycle records (M0-13).
 * Implemented by InMemoryEssenceProposalRepository (tests / dev) and
 * FileSystemEssenceProposalRepository (durable single-process deployments).
 *
 * Invariants the repository must preserve:
 *   P2 — reviewDecisions is append-only; never mutated in place (enforced by callers,
 *         not asserted here — the repository stores whatever it is given).
 */
export interface EssenceProposalRepository {
  /** Upsert a proposal record by proposalId. Creates on first call, overwrites on subsequent. */
  saveProposal(proposal: PendingEssenceProposal): Promise<void>;
  /** Load one proposal by ID. Returns undefined if not found. */
  loadProposal(proposalId: string): Promise<PendingEssenceProposal | undefined>;
  /** Load all proposals for a profile (any status). */
  loadProposalsByProfile(profileId: string): Promise<PendingEssenceProposal[]>;
  /** Load all proposals across all profiles. Used by recovery on server startup (M0-14). */
  loadAllProposals(): Promise<PendingEssenceProposal[]>;
}

// ── Repository: Timeline ──────────────────────────────────────────────────────

import type { EssenceTimelineEvent } from './timeline';

/**
 * Append-only store for the Essence Timeline (M1-1B).
 *
 * Invariants:
 *   - append() is the only write operation; there is no update or delete.
 *   - Events are ordered by insertion (loadByProfile returns them in append order).
 *   - Implementations must be safe to call concurrently within a single process;
 *     multi-process coordination is out of scope for M1.
 *
 * Implemented by InMemoryEssenceTimelineRepository (tests / dev) and
 * FileSystemEssenceTimelineRepository (durable single-process deployments).
 */
export interface EssenceTimelineRepository {
  /** Append one event to the Timeline. Never throws on duplicate IDs — caller owns uniqueness. */
  append(event: EssenceTimelineEvent): Promise<void>;
  /** Return all events for a profile, in insertion order. */
  loadByProfile(profileId: string): Promise<EssenceTimelineEvent[]>;
  /** Return all events that reference a given proposalId, in insertion order. */
  loadByProposal(proposalId: string): Promise<EssenceTimelineEvent[]>;
  /** Return all events that reference a given interpretationId, in insertion order. */
  loadByInterpretation(interpretationId: string): Promise<EssenceTimelineEvent[]>;
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

