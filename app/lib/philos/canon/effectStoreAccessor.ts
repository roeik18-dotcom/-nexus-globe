/**
 * Philos Canon — EffectStore accessor (process-wide singleton). Mirrors
 * `actionStoreAccessor.ts` exactly, over `EffectStore`, at `effects.jsonl`.
 */
import { join } from "node:path";

import { type EffectRecord, type EffectStore, FileSystemEffectStore } from "./effectStore";

function createDefaultEffectStore(): EffectStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemEffectStore(dir);
}

let _effectStore: EffectStore | null = null;

export function effectStore(): EffectStore {
  if (_effectStore === null) _effectStore = createDefaultEffectStore();
  return _effectStore;
}

/** Test helper only — never call from production code. */
export function _setEffectStore(store: EffectStore | null): void {
  _effectStore = store;
}

export async function loadEffects(): Promise<EffectRecord[]> {
  return effectStore().load();
}

/**
 * The real, explicit-link-only read: every persisted Effect whose
 * `effect.action_ref` exactly equals the given Action id. This is the ONLY
 * way an Effect is ever associated with an Action anywhere in this codebase
 * — never by recorded_at proximity, never by subject-name matching alone
 * (CHRONOLOGY != CAUSALITY; ACTION != EFFECT).
 */
export async function findEffectsForAction(actionId: string | undefined): Promise<EffectRecord[]> {
  if (actionId === undefined) return [];
  const all = await loadEffects();
  return all.filter((r) => r.effect.action_ref === actionId);
}

/**
 * The real read path for a subject: every persisted Effect whose
 * `effect.subject` exactly matches — an honest, checked query.
 */
export async function findEffectsForSubject(subject: string | undefined): Promise<EffectRecord[]> {
  if (subject === undefined) return [];
  const all = await loadEffects();
  return all.filter((r) => r.effect.subject === subject);
}
