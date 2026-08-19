/**
 * PHILOS Canonical layer — HumanMasterLoader.
 *
 * Read-only reader for `canonical/data/human.master.json` — the frozen
 * Source Lock (`HUMAN_CONFIG_MASTER_SOURCE_LOCK_v1.0.xlsx`, 189 records,
 * `id_field: SOURCE_NUMBER`) produced by the already-completed Human audit.
 * This module invents no data and performs no classification beyond what
 * the Source Lock itself already states in `RUNTIME_STATUS`/`TYPE`.
 *
 * `HumanMasterRecord.SOURCE_TEXT` is real and present on the loaded record
 * (it is what the frozen file actually contains) — the Phase 4 rule "never
 * copy SOURCE_TEXT into runtime instances" is enforced downstream, in
 * `canonicalRef.ts::resolveCanonicalRef` (whose resolved summary type has no
 * `SOURCE_TEXT` field at all) and in `personInstance.ts` (which stores
 * `CanonicalRef` strings only) — never here, since this loader's whole job
 * is to expose the real frozen record for display/audit use.
 */
import { loadMasterFile } from "./masterLoader";

export interface HumanMasterRecord {
  SOURCE_ORDER: number;
  SOURCE_NUMBER: number;
  SOURCE_FILE: string;
  SOURCE_SECTION: string;
  SOURCE_HEADING: string;
  SOURCE_TEXT: string;
  TYPE: string;
  RUNTIME_STATUS: string;
  COLOR: string;
  COLOR_ID: number;
  COLOR_FUNCTION: string;
  HIERARCHY_LEVEL: string;
  MAPPING_BASIS: string;
  EVIDENCE: string;
  SOURCE_STATUS: string;
  REVIEW_STATUS: string;
  NOTES: string;
}

const FILE_NAME = "human.master.json";

/** The whole frozen Human corpus — real, checked (189 records). */
export function loadHumanMaster(): HumanMasterRecord[] {
  return loadMasterFile<HumanMasterRecord>(FILE_NAME).records;
}

/** Real, checked metadata about the Source Lock itself — surfaced in the
 *  UI's provenance line, never hidden. */
export function humanMasterMeta(): { source_lock: string; source_lock_sha256_16: string; id_field: string; row_count: number } {
  const { source_lock, source_lock_sha256_16, id_field, row_count } = loadMasterFile<HumanMasterRecord>(FILE_NAME);
  return { source_lock, source_lock_sha256_16, id_field, row_count };
}

/** Lookup by the real `id_field` (`SOURCE_NUMBER`) — `null` when genuinely
 *  absent, never a guessed nearest match. */
export function findHumanBySourceNumber(sourceNumber: number | string): HumanMasterRecord | null {
  const n = typeof sourceNumber === "string" ? Number(sourceNumber) : sourceNumber;
  if (!Number.isFinite(n)) return null;
  return loadHumanMaster().find((r) => r.SOURCE_NUMBER === n) ?? null;
}

export interface HumanMasterSummary {
  total: number;
  by_runtime_status: Record<string, number>;
  by_type: Record<string, number>;
}

/** Real aggregate counts over the frozen corpus — no fabricated bucket. */
export function summarizeHumanMaster(): HumanMasterSummary {
  const records = loadHumanMaster();
  const by_runtime_status: Record<string, number> = {};
  const by_type: Record<string, number> = {};
  for (const r of records) {
    by_runtime_status[r.RUNTIME_STATUS] = (by_runtime_status[r.RUNTIME_STATUS] ?? 0) + 1;
    by_type[r.TYPE] = (by_type[r.TYPE] ?? 0) + 1;
  }
  return { total: records.length, by_runtime_status, by_type };
}
