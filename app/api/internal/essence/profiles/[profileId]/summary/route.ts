/**
 * Internal-only route: Essence summary for a given profile.
 *
 * Protected by a shared-secret bearer token (INTERNAL_ESSENCE_TOKEN).
 * Authorization is enforced via EssenceReadAPI — no direct repository access.
 * Caller must also declare the requesting agent via X-Essence-Actor.
 *
 * Security contract:
 *   - Token accepted only from the Authorization header (never query string).
 *   - Constant-time comparison to prevent timing attacks.
 *   - Fail closed: returns 403 when INTERNAL_ESSENCE_TOKEN is not configured.
 *   - Never logs token values.
 *   - 403 for all auth failures — no detail about which check failed.
 */

import { timingSafeEqual } from 'node:crypto';
import { EssenceReadService } from '@/app/lib/essence/read-service';
import { InMemoryEssenceRepository } from '@/app/lib/essence/in-memory-repository';
import { ACCESS_POLICIES } from '@/app/lib/essence/access';
import type { AgentName } from '@/app/lib/essence/access';

// Module-level singleton repository.
// Use _setRepository() in tests to inject a pre-seeded instance.
let _repo = new InMemoryEssenceRepository();
export function _setRepository(r: InMemoryEssenceRepository): void {
  _repo = r;
}

const VALID_ACTORS = new Set<AgentName>(Object.keys(ACCESS_POLICIES) as AgentName[]);

function forbidden(): Response {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
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

  const headers = req.headers;

  if (!checkToken(headers.get('authorization'))) {
    return forbidden();
  }

  const actor = headers.get('x-essence-actor') as AgentName | null;
  if (!actor || !VALID_ACTORS.has(actor)) {
    return forbidden();
  }

  const { profileId } = await ctx.params;
  const svc = new EssenceReadService(_repo.asReadRepository());

  try {
    const summary = await svc.getEssenceSummary(profileId, 'task_relevant', actor);
    return Response.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(msg)) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
