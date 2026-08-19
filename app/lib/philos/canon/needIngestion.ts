/**
 * Philos Canon — the ONE canonical Need ingestion implementation.
 *
 * Mirrors `observationIngestion.ts::ingestObservation` exactly: takes a
 * FULLY EXPLICIT `NeedRecord` (`need`, `recorded_at`, `status` all caller-
 * supplied), validates via `checkNeedAppend`'s own `validateNeed` gate, and
 * appends through `store` — never mints `need.need_id`, never stamps
 * `recorded_at`, never defaults `status`. Minting/stamping/defaulting is an
 * explicit-acceptance boundary's job (a future HTTP route, a Hub form
 * submission, a Merlin capability) — not this core function's, exactly the
 * same division `observationIngestion.ts` already draws for Observation.
 *
 * **This is the "explicit acceptance/write semantics" the CRITICAL rule
 * requires.** Nothing calls this function automatically from an Observation.
 * A future "suggested candidate" feature may PROPOSE field values for a
 * human to review, but persistence only ever happens through this one
 * explicit call, with a caller-supplied, complete `Need` object — never a
 * silent derivation.
 */
import {
  checkNeedAppend,
  NeedAppendRejectedError,
  type NeedAppendRejection,
  type NeedRecord,
  type NeedStore,
} from "./needStore";
import { needStore } from "./needStoreAccessor";
import type { NeedError } from "./need";

export type IngestNeedResult =
  | { ok: true; need_id: string; record: NeedRecord }
  | { ok: false; reason: "invalid"; errors: NeedError[] }
  | { ok: false; reason: "rejected"; rejections: readonly NeedAppendRejection[] };

/**
 * Validates the complete, caller-supplied `NeedRecord`, appends it through
 * `store` (defaulting to the process-wide `needStore()` singleton), and
 * reports what happened as a typed result — never throws for an ordinary
 * validation or duplicate-id rejection, only for a genuinely unexpected
 * store error.
 */
export async function ingestNeed(
  record: NeedRecord,
  store: NeedStore = needStore(),
): Promise<IngestNeedResult> {
  const validation = checkNeedAppend([], [record]);
  if (!validation.ok) {
    const invalidRejection = validation.rejections.find((r) => r.code === "invalid_need");
    if (invalidRejection?.errors) {
      return { ok: false, reason: "invalid", errors: invalidRejection.errors };
    }
    // A structural problem checkNeedAppend can catch even against an empty
    // "stored" baseline (e.g. ambiguous_recorded_at) — surfaced the same way.
    return { ok: false, reason: "rejected", rejections: validation.rejections };
  }

  try {
    const [stored] = await store.append([record]);
    return { ok: true, need_id: stored.need.need_id, record: stored };
  } catch (err) {
    if (err instanceof NeedAppendRejectedError) {
      return { ok: false, reason: "rejected", rejections: err.rejections };
    }
    throw err;
  }
}
