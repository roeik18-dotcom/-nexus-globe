/**
 * Philos Canon — the first read caller of `actionStore()`.
 *
 * `GET /api/canon/actions` — lists real, persisted `Action` records
 * (`actionStore.ts`, `actions.jsonl`). Same auth shape, same `json()` helper,
 * same fail-closed discipline as every sibling read route in this directory
 * (`observations/[canonEventId]/route.ts`, `.../cell-state/route.ts`) — each
 * owns its own inline auth check, duplicated rather than shared, matching
 * this directory's existing convention.
 *
 * Optional `?owner=` query filters to Actions whose `owner` (ACTOR) exactly
 * matches — delegates to `actionStoreAccessor.ts::findActionsForActor`, the
 * one real, checked per-subject read already established there, never a new
 * filter implementation. Omitted, the full log is returned in stored order.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset (fail closed)
 *   200  body is `{ actions: ActionRecord[] }`
 *   500  unexpected store failure (e.g. corrupt log)
 *
 * **Read-only, by construction.** No `POST` is exported here — write access
 * to the Action store stays `actionLifecycle.ts::recordAction` (in-process
 * callers only, e.g. `/hub` server actions), not yet exposed over HTTP. See
 * `PHILOS-PRODUCT-MASTER-LEDGER.md` for why a write endpoint is deliberately
 * out of scope this pass.
 */
import { timingSafeEqual } from "node:crypto";

import { findActionsForActor, loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";

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
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const owner = new URL(request.url).searchParams.get("owner");

  try {
    const actions = owner !== null ? await findActionsForActor(owner) : await loadActions();
    return json({ actions }, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
