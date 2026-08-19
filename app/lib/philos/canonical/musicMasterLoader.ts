/**
 * PHILOS Canonical layer — MusicMasterLoader.
 *
 * Read-only reader for `canonical/data/music.master.json` — the frozen
 * Source Lock (`MUSIC_CONFIG_MASTER_SOURCE_LOCK_v1.0.xlsx`, 80 records,
 * `id_field: SOURCE_NUMBER`). Unlike Human's `SOURCE_NUMBER` (a plain
 * integer), Music's is a real, checked string id (e.g. `"GEN-MU-PROC-04"`)
 * — kept exactly as the Source Lock states it, never coerced to a number.
 *
 * Same `SOURCE_TEXT`-exposure discipline as `humanMasterLoader.ts`'s own
 * header: real here (this is a read-only view of the frozen record), never
 * copied into a runtime `PersonInstance`/`ValueDomainInstance`.
 *
 * "MUSIC FIRST CONTACT" (Phase 4 §6) — before this module, nothing in this
 * repository read `music.master.json` at runtime; `MUSIC_CANON_DOMAIN_ID`
 * below is the one real, stable `domain_id` Hub/Dynamics use to distinguish
 * this CANON corpus from the pre-existing `demoMusicDomain.ts` DEMO
 * fixture (different `domain_id`, different `SOURCE_KIND`, never merged).
 */
import { loadMasterFile } from "./masterLoader";

export interface MusicMasterRecord {
  SOURCE_ORDER: number;
  SOURCE_NUMBER: string;
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

const FILE_NAME = "music.master.json";

/** The stable `domain_id` this Phase 4 pass wires Music CANON data into —
 *  deliberately different from `demoMusicDomain.ts::DEMO_MUSIC_DOMAIN.domain_id`
 *  ("demo_domain_music") so a CANON reading and a DEMO fixture can never be
 *  mistaken for the same domain by any downstream consumer. */
export const MUSIC_CANON_DOMAIN_ID = "music_canon";

/** The whole frozen Music corpus — real, checked (80 records). */
export function loadMusicMaster(): MusicMasterRecord[] {
  return loadMasterFile<MusicMasterRecord>(FILE_NAME).records;
}

export function musicMasterMeta(): { source_lock: string; source_lock_sha256_16: string; id_field: string; row_count: number } {
  const { source_lock, source_lock_sha256_16, id_field, row_count } = loadMasterFile<MusicMasterRecord>(FILE_NAME);
  return { source_lock, source_lock_sha256_16, id_field, row_count };
}

/** Lookup by the real `id_field` (`SOURCE_NUMBER`), string-typed — `null`
 *  when genuinely absent. */
export function findMusicBySourceNumber(sourceNumber: string): MusicMasterRecord | null {
  return loadMusicMaster().find((r) => r.SOURCE_NUMBER === sourceNumber) ?? null;
}

/** Real records this Phase 4 pass considers runtime-eligible — the Source
 *  Lock's own `RUNTIME_STATUS === "READY"` flag, never a second heuristic. */
export function readyMusicRecords(): MusicMasterRecord[] {
  return loadMusicMaster().filter((r) => r.RUNTIME_STATUS === "READY");
}

export interface MusicMasterSummary {
  total: number;
  by_runtime_status: Record<string, number>;
  by_type: Record<string, number>;
}

export function summarizeMusicMaster(): MusicMasterSummary {
  const records = loadMusicMaster();
  const by_runtime_status: Record<string, number> = {};
  const by_type: Record<string, number> = {};
  for (const r of records) {
    by_runtime_status[r.RUNTIME_STATUS] = (by_runtime_status[r.RUNTIME_STATUS] ?? 0) + 1;
    by_type[r.TYPE] = (by_type[r.TYPE] ?? 0) + 1;
  }
  return { total: records.length, by_runtime_status, by_type };
}
