/**
 * POST /api/internal/essence/profiles — profile creation endpoint (M0-11B).
 *
 * HTTP contract:
 *   403  missing or invalid token, or token passed via query string
 *   400  missing/unknown X-Essence-Actor, or malformed body, or invalid profileId
 *   200  profile already exists — idempotent (created: false)
 *   201  profile created (created: true)
 *   500  unexpected internal error
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryEssenceRepository } from '@/app/lib/essence/in-memory-repository';

const VALID_TOKEN = 'test-profile-token-xyz';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(opts: {
  token?: string | null;
  actor?: string | null;
  body?: unknown;
  searchParams?: Record<string, string>;
} = {}): Request {
  const url = new URL('http://localhost/api/internal/essence/profiles');
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

async function route() {
  return await import('../route');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/internal/essence/profiles', () => {
  beforeEach(async () => {
    vi.stubEnv('INTERNAL_ESSENCE_TOKEN', VALID_TOKEN);
    const { _setRepository } = await route();
    _setRepository(new InMemoryEssenceRepository());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Token auth → 403 ──────────────────────────────────────────────────────

  it('returns 403 when Authorization header is absent', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ actor: 'merlin', body: { profileId: 'u1' } }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is wrong', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: 'wrong', actor: 'merlin', body: { profileId: 'u1' } }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is passed as query parameter', async () => {
    const { POST } = await route();
    const res = await POST(
      makeRequest({ actor: 'merlin', body: { profileId: 'u1' }, searchParams: { token: VALID_TOKEN } }),
    );
    expect(res.status).toBe(403);
  });

  it('fails closed (403) when INTERNAL_ESSENCE_TOKEN is not set', async () => {
    vi.unstubAllEnvs();
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u1' } }));
    expect(res.status).toBe(403);
  });

  // ── Actor validation → 400 ────────────────────────────────────────────────

  it('returns 400 when X-Essence-Actor is absent', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, body: { profileId: 'u1' } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when X-Essence-Actor is unknown', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'skynet', body: { profileId: 'u1' } }));
    expect(res.status).toBe(400);
  });

  // ── Body validation → 400 ─────────────────────────────────────────────────

  it('returns 400 when body is not valid JSON', async () => {
    const { POST } = await route();
    const url = new URL('http://localhost/api/internal/essence/profiles');
    const headers = new Headers({
      authorization: `Bearer ${VALID_TOKEN}`,
      'x-essence-actor': 'merlin',
      'content-type': 'application/json',
    });
    const res = await POST(new Request(url, { method: 'POST', headers, body: 'not-json' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when profileId is missing', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when profileId is an empty string', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: '' } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when profileId is whitespace only', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: '   ' } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when profileId is not a string', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 42 } }));
    expect(res.status).toBe(400);
  });

  // ── Creation → 201 ────────────────────────────────────────────────────────

  it('returns 201 with created: true on first creation', async () => {
    const { POST } = await route();
    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u-new' } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.profileId).toBe('u-new');
    expect(body.created).toBe(true);
  });

  it('profile is retrievable after creation', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    _setRepository(repo);

    await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u-check' } }));
    expect(await repo.profileExists('u-check')).toBe(true);
    const profile = await repo.getProfile('u-check');
    expect(profile?.profileId).toBe('u-check');
    expect(profile?.schemaVersion).toBe('1');
  });

  // ── Idempotency → 200 ─────────────────────────────────────────────────────

  it('returns 200 with created: false when profile already exists', async () => {
    const { POST } = await route();
    await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u-idem' } }));

    const res = await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u-idem' } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profileId).toBe('u-idem');
    expect(body.created).toBe(false);
  });

  it('idempotent creation does not overwrite existing observations or interpretations', async () => {
    const { POST, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    _setRepository(repo);

    await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u-safe' } }));

    // Append an observation directly — simulates data written after profile creation.
    await repo.appendObservation('u-safe', {
      id: 'obs-existing',
      source: 'agent_inference',
      recordedBy: 'merlin',
      content: 'some observation',
      sessionId: null,
      observedAt: new Date().toISOString(),
      evidenceIds: [],
      correctsObservationId: null,
    });

    // Second creation call must not reset the profile.
    await POST(makeRequest({ token: VALID_TOKEN, actor: 'merlin', body: { profileId: 'u-safe' } }));

    const profile = await repo.getProfile('u-safe');
    expect(profile!.observations.some(o => o.id === 'obs-existing')).toBe(true);
  });

  // ── Body is a plain JSON object ───────────────────────────────────────────

  it('returns 400 when body is a JSON array', async () => {
    const { POST } = await route();
    const url = new URL('http://localhost/api/internal/essence/profiles');
    const headers = new Headers({
      authorization: `Bearer ${VALID_TOKEN}`,
      'x-essence-actor': 'merlin',
      'content-type': 'application/json',
    });
    const res = await POST(new Request(url, { method: 'POST', headers, body: '[]' }));
    expect(res.status).toBe(400);
  });
});
