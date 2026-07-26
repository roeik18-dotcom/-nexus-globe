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
import { ACCESS_POLICIES } from './access';
import type {
  EssenceProposalAPI,
  EssenceUserActionAPI,
  PendingEssenceProposal,
  ProposedUpdate,
  UserCorrection,
  EvidencePackage,
} from './api';
import type { PipelineResult } from './pipeline';
import type { EssenceRepository } from './repository';
import type { EssencePipeline, Clock, IdGenerator } from './pipeline-runner';
import { systemClock, defaultIdGenerator } from './pipeline-runner';
import type { UserAuthorizedActionContext } from './actor';
import { findInterpretation } from './interpretation-utils';

export { type Clock };

const LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

export class EssenceProposalService implements EssenceProposalAPI, EssenceUserActionAPI {
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
    // Access-control and conflict checks run inside the pipeline (after the observation
    // is persisted), because those rejections represent real signals worth recording.
    // Schema violations (unknown node, empty content) are not meaningful signals.
    if (!proposal.nodeId || !proposal.proposedContent?.trim()) {
      return structuredReject('Empty nodeId or proposedContent');
    }
    if (!getEssenceNode(proposal.nodeId)) {
      return structuredReject(`Unknown nodeId: ${proposal.nodeId}`);
    }

    // Persist the backing observation (two-tier: observation before interpretation).
    // Runs after schema pre-validation so garbage inputs never reach the store.
    const obs = buildProposalObservation(proposal, this.clock, this.idGen);
    await this.repo.appendObservation(profileId, obs);

    // Merge evidence IDs from the package (correction 10: wire EvidencePackage).
    const allEvidenceIds = [
      ...proposal.evidenceObservationIds,
      ...(evidence?.evidenceIds ?? []),
    ];

    const profile = await this.repo.getProfile(profileId);
    if (!profile) return structuredReject(`Profile not found: ${profileId}`);

    const output = this.runner.run({
      profileId,
      nodeId: proposal.nodeId,
      proposedContent: proposal.proposedContent,
      proposedBy: proposal.proposedBy,
      evidenceObservationIds: allEvidenceIds,
      rationale: proposal.rationale,
      currentProfile: profile,
    });

    // Persist conflict records when a proposal is blocked (correction 3).
    if (output.result.status === 'blocked_by_conflict') {
      const now = new Date(this.clock.now()).toISOString();
      for (const existingId of output.result.conflictIds) {
        const conflict: Conflict = {
          id: this.idGen.nextId('conflict'),
          interpretationIds: [existingId, null],
          type: 'unresolved_contradiction',
          detectedAt: now,
          resolvedAt: null,
          resolution: null,
          resolutionNote: null,
        };
        await this.repo.appendConflict(profileId, conflict);
      }
    }

    if (output.result.status === 'pending_user_confirmation') {
      const { confirmationToken, expiresAt } = output.result;
      const node = getEssenceNode(proposal.nodeId);
      const evidenceStatus = allEvidenceIds.length > 0 ? 'referenced' : 'unavailable';
      this.proposalRecords.set(confirmationToken, {
        proposalId: confirmationToken,
        profileId,
        nodeId: proposal.nodeId,
        layer: node!.layer,
        proposedContent: proposal.proposedContent,
        proposedBy: proposal.proposedBy,
        evidenceStatus,
        proposedAt: new Date(this.clock.now()).toISOString(),
        expiresAt,
        status: 'pending',
        conflictsWith: [],
        pipelineStages: output.stages,
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
      proposedBy: record.proposedBy,
      evidenceObservationIds: [],
      rationale: 'User confirmed proposal',
      authContext: context,
      currentProfile: profile,
    });

    if (output.result.status !== 'accepted') {
      throw new Error(`Pipeline did not accept the confirmed proposal: got ${output.result.status}`);
    }

    const interp = output.result.interpretation;
    await this.writeInterpretation(profile, interp);

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
      proposedBy: 'user',  // correction 1: not 'philos' — records the true actor
      evidenceObservationIds: [obs.id],
      rationale: correction.note ?? 'User correction',
      authContext: context,
      currentProfile: profile,
    });

    if (output.result.status === 'accepted') {
      if (correction.targetInterpretationId) {
        archiveInterpretation(profile, correction.targetInterpretationId, this.clock);
      }
      await this.writeInterpretation(profile, output.result.interpretation);
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
   * Agents see only their own proposals; Philos sees all.
   */
  async getPendingProposals(
    profileId: string,
    requestedBy: AgentName,
  ): Promise<PendingEssenceProposal[]> {
    const now = this.clock.now();
    const result: PendingEssenceProposal[] = [];
    for (const record of this.proposalRecords.values()) {
      if (record.profileId !== profileId || record.status !== 'pending') continue;
      if (new Date(record.expiresAt).getTime() < now) {
        record.status = 'expired';
        continue;
      }
      // Cross-agent isolation: agents see only their own proposals unless they're Philos.
      if (requestedBy !== 'philos' && record.proposedBy !== requestedBy) continue;
      result.push(record);
    }
    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async writeInterpretation(
    profile: EssenceProfile,
    interp: Interpretation,
  ): Promise<void> {
    const layerData = profile[interp.layer] as Record<string, Interpretation[]>;
    if (!layerData[interp.nodeId]) layerData[interp.nodeId] = [];
    layerData[interp.nodeId].push(interp);

    const now = new Date(this.clock.now()).toISOString();
    const entry: EssenceEvolutionEntry = {
      id: this.idGen.nextId('evo'),
      nodeId: interp.nodeId,
      previousInterpretationId: null,
      newInterpretationId: interp.id,
      triggeredBy: interp.provenance.source,
      agentName: interp.provenance.createdBy,
      timestamp: now,
      note: null,
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
