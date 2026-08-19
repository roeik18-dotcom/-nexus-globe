/**
 * Philos Canon — read one persisted `Learning` by `learning_id`.
 * Sibling of `../route.ts` (list); same auth/read-only discipline.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset
 *   404  no Learning with this `learning_id` exists
 *   200  body is `{ learning: LearningRecord }` — `delta` is `null` for a
 *        real `no_update` Learning (see `learningStore.ts` header), never
 *        omitted.
 *   500  unexpected store failure
 */
import { timingSafeEqual } from "node:crypto";

import { loadLearnings } from "@/app/lib/philos/canon/learningStoreAccessor";

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
  ctx: { params: Promise<{ learningId: string }> },
): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const { learningId } = await ctx.params;

  try {
    const learnings = await loadLearnings();
    const found = learnings.find((r) => r.learning.learning_id === learningId);
    if (!found) return json({ error: "not_found" }, 404);
    return json({ learning: found }, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
