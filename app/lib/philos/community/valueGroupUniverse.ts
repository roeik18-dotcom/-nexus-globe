/**
 * VALUE GROUP UNIVERSE — the whole value landscape, with groups attached where
 * groups exist and an honest `0` where they do not.
 *
 * The universe is deliberately the TAXONOMY first and the groups second. That
 * ordering is the product point: PHILOS knows 28 value families and 223
 * sub-values, and has 3 value groups. Rendering only the 3 would report a
 * community of three interests; rendering the 223 with their real group counts
 * reports the truth — a rich ontology and a nearly empty population. The screen
 * can then say which of the two is the gap, which no card list can express.
 *
 *   ONTOLOGY COVERAGE   = how much of the value landscape is described
 *   POPULATION COVERAGE = how much of it anybody has actually organised around
 *
 * The universe is GLOBAL. It carries no viewer, no membership and no
 * personalisation — `viewerGroupOverlay.ts` is the separate structure for
 * that, and keeping them apart is what lets a viewer inspect the whole
 * landscape without any of it being claimed as theirs.
 */
import { RAW_FAMILIES, SUBVALUES } from "./valueUniverse328";
import type { RegistryEntry, ValueGroupRegistry } from "./valueGroupRegistry";

export interface SubvalueNode {
  subvalue_id: string;
  name_he: string;
  family_id: string | null;
  /** Real citations from the 300 source interpretations. Provenance depth. */
  source_count: number;
  groups: readonly RegistryEntry[];
  group_count: number;
}

export interface FamilyNode {
  family_id: string;
  name_he: string;
  content_he: string;
  subvalues: readonly SubvalueNode[];
  subvalue_count: number;
  /** Groups reachable anywhere under this family. `0` is shown, not hidden. */
  group_count: number;
}

export interface UniverseCoverage {
  family_count: number;
  subvalue_count: number;
  /** Sub-values with at least one group. The population-coverage numerator. */
  populated_subvalue_count: number;
  populated_family_count: number;
  /** Groups whose value could not be placed on the taxonomy at all. */
  unplaced_group_count: number;
  group_count: number;
}

export interface ValueGroupUniverse {
  families: readonly FamilyNode[];
  /** Sub-values whose `family_id` is null — real cross-family review cases. */
  unfamilied: readonly SubvalueNode[];
  /** Groups with no RESOLVED sub-value. Visible in the universe as a named
   *  bucket rather than dropped — an unmapped group still exists. */
  unplaced: readonly RegistryEntry[];
  coverage: UniverseCoverage;
}

export function buildValueGroupUniverse(registry: ValueGroupRegistry): ValueGroupUniverse {
  const bySv = new Map<string, RegistryEntry[]>();
  const placed = new Set<string>();
  for (const e of registry.entries) {
    const ids = [e.group.primary_subvalue_id, ...(e.group.secondary_subvalue_ids ?? [])].filter(Boolean) as string[];
    for (const id of ids) {
      const arr = bySv.get(id) ?? [];
      arr.push(e);
      bySv.set(id, arr);
      placed.add(e.group.group_id);
    }
  }

  const nodes: SubvalueNode[] = SUBVALUES.map((s) => {
    const groups = bySv.get(s.subvalue_id) ?? [];
    return {
      subvalue_id: s.subvalue_id,
      name_he: s.name_he,
      family_id: s.family_id,
      source_count: s.source_count,
      groups,
      group_count: groups.length,
    };
  });

  const families: FamilyNode[] = RAW_FAMILIES.map((f) => {
    const subs = nodes.filter((n) => n.family_id === f.id);
    return {
      family_id: f.id,
      name_he: f.name_he,
      content_he: f.content_he,
      subvalues: subs,
      subvalue_count: subs.length,
      group_count: subs.reduce((a, n) => a + n.group_count, 0),
    };
  });

  const unplaced = registry.entries.filter((e) => !placed.has(e.group.group_id));

  return {
    families,
    unfamilied: nodes.filter((n) => n.family_id === null),
    unplaced,
    coverage: {
      family_count: families.length,
      subvalue_count: nodes.length,
      populated_subvalue_count: nodes.filter((n) => n.group_count > 0).length,
      populated_family_count: families.filter((f) => f.group_count > 0).length,
      unplaced_group_count: unplaced.length,
      group_count: registry.entries.length,
    },
  };
}
