/**
 * Philos Canon — the FIRST authenticated read caller of `canonEventStore()`.
 *
 * Completes the write → persistence → read vertical slice: `route.ts`
 * (sibling, `POST`) writes a `CanonEvent<Observation>`; this route reads one
 * back by its `canon_event_id`. No other capability — no listing, no
 * filtering by subject/domain/frame, no derivation. `cell-state/route.ts`
 * (sibling directory) is the next, separate read edge (persisted Observation
 * → CellState candidate); this file does not import it and does not import
 * `cellStateDerivation.ts` at all.
 *
 * **A deliberately SEPARATE credential from the write path.** `POST`'s
 * `CANON_INGEST_TOKEN` and this route's `CANON_READ_TOKEN` are two different
 * env vars, checked independently. Reasoning: least privilege — a leaked
 * read credential must not grant write access, and vice versa. This is a
 * new choice this pass, not a reuse of the write token; same fail-closed,
 * constant-time-comparison shape as `route.ts::authorized`, duplicated
 * rather than shared, matching this directory's existing convention of each
 * route owning its own auth check inline (see `route.ts`,
 * `.../observe/route.ts`, `.../summary/route.ts` — none of them import a
 * shared auth helper either).
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset (fail closed)
 *   404  no canon event with this `canon_event_id` exists
 *   200  body is the stored `CanonEvent` verbatim (`{ event }`, same envelope
 *        shape as `POST`'s 201 response)
 *   500  unexpected store failure (e.g. corrupt log)
 *
 * **Scope boundaries, held exactly, same as every file in this directory:**
 * explicit read of one persisted event only — no inference, no
 * CellState/Need/Target/Offer/Matching/Action/Transfer/Effect/Learning
 * generation, no projection, no Dynamics, no UI, no Merlin, no n8n, no
 * Nexus, no legacy `EventType` touched, no legacy store import. This file
 * imports nothing from `../../route.ts` either — the two routes share no
 * code, only the same underlying accessor.
 */

import { timingSafeEqual } from "node:crypto";

import { canonEventStore } from "@/app/lib/philos/canon/canonEventStoreAccessor";

/** Constant-time bearer check. Fails closed when the secret is not configured. */
function authorized(request: Request): boolean {
  const expected = process.env.CANON_READ_TOKEN;
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

export async function GET(
  request: Request,
  ctx: { params: Promise<{ canonEventId: string }> },
): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const { canonEventId } = await ctx.params;

  try {
    const events = await canonEventStore().load();
    const found = events.find((e) => e.canon_event_id === canonEventId);
    if (!found) return json({ error: "not_found" }, 404);
    return json({ event: found }, 200);
  } catch {
    // Never leak internals (e.g. filesystem paths) to the caller.
    return json({ error: "read_failed" }, 500);
  }
}
