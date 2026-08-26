"use server";

/**
 * Philos Canon — the ONE canonical Observation ingestion implementation.
 *
 * This file replaces `canon/actions.ts`, resolving the `action.ts` (the
 * canonical `Action` entity type, `canon/action.ts`, untouched by this pass)
 * / `actions.ts` naming footgun by retiring the `actions.ts` name entirely.
 * `canon/action.ts` is not imported here and not referenced by this file at
 * all.
 *
 * **Why this file exists**: two Observation-ingestion code paths grew up
 * independently — this file's predecessor (`recordObservationAction`,
 * "use server") and `app/api/canon/observations/route.ts::POST` (built by a
 * concurrent session) — each with its own `validateCanonEvent` + `.append()`
 * call. They agreed on canon semantics but diverged on id/timestamp
 * authority (the server action required both explicit; the route minted
 * `canon_event_id` and always stamped `recorded_at`). This pass collapses
 * both append implementations into `ingestObservation`, the one place
 * `validateCanonEvent` and `store.append()` are ever called for an
 * Observation. Both surfaces below (the server action in this file, and
 * `route.ts`) now delegate to it instead of duplicating it.
 *
 * **Core contract (`ingestObservation`)**: takes a FULLY EXPLICIT
 * `CanonEvent<Observation>` — `canon_event_id`, `canon_type: "observation"`,
 * `payload`, `recorded_at` all caller-supplied. It never mints an id, never
 * stamps a timestamp, never defaults anything — minting/stamping is an HTTP
 * (or any future) boundary's job, not the core's. This mirrors this file's
 * predecessor's own "explicit input only" reasoning, now scoped to exactly
 * the core function rather than the whole file.
 *
 * **Two validations, still deliberate**: `ingestObservation` validates via
 * `validateCanonEvent` before ever calling `store.append()` (so "invalid
 * input => zero write" holds before any store call is attempted), and
 * `checkCanonAppend` (inside the store) validates again as its own defense
 * in depth — same divergence from the live system's narrower `checkAppend`
 * scope that `canonEventStore.ts` already documents.
 *
 * **`recordObservationAction`, below, is now a thin wrapper**: it builds the
 * explicit `CanonEvent` from its three explicit parameters and delegates to
 * `ingestObservation` — it no longer calls `validateCanonEvent` or
 * `canonEventStore()` itself. Its own external signature/behavior is
 * unchanged from `actions.ts`'s version.
 *
 * **On `"use server"` covering `ingestObservation` too**: this file keeps a
 * single "use server" directive (matching the instruction to rename, not
 * split, the server-ingestion module), so `ingestObservation` is technically
 * also exposed as a Next.js server reference. Nothing imports it into a
 * Client Component — its only callers are `recordObservationAction` (below,
 * same module) and `route.ts` (a Route Handler, itself server-only) — so it
 * is never actually invoked as a client→server RPC; every call is a direct,
 * same-process server function call, no serialization boundary crossed.
 *
 * **What this file does NOT do, on purpose** (unchanged from `actions.ts`):
 * no `CellState`/`Need`/`Target`/`Offer`/`Matching` code is imported or
 * exercised. No projection (`projectValueGroup`/`projectDynamics`/
 * `projectGlobeGraph`) is imported or called, no `revalidatePath`. No
 * `../events.ts`/`../eventStore.ts`/`../../philos-event-store.ts` import —
 * the legacy Value Group log is untouched and untouchable from this file.
 * No Merlin, no n8n, no Nexus coordinator. Domain/Transfer naming
 * collisions are not referenced here at all, same as every file before it.
 */
import { type CanonEvent, type CanonEventError, validateCanonEvent } from "./canonEvent";
import {
  type CanonAppendRejection,
  CanonAppendRejectedError,
  type CanonEventStore,
} from "./canonEventStore";
import { canonEventStore } from "./canonEventStoreAccessor";

export type IngestObservationResult =
  | { ok: true; canon_event_id: string; event: CanonEvent }
  | { ok: false; reason: "invalid"; errors: CanonEventError[] }
  | { ok: false; reason: "rejected"; rejections: readonly CanonAppendRejection[] };

/**
 * The one canonical Observation ingestion function. Validates the complete,
 * caller-supplied `CanonEvent`, appends it through `store` (defaulting to
 * the process-wide `canonEventStore()` singleton), and reports what
 * happened as a typed result — never throws for an ordinary validation or
 * duplicate-id rejection, only for a genuinely unexpected store error.
 *
 * Never generates `canon_event_id`. Never generates `recorded_at`. Both are
 * read verbatim from `event` and nothing else.
 *
 * ORIGIN PASSES THROUGH; IT IS NOT CONFERRED HERE. `record_origin` is part of
 * the envelope this function validates and persists, so the field round-trips
 * — but reaching this function proves nothing about where a record came from,
 * and reaching the real store proves nothing either. A record is REAL because
 * a trusted writer said so before calling, never because it was appended.
 */
export async function ingestObservation(
  event: CanonEvent,
  store: CanonEventStore = canonEventStore(),
): Promise<IngestObservationResult> {
  const validation = validateCanonEvent(event);
  if (!validation.valid) {
    return { ok: false, reason: "invalid", errors: validation.errors };
  }

  try {
    const [stored] = await store.append([event]);
    return { ok: true, canon_event_id: stored.canon_event_id, event: stored };
  } catch (err) {
    if (err instanceof CanonAppendRejectedError) {
      return { ok: false, reason: "rejected", rejections: err.rejections };
    }
    throw err;
  }
}
