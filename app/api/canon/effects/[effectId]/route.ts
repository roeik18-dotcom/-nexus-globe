/**
 * Philos Canon — read one persisted `Effect` by `effect_id`.
 * Sibling of `../route.ts` (list); same auth/read-only discipline.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset
 *   404  no Effect with this `effect_id` exists
 *   200  body is `{ effect: EffectRecord }`
 *   500  unexpected store failure
 */
import { timingSafeEqual } from "node:crypto";

import { loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";

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
  ctx: { params: Promise<{ effectId: string }> },
): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const { effectId } = await ctx.params;

  try {
    const effects = await loadEffects();
    const found = effects.find((r) => r.effect.effect_id === effectId);
    if (!found) return json({ error: "not_found" }, 404);
    return json({ effect: found }, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
