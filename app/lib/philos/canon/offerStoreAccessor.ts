/**
 * OfferStore accessor (process-wide singleton). Mirrors
 * `needStoreAccessor.ts` exactly in shape. Reuses the SAME `CANON_DATA_DIR`
 * directory as the canon Need/Observation stores, writes to a DIFFERENT
 * FILE (`offers.jsonl`), via a completely separate store instance.
 */
import { join } from "node:path";

import { type OfferRecord, type OfferStore, FileSystemOfferStore } from "./offerStore";

function createDefaultOfferStore(): OfferStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemOfferStore(dir);
}

let _offerStore: OfferStore | null = null;

export function offerStore(): OfferStore {
  if (_offerStore === null) _offerStore = createDefaultOfferStore();
  return _offerStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never call
 *  this from production code. */
export function _setOfferStore(store: OfferStore | null): void {
  _offerStore = store;
}

/** The whole Offer log, in canonical order. */
export async function loadOffers(): Promise<OfferRecord[]> {
  return offerStore().load();
}

/** Every real persisted Offer whose `offer.source` exactly matches the
 *  given subject — an honest, checked query, never a fabricated match.
 *  Mirrors `findNeedsForSubject`'s exact contract. */
export async function findOffersForSource(source: string | undefined): Promise<OfferRecord[]> {
  if (source === undefined) return [];
  const all = await loadOffers();
  return all.filter((r) => r.offer.source === source);
}
