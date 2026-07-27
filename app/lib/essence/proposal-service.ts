/**
 * Essence · Proposal Service
 *
 * The ONLY service that holds a writable EssenceRepository.
 * All write operations on Canonical Essence go through this service.
 * Proposals are tracked in a permanent lifecycle store — records are never
 * removed after reaching a terminal state (confirmed, rejected, expired).
 */

import type { EssenceLayer } from './ontology';
import { getEssenceNode } from './ontology';
import type {
  Conflict,
  EssenceEvolutionEntry,
  EssenceProfile,
  Interpretation,
  Observation,
} from './schema';
import type { AgentName } from './access';
import { ACCESS_POLICIES, canAgentPropose } from './access';
import type {
  EssencePhilosReviewAPI,
  EssenceProposalAPI,
  EssenceUserActionAPI,
  PendingEssenceProposal,
  PhilosReviewDecision,
  ProposalStatus,
  ProposedUpdate,
  UserCorrection,
  EvidencePackage,
} from './api';
import type { PipelineResult } from './pipeline';
import type { EssenceRepository } from './repository';
import type { EssencePipeline, Clock, IdGenerator } from './pipeline-runner';
import { systemClock, defaultIdGenerator } from './pipeline-runner';
import type { UserAuthorizedActionContext } from './actor';
import { actorLabel } from './actor';
import { findInterpretation } from './interpretation-utils';
import { isOrientationNode } from './orientation';

export { type Clock };

const LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

export class EssenceProposalService implements EssenceProposalAPI, EssenceUserActionAPI, EssencePhilosReviewAPI {
  private readonly proposalRecords = new Map<string, PendingEssenceProposal>();

  constructor(
    private readonly repo: EssenceRepository,
    private readonly runner: EssencePipeline,
    private readonly clock: Clock = systemClock,
    private readonly idGen: IdGenerator = defaultIdGenerator,
  ) {}

  async proposeUpdate(
    profileId: string,
    proposal: ProposedUpdate,
    evidence: EvidencePackage | null,
  ): Promise<PipelineResult> {
    // Verify profile exists before doing any work.
    if (!(await this.repo.profileExists(profileId))) {
      return structuredReject(`Profile not found: ${profileId}`);
    }

    // Pre-validate schema integrity before writing anything to the store.
    // Schema violations (unknown node, empty content) are not meaningful signals.
    if (!proposal.nodeId || !proposal.proposedContent?.trim()) {
      return structuredReject('Empty nodeId or proposedContent');
    }
    const node = getEssenceNode(proposal.nodeId);
    if (!node) {
      return structuredReject(`Unknown nodeId: ${proposal.nodeId}`);
    }

    // Authorization check before any persistence.
    // Unauthorized agents must never create Observations.
    if (!canAgentPropose(proposal.proposedBy, node.layer)) {
      return structuredReject(`Agent ${proposal.proposedBy} cannot propose to layer ${node.layer}`);
    }

    // External evidence refs require an EvidenceResolver, which is not wired in Phase 1A.
    // Reject early — before any persistence — so callers get a typed failure.
    if ((evidence?.externalEvidenceRefs ?? []).length > 0) {
      return {
        status: 'unsupported_external_evidence',
        reason: 'ExternalEvidenceRef validation requires an EvidenceResolver (not available in Phase 1A). ' +
                'Omit externalEvidenceRefs or inject an EvidenceResolver.',
      };
    }

    // Load profile to validate evidence IDs before writing anything.
    const preProfile = await this.repo.getProfile(profileId);
    if (!preProfile) return structuredReject(`Profile not found: ${profileId}`);

    // Validate that every referenced Essence Observation ID belongs to this profile.
    // observation IDs from the proposal and from the evidence package share the same
    // validation: both must be real Observations stored in this profile.
    const knownObsIds = new Set(preProfile.observations.map(o => o.id));
    const allCandidateObsIds = [
      ...proposal.evidenceObservationIds,
      ...(evidence?.observationIds ?? []),
    ];
    for (const id of allCandidateObsIds) {
      if (!knownObsIds.has(id)) {
        return structuredReject(`Unknown or cross-profile observation ID: ${id}`);
      }
    }

    // Persist the backing observation (two-tier: observation before interpretation).
    const obs = buildProposalObservation(proposal, this.clock, this.idGen);
    await this.repo.appendObservation(profileId, obs);

    // Merge and deduplicate validated Essence Observation IDs.
    const allEvidenceIds = [...new Set(allCandidateObsIds)];

    const profile = await this.repo.getProfile(profileId);
    if (!profile) return structuredReject(`Profile not found: ${profileId}`);

    const output = this.runner.run({
      profileId,
      nodeId: proposal.nodeId,
      proposedContent: proposal.proposedContent,
      proposedBy: { type: 'agent', agentName: proposal.proposedBy },
      evidenceObservationIds: allEvidenceIds,
      rationale: proposal.rationale,
      currentProfile: profile,
    });

    // Persist conflict records when a proposal is blocked.
    // triggeringObservationId is the backing observation we just appended — always a real ID.
    // candidateInterpretationId is omitted: the candidate was blocked before being committed.
    if (output.result.status === 'blocked_by_conflict') {
      const now = new Date(this.clock.now()).toISOString();
      for (const existingId of output.result.conflictIds) {
        const conflict: Conflict = {
          id: this.idGen.nextId('conflict'),
          type: 'unresolved_contradiction',
          detectedAt: now,
          existingInterpretationIds: [existingId],
          triggeringObservationId: obs.id,
          resolvedAt: null,
          resolution: null,
          resolutionNote: null,
        };
        await this.repo.appendConflict(profileId, conflict);
      }
    }

    const evidenceStatus = allEvidenceIds.length > 0 ? 'referenced' : 'unavailable';
    const proposedAt = new Date(this.clock.now()).toISOString();

    if (output.result.status === 'pending_review') {
      const { proposalId, expiresAt } = output.result;
      this.proposalRecords.set(proposalId, {
        proposalId,
        profileId,
        nodeId: proposal.nodeId,
        layer: node!.layer,
        proposedContent: proposal.proposedContent,
        proposedBy: proposal.proposedBy,
        evidenceStatus,
        proposedAt,
        expiresAt,
        status: 'pending_review',
        conflictsWith: [],
        pipelineStages: output.stages,
        accumulatedConfidence: proposal.accumulatedConfidence ?? null,
        reviewDecisions: [],
        deferCount: 0,
        evidenceObservationIds: allEvidenceIds,
      });
    }

    if (output.result.status === 'pending_user_confirmation') {
      const { confirmationToken, expiresAt } = output.result;
      this.proposalRecords.set(confirmationToken, {
        proposalId: confirmationToken,
        profileId,
        nodeId: proposal.nodeId,
        layer: node!.layer,
        proposedContent: proposal.proposedContent,
        proposedBy: proposal.proposedBy,
        evidenceStatus,
        proposedAt,
        expiresAt,
        status: 'pending_user_confirmation',
        conflictsWith: [],
        pipelineStages: output.stages,
        accumulatedConfidence: proposal.accumulatedConfidence ?? null,
        reviewDecisions: [],
        deferCount: 0,
        evidenceObservationIds: allEvidenceIds,
      });
    }

    return output.result;
  }

  async confirmUpdate(
    profileId: string,
    confirmationToken: string,
    context: UserAuthorizedActionContext,
  ): Promise<Interpretation> {
    const record = this.proposalRecords.get(confirmationToken);
    if (!record) throw new Error(`Unknown confirmation token: ${confirmationToken}`);
    if (record.profileId !== profileId) throw new Error('Profile ID mismatch');

    // Idempotent: already confirmed
    if (record.status === 'confirmed') {
      const profile = await this.repo.getProfile(profileId);
      const interp = findInterpretation(profile!, record.committedInterpretationId!);
      if (!interp) throw new Error('Confirmed interpretation not found in profile');
      return interp;
    }

    if (record.status === 'rejected') throw new Error('Cannot confirm a rejected proposal');
    if (record.status === 'pending_review') throw new Error('Cannot confirm a proposal that is still pending_review; Philos has not acted yet');

    if (new Date(record.expiresAt).getTime() < this.clock.now()) {
      record.status = 'expired';
      throw new Error('Proposal has expired');
    }

    const profile = await this.repo.getProfile(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const output = this.runner.run({
      profileId,
      nodeId: record.nodeId,
      proposedContent: record.proposedContent,
      proposedBy: { type: 'user', actionContext: context },
      evidenceObservationIds: [],
      rationale: 'User confirmed proposal',
      currentProfile: profile,
    });

    if (output.result.status !== 'accepted') {
      throw new Error(`Pipeline did not accept the confirmed proposal: got ${output.result.status}`);
    }

    const interp = output.result.interpretation;
    await this.writeInterpretation(profile, interp, output.result.writeDisposition);

    record.status = 'confirmed';
    record.committedInterpretationId = interp.id;

    return interp;
  }

  async rejectUpdate(
    profileId: string,
    confirmationToken: string,
    _context: UserAuthorizedActionContext,
    reason: string | null,
  ): Promise<{ rejected: true; recordedAt: string }> {
    const record = this.proposalRecords.get(confirmationToken);
    if (!record) throw new Error(`Unknown confirmation token: ${confirmationToken}`);
    if (record.profileId !== profileId) throw new Error('Profile ID mismatch');

    // Idempotent: already rejected
    if (record.status === 'rejected') {
      return { rejected: true, recordedAt: new Date(this.clock.now()).toISOString() };
    }
    if (record.status === 'confirmed') {
      throw new Error('Cannot reject an already-confirmed proposal');
    }

    record.status = 'rejected';
    if (reason) record.rejectionReason = reason;

    return { rejected: true, recordedAt: new Date(this.clock.now()).toISOString() };
  }

  async correctItem(
    profileId: string,
    correction: UserCorrection,
    context: UserAuthorizedActionContext,
  ): Promise<PipelineResult> {
    // Verify profile exists.
    if (!(await this.repo.profileExists(profileId))) {
      return structuredReject(`Profile not found: ${profileId}`);
    }

    // Persist backing observation (source: user_correction, actor: user).
    const obs = buildCorrectionObservation(correction, this.clock, this.idGen);
    await this.repo.appendObservation(profileId, obs);

    // Get fresh profile (includes the new observation).
    const profile = await this.repo.getProfile(profileId);
    if (!profile) return structuredReject(`Profile not found: ${profileId}`);

    const output = this.runner.run({
      profileId,
      nodeId: correction.nodeId,
      proposedContent: correction.correctedContent,
      proposedBy: { type: 'user', actionContext: context },
      evidenceObservationIds: [obs.id],
      rationale: correction.note ?? 'User correction',
      currentProfile: profile,
    });

    if (output.result.status === 'accepted') {
      const interp = output.result.interpretation;
      if (output.result.writeDisposition === 'replace_single_value') {
        await this.writeInterpretation(profile, interp, 'replace_single_value');
      } else {
        if (correction.targetInterpretationId) {
          archiveInterpretation(profile, correction.targetInterpretationId, this.clock);
        }
        await this.writeInterpretation(profile, interp, 'append');
      }
    }

    return output.result;
  }

  async archiveItem(
    profileId: string,
    interpretationId: string,
    archivedBy: AgentName,
    reason: string,
  ): Promise<{ archived: true; evolutionEntryId: string }> {
    const policy = ACCESS_POLICIES[archivedBy];
    if (!policy.canArchive) throw new Error(`Agent ${archivedBy} cannot archive interpretations`);

    const profile = await this.repo.getProfile(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const archivedAt = new Date(this.clock.now()).toISOString();
    archiveInterpretation(profile, interpretationId, this.clock, archivedAt);

    const nodeId = getInterpretationNodeId(profile, interpretationId) ?? interpretationId;
    const entryId = this.idGen.nextId('evo');
    const entry: EssenceEvolutionEntry = {
      id: entryId,
      nodeId,
      previousInterpretationId: interpretationId,
      newInterpretationId: interpretationId,
      triggeredBy: 'agent_inference',
      agentName: archivedBy,
      timestamp: archivedAt,
      note: reason,
    };
    profile.evolution.push(entry);
    profile.updatedAt = archivedAt;
    await this.repo.saveProfile(profile);

    return { archived: true, evolutionEntryId: entryId };
  }

  /**
   * Returns pending proposals visible to the requesting agent.
   *
   * Visibility rules:
   *   - pending_review: Philos only (Philos-internal queue).
   *   - pending_user_confirmation: the proposing agent + Philos.
   *
   * Cross-agent isolation: agents see only their own pending_user_confirmation proposals.
   * Philos sees all proposals in both pending states.
   */
  async getPendingProposals(
    profileId: string,
    requestedBy: AgentName,
  ): Promise<PendingEssenceProposal[]> {
    const now = this.clock.now();
    const result: PendingEssenceProposal[] = [];
    for (const record of this.proposalRecords.values()) {
      if (record.profileId !== profileId) continue;
      if (record.status !== 'pending_review' && record.status !== 'pending_user_confirmation') continue;
      if (new Date(record.expiresAt).getTime() < now) {
        record.status = 'expired';
        continue;
      }
      if (record.status === 'pending_review' && requestedBy !== 'philos') continue;
      if (record.status === 'pending_user_confirmation' && requestedBy !== 'philos' && record.proposedBy !== requestedBy) continue;
      result.push(record);
    }
    return result;
  }

  // ── EssencePhilosReviewAPI ─────────────────────────────────────────────────

  async getReviewQueue(profileId: string): Promise<PendingEssenceProposal[]> {
    const now = this.clock.now();
    const result: PendingEssenceProposal[] = [];
    for (const record of this.proposalRecords.values()) {
      if (record.profileId !== profileId || record.status !== 'pending_review') continue;
      if (new Date(record.expiresAt).getTime() < now) {
        record.status = 'expired';
        continue;
      }
      result.push(record);
    }
    return result;
  }

  getProposalRecord(proposalId: string): PendingEssenceProposal | undefined {
    return this.proposalRecords.get(proposalId);
  }

  applyReviewDecision(
    proposalId: string,
    decision: PhilosReviewDecision,
    newStatus: ProposalStatus,
  ): void {
    const record = this.proposalRecords.get(proposalId);
    if (!record) throw new Error(`Unknown proposalId: ${proposalId}`);
    record.reviewDecisions.push(decision);
    record.status = newStatus;
    if (decision.decision === 'defer') {
      record.deferCount += 1;
    }
  }

  async commitReviewedProposal(proposal: PendingEssenceProposal): Promise<Interpretation> {
    if (proposal.status !== 'pending_review') {
      throw new Error(`commitReviewedProposal: expected pending_review, got ${proposal.status}`);
    }
    if (proposal.accumulatedConfidence === null || proposal.accumulatedConfidence === undefined) {
      throw new Error(`commitReviewedProposal: accumulatedConfidence is null for proposal ${proposal.proposalId}`);
    }

    const profile = await this.repo.getProfile(proposal.profileId);
    if (!profile) throw new Error(`Profile not found: ${proposal.profileId}`);

    const node = getEssenceNode(proposal.nodeId);
    if (!node) throw new Error(`Unknown nodeId: ${proposal.nodeId}`);

    const now = new Date(this.clock.now()).toISOString();
    const confidence = proposal.accumulatedConfidence;
    const evidenceIds = Array.from(proposal.evidenceObservationIds);

    const interp: Interpretation = {
      id: this.idGen.nextId('interp'),
      version: 1,
      nodeId: proposal.nodeId,
      layer: node.layer,
      stabilityClass: node.stabilityClass,
      content: proposal.proposedContent,
      observationIds: evidenceIds,
      confidence,
      interpretationKind: 'probable_interpretation',
      provenance: {
        source: 'agent_inference',
        confidence,
        createdBy: 'philos',
        firstObservedAt: proposal.proposedAt,
        lastConfirmedAt: now,
        lastUpdatedAt: now,
        evidenceIds,
        conflictingInterpretationIds: [],
      },
      sensitivity: 'personal',
      temporalKind: 'trait',
      stateScope: null,
      expiresAt: null,
      archivedAt: null,
      conflictIds: [],
      evidenceStatus: proposal.evidenceStatus,
    };

    await this.writeInterpretation(profile, interp, 'replace_single_value');

    proposal.committedInterpretationId = interp.id;
    return interp;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async writeInterpretation(
    profile: EssenceProfile,
    interp: Interpretation,
    writeDisposition: 'append' | 'replace_single_value',
  ): Promise<void> {
    if (writeDisposition === 'replace_single_value' && !isOrientationNode(interp.nodeId)) {
      throw new Error(`replace_single_value is only valid for orientation nodes; got '${interp.nodeId}'`);
    }

    const now = new Date(this.clock.now()).toISOString();
    let previousInterpretationId: string | null = null;
    let additionalArchivedNote: string | null = null;

    if (writeDisposition === 'replace_single_value') {
      const layerData = profile[interp.layer] as Record<string, Interpretation[]>;
      // Capture IDs before archiving so previousInterpretationId is non-null when a prior existed.
      const activeIds = (layerData[interp.nodeId] ?? [])
        .filter(p => !p.archivedAt)
        .map(p => p.id);
      previousInterpretationId = activeIds[0] ?? null;
      if (activeIds.length > 1) {
        additionalArchivedNote = `Additional archived: ${activeIds.slice(1).join(', ')}`;
      }
      for (const prev of layerData[interp.nodeId] ?? []) {
        if (!prev.archivedAt) archiveInterpretation(profile, prev.id, this.clock, now);
      }
      // Resolve open preference_shift conflicts that referenced the archived interpretations.
      for (const archivedId of activeIds) {
        resolveConflictsForArchived(profile, archivedId, interp.id, now);
      }
    }

    const layerData = profile[interp.layer] as Record<string, Interpretation[]>;
    if (!layerData[interp.nodeId]) layerData[interp.nodeId] = [];
    layerData[interp.nodeId].push(interp);

    const entry: EssenceEvolutionEntry = {
      id: this.idGen.nextId('evo'),
      nodeId: interp.nodeId,
      previousInterpretationId,
      newInterpretationId: interp.id,
      triggeredBy: interp.provenance.source,
      agentName: interp.provenance.createdBy,
      timestamp: now,
      note: additionalArchivedNote,
    };
    profile.evolution.push(entry);
    profile.updatedAt = now;
    await this.repo.saveProfile(profile);
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

function buildProposalObservation(
  proposal: ProposedUpdate,
  clock: Clock,
  idGen: IdGenerator,
): Observation {
  const now = new Date(clock.now()).toISOString();
  return {
    id: idGen.nextId('obs'),
    source: 'agent_inference',
    recordedBy: proposal.proposedBy,
    content: proposal.proposedContent,
    sessionId: null,
    observedAt: now,
    evidenceIds: proposal.evidenceObservationIds,
    correctsObservationId: null,
  };
}

function buildCorrectionObservation(
  correction: UserCorrection,
  clock: Clock,
  idGen: IdGenerator,
): Observation {
  return {
    id: idGen.nextId('obs'),
    source: 'user_correction',
    recordedBy: 'user',
    content: correction.correctedContent,
    sessionId: null,
    observedAt: correction.correctedAt,
    evidenceIds: [],
    correctsObservationId: correction.targetInterpretationId,
  };
}

function archiveInterpretation(
  profile: EssenceProfile,
  interpretationId: string,
  clock: Clock,
  archivedAt?: string,
): void {
  const at = archivedAt ?? new Date(clock.now()).toISOString();
  for (const layer of LAYERS) {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    for (const interpretations of Object.values(layerData)) {
      const interp = interpretations.find(i => i.id === interpretationId);
      if (interp) {
        (interp as { archivedAt: string | null }).archivedAt = at;
        return;
      }
    }
  }
}

/**
 * Resolve open preference_shift conflicts whose existingInterpretationIds contain
 * the archived interpretation. Called after replace_single_value writes.
 * Only resolves 'preference_shift' severity — unresolved contradictions remain open.
 */
function resolveConflictsForArchived(
  profile: EssenceProfile,
  archivedId: string,
  newInterpId: string,
  now: string,
): void {
  for (const conflict of profile.conflicts) {
    if (conflict.resolvedAt !== null) continue;
    if (!conflict.existingInterpretationIds.includes(archivedId)) continue;
    // Only auto-resolve preference_shift conflicts; others require user action.
    if (conflict.type !== 'preference_shift') continue;
    (conflict as { resolvedAt: string | null }).resolvedAt = now;
    (conflict as { resolution: string | null }).resolution = 'accepted_newer';
    (conflict as { resolutionNote: string | null }).resolutionNote =
      `Superseded by interpretation ${newInterpId}`;
  }
}

function getInterpretationNodeId(profile: EssenceProfile, id: string): string | null {
  for (const layer of LAYERS) {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    for (const [nodeId, interpretations] of Object.entries(layerData)) {
      if (interpretations.some(i => i.id === id)) return nodeId;
    }
  }
  return null;
}

function structuredReject(reason: string): PipelineResult {
  return {
    status: 'rejected',
    candidateInterpretation: {} as never,
    writePolicy: {} as never,
    reason,
  };
}
