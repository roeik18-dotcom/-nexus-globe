/**
 * Internal Essence observe route — auth, actor validation, body validation,
 * profile resolution, and 200/500 response contract.
 *
 * HTTP contract under test:
 *   403  missing or invalid Authorization token
 *   400  missing or unknown X-Essence-Actor, or malformed body
 *   404  profile does not exist
 *   200  valid request + existing profile → OrientationInferenceReport
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryEssenceRepository } from '@/app/lib/essence/in-memory-repository';

const VALID_TOKEN = 'test-internal-token-xyz';

// Helpers ─────────────────────────────────────────────────────────────────────

function makeRequest(opts: {
  token?: string | null;
  actor?: string | null;
  body?: unknown;
  searchParams?: Record<string, string>;
} = {}): Request {
  const url = new URL('http://localhost/api/internal/essence/profiles/u1/observe');
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) url.searchParams.set(k, v);
  }
  const headers = new Headers();
  if (opts.token !== undefined && opts.token !== null) {
    headers.set('authorization', `Bearer ${opts.token}`);
  }
  if (opts.actor !== undefined && opts.actor !== null) {
    headers.set('x-essence-actor', opts.actor);
  }
  if (opts.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(url, {
    method: 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function makeCtx(profileId = 'u1') {
  return { params: Promise.resolve({ profileId }) };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId:         'session-1',
    userMessage:       'Help me understand this.',
    assistantResponse: 'Sure, here is an explanation.',
    ...overrides,
  };
}

// Lazy-import so module is shared across tests (Vitest module cache).
async function route() {
  return await import('../route');
}

// Tests ───────────────────────────────────────────────────────────────────────

describe('POST /api/internal/essence/profiles/[profileId]/observe', () => {
  beforeEach(async () => {
    vi.stubEnv('INTERNAL_ESSENCE_TOKEN', VALID_TOKEN);
    const { _setRepository, _clearRegistry } = await route();
    _setRepository(new InMemoryEssenceRepository());
    _clearRegistry();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Token auth → 403 ───────────────────────────────────────────────────────

  it('returns 403 when Authorization header is absent', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ actor: 'merlin', body: validBody() }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is wrong', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: 'wrong-token', actor: 'merlin', body: validBody() }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is empty string', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: '', actor: 'merlin', body: validBody() }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is passed as query parameter instead of header', async () => {
    const { POST } = await route();
    const res = await POST(
      makeRequest({ actor: 'merlin', body: validBody(), searchParams: { token: VALID_TOKEN } }),
      makeCtx(),
    );
    expect(res.status).toBe(403);
  });

  it('fails closed (403) when INTERNAL_ESSENCE_TOKEN is not set on the server', async () => {
    vi.unstubAllEnvs();
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody() }), makeCtx());
    expect(res.status).toBe(403);
  });

  // ── Actor validation → 400 ─────────────────────────────────────────────────

  it('returns 400 when X-Essence-Actor header is absent', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, body: validBody() }), makeCtx());
    expect(res.status).toBe(400);
  });

  it('returns 400 when X-Essence-Actor is an unknown agent name', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'skynet', body: validBody() }), makeCtx());
    expect(res.status).toBe(400);
  });

  // ── Profile resolution → 404 ───────────────────────────────────────────────

  it('returns 404 when the profile does not exist', async () => {
    const { POST } = await route();
    const res = await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody() }),
      makeCtx('missing'),
    );
    expect(res.status).toBe(404);
  });

  // ── Body validation → 400 ─────────────────────────────────────────────────

  it('returns 400 when body is missing sessionId', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody({ sessionId: undefined }) }),
      makeCtx(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing userMessage', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody({ userMessage: undefined }) }),
      makeCtx(),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing assistantResponse', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody({ assistantResponse: undefined }) }),
      makeCtx(),
    );
    expect(res.status).toBe(400);
  });

  // ── Successful response → 200 ──────────────────────────────────────────────

  it('returns 200 with OrientationInferenceReport for valid request', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody() }),
      makeCtx(),
    );
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.profileId).toBe('u1');
    expect(body.sessionId).toBe('session-1');
    expect(typeof body.sessionObservationId).toBe('string');
    expect(Array.isArray(body.results)).toBe(true);
    expect(typeof body.processedAt).toBe('string');
  });

  it('appends an Observation to the profile before running inference', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody() }),
      makeCtx(),
    );

    const profile = await repo.getProfile('u1');
    expect(profile?.observations).toHaveLength(1);
    expect(profile?.observations[0].recordedBy).toBe('merlin');
    expect(profile?.observations[0].source).toBe('agent_inference');
    expect(profile?.observations[0].sessionId).toBe('session-1');
  });

  it('report.sessionObservationId matches the appended Observation id', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await POST(
      makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody() }),
      makeCtx(),
    );
    const body = await res.json() as { sessionObservationId: string };

    const profile = await repo.getProfile('u1');
    expect(body.sessionObservationId).toBe(profile?.observations[0].id);
  });

  it('returns suppressed results when userMessage contains no orientation phrases', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await POST(
      makeRequest({
        token: VALID_TOKEN,
        actor: 'merlin',
        body: validBody({ userMessage: 'What is the weather today?' }),
      }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it('reuses the same orchestrator across multiple calls for the same sessionId', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const makeCall = () =>
      POST(
        makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: validBody() }),
        makeCtx(),
      );

    // Two calls with the same sessionId must both succeed (shared orchestrator).
    const res1 = await makeCall();
    const res2 = await makeCall();
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
