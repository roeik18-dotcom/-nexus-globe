/**
 * Philos Canon — the first read caller of `learningStore()`.
 *
 * `GET /api/canon/learnings` — lists real, persisted `Learning` records,
 * each carrying its own `delta: StateDelta | null` (`learningStore.ts`,
 * `learnings.jsonl`). Same auth/read-only discipline as `../actions/route.ts`.
 *
 * Optional `?effect_ref=` filters to Learnings whose `effect_ref` exactly
 * matches (`learningStoreAccessor.ts::findLearningsForEffect` — the same
 * explicit-link-only read `actionLifecycle.ts` uses, never a new filter).
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset
 *   200  body is `{ learnings: LearningRecord[] }`
 *   500  unexpected store failure
 */
import { timingSafeEqual } from "node:crypto";

import { findLearningsForEffect, loadLearnings } from "@/app/lib/philos/canon/learningStoreAccessor";

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

  const effectRef = new URL(request.url).searchParams.get("effect_ref");

  try {
    const learnings = effectRef !== null ? await findLearningsForEffect(effectRef) : await loadLearnings();
    return json({ learnings }, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
