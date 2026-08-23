/**
 * THE CANONICAL VALUE/COMMUNITY DATA PACKAGE — one inspectable place.
 *
 * The taxonomy used to live only inside `valueUniverse328.ts` and
 * `baseValueRegistry.ts`: 28 families, 223 sub-values, 300 source
 * interpretations and 65 base values, all as TypeScript literals. That is
 * readable by the compiler and by nobody else — it cannot be diffed as data,
 * inspected without a build, or extended without an edit to code.
 *
 * `.philos-canon-data/` now holds the same facts as records, each carrying
 * `provenance` / `source` / `status` / `evidence` where they apply, and this
 * module is the only door to them. The TS modules remain the ORIGIN of the
 * export (they are the parsed form of Roei's own documents) and stay the
 * fallback, so a missing package degrades to the built-in taxonomy rather than
 * to an empty screen — but nothing in the app reads them directly any more.
 *
 * Files, and why each is separate rather than one denormalised blob:
 *   value-families.jsonl    28   the taxonomy's top level
 *   sub-values.jsonl        223  leaves, each citing its source entries by id
 *   value-sources.jsonl     300  the interpretations — provenance, not values
 *   base-values.jsonl       65   a SEPARATE canonical layer (contract §17.2)
 *   candidate-families.jsonl 28  base-value → family sort, review-required
 *   value-groups.jsonl      N    the INGEST DOOR — externally supplied groups
 *   group-projections.jsonl N    DERIVED snapshot of the log-owned groups, so
 *                                the package is inspectable without asserting
 *                                a second identity for a group the log owns
 *   memberships.jsonl       N    person↔group, with the role the log records
 *   money-flows.jsonl       N    allocations and transfers
 *   group-effects.jsonl     N    claimed effects
 *   group-evidence.jsonl    N    verifications, referencing an effect_id
 *   group-history.jsonl     N    trend depth per group
 *   group-events.jsonl      N    THE OPERATIONAL SPINE — every need, resource,
 *                                match, action, effect, evidence, tension and
 *                                budget movement, append-only
 *   group-relations.jsonl   N    edges — empty today, and honestly so
 * A fact lives in exactly one of these; `sub-values` cites source ids rather
 * than copying the interpretations, and `group-evidence` cites `effect_id`
 * rather than restating the effect.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RAW_FAMILIES, SUBVALUES } from "./valueUniverse328";

export interface FamilyRecord { family_id: string; name_he: string; content_he: string; status: string; provenance: string; source: string }
export interface SubvalueRecord { subvalue_id: string; name_he: string; family_id: string | null; source_entry_ids: string[]; source_count: number; status: string; provenance: string; source: string; evidence: string }
export interface MembershipRecord { membership_id: string; group_id: string; person_id: string; display_name?: string; role: string | null; role_label: string | null; area: string | null; since: string | null; status: string; provenance: string; source: string; evidence: string }
export interface MoneyFlowRecord { flow_id: string; group_id: string; kind: "ALLOCATION" | "TRANSFER"; amount: number; currency: string; purpose?: string; to?: string | null; status: string; provenance: string; source: string; evidence: string }
export interface GroupEffectRecord { effect_id: string; group_id: string; description: string; metric: string | null; value: number | null; at: string | null; provenance: string; source: string; status: "VERIFIED" | "CLAIMED" }
export interface GroupEvidenceRecord { evidence_id: string; effect_id: string; group_id: string; verified_by: string | null; level: string | null; provenance: string; source: string; status: string }

export function packageDir(): string {
  return process.env.PHILOS_CANON_DIR ?? join(process.cwd(), ".philos-canon-data");
}

function readJsonl<T>(file: string, dir = packageDir()): T[] {
  const p = join(dir, file);
  if (!existsSync(p)) return [];
  const out: T[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t) as T); } catch { /* a bad line is skipped, never half-applied */ }
  }
  return out;
}

/** The 28 families. Falls back to the embedded origin if the package is absent. */
export function loadFamilies(dir?: string): FamilyRecord[] {
  const rows = readJsonl<FamilyRecord>("value-families.jsonl", dir);
  if (rows.length) return rows;
  return RAW_FAMILIES.map((f) => ({
    family_id: f.id, name_he: f.name_he, content_he: f.content_he, status: f.status,
    provenance: "REAL", source: "embedded origin (package file absent)",
  }));
}

/** The 223 sub-values. Same fallback rule. */
export function loadSubvalues(dir?: string): SubvalueRecord[] {
  const rows = readJsonl<SubvalueRecord>("sub-values.jsonl", dir);
  if (rows.length) return rows;
  return SUBVALUES.map((s) => ({
    subvalue_id: s.subvalue_id, name_he: s.name_he, family_id: s.family_id,
    source_entry_ids: [...s.source_entry_ids], source_count: s.source_count,
    status: s.family_id ? "FAMILY_ASSIGNED" : "CROSS_FAMILY_REVIEW",
    provenance: "REAL", source: "embedded origin (package file absent)",
    evidence: `${s.source_count} interpretations cite this value string`,
  }));
}

export const loadMemberships = (dir?: string) => readJsonl<MembershipRecord>("memberships.jsonl", dir);
export const loadMoneyFlows = (dir?: string) => readJsonl<MoneyFlowRecord>("money-flows.jsonl", dir);
export const loadGroupEffects = (dir?: string) => readJsonl<GroupEffectRecord>("group-effects.jsonl", dir);
export const loadGroupEvidence = (dir?: string) => readJsonl<GroupEvidenceRecord>("group-evidence.jsonl", dir);

/** What the package physically contains, for the audit layer to state. */
export function packageManifest(dir = packageDir()): { file: string; records: number; present: boolean }[] {
  const files = [
    "value-families.jsonl", "sub-values.jsonl", "value-sources.jsonl", "base-values.jsonl",
    "candidate-families.jsonl", "value-groups.jsonl", "memberships.jsonl", "money-flows.jsonl",
    "group-events.jsonl", "group-projections.jsonl", "group-effects.jsonl",
    "group-evidence.jsonl", "group-history.jsonl", "group-relations.jsonl",
    "value-group-mappings.jsonl", "needs.jsonl", "offers.jsonl", "actions.jsonl", "effects.jsonl",
    "value-declarations.jsonl", "person-community-links.jsonl", "need-group-links.jsonl",
  ];
  return files.map((f) => {
    const p = join(dir, f);
    if (!existsSync(p)) return { file: f, records: 0, present: false };
    const n = readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).length;
    return { file: f, records: n, present: true };
  });
}
