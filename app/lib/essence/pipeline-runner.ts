/**
 * Essence · Pipeline Runner
 *
 * Implements the 8-stage semantic pipeline as a pure computation.
 * No I/O, no side effects — takes a profile snapshot, returns a PipelineResult.
 *
 * Phase 1A invariant: no agent proposal produces `accepted` without a
 * UserAuthorizedActionContext. auto_accept is only reachable when
 * authContext.actorType === 'user'.
 */

import type { EssenceLayer, StabilityClass } from './ontology';
import { getEssenceNode } from './ontology';
import { isOrientationNode, isValidOrientationValue } from './orientation';
import type {
  ConfidenceLevel,
  ConflictType,
  EssenceProfile,
  EvidenceStatus,
  Interpretation,
  Provenance,
} from './schema';
import type { AgentName } from './access';
import { canAgentPropose } from './access';
import type { EssenceActor } from './actor';
import { actorLabel } from './actor';
import type {
  CandidateInterpretation,
  ClassificationResult,
  ConflictDetectionResult,
  DetectedConflict,
  EvidenceEvaluation,
  NormalizationResult,
  PipelineResult,
  PipelineStage,
  PipelineStageSummary,
  WritePolicy,
  WritePolicyDecision,
} from './pipeline';

// ── Clock ──────────────────────────────────────────────────────────────────────

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

// ── Id Generator ───────────────────────────────────────────────────────────────

export interface IdGenerator {
  nextId(prefix: string): string;
}

export const defaultIdGenerator: IdGenerator = {
  nextId(prefix: string): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${ts}_${rand}`;
  },
};

// ── Pipeline Abstraction ───────────────────────────────────────────────────────

export interface EssencePipeline {
  run(input: PipelineRunnerInput): PipelineRunnerOutput;
}

// ── Runner I/O ─────────────────────────────────────────────────────────────────

export interface PipelineRunnerInput {
  profileId: string;
  nodeId: string;
  proposedContent: string;
  /**
   * The actor submitting this proposal.
   * - 'agent': subject to canAgentPropose access check.
   * - 'user': bypasses agent-access check; auto_accept write policy.
   * - 'legacy_import': bypasses agent-access check; auto_accept write policy.
   */
  proposedBy: EssenceActor;
  evidenceObservationIds: string[];
  rationale: string;
  /** Snapshot of the profile at the time of proposal. */
  currentProfile: EssenceProfile;
}

export interface PipelineRunnerOutput {
  result: PipelineResult;
  stages: PipelineStageSummary[];
  /** All conflicts detected in Stage 5 (empty for early rejections). */
  detectedConflicts: DetectedConflict[];
}

// ── Pipeline Runner ────────────────────────────────────────────────────────────

export class PipelineRunner implements EssencePipeline {
  constructor(
    private readonly clock: Clock = systemClock,
    private readonly idGen: IdGenerator = defaultIdGenerator,
  ) {}

  run(input: PipelineRunnerInput): PipelineRunnerOutput {
    const stages: PipelineStageSummary[] = [];

    // ── Stage 1: Validate ────────────────────────────────────────────────────
    if (!input.nodeId || !input.proposedContent?.trim()) {
      stages.push(stage('validate', 'blocked', 'empty nodeId or content'));
      return earlyReject(stages, 'Empty nodeId or content', this.clock, this.idGen);
    }
    const node = getEssenceNode(input.nodeId);
    if (!node) {
      stages.push(stage('validate', 'blocked', `unknown nodeId: ${input.nodeId}`));
      return earlyReject(stages, `Unknown nodeId: ${input.nodeId}`, this.clock, this.idGen);
    }
    // Orientation nodes only accept categorical values defined in ORIENTATION_SCHEMA.
    if (isOrientationNode(input.nodeId)) {
      const trimmed = input.proposedContent.trim();
      if (!isValidOrientationValue(input.nodeId, trimmed)) {
        stages.push(stage('validate', 'blocked', `'${trimmed}' is not a valid value for ${input.nodeId}`));
        return earlyReject(stages, `'${trimmed}' is not a valid value for ${input.nodeId}`, this.clock, this.idGen);
      }
    }
    // Only agents are subject to the canAgentPropose access check.
    // Users and legacy imports are pre-authorized by their actor type.
    if (input.proposedBy.type === 'agent') {
      if (!canAgentPropose(input.proposedBy.agentName, node.layer)) {
        stages.push(stage('validate', 'blocked', `${input.proposedBy.agentName} cannot propose to ${node.layer}`));
        return earlyReject(stages, `Agent ${input.proposedBy.agentName} cannot propose to layer ${node.layer}`, this.clock, this.idGen);
      }
    }
    stages.push(stage('validate', 'passed'));

    // ── Stage 2: Classify ────────────────────────────────────────────────────
    stages.push(stage('classify', 'passed'));

    // ── Stage 3: Normalize ───────────────────────────────────────────────────
    const existing = getNodeInterpretations(input.currentProfile, node.layer, input.nodeId);
    const isRedundant = existing.some(i =>
      !i.archivedAt && i.content.trim() === input.proposedContent.trim()
    );
    stages.push(stage('normalize', isRedundant ? 'flagged' : 'passed', isRedundant ? 'redundant with existing interpretation' : undefined));

    // ── Stage 4: Evaluate Evidence ───────────────────────────────────────────
    const evidenceStatus: EvidenceStatus =
      input.evidenceObservationIds.length > 0 ? 'referenced' : 'unavailable';
    stages.push(stage('evaluate_evidence', 'passed'));

    // ── Stage 5: Detect Conflicts ────────────────────────────────────────────
    const active = existing.filter(i => !i.archivedAt);
    const detectedConflicts: DetectedConflict[] = active.map(i => {
      const cType = classifyConflictType(input.nodeId, node.layer, i);
      const sev = classifyConflictSeverity(input.nodeId, i);
      return {
        existingInterpretationId: i.id,
        conflictType: cType,
        severity: sev,
        autoResolutionStrategy: sev === 'auto_resolvable' ? 'accept_newer' : null,
      };
    });
    const hasBlockingConflict = detectedConflicts.some(c => c.severity === 'requires_user');

    if (hasBlockingConflict) {
      stages.push(stage('detect_conflict', 'blocked', 'unresolvable contradiction'));
      padBlocked(stages, ['apply_write_policy', 'create_proposal', 'commit']);
      const candidate = buildCandidate(input, node, evidenceStatus, this.clock, this.idGen);
      return {
        result: {
          status: 'blocked_by_conflict',
          candidateInterpretation: candidate,
          conflictIds: detectedConflicts
            .filter(c => c.severity === 'requires_user')
            .map(c => c.existingInterpretationId),
          reason: 'Unresolved contradiction requires user resolution',
        },
        stages,
        detectedConflicts,
      };
    }
    stages.push(stage('detect_conflict', detectedConflicts.length > 0 ? 'flagged' : 'passed'));

    // ── Stage 6: Apply Write Policy ──────────────────────────────────────────
    const decision = applyWritePolicy(input, node, evidenceStatus);
    stages.push(stage('apply_write_policy', decision === 'reject' ? 'blocked' : 'passed'));

    const candidate = buildCandidate(input, node, evidenceStatus, this.clock, this.idGen);
    const conflictDetectionResult: ConflictDetectionResult = {
      evidenceEvaluation: buildEvidenceEvaluation(candidate, evidenceStatus, this.clock),
      detectedConflicts,
      hasBlockingConflict: false,
    };
    const writePolicy: WritePolicy = {
      conflictDetectionResult,
      decision,
      reason: writePolicyReason(decision, node, evidenceStatus),
      additionalEvidenceRequired: decision === 'queue_for_review' ? 1 : 0,
      evaluatedAt: new Date(this.clock.now()).toISOString(),
    };

    if (decision === 'reject') {
      padBlocked(stages, ['create_proposal', 'commit']);
      return {
        result: {
          status: 'rejected',
          candidateInterpretation: candidate,
          writePolicy,
          reason: writePolicy.reason,
        },
        stages,
        detectedConflicts,
      };
    }

    // ── Stage 7: Create Proposal ─────────────────────────────────────────────
    stages.push(stage('create_proposal', 'passed'));
    const confirmationToken = this.idGen.nextId('ct');
    const expiresAt = new Date(this.clock.now() + 24 * 60 * 60 * 1000).toISOString();

    // ── Stage 8: Commit ──────────────────────────────────────────────────────
    if (decision === 'auto_accept') {
      const interpretation = buildInterpretation(input, node, evidenceStatus, this.clock, this.idGen);
      const writeDisposition = isOrientationNode(input.nodeId) ? 'replace_single_value' : 'append';
      stages.push(stage('commit', 'passed'));
      return {
        result: {
          status: 'accepted',
          interpretation,
          writePolicy,
          writeDisposition,
          completedAt: new Date(this.clock.now()).toISOString(),
        },
        stages,
        detectedConflicts,
      };
    }

    if (decision === 'require_user_confirmation') {
      stages.push(stage('commit', 'flagged', 'awaiting user confirmation'));
      return {
        result: {
          status: 'pending_user_confirmation',
          candidateInterpretation: candidate,
          writePolicy,
          confirmationToken,
          expiresAt,
        },
        stages,
        detectedConflicts,
      };
    }

    // queue_for_review
    stages.push(stage('commit', 'flagged', 'queued for human review'));
    return {
      result: {
        status: 'pending_review',
        candidateInterpretation: candidate,
        writePolicy,
        queuedAt: new Date(this.clock.now()).toISOString(),
      },
      stages,
      detectedConflicts,
    };
  }
}

// ── Stage Helpers ──────────────────────────────────────────────────────────────

function stage(
  s: PipelineStage,
  outcome: PipelineStageSummary['outcome'],
  note?: string,
): PipelineStageSummary {
  return note !== undefined ? { stage: s, outcome, note } : { stage: s, outcome };
}

function padBlocked(stages: PipelineStageSummary[], remaining: PipelineStage[]): void {
  for (const s of remaining) stages.push(stage(s, 'blocked'));
}

function earlyReject(
  stages: PipelineStageSummary[],
  reason: string,
  clock: Clock,
  idGen: IdGenerator,
): PipelineRunnerOutput {
  padBlocked(stages, ['classify', 'normalize', 'evaluate_evidence', 'detect_conflict', 'apply_write_policy', 'create_proposal', 'commit']);
  const now = new Date(clock.now()).toISOString();
  const placeholderCandidate: CandidateInterpretation = {
    normalizationResult: {
      classificationResult: {
        observation: {
          id: '',
          source: 'agent_inference',
          recordedBy: 'pipeline-runner',
          content: '',
          sessionId: null,
          observedAt: now,
          evidenceIds: [],
          correctsObservationId: null,
        },
        nodeId: '',
        layer: 'core',
        stabilityClass: 'Foundational',
        classificationConfidence: 'ambiguous',
        alternativeCandidates: [],
        classifiedAt: now,
        classifiedBy: 'pipeline-runner',
      },
      normalizedContent: '',
      relatedObservationIds: [],
      isRedundant: false,
      duplicateOfId: null,
      normalizedAt: now,
    },
    candidateContent: '',
    candidateConfidence: 'low',
    interpretationKind: 'probable_interpretation',
    temporalKind: 'trait',
    stateScope: null,
    sensitivity: 'personal',
    proposedAt: now,
    proposedBy: 'philos',
  };
  return {
    result: {
      status: 'rejected',
      candidateInterpretation: placeholderCandidate,
      writePolicy: buildRejectPolicy(clock, reason, idGen),
      reason,
    },
    stages,
    detectedConflicts: [],
  };
}

// ── Write Policy ───────────────────────────────────────────────────────────────

function applyWritePolicy(
  input: PipelineRunnerInput,
  node: { id: string; layer: EssenceLayer; confidenceRules: { writeThreshold: string; requiresUserConfirmation: boolean } },
  evidenceStatus: EvidenceStatus,
): WritePolicyDecision {
  // Users and legacy imports carry pre-authorized context — auto accept.
  if (input.proposedBy.type !== 'agent') return 'auto_accept';
  const { writeThreshold, requiresUserConfirmation } = node.confidenceRules;
  if (requiresUserConfirmation || writeThreshold === 'user_confirmed') return 'require_user_confirmation';
  if (evidenceStatus === 'unavailable') return 'require_user_confirmation';
  return 'queue_for_review';
}

function writePolicyReason(
  decision: WritePolicyDecision,
  node: { id: string; confidenceRules: { writeThreshold: string; requiresUserConfirmation: boolean } },
  evidenceStatus: EvidenceStatus,
): string {
  if (decision === 'auto_accept') return 'User authorized — committed immediately';
  if (decision === 'reject') return 'Structural validation failed';
  if (node.confidenceRules.requiresUserConfirmation) return 'Node requires explicit user confirmation';
  if (node.confidenceRules.writeThreshold === 'user_confirmed') return 'Write threshold requires user confirmation';
  if (evidenceStatus === 'unavailable') return 'No evidence references — pending user confirmation';
  return 'Evidence referenced but not yet evaluated — queued for review';
}

// ── Conflict Classification ────────────────────────────────────────────────────

function classifyConflictType(
  nodeId: string,
  layer: EssenceLayer,
  existing: Interpretation,
): ConflictType {
  if (isOrientationNode(nodeId)) return 'preference_shift';
  if (nodeId === 'Preferences') return 'preference_shift';
  if (layer === 'identity') return 'role_difference';
  if (existing.temporalKind === 'state') return 'temporal_change';
  return 'unresolved_contradiction';
}

function classifyConflictSeverity(nodeId: string, existing: Interpretation): DetectedConflict['severity'] {
  if (isOrientationNode(nodeId)) return 'auto_resolvable';
  if (existing.temporalKind === 'state') return 'auto_resolvable';
  if (nodeId === 'Preferences') return 'auto_resolvable';
  return 'requires_user';
}

// ── Builders ───────────────────────────────────────────────────────────────────

function getNodeInterpretations(
  profile: EssenceProfile,
  layer: EssenceLayer,
  nodeId: string,
): Interpretation[] {
  const layerData = profile[layer] as Record<string, Interpretation[]>;
  return layerData[nodeId] ?? [];
}

function buildCandidate(
  input: PipelineRunnerInput,
  node: { id: string; layer: EssenceLayer; stabilityClass: StabilityClass },
  evidenceStatus: EvidenceStatus,
  clock: Clock,
  idGen: IdGenerator,
): CandidateInterpretation {
  const now = new Date(clock.now()).toISOString();
  const isUserOrImport = input.proposedBy.type !== 'agent';
  const classification: ClassificationResult = {
    observation: {
      id: idGen.nextId('obs'),
      source: isUserOrImport ? 'user_correction' : 'agent_inference',
      recordedBy: actorLabel(input.proposedBy),
      content: input.proposedContent,
      sessionId: null,
      observedAt: now,
      evidenceIds: input.evidenceObservationIds,
      correctsObservationId: null,
    },
    nodeId: input.nodeId,
    layer: node.layer,
    stabilityClass: node.stabilityClass,
    classificationConfidence: 'probable',
    alternativeCandidates: [],
    classifiedAt: now,
    classifiedBy: 'pipeline-runner',
  };
  const normalization: NormalizationResult = {
    classificationResult: classification,
    normalizedContent: input.proposedContent.trim(),
    relatedObservationIds: [],
    isRedundant: false,
    duplicateOfId: null,
    normalizedAt: now,
  };
  return {
    normalizationResult: normalization,
    candidateContent: input.proposedContent.trim(),
    candidateConfidence: evidenceStatus === 'unavailable' ? 'low' : 'medium',
    interpretationKind: isUserOrImport
      ? 'user_confirmed_understanding'
      : 'probable_interpretation',
    temporalKind: 'trait',
    stateScope: null,
    sensitivity: 'personal',
    proposedAt: now,
    proposedBy: actorLabel(input.proposedBy),
  };
}

function buildEvidenceEvaluation(
  candidate: CandidateInterpretation,
  evidenceStatus: EvidenceStatus,
  clock: Clock,
): EvidenceEvaluation {
  return {
    candidate,
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    distinctSourceCount: 0,
    adjustedConfidence: candidate.candidateConfidence,
    evaluatedAt: new Date(clock.now()).toISOString(),
    evidenceStatus,
  };
}

function buildInterpretation(
  input: PipelineRunnerInput,
  node: { id: string; layer: EssenceLayer; stabilityClass: StabilityClass },
  evidenceStatus: EvidenceStatus,
  clock: Clock,
  idGen: IdGenerator,
): Interpretation {
  const now = new Date(clock.now()).toISOString();
  const isUserOrImport = input.proposedBy.type !== 'agent';
  const confidence: ConfidenceLevel =
    isUserOrImport ? 'verified' : evidenceStatus === 'unavailable' ? 'low' : 'medium';
  const provenance: Provenance = {
    source: isUserOrImport ? 'user_correction' : 'agent_inference',
    confidence,
    createdBy: actorLabel(input.proposedBy),
    firstObservedAt: now,
    lastConfirmedAt: now,
    lastUpdatedAt: now,
    evidenceIds: input.evidenceObservationIds,
    conflictingInterpretationIds: [],
  };
  return {
    id: idGen.nextId('interp'),
    version: 1,
    nodeId: input.nodeId,
    layer: node.layer,
    stabilityClass: node.stabilityClass,
    content: input.proposedContent.trim(),
    observationIds: input.evidenceObservationIds,
    confidence,
    interpretationKind: isUserOrImport
      ? 'user_confirmed_understanding'
      : 'probable_interpretation',
    provenance,
    sensitivity: 'personal',
    temporalKind: 'trait',
    stateScope: null,
    expiresAt: null,
    archivedAt: null,
    conflictIds: [],
    evidenceStatus,
  };
}

function buildRejectPolicy(clock: Clock, reason: string, idGen: IdGenerator): WritePolicy {
  const now = new Date(clock.now()).toISOString();
  const placeholderCandidate: CandidateInterpretation = {
    normalizationResult: {
      classificationResult: {
        observation: {
          id: '',
          source: 'agent_inference',
          recordedBy: 'pipeline-runner',
          content: '',
          sessionId: null,
          observedAt: now,
          evidenceIds: [],
          correctsObservationId: null,
        },
        nodeId: '',
        layer: 'core',
        stabilityClass: 'Foundational',
        classificationConfidence: 'ambiguous',
        alternativeCandidates: [],
        classifiedAt: now,
        classifiedBy: 'pipeline-runner',
      },
      normalizedContent: '',
      relatedObservationIds: [],
      isRedundant: false,
      duplicateOfId: null,
      normalizedAt: now,
    },
    candidateContent: '',
    candidateConfidence: 'low',
    interpretationKind: 'probable_interpretation',
    temporalKind: 'trait',
    stateScope: null,
    sensitivity: 'personal',
    proposedAt: now,
    proposedBy: 'philos',
  };
  return {
    conflictDetectionResult: {
      evidenceEvaluation: {
        candidate: placeholderCandidate,
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        distinctSourceCount: 0,
        adjustedConfidence: 'low',
        evaluatedAt: now,
        evidenceStatus: 'unavailable',
      },
      detectedConflicts: [],
      hasBlockingConflict: false,
    },
    decision: 'reject',
    reason,
    additionalEvidenceRequired: 0,
    evaluatedAt: now,
  };
}
