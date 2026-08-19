/**
 * Philos Canon — ActionStore accessor (process-wide singleton).
 *
 * Mirrors `needStoreAccessor.ts` exactly in shape, over `ActionStore`
 * instead of `NeedStore`. Same `CANON_DATA_DIR` directory (same canon
 * vocabulary), different file (`actions.jsonl`), separate store instance and
 * singleton — the three logs never share a byte of live state.
 */
import { join } from "node:path";

import { type ActionRecord, type ActionStore, FileSystemActionStore } from "./actionStore";

function createDefaultActionStore(): ActionStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemActionStore(dir);
}

let _actionStore: ActionStore | null = null;

/** The process-wide Action store. Lazily constructed on first call —
 *  importing this module does not touch the filesystem. */
export function actionStore(): ActionStore {
  if (_actionStore === null) _actionStore = createDefaultActionStore();
  return _actionStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never call
 *  this from production code — same contract as `_setNeedStore`. */
export function _setActionStore(store: ActionStore | null): void {
  _actionStore = store;
}

/** The whole Action log, in canonical order (`inActionOrder`). */
export async function loadActions(): Promise<ActionRecord[]> {
  return actionStore().load();
}

/**
 * The real read path: every persisted Action whose `action.owner` (ACTOR)
 * exactly matches the given subject — an honest, checked query, never a
 * fabricated match. Returns an empty array (not an error) when the subject
 * has no Actions, or `subject` is undefined.
 */
export async function findActionsForActor(subject: string | undefined): Promise<ActionRecord[]> {
  if (subject === undefined) return [];
  const all = await loadActions();
  return all.filter((r) => r.action.owner === subject);
}
