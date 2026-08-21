/**
 * GROUP RELATIONS — edges between value groups, materialised only from evidence.
 *
 * Built now so the future dataset needs no further architectural change, and
 * deliberately returning `0` today, which is the correct answer: with three
 * groups that share no member, no sub-value, no need and no resource, there is
 * no edge to draw. A relation model that produced edges anyway — "both are
 * communities", "both are in Israel" — would be similarity dressed as relation,
 * and SIMILARITY ≠ RELATION.
 *
 * This is also the model Network/Globe should eventually consume: Community is
 * the semantic/value view of these same edges, Network the spatial one. Same
 * edges, two projections — never two independently-derived edge sets.
 */
import type { PhilosEvent } from "../events";
import type { ValueGroupRegistry } from "./valueGroupRegistry";

export type GroupRelationType =
  | "OVERLAPPING_MEMBERS"
  | "SHARED_SUBVALUE"
  | "SHARED_VALUE_FAMILY"
  | "SHARED_NEED"
  | "SHARED_RESOURCE"
  | "COOPERATION"
  | "CONFLICT"
  | "RESOURCE_FLOW"
  | "ACTION_DEPENDENCY"
  | "GEOGRAPHIC_OVERLAP";

export interface GroupRelation {
  from_group_id: string;
  to_group_id: string;
  type: GroupRelationType;
  /** What makes this an edge, concretely. Never a category statement. */
  evidence: string;
  /** Shared entities that produced it, when the type has them. */
  shared?: readonly string[];
  strength: number;
}

/**
 * Derive every relation the current data actually supports.
 *
 * Each block below is gated on a concrete shared entity. GEOGRAPHIC_OVERLAP is
 * intentionally NOT derived from two groups naming the same region string: a
 * region label is a similarity, and it would manufacture edges among all three
 * current groups. It stays a supported TYPE with no producer until the dataset
 * carries real geography rather than a free-text city.
 */
export function buildGroupRelations(
  registry: ValueGroupRegistry,
  events: readonly PhilosEvent[] = [],
): GroupRelation[] {
  const out: GroupRelation[] = [];
  const es = registry.entries;

  // Members per group, from recorded rosters.
  const membersOf = new Map<string, Set<string>>();
  for (const e of es) membersOf.set(e.group.group_id, new Set(e.group.members.map((m) => m.person_id)));

  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i].group, b = es[j].group;

      const ma = membersOf.get(a.group_id)!, mb = membersOf.get(b.group_id)!;
      const shared = [...ma].filter((p) => mb.has(p));
      if (shared.length > 0) {
        out.push({
          from_group_id: a.group_id, to_group_id: b.group_id, type: "OVERLAPPING_MEMBERS",
          evidence: `${shared.length} אנשים רשומים בשתי הקבוצות`, shared, strength: shared.length,
        });
      }

      // Sub-value edges require RESOLVED mappings on both sides. Two groups
      // that are both unresolved are not thereby related.
      const sa = [a.primary_subvalue_id, ...(a.secondary_subvalue_ids ?? [])].filter(Boolean) as string[];
      const sb = [b.primary_subvalue_id, ...(b.secondary_subvalue_ids ?? [])].filter(Boolean) as string[];
      const sv = sa.filter((x) => sb.includes(x));
      if (sv.length > 0) {
        out.push({
          from_group_id: a.group_id, to_group_id: b.group_id, type: "SHARED_SUBVALUE",
          evidence: `שתי הקבוצות ממופות לתת-הערך ${sv.join(", ")}`, shared: sv, strength: sv.length,
        });
      } else if (a.value_family_id && b.value_family_id && a.value_family_id === b.value_family_id) {
        out.push({
          from_group_id: a.group_id, to_group_id: b.group_id, type: "SHARED_VALUE_FAMILY",
          evidence: `שתי הקבוצות ממופות למשפחת הערך ${a.value_family_id}`, shared: [a.value_family_id], strength: 1,
        });
      }

      const needs = (a.needs ?? []).filter((n) => (b.needs ?? []).includes(n));
      if (needs.length > 0) {
        out.push({ from_group_id: a.group_id, to_group_id: b.group_id, type: "SHARED_NEED", evidence: `צורך משותף מתועד`, shared: needs, strength: needs.length });
      }
      const offers = (a.offers ?? []).filter((n) => (b.offers ?? []).includes(n));
      if (offers.length > 0) {
        out.push({ from_group_id: a.group_id, to_group_id: b.group_id, type: "SHARED_RESOURCE", evidence: `משאב משותף מתועד`, shared: offers, strength: offers.length });
      }
    }
  }

  // RESOURCE_FLOW: a transfer whose recorded counterparty is another registry
  // group. No such event exists today; the producer is here for when it does.
  for (const ev of events) {
    if (ev.event_type !== "transfer.completed") continue;
    const from = (ev as { entity_id?: string }).entity_id;
    const to = (ev as { payload?: { to_group_id?: string } }).payload?.to_group_id;
    if (from && to && registry.byId(from) && registry.byId(to)) {
      out.push({ from_group_id: from, to_group_id: to, type: "RESOURCE_FLOW", evidence: "אירוע transfer.completed בין שתי קבוצות רשומות", strength: 1 });
    }
  }

  return out;
}
