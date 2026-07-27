/**
 * Internal-only route: record a voice exchange and run orientation inference.
 *
 * Protected by a shared-secret bearer token (INTERNAL_ESSENCE_TOKEN).
 * Caller must also declare the requesting agent via X-Essence-Actor.
 *
 * HTTP contract:
 *   403  missing or invalid Authorization token (fail closed, no detail disclosed)
 *   400  missing or unknown X-Essence-Actor header, or malformed body
 *   404  profile does not exist
 *   200  inference succeeded — body is OrientationInferenceReport
 *   500  inference failed (write already committed; Python caller ignores this)
 *
 * Processing order (M0-8C invariant):
 *   1. Auth + actor validation
 *   2. Profile existence check
 *   3. Append Observation to the profile (write before inference)
 *   4. Re-read post-append profile
 *   5. Get-or-create per-session OrientationInferenceOrchestrator
 *   6. processExchange() → OrientationInferenceReport
 *
 * Security contract (mirrors summary/route.ts):
 *   - Token accepted only from the Authorization header (never query string).
 *   - Constant-time comparison prevents timing attacks.
 *   - Fail closed: returns 403 when INTERNAL_ESSENCE_TOKEN is not configured.
 *   - Never logs token values, exchange content, or raw profile content.
 */

import { timingSafeEqual, randomUUID } from 'node:crypto';
import { getRepository, _setRepository } from '@/app/lib/essence/server-repository';
import { ACCESS_POLICIES } from '@/app/lib/essence/access';
import { RuleBasedOrientationProvider } from '@/app/lib/essence/orientation-rule-provider';
import { LLMOrientationProvider } from '@/app/lib/essence/orientation-llm-provider';
import { CompositeOrientationProvider } from '@/app/lib/essence/orientation-composite-provider';
import { OrientationInferenceOrchestrator } from '@/app/lib/essence/orientation-orchestrator';
import { EssenceProposalService } from '@/app/lib/essence/proposal-service';
import { PipelineRunner, systemClock } from '@/app/lib/essence/pipeline-runner';
import { PhilosReviewConsumer } from '@/app/lib/essence/philos-review-consumer';
import { getOrCreate, _clearRegistry } from '@/app/lib/essence/orientation-session-registry';
import type { AgentName } from '@/app/lib/essence/access';
import type { OrientationInferenceProvider } from '@/app/lib/essence/orientation-inference';
import type { OrientationInferenceReport } from '@/app/lib/essence/orientation-integration';

// Re-export test helpers so tests can import from the route (mirroring summary/route.ts).
export { _setRepository, _clearRegistry };

const VALID_ACTORS = new Set<AgentName>(Object.keys(ACCESS_POLICIES) as AgentName[]);

/**
 * Fixed inference identity for this route.
 *
 * X-Essence-Actor controls authorization (which agents may call this endpoint).
 * Inference provenance — inferredBy, proposedBy, recordedBy — is always Merlin.
 * The two concerns must not be conflated: trusting the header for provenance would
 * let any authorized caller claim a different agent's identity in the human model.
 */
const OBSERVE_ACTOR: AgentName = 'merlin';

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ profileId: string }> },
): Promise<Response> {
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

  const { profileId } = await ctx.params;
  const repo = getRepository();

  if (!(await repo.profileExists(profileId))) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Parse and validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest('Body must be a JSON object');
  }

  const { sessionId, userMessage, assistantResponse } = body as Record<string, unknown>;

  if (typeof sessionId !== 'string' || !sessionId) {
    return badRequest('sessionId is required');
  }
  if (typeof userMessage !== 'string' || !userMessage) {
    return badRequest('userMessage is required');
  }
  if (typeof assistantResponse !== 'string') {
    return badRequest('assistantResponse is required');
  }

  // Append Observation before inference (M0-8C invariant: write first).
  const observationId = randomUUID();
  await repo.appendObservation(profileId, {
    id:                      observationId,
    source:                  'agent_inference',
    recordedBy:              'merlin',
    content:                 userMessage,
    sessionId,
    observedAt:              new Date().toISOString(),
    evidenceIds:             [],
    correctsObservationId:   null,
  });

  // Re-read post-append profile so the observation exists for the accumulator.
  const profile = await repo.getProfile(profileId);
  if (!profile) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }

  // Get-or-create stateful per-session orchestrator.
  // Co-construct EssenceProposalService + PhilosReviewConsumer inside the factory so
  // they share the same proposalRecords Map (M0-11A / I4).
  // Provider list is also built inside the factory — config is session-scoped, not
  // per-request, so it is safe to read env at factory-call time.
  // Registry is process-scoped (no TTL eviction — see orientation-session-registry.ts TODO).
  const orchestrator = getOrCreate(sessionId, () => {
    const providers: OrientationInferenceProvider[] = [new RuleBasedOrientationProvider(OBSERVE_ACTOR)];
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push(new LLMOrientationProvider(OBSERVE_ACTOR));
    }
    const svc = new EssenceProposalService(getRepository(), new PipelineRunner());
    const philos = new PhilosReviewConsumer(svc);
    return new OrientationInferenceOrchestrator(
      new CompositeOrientationProvider(providers),
      svc,
      OBSERVE_ACTOR,
      systemClock,
      philos,
    );
  });

  // Run inference. On failure, return 500 — the observation write is already committed.
  // The Python caller (fire-and-forget) ignores non-2xx responses.
  let report: OrientationInferenceReport;
  try {
    report = await orchestrator.processExchange(
      {
        sessionId,
        profileId,
        exchange: { userMessage, assistantResponse },
        sessionObservationId: observationId,
      },
      profile,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[observe] orientation inference failed:', msg);
    return Response.json({ error: 'Inference failed' }, { status: 500 });
  }

  return Response.json(report);
}
