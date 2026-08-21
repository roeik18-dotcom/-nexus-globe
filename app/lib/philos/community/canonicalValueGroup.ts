/**
 * CANONICAL VALUE GROUP — the model PHILOS uses to represent a value group,
 * replacing the product-wide assumption that there is exactly one.
 *
 * Until this module existed, "which group" had a compile-time answer:
 * `valueGroupLog.ts` exported `GROUP_ID = "vg_ahrayut_kehilatit"` and twelve
 * non-test modules across all seven terminals imported it. That is not a UI
 * choice that a redesign could fix — the product was COMPILED around one
 * group, so no dataset of groups could enter it without a rewrite. This model
 * is the shape that makes `0..N` representable.
 *
 * MISSING STAYS MISSING. Every optional field below is optional because the
 * data this codebase actually holds does not fill it — 9 of the 18 fields the
 * ruling names are empty for all three groups that exist today (no roles, no
 * needs, no offers, no actions, no description, no relations, no value family,
 * no sub-values, no provenance on the projection). Representing them as
 * `undefined` is the honest encoding; filling them would be fabrication.
 *
 * VALUE MAPPING IS NOT STRING EQUALITY. A group's own `central_value` is free
 * text written into a `group.opened` payload by whoever opened it. The
 * canonical taxonomy is the 28 families / 223 sub-values of
 * `valueUniverse328.ts`. "אחריות" matches NONE of the 223 exactly and four of
 * them partially — that is a REVIEW, not a match, and `valueMapping.ts` keeps
 * it unresolved rather than choosing. See that module for the rule.
 */
import type { ValueGroupView } from "../projectValueGroup";
import type { PhilosEvent } from "../events";

/** How this group entered the registry. Never a quality judgement — a source. */
export type GroupProvenanceTag = "REAL" | "DEMO";

export type GroupLifecycleStatus = "active" | "forming" | "archived" | "unknown";

/** A member and the role the LOG records for them. `role: undefined` is the
 *  real state of all 23 members across all three current groups — no
 *  `role.assigned` event has ever been written. Not defaulted to "member". */
export interface GroupMemberRef {
  person_id: string;
  display_name?: string;
  /** Only from `leader.appointed` / an explicit role event. Never inferred. */
  role?: string;
  joined_at?: string;
}

export interface GroupBudgetRef {
  received: number;
  spent: number;
  committed: number;
  available: number;
  currency: string;
}

/**
 * The canonical record. Fields the ruling names, in its order, each carrying
 * `undefined` when this codebase has no record for it.
 */
export interface CanonicalValueGroup {
  group_id: string;
  name: string;
  description?: string;
  status: GroupLifecycleStatus;
  geography?: string;

  /** Free-text label from `group.opened`. NOT a taxonomy id. Kept because it
   *  is what the group itself declared, and it is the mapping's input. */
  central_value_label?: string;
  /** Canonical `SV###`. Present only where a mapping is RESOLVED by evidence. */
  primary_subvalue_id?: string;
  secondary_subvalue_ids?: readonly string[];
  /** `F01..F28`. Derived from the primary sub-value, or stated explicitly. */
  value_family_id?: string;
  /** Why the three fields above are (or are not) filled. Always present. */
  value_mapping_status: ValueMappingStatus;

  members: readonly GroupMemberRef[];
  budget?: GroupBudgetRef;
  money_flow_count?: number;
  needs?: readonly string[];
  offers?: readonly string[];
  actions?: readonly string[];
  effect_count?: number;
  evidence_count?: number;
  /** Events the projection consumed — the trend/history depth anchor. */
  event_count?: number;

  provenance: GroupProvenanceTag;
  /** Where the record came from, in words, for the screen to be able to say it. */
  source: string;
}

/** The mapping outcome. `UNRESOLVED_REVIEW_REQUIRED` is a real, final answer
 *  for now — not a placeholder to be quietly upgraded by a fuzzy match. */
export type ValueMappingStatus =
  | "RESOLVED"
  | "UNRESOLVED_REVIEW_REQUIRED"
  | "NO_CANDIDATE"
  | "NO_VALUE_DECLARED";

/** Group ids the log actually contains, from `group.opened` events only.
 *  Existence is an event, never a constant and never a UI selection. */
export function discoverGroupIds(events: readonly PhilosEvent[]): string[] {
  const ids: string[] = [];
  for (const e of events) {
    if (e.event_type !== "group.opened") continue;
    const gid = (e as { entity_id?: string }).entity_id;
    if (gid && !ids.includes(gid)) ids.push(gid);
  }
  return ids;
}

/** Fold a projection into the canonical record. Everything the projection does
 *  not carry stays `undefined` — this function invents nothing. */
export function fromProjection(
  view: ValueGroupView,
  provenance: GroupProvenanceTag,
  source: string,
  mapping: { status: ValueMappingStatus; primary?: string; secondary?: readonly string[]; family?: string },
): CanonicalValueGroup {
  const roles = new Map<string, string>();
  for (const l of view.leaders) roles.set(l.person_id, l.role ?? "leader");
  return {
    group_id: view.group_id,
    name: view.name,
    // `goal` is the group's own stated purpose; empty string is not a purpose.
    description: view.goal || undefined,
    status:
      view.status === "active" || view.status === "forming" || view.status === "archived"
        ? view.status
        : "unknown",
    geography: view.region || undefined,
    central_value_label: view.central_value || undefined,
    primary_subvalue_id: mapping.primary,
    secondary_subvalue_ids: mapping.secondary,
    value_family_id: mapping.family,
    value_mapping_status: mapping.status,
    members: view.members.map((m) => ({
      person_id: m.person_id,
      display_name: m.display_name,
      role: roles.get(m.person_id),
      joined_at: (m as { joined_at?: string }).joined_at,
    })),
    budget: view.budget,
    money_flow_count: view.allocations.length + view.transfers.length || undefined,
    // No `need.declared` / `offer.declared` event type reaches this projection
    // today. Left undefined rather than reported as zero — UNKNOWN ≠ 0.
    needs: undefined,
    offers: undefined,
    actions: undefined,
    effect_count: view.impact.length || undefined,
    evidence_count: view.impact.filter((i) => i.verified).length || undefined,
    event_count: view.event_count,
    provenance,
    source,
  };
}
