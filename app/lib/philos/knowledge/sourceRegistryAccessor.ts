/**
 * PHILOS Knowledge — SourceRegistry accessor (process-wide singleton).
 *
 * Mirrors `needStoreAccessor.ts` in shape, but deliberately uses its OWN env
 * var / directory (`PHILOS_KNOWLEDGE_DATA_DIR`), never `CANON_DATA_DIR` —
 * a registered source is knowledge-layer metadata about a document, never a
 * canon `Observation`. Sharing a directory with canon would blur exactly the
 * distinction this pass's brief requires: KNOWLEDGE GRAPH (what PHILOS knows
 * about concepts/sources) vs LIVE STATE GRAPH (what PHILOS observed about a
 * person) must stay separate stores, not just separate types.
 */
import { join } from "node:path";

import { type SourceRecord, type SourceRegistryStore, type SourceStatus, FileSystemSourceRegistryStore } from "./sourceRegistry";

function createDefaultSourceRegistryStore(): SourceRegistryStore {
  const dir = process.env.PHILOS_KNOWLEDGE_DATA_DIR ?? join(process.cwd(), ".philos-knowledge-data");
  return new FileSystemSourceRegistryStore(dir);
}

let _sourceRegistryStore: SourceRegistryStore | null = null;

/** The process-wide source registry. Lazily constructed — importing this
 *  module does not touch the filesystem. */
export function sourceRegistryStore(): SourceRegistryStore {
  if (_sourceRegistryStore === null) _sourceRegistryStore = createDefaultSourceRegistryStore();
  return _sourceRegistryStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never call
 *  from production code — same contract as `_setNeedStore`. */
export function _setSourceRegistryStore(store: SourceRegistryStore | null): void {
  _sourceRegistryStore = store;
}

/** The whole source registry, in canonical order. */
export async function loadSources(): Promise<SourceRecord[]> {
  return sourceRegistryStore().load();
}

const REVIEW_QUEUE_STATUSES: ReadonlySet<SourceStatus> = new Set(["RAW_SOURCE", "REVIEW_REQUIRED", "CONTRADICTORY"]);

/**
 * Every registered source that has NOT yet been reviewed to a resolved
 * status (`CANONICAL`/`EXTERNAL_REFERENCE`/`HISTORICAL`/`SUPERSEDED` are all
 * resolved; `EXTRACTED` means Step 2 processed it but a human hasn't signed
 * off — also excluded here since it's past raw intake). A real, checked
 * query — never a fabricated "nothing pending" answer.
 */
export async function listReviewQueue(): Promise<SourceRecord[]> {
  const all = await loadSources();
  return all.filter((r) => REVIEW_QUEUE_STATUSES.has(r.status));
}
