/**
 * projectToRealityGraph — pure projection from PUDM entity collections
 * to the typed Reality Graph.
 *
 * Invariants (enforced by construction, never by runtime checks):
 *   - No side effects. No writes. No hardcoded data.
 *   - All edges derived from data (embedded refs or relation files).
 *   - Handles all four relation types, including selected_for (0 records
 *     at Candidate stage; graph is ready when execution records arrive).
 *   - nodeById covers all nodes; O(1) lookup.
 */

import type { Mission } from "../lib/mission/schema";
import type { Gap } from "../lib/gap/schema";
import type { Value } from "../lib/value/schema";
import type { Capability } from "../lib/capability/schema";
import type { Provider } from "../lib/provider/schema";
import type { ValueCapabilityRelation } from "../lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "../lib/provider-capability-relation/schema";
import type {
  RealityGraph,
  RealityGraphNode,
  RealityGraphEdge,
} from "./realityGraph";

export function projectToRealityGraph(
  missions: Mission[],
  gaps: Gap[],
  values: Value[],
  capabilities: Capability[],
  providers: Provider[],
  vcRelations: ValueCapabilityRelation[],
  pcRelations: ProviderCapabilityRelation[],
): RealityGraph {
  // ── Nodes ──────────────────────────────────────────────────────────────────
  const nodes: RealityGraphNode[] = [
    ...missions.map(entity    => ({ type: "mission"    as const, entity })),
    ...gaps.map(entity        => ({ type: "gap"        as const, entity })),
    ...values.map(entity      => ({ type: "value"      as const, entity })),
    ...capabilities.map(entity => ({ type: "capability" as const, entity })),
    ...providers.map(entity   => ({ type: "provider"   as const, entity })),
  ];

  // ── Edges ──────────────────────────────────────────────────────────────────
  const edges: RealityGraphEdge[] = [];

  // Hop 1: Mission → Gap  (embedded GapRef[] inside each Mission)
  for (const mission of missions) {
    for (const ref of mission.gaps) {
      edges.push({ type: "mission_gap", missionId: mission.id, gapId: ref.gapId });
    }
  }

  // Hop 2: Gap → Value  (embedded ValueRef[] inside each Gap)
  for (const gap of gaps) {
    for (const ref of gap.requiredValues) {
      edges.push({ type: "gap_value", gapId: gap.id, valueId: ref.valueId });
    }
  }

  // Hop 3: Value → Capability  (standalone relation file)
  for (const relation of vcRelations) {
    edges.push({ type: "value_capability", relation });
  }

  // Hop 4: Capability → Provider  (standalone relation file)
  for (const relation of pcRelations) {
    edges.push({ type: "capability_provider", relation });
  }

  // ── nodeById  ──────────────────────────────────────────────────────────────
  const nodeById = new Map<string, RealityGraphNode>();
  for (const node of nodes) {
    nodeById.set(node.entity.id, node);
  }

  return { nodes, edges, nodeById };
}
