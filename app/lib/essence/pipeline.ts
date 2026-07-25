/**
 * Essence · Semantic Pipeline v1
 *
 * Types for each stage of the inference pipeline. Nothing writes directly to
 * Canonical Essence — every interpretation passes through all stages in order.
 *
 * Pipeline:
 *   Observation
 *     → Classification
 *     → Normalization
 *     → Candidate Interpretation
 *     → Evidence Evaluation
 *     → Conflict Detection
 *     → Write Policy
 *     → Proposal | Accepted Interpretation
 *     → Canonical Essence
 */

import type { EssenceLayer, StabilityClass } from './ontology';
import type {
  ConfidenceLevel,
  ConflictType,
  EvidenceStatus,
  Interpretation,
  InterpretationKind,
  Observation,
  SensitivityLevel,
  TemporalKind,
  StateTemporalScope,
} from './schema';

// ── Pipeline Stages ────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'validate'
  | 'classify'
  | 'normalize'
  | 'evaluate_evidence'
  | 'detect_conflict'
  | 'apply_write_policy'
  | 'create_proposal'
  | 'commit';

export interface PipelineStageSummary {
  stage: PipelineStage;
  outcome: 'passed' | 'flagged' | 'blocked';
  note?: string;
}

// ── Stage 1 — Observation ──────────────────────────────────────────────────────

/** The raw signal entering the pipeline. Wraps Observation with routing hints. */
export interface PipelineObservation {
  observation: Observation;
  /** Agent submitting this observation for processing. */
  submittedBy: string;
  /** Optional routing hint — agent's guess at the ontology node. Not binding. */
  suggestedNodeId: string | null;
}

// ── Stage 2 — Classification ───────────────────────────────────────────────────

/** Output of the classification stage — where in the ontology does this belong? */
export interface ClassificationResult {
  observation: Observation;
  nodeId: string;
  layer: EssenceLayer;
  stabilityClass: StabilityClass;
  classificationConfidence: 'certain' | 'probable' | 'ambiguous';
  /** If ambiguous, the alternative node IDs under consideration. */
  alternativeCandidates: string[];
  classifiedAt: string; // ISO 8601
  classifiedBy: string; // pipeline step or agent
}

// ── Stage 3 — Normalization ────────────────────────────────────────────────────

/** Normalized and deduped form of the observation ready for interpretation. */
export interface NormalizationResult {
  classificationResult: ClassificationResult;
  normalizedContent: string;
  /** IDs of prior observations that cover similar ground — used for dedup. */
  relatedObservationIds: string[];
  /** True if this observation is substantially redundant with an existing one. */
  isRedundant: boolean;
  /** If redundant, the existing observation it duplicates. */
  duplicateOfId: string | null;
  normalizedAt: string;
}

// ── Stage 4 — Candidate Interpretation ────────────────────────────────────────

/**
 * A proposed interpretation not yet evaluated for evidence or conflicts.
 * This is the raw output of inference — not yet canonical.
 */
export interface CandidateInterpretation {
  normalizationResult: NormalizationResult;
  candidateContent: string;
  candidateConfidence: ConfidenceLevel;
  interpretationKind: InterpretationKind;
  temporalKind: TemporalKind;
  stateScope: StateTemporalScope | null;
  sensitivity: SensitivityLevel;
  proposedAt: string;
  proposedBy: string;
}

// ── Stage 5 — Evidence Evaluation ─────────────────────────────────────────────

/** Result of consulting the cross-domain Evidence Engine. */
export interface EvidenceEvaluation {
  candidate: CandidateInterpretation;
  /** Evidence Engine IDs that corroborate this candidate. */
  supportingEvidenceIds: string[];
  /** Evidence Engine IDs that undermine this candidate. */
  contradictingEvidenceIds: string[];
  /** How many distinct source types support this. */
  distinctSourceCount: number;
  adjustedConfidence: ConfidenceLevel;
  evaluatedAt: string;
  evidenceStatus: EvidenceStatus;
}

// ── Stage 6 — Conflict Detection ──────────────────────────────────────────────

/** A candidate conflict identified during the detection stage. */
export interface DetectedConflict {
  existingInterpretationId: string;
  conflictType: ConflictType;
  severity: 'auto_resolvable' | 'requires_review' | 'requires_user';
  autoResolutionStrategy: 'accept_newer' | 'accept_older' | 'both_valid' | null;
}

export interface ConflictDetectionResult {
  evidenceEvaluation: EvidenceEvaluation;
  detectedConflicts: DetectedConflict[];
  hasBlockingConflict: boolean;
}

// ── Stage 7 — Write Policy ─────────────────────────────────────────────────────

/** The write threshold decision for this candidate. */
export type WritePolicyDecision =
  | 'auto_accept'       // evidence sufficient; write immediately
  | 'queue_for_review'  // needs human review before writing
  | 'require_user_confirmation' // must not write without explicit user approval
  | 'reject';           // insufficient evidence; discard candidate

export interface WritePolicy {
  conflictDetectionResult: ConflictDetectionResult;
  decision: WritePolicyDecision;
  reason: string;
  /**
   * Minimum additional independent observations needed before this can proceed,
   * if decision is 'queue_for_review'. 0 if not applicable.
   */
  additionalEvidenceRequired: number;
  evaluatedAt: string;
}

// ── Stage 8 — Pipeline Result ──────────────────────────────────────────────────

/** The final result of one observation passing through the full pipeline. */
export type PipelineResult =
  | {
      status: 'accepted';
      interpretation: Interpretation;
      writePolicy: WritePolicy;
      completedAt: string;
    }
  | {
      status: 'pending_user_confirmation';
      candidateInterpretation: CandidateInterpretation;
      writePolicy: WritePolicy;
      /** Token the user must present to confirm this update. */
      confirmationToken: string;
      expiresAt: string;
    }
  | {
      status: 'pending_review';
      candidateInterpretation: CandidateInterpretation;
      writePolicy: WritePolicy;
      queuedAt: string;
    }
  | {
      status: 'rejected';
      candidateInterpretation: CandidateInterpretation;
      writePolicy: WritePolicy;
      reason: string;
    }
  | {
      status: 'blocked_by_conflict';
      candidateInterpretation: CandidateInterpretation;
      conflictIds: string[];
      reason: string;
    };
