/**
 * Essence · Agent Access Policies v1
 *
 * Defines what each agent can read from and propose to Essence.
 * Apex is the Control Layer — not an agent — and does not appear here.
 * No agent reads raw observations. No agent writes directly to Canonical Essence.
 */

import type { EssenceLayer } from './ontology';
import type { SensitivityLevel, TemporalKind } from './schema';
import type { RetrievalMode } from './schema';

// ── Agent Names ────────────────────────────────────────────────────────────────

/**
 * The agents that may query Essence.
 * Apex is not listed — it is a control structure, not an agent.
 */
export type AgentName =
  | 'merlin'   // Execution: tasks, code, decisions, momentum
  | 'morgana'  // Creative: music production, aesthetic work
  | 'philos'   // Reasoning: analysis, models, orientation
  | 'nexus';   // Coordination: routing, node mapping, ecosystem navigation

// ── Access Policy ──────────────────────────────────────────────────────────────

export interface AgentAccessPolicy {
  agent: AgentName;
  description: string;

  /** Ontology layers this agent may read from. */
  readableLayers: EssenceLayer[];

  /**
   * Specific ontology node IDs this agent may read (when narrower than the full layer).
   * Empty = all nodes in readable layers are accessible.
   */
  readableNodeIds: string[];

  /** Whether this agent may propose updates (all agents may; none write directly). */
  canProposeUpdates: boolean;

  /**
   * Ontology layers this agent may propose updates to.
   * Agents can propose only within their domain of competence.
   */
  writableLayers: EssenceLayer[];

  /** Highest sensitivity level this agent may read without explicit user request. */
  maxSensitivity: SensitivityLevel;

  /** Which temporal kinds this agent may read. */
  readableTemporalKinds: TemporalKind[];

  /** Default retrieval mode when this agent requests a summary. */
  defaultRetrievalMode: RetrievalMode;

  /**
   * Whether this agent may read conflict details.
   * Only Philos gets conflict visibility; others see counts only.
   */
  canReadConflicts: boolean;

  /**
   * Whether this agent may trigger archival of an interpretation.
   * Only Philos and user corrections may archive.
   */
  canArchive: boolean;
}

// ── Policy Registry ────────────────────────────────────────────────────────────

export const ACCESS_POLICIES: Record<AgentName, AgentAccessPolicy> = {

  merlin: {
    agent: 'merlin',
    description: 'Execution agent. Reads enough to act effectively; does not analyze the whole person.',
    readableLayers: ['core', 'expression', 'identity'],
    readableNodeIds: [
      // Core: enough to respect non-negotiables
      'Values', 'Needs', 'IntrinsicConstraints',
      // Expression: enough to match communication and working style
      'Principles', 'Communication', 'Style', 'Preferences',
      // Identity: enough to know roles and context
      'Roles', 'ProfessionalIdentity',
    ],
    canProposeUpdates: true,
    writableLayers: ['expression'],
    maxSensitivity: 'personal',
    readableTemporalKinds: ['trait', 'state', 'phase'],
    defaultRetrievalMode: 'task_relevant',
    canReadConflicts: false,
    canArchive: false,
  },

  morgana: {
    agent: 'morgana',
    description: 'Creative agent. Deep access to Expression; minimal exposure to core architecture.',
    readableLayers: ['expression', 'aspirations'],
    readableNodeIds: [
      // Expression: full access for creative work
      'Aesthetics', 'CreativeDNA', 'Principles', 'Style', 'Preferences',
      // Aspirations: to align creative work with direction
      'Aspirations_Becoming', 'Aspirations_Contribution',
      // Core: only creative-adjacent values
      'Values',
    ],
    canProposeUpdates: true,
    writableLayers: ['expression'],
    maxSensitivity: 'personal',
    readableTemporalKinds: ['trait', 'state', 'phase'],
    defaultRetrievalMode: 'creative',
    canReadConflicts: false,
    canArchive: false,
  },

  philos: {
    agent: 'philos',
    description: 'Reasoning agent. Full read access for analysis; proposes only — never invents traits.',
    readableLayers: ['core', 'aspirations', 'expression', 'identity'],
    readableNodeIds: [], // all nodes in all layers
    canProposeUpdates: true,
    writableLayers: ['core', 'aspirations', 'expression', 'identity'],
    maxSensitivity: 'private',
    readableTemporalKinds: ['trait', 'state', 'phase', 'history'],
    defaultRetrievalMode: 'deep',
    canReadConflicts: true,
    canArchive: true,
  },

  nexus: {
    agent: 'nexus',
    description: 'Coordination agent. Routes using stable identity traits; does not invent or store user data.',
    readableLayers: ['core', 'identity'],
    readableNodeIds: [
      // Core: values for alignment checks
      'Values', 'Motivations',
      // Identity: full — routing depends on knowing who the user is publicly
      'Roles', 'PublicPersona', 'ProfessionalIdentity', 'PersonalIdentity',
    ],
    canProposeUpdates: false, // Nexus routes; it does not model the person
    writableLayers: [],
    maxSensitivity: 'personal',
    readableTemporalKinds: ['trait'],
    defaultRetrievalMode: 'compact',
    canReadConflicts: false,
    canArchive: false,
  },

};

// ── Enforcement Helpers ────────────────────────────────────────────────────────

/** Returns true if the agent is allowed to read the given node and sensitivity. */
export function canAgentReadNode(
  agentName: AgentName,
  nodeId: string,
  layer: EssenceLayer,
  sensitivity: SensitivityLevel,
): boolean {
  const policy = ACCESS_POLICIES[agentName];

  if (!policy.readableLayers.includes(layer)) return false;

  if (policy.readableNodeIds.length > 0 && !policy.readableNodeIds.includes(nodeId)) {
    return false;
  }

  const sensitivityOrder: SensitivityLevel[] = ['public', 'personal', 'private', 'highly_sensitive'];
  const maxIdx = sensitivityOrder.indexOf(policy.maxSensitivity);
  const nodeIdx = sensitivityOrder.indexOf(sensitivity);
  return nodeIdx <= maxIdx;
}

/** Returns true if the agent is allowed to propose an update to the given layer. */
export function canAgentPropose(agentName: AgentName, layer: EssenceLayer): boolean {
  const policy = ACCESS_POLICIES[agentName];
  return policy.canProposeUpdates && policy.writableLayers.includes(layer);
}

/** Returns true if the agent is allowed to read state of a given temporal kind. */
export function canAgentReadTemporalKind(
  agentName: AgentName,
  temporalKind: TemporalKind,
): boolean {
  return ACCESS_POLICIES[agentName].readableTemporalKinds.includes(temporalKind);
}
