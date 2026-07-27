/**
 * Internal-only route: Essence summary for a given profile.
 *
 * Protected by a shared-secret bearer token (INTERNAL_ESSENCE_TOKEN).
 * Authorization is enforced via EssenceReadAPI — no direct repository access.
 * Caller must also declare the requesting agent via X-Essence-Actor.
 *
 * HTTP contract:
 *   403  missing or invalid Authorization token (fail closed, no detail disclosed)
 *   400  missing or unknown X-Essence-Actor header (malformed request)
 *   404  profile does not exist
 *
 * Security contract:
 *   - Token accepted only from the Authorization header (never query string).
 *   - Constant-time comparison prevents timing attacks.
 *   - Fail closed: returns 403 when INTERNAL_ESSENCE_TOKEN is not configured server-side.
 *   - Never logs token values.
 *
 * Response shape — MerlinEssenceContext (transport DTO):
 *   Derived from EssenceSummary but excludes conflict metadata, pending proposals,
 *   and internal policy fields that Merlin does not need.
 */

import { timingSafeEqual } from 'node:crypto';
import { EssenceReadService } from '@/app/lib/essence/read-service';
import { getRepository, _setRepository } from '@/app/lib/essence/server-repository';
import { ACCESS_POLICIES } from '@/app/lib/essence/access';
import type { AgentName } from '@/app/lib/essence/access';
import type { EssenceSummary } from '@/app/lib/essence/api';

export { _setRepository };

const VALID_ACTORS = new Set<AgentName>(Object.keys(ACCESS_POLICIES) as AgentName[]);

/**
 * Transport DTO returned to callers.
 * Explicitly excludes unresolvedConflictCount, conflict details, and pending proposals.
 */
export type MerlinEssenceContext = Omit<EssenceSummary, 'unresolvedConflictCount'>;

function toMerlinContext(summary: EssenceSummary): MerlinEssenceContext {
  const { unresolvedConflictCount: _dropped, ...rest } = summary;
  return rest;
}

function forbidden(): Response {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(detail: string): Response {
  return Response.json({ error: 'Bad Request', detail }, { status: 400 });
}

function checkToken(authHeader: string | null): boolean {
  const expected = process.env.INTERNAL_ESSENCE_TOKEN;
  if (!expected) return false; // fail closed when not configured on the server
  if (!authHeader?.startsWith('Bearer ')) return false;
  const provided = authHeader.slice(7);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Run a dummy compare when lengths differ so length itself is not a timing oracle.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ profileId: string }> },
): Promise<Response> {
  // Never accept credentials via query string.
  const url = new URL(req.url);
  if (url.searchParams.has('token')) {
    return forbidden();
  }

  // Auth check: missing or invalid token → 403.
  if (!checkToken(req.headers.get('authorization'))) {
    return forbidden();
  }

  // Actor check: malformed or unknown → 400 (bad request, not auth failure).
  const actor = req.headers.get('x-essence-actor') as AgentName | null;
  if (!actor) {
    return badRequest('X-Essence-Actor header is required');
  }
  if (!VALID_ACTORS.has(actor)) {
    return badRequest(`Unknown actor: ${actor}`);
  }

  const { profileId } = await ctx.params;
  const svc = new EssenceReadService(getRepository());

  try {
    const summary = await svc.getEssenceSummary(profileId, 'task_relevant', actor);
    return Response.json(toMerlinContext(summary));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(msg)) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
