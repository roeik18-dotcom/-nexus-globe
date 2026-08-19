/**
 * Philos Canon — the first read caller of `effectStore()`.
 *
 * `GET /api/canon/effects` — lists real, persisted `Effect` records
 * (`effectStore.ts`, `effects.jsonl`). Same auth/read-only discipline as
 * `../actions/route.ts`.
 *
 * Optional `?action_ref=` filters to Effects whose `action_ref` exactly
 * matches (`effectStoreAccessor.ts::findEffectsForAction` — the same
 * explicit-link-only read `actionLifecycle.ts` itself uses, never a new
 * filter). Optional `?subject=` filters via `findEffectsForSubject`. If both
 * are supplied, `action_ref` takes precedence (the stricter, explicit-link
 * query) — `subject` is not additionally applied on top, to avoid silently
 * implying an AND semantics this route does not actually compute.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset
 *   200  body is `{ effects: EffectRecord[] }`
 *   500  unexpected store failure
 */
import { timingSafeEqual } from "node:crypto";

import {
  findEffectsForAction,
  findEffectsForSubject,
  loadEffects,
} from "@/app/lib/philos/canon/effectStoreAccessor";

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

  const params = new URL(request.url).searchParams;
  const actionRef = params.get("action_ref");
  const subject = params.get("subject");

  try {
    const effects = actionRef !== null
      ? await findEffectsForAction(actionRef)
      : subject !== null
        ? await findEffectsForSubject(subject)
        : await loadEffects();
    return json({ effects }, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
