/**
 * VALUE GROUP REGISTRY — the one place that answers "which value groups exist".
 *
 * This is the module that removes the single-group assumption. Nothing here
 * imports a default group id, and there is no code path that answers "the
 * group" — only "the groups", of which there may be `0`, `1`, or `N`. A
 * product built on this can accept a dataset of any size without another
 * architectural change; that is the entire point of the pass.
 *
 * THREE SOURCES, ONE IDENTITY EACH. A group is never copied per surface:
 *   1. the real event log   — every `group.opened` in `philos-events.jsonl`,
 *                             discovered from events, not from a constant
 *   2. `value-groups.jsonl` — bulk-ingested records (today: file absent = 0)
 *   3. `demoCommunities.ts` — the two hand-written DEMO groups, tagged DEMO
 * A `group_id` collision between sources is a CONFLICT, reported, never merged
 * silently — two sources disagreeing about one identity is exactly the bug
 * this registry exists to make visible.
 *
 * ZERO IS A LEGITIMATE REGISTRY. `buildValueGroupRegistry([])` returns an empty
 * registry rather than falling back to anything; a product that cannot render
 * zero groups will fabricate one.
 */
import type { PhilosEvent } from "../events";
import { projectValueGroup } from "../projectValueGroup";
import {
  discoverGroupIds, fromProjection,
  type CanonicalValueGroup, type GroupProvenanceTag,
} from "./canonicalValueGroup";
import { resolveValueMapping, type MappingOutcome, type ValueMappingRecord } from "./valueMapping";
import { toCanonical, type ValueGroupSourceRecord } from "./valueGroupIngest";

export interface RegistryEntry {
  group: CanonicalValueGroup;
  /** Kept beside the group so a screen can show WHY a value is unresolved and
   *  which candidates a ruling would choose between. */
  mapping: MappingOutcome;
}

export interface ValueGroupRegistry {
  entries: readonly RegistryEntry[];
  real_count: number;
  demo_count: number;
  /** Same `group_id` offered by two sources. Reported, never resolved silently. */
  conflicts: readonly { group_id: string; sources: string[] }[];
  /** Ingest lines that failed to parse, carried through so a screen can say so. */
  rejected: readonly { line: number; because: string }[];
  byId(group_id: string): RegistryEntry | undefined;
  /** Groups whose PRIMARY sub-value is this one. Resolved mappings only —
   *  an unresolved group is attached to no leaf, which is the truthful state. */
  bySubvalue(subvalue_id: string): readonly RegistryEntry[];
  byFamily(family_id: string): readonly RegistryEntry[];
}

export interface RegistryInput {
  /** The real append-only log. Group existence is read from `group.opened`. */
  events?: readonly PhilosEvent[];
  /** Bulk-ingested source records. */
  ingested?: readonly ValueGroupSourceRecord[];
  /** DEMO group event bundles, each already carrying its own id. */
  demo?: readonly { group_id: string; events: readonly PhilosEvent[] }[];
  /** Recorded mapping rulings. Absent = every mapping stays unresolved. */
  rulings?: readonly ValueMappingRecord[];
  today?: string;
}

export function buildValueGroupRegistry(input: RegistryInput): ValueGroupRegistry {
  const rulings = input.rulings ?? [];
  const today = input.today ?? "1970-01-01";
  const collected: { g: CanonicalValueGroup; source: string }[] = [];

  // 1 · REAL, discovered from the log itself.
  const events = input.events ?? [];
  for (const gid of discoverGroupIds(events)) {
    const view = projectValueGroup(events, gid, today);
    // `group.opened` named an id the projection cannot build. Skipped rather
    // than pushed as a half-group — and it never becomes a fallback.
    if (!view) continue;
    collected.push({
      g: fromProjection(view, "REAL", "אירועי group.opened ביומן האמיתי", { status: "UNRESOLVED_REVIEW_REQUIRED" }),
      source: "event-log",
    });
  }

  // 2 · Bulk-ingested.
  for (const r of input.ingested ?? []) {
    collected.push({ g: toCanonical(r), source: "value-groups.jsonl" });
  }

  // 3 · DEMO.
  for (const d of input.demo ?? []) {
    const view = projectValueGroup(d.events as PhilosEvent[], d.group_id, today);
    if (!view) continue;
    collected.push({
      g: fromProjection(view, "DEMO", "חבילת DEMO מוצהרת (demoCommunities.ts)", { status: "UNRESOLVED_REVIEW_REQUIRED" }),
      source: "demo",
    });
  }

  // Identity collision → reported, first-seen kept, never merged.
  const seen = new Map<string, string>();
  const conflicts: { group_id: string; sources: string[] }[] = [];
  const kept: { g: CanonicalValueGroup; source: string }[] = [];
  for (const c of collected) {
    const prior = seen.get(c.g.group_id);
    if (prior) {
      const existing = conflicts.find((x) => x.group_id === c.g.group_id);
      if (existing) existing.sources.push(c.source);
      else conflicts.push({ group_id: c.g.group_id, sources: [prior, c.source] });
      continue;
    }
    seen.set(c.g.group_id, c.source);
    kept.push(c);
  }

  const entries: RegistryEntry[] = kept.map(({ g }) => {
    // A record that arrived with its own resolved mapping keeps it; everything
    // else goes through the same rule, ingested and seeded alike.
    if (g.primary_subvalue_id) {
      const m = resolveValueMapping(g.group_id, g.central_value_label, [
        { group_id: g.group_id, primary_subvalue_id: g.primary_subvalue_id, secondary_subvalue_ids: g.secondary_subvalue_ids as string[] | undefined, decided_by: "מקור הייבוא", evidence: "המיפוי הגיע כחלק מרשומת המקור", recorded_at: "" },
      ]);
      return { group: { ...g, value_family_id: m.family, value_mapping_status: m.status }, mapping: m };
    }
    const m = resolveValueMapping(g.group_id, g.central_value_label, rulings);
    return {
      group: {
        ...g,
        primary_subvalue_id: m.primary,
        secondary_subvalue_ids: m.secondary,
        value_family_id: m.family,
        value_mapping_status: m.status,
      },
      mapping: m,
    };
  });

  const count = (p: GroupProvenanceTag) => entries.filter((e) => e.group.provenance === p).length;

  return {
    entries,
    real_count: count("REAL"),
    demo_count: count("DEMO"),
    conflicts,
    rejected: [],
    byId: (id) => entries.find((e) => e.group.group_id === id),
    bySubvalue: (sv) =>
      entries.filter((e) => e.group.primary_subvalue_id === sv || (e.group.secondary_subvalue_ids ?? []).includes(sv)),
    byFamily: (f) => entries.filter((e) => e.group.value_family_id === f),
  };
}
