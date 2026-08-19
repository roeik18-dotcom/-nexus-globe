/**
 * Philos Canon — DomainStateStore accessor (process-wide singleton).
 *
 * Mirrors `needStoreAccessor.ts` exactly in shape. Same `CANON_DATA_DIR`
 * directory as every other real canon store, own file
 * (`domain-states.jsonl`), own singleton — never shares live state with
 * `needs.jsonl`/`canon-events.jsonl`/any other store.
 */
import { join } from "node:path";

import { type DomainStateRecord, type DomainStateStore, FileSystemDomainStateStore } from "./domainStateStore";

function createDefaultDomainStateStore(): DomainStateStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemDomainStateStore(dir);
}

let _domainStateStore: DomainStateStore | null = null;

/** The process-wide DomainState store. Lazily constructed on first call —
 *  importing this module does not touch the filesystem. */
export function domainStateStore(): DomainStateStore {
  if (_domainStateStore === null) _domainStateStore = createDefaultDomainStateStore();
  return _domainStateStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never
 *  call this from production code — same contract as `_setNeedStore`. */
export function _setDomainStateStore(store: DomainStateStore | null): void {
  _domainStateStore = store;
}

/** The whole DomainState log, in chronological order. */
export async function loadDomainStates(): Promise<DomainStateRecord[]> {
  return domainStateStore().load();
}

/** Every persisted DomainState whose `state.subject` exactly matches the
 *  given subject — an honest, checked query, never a fabricated match.
 *  Returns an empty array (not an error) when the subject has none, or
 *  `subject` is undefined. */
export async function findDomainStatesForSubject(subject: string | undefined): Promise<DomainStateRecord[]> {
  if (subject === undefined) return [];
  const all = await loadDomainStates();
  return all.filter((r) => r.state.subject === subject);
}
