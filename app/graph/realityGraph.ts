/**
 * Reality Graph — canonical typed graph derived from the PUDM chain.
 *
 * The Reality Graph is the single projection surface for all screens.
 * All nodes and edges are derived entirely from repository data — never
 * hardcoded, never screen-specific.
 *
 * Screens that need visual overlays (orbital angles, industry sectors,
 * illustrative archetypes) must declare those as explicit visualization
 * constants with a non-claim marker — they are not part of this graph.
 *
 * Chain: Mission → Gap → Value → Capability → Provider
 * Edges: MissionGap (embedded) | GapValue (embedded) |
 *        ValueCapability (relation file) | CapabilityProvider (relation file)
 */

import type { Mission } from "../lib/mission/schema";
import type { Gap } from "../lib/gap/schema";
import type { Value } from "../lib/value/schema";
import type { Capability } from "../lib/capability/schema";
import type { Provider } from "../lib/provider/schema";
import type { ValueCapabilityRelation } from "../lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "../lib/provider-capability-relation/schema";

// ─── Nodes ────────────────────────────────────────────────────────────────────

export interface MissionNode     { type: "mission";    entity: Mission; }
export interface GapNode         { type: "gap";        entity: Gap; }
export interface ValueNode       { type: "value";      entity: Value; }
export interface CapabilityNode  { type: "capability"; entity: Capability; }
export interface ProviderNode    { type: "provider";   entity: Provider; }

export type RealityGraphNode =
  | MissionNode
  | GapNode
  | ValueNode
  | CapabilityNode
  | ProviderNode;

// ─── Edges ────────────────────────────────────────────────────────────────────

/** Mission → Gap: derived from Mission.gaps[] embedded refs. */
export interface MissionGapEdge {
  type: "mission_gap";
  missionId: string;
  gapId: string;
}

/** Gap → Value: derived from Gap.requiredValues[] embedded refs. */
export interface GapValueEdge {
  type: "gap_value";
  gapId: string;
  valueId: string;
}

/** Value → Capability: derived from value-capability-relations.json. */
export interface ValueCapabilityEdge {
  type: "value_capability";
  relation: ValueCapabilityRelation;
}

/** Capability → Provider: derived from provider-capability-relations.json. */
export interface CapabilityProviderEdge {
  type: "capability_provider";
  relation: ProviderCapabilityRelation;
}

export type RealityGraphEdge =
  | MissionGapEdge
  | GapValueEdge
  | ValueCapabilityEdge
  | CapabilityProviderEdge;

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface RealityGraph {
  /** All PUDM entity nodes — one entry per entity record. */
  nodes: RealityGraphNode[];
  /** All typed edges in canonical PUDM order. */
  edges: RealityGraphEdge[];
  /** O(1) node lookup by entity id. */
  nodeById: Map<string, RealityGraphNode>;
}
