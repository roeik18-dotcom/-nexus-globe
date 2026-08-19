/**
 * Philos Canon — the ONE canonical Offer ingestion implementation.
 * Mirrors `needIngestion.ts::ingestNeed` exactly: takes a FULLY EXPLICIT
 * `OfferRecord` (`offer`, `recorded_at` both caller-supplied), validates
 * via `checkOfferAppend`'s own `validateOffer` gate, and appends through
 * `store` — never mints `offer.offer_id`, never stamps `recorded_at`.
 */
import {
  checkOfferAppend,
  OfferAppendRejectedError,
  type OfferAppendRejection,
  type OfferRecord,
  type OfferStore,
} from "./offerStore";
import { offerStore } from "./offerStoreAccessor";
import type { OfferError } from "./offer";

export type IngestOfferResult =
  | { ok: true; offer_id: string; record: OfferRecord }
  | { ok: false; reason: "invalid"; errors: OfferError[] }
  | { ok: false; reason: "rejected"; rejections: readonly OfferAppendRejection[] };

/**
 * Validates the complete, caller-supplied `OfferRecord`, appends it
 * through `store` (defaulting to the process-wide `offerStore()`
 * singleton), and reports what happened as a typed result — never throws
 * for an ordinary validation or duplicate-id rejection.
 */
export async function ingestOffer(record: OfferRecord, store: OfferStore = offerStore()): Promise<IngestOfferResult> {
  const validation = checkOfferAppend([], [record]);
  if (!validation.ok) {
    const invalidRejection = validation.rejections.find((r) => r.code === "invalid_offer");
    if (invalidRejection?.errors) {
      return { ok: false, reason: "invalid", errors: invalidRejection.errors };
    }
    return { ok: false, reason: "rejected", rejections: validation.rejections };
  }

  try {
    const [stored] = await store.append([record]);
    return { ok: true, offer_id: stored.offer.offer_id, record: stored };
  } catch (err) {
    if (err instanceof OfferAppendRejectedError) {
      return { ok: false, reason: "rejected", rejections: err.rejections };
    }
    throw err;
  }
}

// Structural check re-exported for callers that want to validate before
// attempting a write (same convenience `needIngestion.ts` provides).
export { checkOfferAppend };
