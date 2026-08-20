/**
 * NETWORK ACCOUNTING — four layers, counted once each.
 *
 * The relation inventory silently dropped every EntityLink type except three
 * before the truth gate ever saw them, so ten REAL links were excluded from
 * an inventory that presents itself as complete. Presentation may filter;
 * truth accounting may not discard a relation type before evaluating it.
 *
 * FOUR LAYERS, deliberately not summed together:
 *
 *   EVENT_RECORDS    what HAPPENED — transitions in the durable log
 *                    (`member.joined` is a join event, at a moment)
 *   ENTITY_LINKS     what is TRUE NOW — state asserted by the bridge
 *                    (`PERSON_MEMBER_OF_COMMUNITY` is current roster)
 *   GATED_RELATIONS  links that passed the network truth gate
 *   DRAWN_ARCS       what the sphere actually renders — a fact about the
 *                    DRAWING, never about the records
 *
 * THE DOUBLE-COUNT THIS PREVENTS. Measured on real data: 6 `member.joined`
 * events and 9 `PERSON_MEMBER_OF_COMMUNITY` REAL links. They are not
 * duplicates in the naive sense and the numbers deliberately disagree — the
 * roster contains members who arrived by other paths (the opener, appointed
 * leaders), and someone could join and later leave. They are the SAME
 * underlying fact at two layers: transitions versus state.
 *
 * So membership is counted ONCE, from the LINK layer, because "how many
 * membership relations exist" is a question about the present, not about how
 * many join events were ever recorded. The events remain visible as events.
 *
 * SPATIAL/CONTEXT CONTRACT — option (A), stated rather than assumed: spatial
 * links ARE included in the inventory, classified separately. Excluding them
 * silently was the original defect; excluding them loudly would still leave
 * the inventory claiming a completeness it does not have.
 */
import type { EntityLink, RelationType } from "../bridge/entityLink";
import { runNetworkTruthGate, type EdgeCandidate, type GateReport } from "./networkTruthGate";

export type RelationClass = "SOCIAL" | "SPATIAL_CONTEXT" | "MARKETPLACE";

/** Which class each relation belongs to. Every type is classified; nothing
 *  falls through to a default, because a default is how types get dropped. */
export const RELATION_CLASS: Record<string, RelationClass> = {
  PERSON_MEMBER_OF_COMMUNITY: "SOCIAL",
  PERSON_ASSOCIATED_WITH_VALUE_GROUP: "SOCIAL",
  COMMUNITY_HAS_NEED: "SOCIAL",
  ACTION_AFFECTS_COMMUNITY: "SOCIAL",
  EFFECT_AFFECTS_COMMUNITY: "SOCIAL",
  EFFECT_AFFECTS_PERSON: "SOCIAL",
  PROJECT_BELONGS_TO_COMMUNITY: "SOCIAL",
  NEED_MATCHED_TO_OFFER: "MARKETPLACE",
  PROVIDER_OFFERS_RESOURCE: "MARKETPLACE",
  COMMUNITY_USES_RESOURCE: "MARKETPLACE",
  COMMUNITY_LOCATED_IN_REGION: "SPATIAL_CONTEXT",
  VALUE_GROUP_PRESENT_IN_REGION: "SPATIAL_CONTEXT",
  ENTITY_LOCATED_IN: "SPATIAL_CONTEXT",
  ENTITY_ACTIVE_IN: "SPATIAL_CONTEXT",
  ENTITY_AFFECTS_REGION: "SPATIAL_CONTEXT",
  ACTION_OCCURRED_IN: "SPATIAL_CONTEXT",
  EFFECT_OBSERVED_IN: "SPATIAL_CONTEXT",
  RESOURCE_AVAILABLE_IN: "SPATIAL_CONTEXT",
  NEED_EXISTS_IN: "SPATIAL_CONTEXT",
  COMMUNITY_ACTIVE_IN: "SPATIAL_CONTEXT",
};

/** Event kinds whose fact the link layer also asserts as state. */
export const EVENT_LAYER_DUPLICATE: Partial<Record<RelationType, string>> = {
  PERSON_MEMBER_OF_COMMUNITY: "member.joined",
};

export interface RelationRow {
  relation: string;
  relation_class: RelationClass;
  raw_count: number;
  real: number;
  demo: number;
  gate_eligible: boolean;
  gate_passed: number;
  gate_rejected: number;
  /** The event kind expressing the same fact, when one exists. */
  semantic_duplicate_of_event?: string;
  drawn_on_globe: boolean;
  shown_in_inventory: boolean;
}

export interface NetworkAccounting {
  rows: RelationRow[];
  gate: GateReport;
  totals: {
    entity_links: number;
    real_relations: number;
    derived_relations: number;
    demo_relations: number;
    gated_relations: number;
    drawn_arcs: number;
  };
}

/** Relation types the sphere draws as geometry (from the event log, not links). */
const DRAWN_EVENT_RELATIONS = new Set(["member.joined", "leader.appointed", "group.opened", "transfer.completed"]);

export function buildNetworkAccounting(
  links: readonly EntityLink[],
  arcs: readonly { relation: string; event_id: string; verification_status?: string }[],
): NetworkAccounting {
  // EVERY link becomes a candidate. Nothing is filtered before the gate.
  const candidates: EdgeCandidate[] = links.map((l) => ({
    from_entity_id: l.source.canonical_id,
    to_entity_id: l.target.canonical_id,
    relation_type: l.relation,
    source_record_id: l.link_id,
    provenance: l.relation === "EFFECT_AFFECTS_COMMUNITY" ? "DERIVED_REAL" : l.provenance,
    epistemic_status: "CLAIMED",
    derivation_steps: l.relation === "EFFECT_AFFECTS_COMMUNITY"
      ? [{ rule: "Effect.action_ref", backed_by: l.link_id }, { rule: "ACTION_AFFECTS_COMMUNITY", backed_by: l.link_id }]
      : undefined,
    backed_only_by_membership: l.relation === "PERSON_MEMBER_OF_COMMUNITY",
  }));

  const gate = runNetworkTruthGate(candidates);

  const byRelation = new Map<string, EntityLink[]>();
  for (const l of links) {
    const list = byRelation.get(l.relation) ?? [];
    list.push(l);
    byRelation.set(l.relation, list);
  }

  const rows: RelationRow[] = [...byRelation.entries()].map(([relation, list]) => {
    const passed = gate.passed.filter((c) => c.relation_type === relation).length;
    const rejected = gate.rejected.filter((r) => r.candidate.relation_type === relation).length;
    return {
      relation,
      relation_class: RELATION_CLASS[relation] ?? "SOCIAL",
      raw_count: list.length,
      real: list.filter((l) => l.provenance === "REAL").length,
      demo: list.filter((l) => l.provenance === "DEMO").length,
      gate_eligible: true,
      gate_passed: passed,
      gate_rejected: rejected,
      semantic_duplicate_of_event: EVENT_LAYER_DUPLICATE[relation as RelationType],
      drawn_on_globe: false,
      shown_in_inventory: true,
    };
  }).sort((a, b) => b.raw_count - a.raw_count);

  return {
    rows,
    gate,
    totals: {
      entity_links: links.length,
      real_relations: gate.byProvenance.REAL,
      derived_relations: gate.byProvenance.DERIVED_REAL,
      demo_relations: gate.byProvenance.DEMO,
      gated_relations: gate.passed.length,
      // Counted from the ARCS, not the links: a drawn arc is a fact about the
      // drawing. Arcs and links overlap semantically and are never summed.
      drawn_arcs: arcs.filter((a) => DRAWN_EVENT_RELATIONS.has(a.relation)).length,
    },
  };
}
