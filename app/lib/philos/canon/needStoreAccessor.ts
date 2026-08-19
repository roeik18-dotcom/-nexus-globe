/**
 * Philos Canon — NeedStore accessor (process-wide singleton).
 *
 * Mirrors `canonEventStoreAccessor.ts` exactly in shape, over `NeedStore`
 * instead of `CanonEventStore`. Deliberately reuses the SAME `CANON_DATA_DIR`
 * env var / default directory as the canon Observation store — `Need` is the
 * same canon vocabulary (§12, same document), so it belongs in the same
 * data directory — but writes to a DIFFERENT FILE (`needs.jsonl`, never
 * `canon-events.jsonl`), via a completely separate store instance and
 * separate module-level singleton, so the two logs never share a byte of
 * live state. No new env var invented for a one-file difference.
 */
import { join } from "node:path";

import { type NeedRecord, type NeedStore, FileSystemNeedStore } from "./needStore";

function createDefaultNeedStore(): NeedStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemNeedStore(dir);
}

let _needStore: NeedStore | null = null;

/** The process-wide Need store. Lazily constructed on first call — importing
 *  this module does not touch the filesystem. */
export function needStore(): NeedStore {
  if (_needStore === null) _needStore = createDefaultNeedStore();
  return _needStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never call
 *  this from production code — same contract as `_setCanonEventStore`. */
export function _setNeedStore(store: NeedStore | null): void {
  _needStore = store;
}

/** The whole Need log, in canonical order (`inNeedOrder`). */
export async function loadNeeds(): Promise<NeedRecord[]> {
  return needStore().load();
}

/**
 * The real read path Marketplace uses: every persisted Need whose
 * `need.subject` exactly matches the given subject — an honest, checked
 * query, never a fabricated match. Returns an empty array (not an error)
 * when the subject has no Needs, or `subject` is undefined.
 */
export async function findNeedsForSubject(subject: string | undefined): Promise<NeedRecord[]> {
  if (subject === undefined) return [];
  const all = await loadNeeds();
  return all.filter((r) => r.need.subject === subject);
}
