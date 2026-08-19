/**
 * Philos Canon — the FIRST live HTTP caller of `deriveCellStateForPersistedObservation`.
 *
 * Reads one persisted `CanonEvent<Observation>` by id and returns the
 * single-Observation `CellState` candidate `cellStateDerivation.ts` already
 * proved deterministic — never a store, never an aggregate, never a second
 * `canon_type`. This is the minimum safe read-side edge for canonical
 * runtime consumption named by this pass's own priority list: expose the
 * ALREADY-BUILT, ALREADY-TESTED derivation function over HTTP, add no new
 * derivation logic here.
 *
 * **Why `asOf` is a required query parameter, never a server-side `Date.now()`
 * default**: `deriveCellStateFromObservation`/`deriveCellStateForPersistedObservation`
 * (`cellStateDerivation.ts`) are pure functions with no clock of their own —
 * "matching every other pure function in this directory," per that file's
 * own header. Defaulting `asOf` to the server's wall clock here would make
 * this endpoint's output depend on wall-clock time, non-reproducible, and a
 * silent behavioral difference from the tested function signature. The
 * caller states `asOf` explicitly, exactly as every test of the underlying
 * function already does.
 *
 * **Same separate read credential as the sibling route** (`../route.ts`):
 * `CANON_READ_TOKEN`, checked independently, fail-closed, same shape —
 * duplicated inline rather than shared, matching this directory's existing
 * per-route auth convention.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset (fail closed)
 *   400  `asOf` query param missing or unparseable/no explicit offset
 *   404  no canon event with this `canon_event_id` exists
 *   200  body is `{ kind: "cell_state", candidate, provenance }` or
 *        `{ kind: "no_derivation", reason }` — a "no derivation" outcome
 *        (`zero_confidence`, `expired`, `canon_event_invalid`) is a
 *        successful read that correctly reports no CellState is derivable;
 *        it is not a request error, so it is still 200, not 4xx/5xx.
 *   500  unexpected store failure (e.g. corrupt log)
 *
 * **Scope boundaries, held exactly**: this route computes nothing itself —
 * every field in the response is produced by `deriveCellStateFromObservation`,
 * unmodified. No Need/Target/Offer/Matching/Action/Transfer/Effect/Learning
 * generation, no Tension/Deficit inference, no multi-observation
 * aggregation (this endpoint addresses exactly one persisted event, chosen
 * by explicit `canon_event_id`, never "latest for a subject/cell"). No
 * projection, no Dynamics, no UI, no Merlin, no n8n, no Nexus, no legacy
 * event store import.
 */

import { timingSafeEqual } from "node:crypto";

import { canonEventStore } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { deriveCellStateFromObservation } from "@/app/lib/philos/canon/cellStateDerivation";

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
  const asOf = new URL(request.url).searchParams.get("asOf");

  try {
    const events = await canonEventStore().load();
    const found = events.find((e) => e.canon_event_id === canonEventId);
    if (!found) return json({ error: "not_found" }, 404);

    const result = deriveCellStateFromObservation(found, asOf ?? "");

    if (result.kind === "no_derivation" && result.reason === "as_of_unparseable") {
      return json(
        { error: "invalid_as_of", detail: "asOf must be an ISO 8601 instant with an explicit offset" },
        400,
      );
    }

    return json(result, 200);
  } catch {
    // Never leak internals (e.g. filesystem paths) to the caller.
    return json({ error: "read_failed" }, 500);
  }
}
