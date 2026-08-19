/**
 * Canonical Value Registry (ledger §40 — Community / Value Universe pass).
 *
 * "Do not reduce the system to 'אחריות'" — checked directly: three real
 * sources already carry value/value-like concepts in this codebase, never
 * unified before now:
 *   1. The REAL Value Group's own `central_value` ("אחריות") —
 *      `valueGroupLog.ts`, `group.opened` payload.
 *   2. The 2 DEMO Value Groups' `central_value` ("קיימות" / "שכנות
 *      טובה") — `demoCommunities.ts`, clearly DEMO.
 *   3. The 12 PUDM "Candidate" values (Capital, Trust, Knowledge, ...) —
 *      `data/values.json`, real records, §39's own audit classified this
 *      file MIGRATABLE (real concept, not yet linked to any real
 *      Person/Need/Group).
 *
 * This module is a pure fold over already-projected data — no new I/O,
 * no new store, no invented value. `buildValueRegistry` takes real
 * `ValueGroupView`s (real + demo, already tagged) and the real PUDM
 * `Value[]` array; nothing here mints a value that isn't already a real
 * record somewhere in the codebase.
 *
 * Value relations: types are supported (see `ValueRelationType`) but
 * `buildValueRelations` returns an EMPTY array today — checked directly,
 * no real source anywhere ties any two of these 15 values together (PUDM
 * defines Value→Capability/Provider relations, never Value→Value; the
 * Value-Group log has no cross-group value-comparison event type). "Every
 * populated relation requires source/evidence" (this pass's own rule) —
 * 0 evidence exists, so 0 relations are populated. Not a bug.
 */
import type { ValueGroupView } from "./../projectValueGroup";

/** Deliberately NOT imported from `projectValueGroup.ts` — that module's
 *  own `Provenance` (re-exported from `events.ts`) is a DIFFERENT,
 *  larger metrics-provenance object (`{source_events, sample_size,
 *  verification_status, ...}`), not this simple REAL/DEMO tag. Same
 *  name, two real different types in this codebase — kept apart here
 *  rather than colliding them. */
export type GroupProvenance = "REAL" | "DEMO";
export type ValueRegistryProvenance = GroupProvenance | "LEGACY";

/** PHILOS' own INDIVIDUAL → GROUP → COMMON axis (VALUE GROUPS CONVERGENCE
 *  pass). Derived, never asserted: a real, computable function of
 *  `groups.length` — the ONLY real signal this codebase has for how
 *  widely a value is actually shared today. 0 real/DEMO groups = no one
 *  has coordinated around it yet (INDIVIDUAL); exactly 1 = one real
 *  coordination context (GROUP); 2+ = shared across multiple real
 *  contexts (COMMON). Never a self-reported or asserted classification —
 *  recomputed every time from the real group count. */
export type ValueScope = "INDIVIDUAL" | "GROUP" | "COMMON";

export function deriveValueScope(groupCount: number): ValueScope {
  if (groupCount === 0) return "INDIVIDUAL";
  if (groupCount === 1) return "GROUP";
  return "COMMON";
}

export interface ValueEntry {
  value_id: string;
  name: string;
  /** Where this value concept came from — never blank, never guessed. */
  source: "value_group_event" | "pudm_candidate_value";
  provenance: ValueRegistryProvenance;
  /** Real domain/context string, when the source carries one (PUDM
   *  values have one; Value-Group central_value does not). */
  domain?: string;
  /** group_ids where this is the group's own real central_value. */
  groups: string[];
  /** `deriveValueScope(groups.length)` — see that function's own header. */
  scope: ValueScope;
}

/** Ledger §41 revision: replaces the earlier §40 set (which included
 *  ROLE_REVERSAL/UNKNOWN) with the exact 10 types this pass's own
 *  request specifies — SUPPORTS/CONSTRAINS/REQUIRES added, ROLE_REVERSAL
 *  dropped (0 real source examples were ever found for it; UNKNOWN is
 *  superseded by simply not asserting a relation at all, matching how
 *  every other "no evidence" case in this codebase is handled — absence,
 *  not an UNKNOWN-typed relation record). */
export type ValueRelationType =
  | "ALIGNMENT" | "OPPOSITION" | "COMPLEMENT" | "CONTINUUM" | "TENSION"
  | "OVERLAP" | "COMMON_GROUND" | "SUPPORTS" | "CONSTRAINS" | "REQUIRES";

export interface ValueRelation {
  relation_id: string;
  from_value_id: string;
  to_value_id: string;
  type: ValueRelationType;
  evidence: string;
  source: string;
}

/** Deterministic id — derived from the real source string, never
 *  translated/reinterpreted (a Hebrew central_value stays Hebrew). */
function groupValueId(centralValue: string): string {
  return `vg_value_${centralValue}`;
}
function pudmValueId(id: string): string {
  return `pudm_value_${id}`;
}

/** Real PUDM Value shape this module actually reads — kept minimal and
 *  local rather than importing the full `Value` node type, since only
 *  `id`/`context.label`/`context.domain` are used here. */
export interface PudmValueSource {
  id: string;
  context: { label: string; domain: string | null };
}

export function buildValueRegistry(
  groups: { view: ValueGroupView; provenance: GroupProvenance }[],
  pudmValues: PudmValueSource[],
): ValueEntry[] {
  const byGroupValue = new Map<string, Omit<ValueEntry, "scope">>();
  for (const { view, provenance } of groups) {
    const id = groupValueId(view.central_value);
    const existing = byGroupValue.get(id);
    if (existing) {
      existing.groups.push(view.group_id);
    } else {
      byGroupValue.set(id, {
        value_id: id,
        name: view.central_value,
        source: "value_group_event",
        provenance,
        groups: [view.group_id],
      });
    }
  }

  const pudmEntries: Omit<ValueEntry, "scope">[] = pudmValues.map((v) => ({
    value_id: pudmValueId(v.id),
    name: v.context.label,
    source: "pudm_candidate_value",
    provenance: "LEGACY",
    domain: v.context.domain ?? undefined,
    groups: [],
  }));

  // `scope` is derived from the FINAL real group count — computed only
  // once every duplicate-group merge above has settled, never at
  // insertion time (which would see a partial count).
  return [...byGroupValue.values(), ...pudmEntries].map((entry) => ({ ...entry, scope: deriveValueScope(entry.groups.length) }));
}

/** Real, checked: 0 today. See module header. A real future relation
 *  would be appended here with its own `evidence`/`source`, never
 *  inferred from name similarity. */
export function buildValueRelations(): ValueRelation[] {
  return [];
}

export const VALUE_RELATION_TYPES: ValueRelationType[] = [
  "ALIGNMENT", "OPPOSITION", "COMPLEMENT", "CONTINUUM", "TENSION",
  "OVERLAP", "COMMON_GROUND", "SUPPORTS", "CONSTRAINS", "REQUIRES",
];
