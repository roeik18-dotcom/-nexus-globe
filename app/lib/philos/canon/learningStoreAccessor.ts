/**
 * Philos Canon — LearningStore accessor (process-wide singleton). Mirrors
 * `effectStoreAccessor.ts` exactly, over `LearningStore`, at
 * `learnings.jsonl`.
 */
import { join } from "node:path";

import { type LearningRecord, type LearningStore, FileSystemLearningStore } from "./learningStore";

function createDefaultLearningStore(): LearningStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemLearningStore(dir);
}

let _learningStore: LearningStore | null = null;

export function learningStore(): LearningStore {
  if (_learningStore === null) _learningStore = createDefaultLearningStore();
  return _learningStore;
}

/** Test helper only — never call from production code. */
export function _setLearningStore(store: LearningStore | null): void {
  _learningStore = store;
}

export async function loadLearnings(): Promise<LearningRecord[]> {
  return learningStore().load();
}

/**
 * The real, explicit-link-only read: every persisted Learning whose
 * `learning.effect_ref` exactly equals the given Effect id — the ONLY way a
 * Learning is ever associated with an Effect in this codebase (EFFECT !=
 * LEARNING; never inferred by recorded_at proximity).
 */
export async function findLearningsForEffect(effectId: string | undefined): Promise<LearningRecord[]> {
  if (effectId === undefined) return [];
  const all = await loadLearnings();
  return all.filter((r) => r.learning.effect_ref === effectId);
}
