/**
 * PHILOS Canonical layer — generic frozen-master-file reader.
 *
 * Reads one `canonical/data/*.master.json` Source Lock file, verbatim, and
 * caches it in memory for the lifetime of the process (same "read real
 * frozen data, never mutate it" discipline `humanConfig/masterUnitsSource.ts`
 * already uses for the live Dropbox workbook — this reader is simpler
 * because these three files are already-frozen JSON, not a live xlsx).
 *
 * **Never writes.** No function in this file opens its target file for
 * writing, and none of the three Source Locks
 * (`human.master.json`/`music.master.json`/`color.master.json`) is ever
 * touched — "do not touch the frozen XLSX Source Locks" (Phase 4 brief)
 * applies transitively to their JSON exports too.
 *
 * **`row_count` is checked, not trusted** — a master file whose declared
 * `row_count` disagrees with its actual `records.length` is a corrupted or
 * hand-edited Source Lock; this loader refuses to silently serve it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface MasterFileEnvelope<T> {
  source_lock: string;
  source_lock_sha256_16: string;
  id_field: string;
  row_count: number;
  records: T[];
}

export class MasterFileCorruptError extends Error {
  constructor(fileName: string, declaredCount: number, actualCount: number) {
    super(`${fileName}: declared row_count ${declaredCount} does not match records.length ${actualCount} — refusing to serve a Source Lock that disagrees with itself`);
    this.name = "MasterFileCorruptError";
  }
}

const CANONICAL_DATA_DIR = join(process.cwd(), "app/lib/philos/canonical/data");

const cache = new Map<string, MasterFileEnvelope<unknown>>();

/** The one entry point every kind-specific loader (`humanMasterLoader.ts`,
 *  `musicMasterLoader.ts`, `colorMasterLoader.ts`) calls. In-memory cache
 *  only, keyed by file name — never re-read from disk once loaded, matching
 *  the "frozen, never touched" contract of these files this process run. */
export function loadMasterFile<T>(fileName: string): MasterFileEnvelope<T> {
  const cached = cache.get(fileName);
  if (cached) return cached as MasterFileEnvelope<T>;

  const filePath = join(CANONICAL_DATA_DIR, fileName);
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as MasterFileEnvelope<T>;
  if (parsed.row_count !== parsed.records.length) {
    throw new MasterFileCorruptError(fileName, parsed.row_count, parsed.records.length);
  }
  cache.set(fileName, parsed as MasterFileEnvelope<unknown>);
  return parsed;
}

/** Test helper only — clears the in-memory cache so a test can exercise a
 *  fresh `loadMasterFile` read. Never call from production code. */
export function _clearMasterFileCache(): void {
  cache.clear();
}
