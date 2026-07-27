/**
 * Internal-only route: create an Essence profile.
 *
 * Protected by a shared-secret bearer token (INTERNAL_ESSENCE_TOKEN).
 * Caller must also declare the requesting agent via X-Essence-Actor.
 *
 * HTTP contract:
 *   403  missing or invalid Authorization token (fail closed, no detail disclosed)
 *   400  missing or unknown X-Essence-Actor header, or malformed body
 *   201  profile created (first creation)
 *   200  profile already exists — idempotent, no overwrite (created: false)
 *   500  unexpected internal error
 *
 * Idempotency: creating an existing profile returns 200 + { created: false }.
 * The route never overwrites or resets an existing profile.
 *
 * Security contract (mirrors observe/route.ts and summary/route.ts):
 *   - Token accepted only from the Authorization header (never query string).
 *   - Constant-time comparison prevents timing attacks.
 *   - Fail closed: returns 403 when INTERNAL_ESSENCE_TOKEN is not configured.
 *   - Never logs token values or profile content.
 *
 * Profile shape: produced by createEmptyEssenceProfile() (domain factory in schema.ts).
 * The route never constructs a profile object directly.
 */

import { timingSafeEqual } from 'node:crypto';
import { getRepository, _setRepository } from '@/app/lib/essence/server-repository';
import { ACCESS_POLICIES } from '@/app/lib/essence/access';
import type { AgentName } from '@/app/lib/essence/access';

export { _setRepository };

const VALID_ACTORS = new Set<AgentName>(Object.keys(ACCESS_POLICIES) as AgentName[]);

function forbidden(): Response {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(detail: string): Response {
  return Response.json({ error: 'Bad Request', detail }, { status: 400 });
}

function checkToken(authHeader: string | null): boolean {
  const expected = process.env.INTERNAL_ESSENCE_TOKEN;
  if (!expected) return false;
  if (!authHeader?.startsWith('Bearer ')) return false;
  const provided = authHeader.slice(7);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  // Never accept credentials via query string.
  const url = new URL(req.url);
  if (url.searchParams.has('token')) {
    return forbidden();
  }

  if (!checkToken(req.headers.get('authorization'))) {
    return forbidden();
  }

  const actor = req.headers.get('x-essence-actor') as AgentName | null;
  if (!actor) {
    return badRequest('X-Essence-Actor header is required');
  }
  if (!VALID_ACTORS.has(actor)) {
    return badRequest(`Unknown actor: ${actor}`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest('Body must be a JSON object');
  }

  const { profileId } = body as Record<string, unknown>;
  if (typeof profileId !== 'string' || profileId.trim() === '') {
    return badRequest('profileId is required and must be a non-empty string');
  }

  try {
    const repo = getRepository();

    if (await repo.profileExists(profileId)) {
      return Response.json({ profileId, created: false }, { status: 200 });
    }

    await repo.createProfile(profileId);
    return Response.json({ profileId, created: true }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[profiles] createProfile failed:', msg);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
