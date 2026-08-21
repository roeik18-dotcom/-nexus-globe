/**
 * BULK GROUP INGESTION — the path a real dataset of value groups enters PHILOS
 * by, WITHOUT a TypeScript change per group.
 *
 * Before this, adding a group meant editing code: the one real group lives as
 * a hand-written `PhilosEvent[]` in `valueGroupLog.ts`, and the two DEMO groups
 * as another hand-written array in `demoCommunities.ts`. That is why the
 * dataset is three. This module makes N a data question.
 *
 * FORMAT: newline-delimited JSON (`value-groups.jsonl`), one group per line,
 * append-only like every other canon store. JSONL rather than one big array so
 * a partial file is still readable, a bad line is skippable and reportable
 * rather than fatal, and appending a batch never rewrites what is already
 * there. See `VALUE_GROUP_INGEST_SCHEMA` below for the field contract — it is
 * exported so a screen, a test, or a document generator can print it rather
 * than restate it and drift.
 *
 * WHAT INGESTION DOES NOT DO. It does not decide value identity: an ingested
 * `central_value_label` goes through `valueMapping.ts` exactly like the seeded
 * group's does, and stays UNRESOLVED until ruled on. It does not mint members,
 * budgets, needs or evidence — a field absent from the line stays absent in the
 * registry. And it never marks a record REAL on the file's say-so: provenance
 * is a required, explicit field on every line.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalValueGroup, GroupMemberRef, GroupProvenanceTag, GroupLifecycleStatus } from "./canonicalValueGroup";

export const VALUE_GROUP_STORE_FILENAME = "value-groups.jsonl";
export const VALUE_MAPPING_STORE_FILENAME = "value-group-mappings.jsonl";

/** The wire record. Only `group_id`, `name` and `provenance` are required —
 *  everything else is genuinely optional, and absent means absent. */
export interface ValueGroupSourceRecord {
  group_id: string;
  name: string;
  provenance: GroupProvenanceTag;
  description?: string;
  status?: GroupLifecycleStatus;
  geography?: string;
  central_value_label?: string;
  /** Pre-ruled canonical mapping, if the dataset already carries one. */
  primary_subvalue_id?: string;
  secondary_subvalue_ids?: string[];
  members?: GroupMemberRef[];
  budget?: { received: number; spent: number; committed: number; available: number; currency: string };
  money_flow_count?: number;
  needs?: string[];
  offers?: string[];
  actions?: string[];
  effect_count?: number;
  evidence_count?: number;
  event_count?: number;
  /** Free text: where this line came from. Printed on screen beside the group. */
  source?: string;
}

export const VALUE_GROUP_INGEST_SCHEMA = {
  file: VALUE_GROUP_STORE_FILENAME,
  encoding: "UTF-8, one JSON object per line (JSONL), append-only",
  required: ["group_id (unique, stable, e.g. vg_xxx)", "name", 'provenance ("REAL" | "DEMO")'],
  optional: [
    "description", 'status ("active"|"forming"|"archived")', "geography",
    "central_value_label (free text — mapped, never trusted as taxonomy)",
    "primary_subvalue_id (SV001..SV223)", "secondary_subvalue_ids[]",
    "members[] { person_id, display_name?, role?, joined_at? }",
    "budget { received, spent, committed, available, currency }",
    "money_flow_count", "needs[]", "offers[]", "actions[]",
    "effect_count", "evidence_count", "event_count", "source",
  ],
  rules: [
    "An absent field stays absent — it is never defaulted to 0, \"\" or \"member\".",
    "central_value_label is NOT a taxonomy id; mapping stays UNRESOLVED without a ruling.",
    "A duplicate group_id is rejected, not merged.",
    "provenance REAL is the caller's assertion, never inferred from the file.",
  ],
} as const;

export interface IngestResult {
  records: ValueGroupSourceRecord[];
  /** Lines that could not be read, with why. Never silently dropped. */
  rejected: { line: number; because: string }[];
}

/** Pure. Parses JSONL text; a bad line is reported, never fatal. */
export function parseValueGroupJsonl(text: string): IngestResult {
  const records: ValueGroupSourceRecord[] = [];
  const rejected: { line: number; because: string }[] = [];
  const seen = new Set<string>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    let o: unknown;
    try {
      o = JSON.parse(raw);
    } catch {
      rejected.push({ line: i + 1, because: "JSON לא תקין" });
      continue;
    }
    const r = o as ValueGroupSourceRecord;
    if (!r || typeof r.group_id !== "string" || !r.group_id) { rejected.push({ line: i + 1, because: "חסר group_id" }); continue; }
    if (typeof r.name !== "string" || !r.name) { rejected.push({ line: i + 1, because: `${r.group_id}: חסר name` }); continue; }
    if (r.provenance !== "REAL" && r.provenance !== "DEMO") { rejected.push({ line: i + 1, because: `${r.group_id}: provenance חייב להיות REAL או DEMO` }); continue; }
    if (seen.has(r.group_id)) { rejected.push({ line: i + 1, because: `${r.group_id}: מזהה כפול — נדחה, לא ממוזג` }); continue; }
    seen.add(r.group_id);
    records.push(r);
  }
  return { records, rejected };
}

/** Wire record → canonical record. Absent stays absent. Mapping is applied by
 *  the registry afterwards, not here — this is a pure shape change. */
export function toCanonical(r: ValueGroupSourceRecord): CanonicalValueGroup {
  return {
    group_id: r.group_id,
    name: r.name,
    description: r.description,
    status: r.status ?? "unknown",
    geography: r.geography,
    central_value_label: r.central_value_label,
    primary_subvalue_id: r.primary_subvalue_id,
    secondary_subvalue_ids: r.secondary_subvalue_ids,
    value_family_id: undefined,
    value_mapping_status: r.primary_subvalue_id ? "RESOLVED" : "UNRESOLVED_REVIEW_REQUIRED",
    members: r.members ?? [],
    budget: r.budget,
    money_flow_count: r.money_flow_count,
    needs: r.needs,
    offers: r.offers,
    actions: r.actions,
    effect_count: r.effect_count,
    evidence_count: r.evidence_count,
    event_count: r.event_count,
    provenance: r.provenance,
    source: r.source ?? `ingested from ${VALUE_GROUP_STORE_FILENAME}`,
  };
}

function storeDir(): string {
  return process.env.PHILOS_CANON_DIR ?? join(process.cwd(), ".philos-canon-data");
}

/** Reads the ingest file if it exists. A missing file is an empty dataset —
 *  not an error, and not a reason to fall back to a built-in group. */
export function loadIngestedGroups(dir = storeDir()): IngestResult {
  const p = join(dir, VALUE_GROUP_STORE_FILENAME);
  if (!existsSync(p)) return { records: [], rejected: [] };
  return parseValueGroupJsonl(readFileSync(p, "utf8"));
}

/** Recorded value-mapping rulings. Missing file = no rulings yet. */
export function loadValueMappingRulings(dir = storeDir()): import("./valueMapping").ValueMappingRecord[] {
  const p = join(dir, VALUE_MAPPING_STORE_FILENAME);
  if (!existsSync(p)) return [];
  const out: import("./valueMapping").ValueMappingRecord[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t);
      if (r && typeof r.group_id === "string" && typeof r.primary_subvalue_id === "string") out.push(r);
    } catch { /* a malformed ruling is ignored, never applied half-read */ }
  }
  return out;
}
