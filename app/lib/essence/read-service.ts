/**
 * Essence · Read Service
 *
 * Implements all read operations for the Essence API.
 * Receives EssenceReadRepository — never the writable variant.
 */

import type { EssenceLayer } from './ontology';
import type { AgentName } from './access';
import { canAgentReadNode, canAgentReadTemporalKind, ACCESS_POLICIES } from './access';
import type {
  EssenceContextView,
  EssenceLayerView,
  EssenceSummary,
  PendingEssenceProposal,
} from './api';
import type {
  ConflictType,
  EssenceProfile,
  EssenceStateItem,
  Interpretation,
  RetrievalMode,
  StateTemporalScope,
} from './schema';
import type { EssenceReadRepository } from './repository';

const LAYERS: EssenceLayer[] = ['core', 'aspirations', 'expression', 'identity'];

export class EssenceReadService {
  constructor(private readonly repo: EssenceReadRepository) {}

  async getEssenceSummary(
    profileId: string,
    mode: RetrievalMode,
    requestedBy: AgentName,
    context?: EssenceContextView,
  ): Promise<EssenceSummary> {
    const profile = await this.requireProfile(profileId);
    const policy = ACCESS_POLICIES[requestedBy];
    const nodes: EssenceSummary['nodes'] = {};

    for (const layer of LAYERS) {
      if (!policy.readableLayers.includes(layer)) continue;
      const layerData = profile[layer] as Record<string, Interpretation[]>;
      for (const [nodeId, interpretations] of Object.entries(layerData)) {
        const active = interpretations.filter(i => !i.archivedAt);
        if (active.length === 0) continue;
        const best = selectBest(active);
        if (!canAgentReadNode(requestedBy, nodeId, layer, best.sensitivity)) continue;
        nodes[nodeId] = {
          nodeId,
          layer,
          content: best.content,
          confidence: best.confidence,
          sensitivity: best.sensitivity,
          temporalKind: best.temporalKind,
          evidenceStatus: best.evidenceStatus,
        };
      }
    }

    const activeState = canAgentReadTemporalKind(requestedBy, 'state')
      ? allStateItems(profile).filter(i => i.isActive)
      : [];

    return {
      profileId,
      retrievedAt: new Date().toISOString(),
      retrievalMode: mode,
      nodes,
      activeState,
      unresolvedConflictCount: profile.conflicts.filter(c => !c.resolvedAt).length,
    };
  }

  async getLayerView(
    profileId: string,
    layer: EssenceLayer,
    requestedBy: AgentName,
  ): Promise<EssenceLayerView> {
    const profile = await this.requireProfile(profileId);
    const policy = ACCESS_POLICIES[requestedBy];

    if (!policy.readableLayers.includes(layer)) {
      return { layer, nodes: {}, retrievedAt: new Date().toISOString() };
    }

    const layerData = profile[layer] as Record<string, Interpretation[]>;
    const nodes: Record<string, Interpretation[]> = {};
    for (const [nodeId, interpretations] of Object.entries(layerData)) {
      const readable = interpretations.filter(i =>
        canAgentReadNode(requestedBy, nodeId, layer, i.sensitivity)
      );
      if (readable.length > 0) nodes[nodeId] = readable;
    }

    return { layer, nodes, retrievedAt: new Date().toISOString() };
  }

  async getCurrentState(
    profileId: string,
    requestedBy: AgentName,
    scope?: StateTemporalScope,
  ): Promise<EssenceStateItem[]> {
    const profile = await this.requireProfile(profileId);
    if (!canAgentReadTemporalKind(requestedBy, 'state')) return [];

    const items: EssenceStateItem[] = scope
      ? profile.state[scope]
      : allStateItems(profile);

    return items.filter(i => i.isActive);
  }

  async getEvidence(
    profileId: string,
    interpretationId: string,
    requestedBy: AgentName,
  ): Promise<{ observationIds: string[]; evidenceIds: string[] }> {
    const profile = await this.requireProfile(profileId);
    const interp = findInterpretation(profile, interpretationId);
    if (!interp) return { observationIds: [], evidenceIds: [] };
    return {
      observationIds: [...interp.observationIds],
      evidenceIds: [...interp.provenance.evidenceIds],
    };
  }

  async getConflicts(
    profileId: string,
    requestedBy: AgentName,
  ): Promise<{ count: number; types: ConflictType[] }> {
    const profile = await this.requireProfile(profileId);
    const unresolved = profile.conflicts.filter(c => !c.resolvedAt);
    const types = [...new Set(unresolved.map(c => c.type))] as ConflictType[];
    return { count: unresolved.length, types };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async requireProfile(profileId: string): Promise<EssenceProfile> {
    const profile = await this.repo.getProfile(profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    return profile;
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

function selectBest(interpretations: Interpretation[]): Interpretation {
  const order: string[] = ['verified', 'high', 'medium', 'low', 'speculative'];
  return [...interpretations].sort(
    (a, b) => order.indexOf(a.confidence) - order.indexOf(b.confidence)
  )[0];
}

function allStateItems(profile: EssenceProfile): EssenceStateItem[] {
  return [
    ...profile.state.momentary,
    ...profile.state.session,
    ...profile.state.daily,
    ...profile.state.short_term,
    ...profile.state.open_ended,
  ];
}

export function findInterpretation(profile: EssenceProfile, id: string): Interpretation | null {
  for (const layer of LAYERS) {
    const layerData = profile[layer] as Record<string, Interpretation[]>;
    for (const interpretations of Object.values(layerData)) {
      const found = interpretations.find(i => i.id === id);
      if (found) return found;
    }
  }
  return null;
}
