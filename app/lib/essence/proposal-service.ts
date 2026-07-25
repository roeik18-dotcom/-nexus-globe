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
  EssenceEvolutionEntry,
  EssenceProfile,
  Interpretation,
} from './schema';
import type { AgentName } from './access';
import { ACCESS_POLICIES } from './access';
import type {
  PendingEssenceProposal,
  ProposedUpdate,
  UserCorrection,
  UserAuthorizedActionContext,
  EvidencePackage,
} from './api';
import type { PipelineResult } from './pipeline';
import type { EssenceRepository } from './repository';
import { PipelineRunner } from './pipeline-runner';
import type { Clock } from './pipeline-runner';
import { findInterpretation } from './read-service';

export { type Clock };

const LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

export class EssenceProposalService {
  private readonly proposalRecords = new Map<string, PendingEssenceProposal>();

  constructor(
    private readonly repo: EssenceRepository,
    private readonly runner: PipelineRunner,
    private readonly clock: Clock = { now: () => Date.now() },
  ) {}

  async proposeUpdate(
    profileId: string,
    proposal: ProposedUpdate,
    _evidence: EvidencePackage | null,
  ): Promise<PipelineResult> {
    const profile = await this.repo.getProfile(profileId);
    if (!profile) {
      return structuredReject(`Profile not found: ${profileId}`);
    }

    const output = this.runner.run({
      profileId,
      nodeId: proposal.nodeId,
      proposedContent: proposal.proposedContent,
      proposedBy: proposal.proposedBy,
      evidenceObservationIds: proposal.evidenceObservationIds,
      rationale: proposal.rationale,
      currentProfile: profile,
    });

    if (output.result.status === 'pending_user_confirmation') {
      const { confirmationToken, expiresAt } = output.result;
      const node = getEssenceNode(proposal.nodeId);
      const evidenceStatus = proposal.evidenceObservationIds.length > 0 ? 'referenced' : 'unavailable';
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
    const profile = await this.repo.getProfile(profileId);
    if (!profile) {
      return structuredReject(`Profile not found: ${profileId}`);
    }

    const output = this.runner.run({
      profileId,
      nodeId: correction.nodeId,
      proposedContent: correction.correctedContent,
      proposedBy: 'philos',
      evidenceObservationIds: [],
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
    const entryId = `evo_${this.clock.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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

  getPendingProposals(profileId: string): PendingEssenceProposal[] {
    const now = this.clock.now();
    const result: PendingEssenceProposal[] = [];
    for (const record of this.proposalRecords.values()) {
      if (record.profileId !== profileId || record.status !== 'pending') continue;
      if (new Date(record.expiresAt).getTime() < now) {
        record.status = 'expired';
        continue;
      }
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
      id: `evo_${this.clock.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
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
