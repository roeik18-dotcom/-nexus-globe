/**
 * Philos Canon — read one persisted `Action` by `action_id`.
 * Sibling of `../route.ts` (list); same auth, same `json()` helper, same
 * fail-closed discipline as `observations/[canonEventId]/route.ts`.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset (fail closed)
 *   404  no Action with this `action_id` exists
 *   200  body is `{ action: ActionRecord }`
 *   500  unexpected store failure
 */
import { timingSafeEqual } from "node:crypto";

import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";

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

export async function GET(
  request: Request,
  ctx: { params: Promise<{ actionId: string }> },
): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const { actionId } = await ctx.params;

  try {
    const actions = await loadActions();
    const found = actions.find((r) => r.action.action_id === actionId);
    if (!found) return json({ error: "not_found" }, 404);
    return json({ action: found }, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
