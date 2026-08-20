/**
 * NeedGroupLinkStore accessor (process-wide singleton). Mirrors
 * `personCommunityLinkStoreAccessor.ts` exactly. Same `CANON_DATA_DIR`
 * directory as the canon stores — canon-adjacent data, same deployment
 * concern — but its OWN file, via its OWN store instance, so the logs never
 * share live state.
 */
import { join } from "node:path";

import type { NeedGroupLink } from "./needGroupLink";
import { FileSystemNeedGroupLinkStore, type NeedGroupLinkStore } from "./needGroupLinkStore";

function createDefaultStore(): NeedGroupLinkStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemNeedGroupLinkStore(dir);
}

let _store: NeedGroupLinkStore | null = null;

export function needGroupLinkStore(): NeedGroupLinkStore {
  if (_store === null) _store = createDefaultStore();
  return _store;
}

/** Test helper — never call from production code. */
export function _setNeedGroupLinkStore(store: NeedGroupLinkStore | null): void {
  _store = store;
}

export async function loadNeedGroupLinks(): Promise<NeedGroupLink[]> {
  return needGroupLinkStore().load();
}
