/**
 * Philos Canon — the FIRST live caller of `canonEventStore()`.
 *
 * Internal-only route: accept ONE explicit `Observation` and append it to the
 * canon event log through the process-wide accessor
 * (`app/lib/philos/canon/canonEventStoreAccessor.ts::canonEventStore`).
 *
 * **What was read first, this pass** (all re-confirmed, none modified):
 *   - `canonEventStoreAccessor.ts` — lazy singleton, `CANON_DATA_DIR`, default
 *     `.philos-canon-data` (SIBLING of `.philos-data`), `_setCanonEventStore`
 *     as the sanctioned test seam. Its header stated "No wiring into any live
 *     route this pass … 'A real caller' reaching it is future, separately-
 *     approved work." This file is exactly that approved caller, and nothing
 *     more.
 *   - `canonEvent.ts` — `CanonEvent { canon_event_id, canon_type: "observation",
 *     payload: Observation, recorded_at }`; `"observation"` is the only
 *     `CanonType`.
 *   - `canonEventStore.ts` — `append()` throws `CanonAppendRejectedError`
 *     carrying EVERY rejection (`duplicate_canon_event_id`,
 *     `canon_event_id_already_stored`, `invalid_canon_event`, …).
 *   - `observation.ts` — `validateObservation` → `{ valid, errors }`.
 *   - `app/api/internal/essence/profiles/[profileId]/observe/route.ts` — read
 *     for house security conventions only (bearer token in the Authorization
 *     header, `timingSafeEqual`, fail-closed when the secret is unconfigured,
 *     never log secrets or payload content). Mirrored in shape, NOT reused.
 *
 * **Why a NEW route instead of extending the existing `…/observe` route —
 * a THIRD documented naming collision, deliberately not merged:**
 * that endpoint's "Observation" is the ESSENCE orientation concept (a voice
 * exchange appended to an Essence profile, then run through orientation
 * inference). Canon's `Observation` (§6) is a measurement of a 3×3 cell. They
 * share a word and nothing else. Folding canon into that live route would
 * conflate two unrelated models, couple canon ingestion to Essence's auth and
 * to `INTERNAL_ESSENCE_TOKEN`, and put canon writes on a path that also runs
 * inference/proposals. So — exactly as `canonEvent.ts` documents the
 * `Domain`/`Transfer` collisions rather than resolving them — this collision is
 * recorded here and the two paths stay separate. That route is unmodified.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_INGEST_TOKEN` unset (fail closed)
 *   400  malformed body, or `validateObservation` failed  → ZERO persistence
 *   409  store refused the append (duplicate id, or invalid canon event)
 *   201  appended — body is the stored `CanonEvent`
 *   500  unexpected store failure (e.g. corrupt log)
 *
 * **Order (validation strictly before any persistence):**
 *   1. auth  2. parse body  3. `validateObservation`  4. build `CanonEvent`
 *   5. `ingestObservation(event, canonEventStore())`
 * `ingestObservation` is not reached unless 1–4 all pass, so a rejected
 * request writes nothing — no file is created, no line is added.
 *
 * **Reconciliation pass note**: this route used to call
 * `canonEventStore().append()` directly — a second, independent append
 * implementation alongside `canon/actions.ts::recordObservationAction`'s own.
 * Both now delegate to the ONE canonical ingestion function,
 * `canon/observationIngestion.ts::ingestObservation`. This route still owns
 * minting `canon_event_id` (via `randomUUID()`, when omitted) and stamping
 * `recorded_at` — `ingestObservation` never does either — so this route's
 * own id/timestamp authority and idempotency contract (below) are
 * unchanged; only the append call itself moved.
 *
 * **Idempotency is explicit, never inferred.** The caller MAY supply
 * `canon_event_id`; re-POSTing the same id is refused by the store
 * (`canon_event_id_already_stored`) and surfaces as 409 — the caller's own
 * de-duplication key. If it is omitted a fresh UUID is generated, and the
 * request is therefore NOT idempotent by construction; that is stated here
 * rather than silently assumed either way.
 *
 * **Scope boundaries, held exactly:** explicit Observation input only — no
 * inference of any kind; no CellState/Need/Target/Offer/Matching/Action/
 * Transfer/Effect/Learning generation; no projection; no Dynamics; no UI; no
 * Merlin; no n8n; no Nexus; no legacy `EventType` touched; no legacy event
 * written; legacy (`philos-event-store.ts`) and canon stores remain entirely
 * separate — this file imports nothing from the legacy store.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";

import type { CanonEvent } from "@/app/lib/philos/canon/canonEvent";
import { canonEventStore } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { ingestObservation } from "@/app/lib/philos/canon/observationIngestion";
import type { Observation } from "@/app/lib/philos/canon/observation";
import { validateObservation } from "@/app/lib/philos/canon/observation";

/** Constant-time bearer check. Fails closed when the secret is not configured. */
function authorized(request: Request): boolean {
  const expected = process.env.CANON_INGEST_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const presented = Buffer.from(header.slice(prefix.length));
  const secret = Buffer.from(expected);
  if (presented.length !== secret.length) return false;
  return timingSafeEqual(presented, secret);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth — no detail disclosed on failure.
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  // 2. Body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "malformed_body" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ error: "malformed_body" }, 400);
  }

  const { observation, canon_event_id: suppliedId } = body as {
    observation?: unknown;
    canon_event_id?: unknown;
  };
  if (typeof observation !== "object" || observation === null || Array.isArray(observation)) {
    return json({ error: "malformed_body", detail: "observation must be an object" }, 400);
  }
  if (suppliedId !== undefined && (typeof suppliedId !== "string" || suppliedId.trim() === "")) {
    return json({ error: "malformed_body", detail: "canon_event_id must be a non-empty string" }, 400);
  }

  // 3. Canon validation — BEFORE any store call, so a failure persists nothing.
  const candidate = observation as Observation;
  const validation = validateObservation(candidate);
  if (!validation.valid) {
    return json({ error: "invalid_observation", errors: validation.errors }, 400);
  }

  // 4. Event-shape the measurement. `recorded_at` is when this record was
  //    created — deliberately distinct from `payload.time` (canon §6/§8).
  const event: CanonEvent = {
    canon_event_id: suppliedId ?? randomUUID(),
    canon_type: "observation",
    payload: candidate,
    recorded_at: new Date().toISOString(),
  };

  // 5. Delegate to the one canonical ingestion function — this route no
  //    longer appends to CanonEventStore directly.
  try {
    const result = await ingestObservation(event, canonEventStore());
    if (result.ok) return json({ event: result.event }, 201);
    if (result.reason === "invalid") {
      return json({ error: "invalid_observation", errors: result.errors }, 400);
    }
    return json({ error: "append_rejected", rejections: result.rejections }, 409);
  } catch {
    // Never leak internals (e.g. filesystem paths) to the caller.
    return json({ error: "append_failed" }, 500);
  }
}
