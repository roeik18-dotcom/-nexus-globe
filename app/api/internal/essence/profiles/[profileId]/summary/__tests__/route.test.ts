/**
 * Internal Essence summary route — auth, actor validation, DTO shape, profile resolution.
 *
 * HTTP contract under test:
 *   403  missing or invalid Authorization token
 *   400  missing or unknown X-Essence-Actor
 *   404  profile does not exist
 *   200  valid token + valid actor + existing profile
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryEssenceRepository } from '@/app/lib/essence/in-memory-repository';
import type { Interpretation } from '@/app/lib/essence/schema';

const VALID_TOKEN = 'test-internal-token-xyz';

// Helpers ─────────────────────────────────────────────────────────────────────

function makeRequest(opts: {
  token?: string | null;
  actor?: string | null;
  searchParams?: Record<string, string>;
} = {}): Request {
  const url = new URL('http://localhost/api/internal/essence/profiles/u1/summary');
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
  return new Request(url, { method: 'GET', headers });
}

function makeCtx(profileId = 'u1') {
  return { params: Promise.resolve({ profileId }) };
}

function makeInterpretation(overrides: Partial<Interpretation> = {}): Interpretation {
  const now = new Date().toISOString();
  return {
    id: 'interp-test',
    version: 1,
    nodeId: 'Preferences',
    layer: 'expression',
    stabilityClass: 'Adaptive',
    content: 'dark mode',
    observationIds: [],
    confidence: 'medium',
    interpretationKind: 'probable_interpretation',
    provenance: {
      source: 'agent_inference',
      confidence: 'medium',
      createdBy: 'merlin',
      firstObservedAt: now,
      lastConfirmedAt: now,
      lastUpdatedAt: now,
      evidenceIds: [],
      conflictingInterpretationIds: [],
    },
    sensitivity: 'personal',
    temporalKind: 'trait',
    stateScope: null,
    expiresAt: null,
    archivedAt: null,
    conflictIds: [],
    evidenceStatus: 'referenced',
    ...overrides,
  };
}

// Lazy-import so module is shared across tests (Vitest module cache).
async function route() {
  return await import('../route');
}

// Tests ───────────────────────────────────────────────────────────────────────

describe('GET /api/internal/essence/profiles/[profileId]/summary', () => {
  beforeEach(async () => {
    vi.stubEnv('INTERNAL_ESSENCE_TOKEN', VALID_TOKEN);
    const { _setRepository } = await route();
    _setRepository(new InMemoryEssenceRepository());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Token auth → 403 ───────────────────────────────────────────────────────

  it('returns 403 when Authorization header is absent', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ actor: 'merlin' }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is wrong', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: 'wrong-token', actor: 'merlin' }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is empty string', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: '', actor: 'merlin' }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is passed as query parameter instead of header', async () => {
    const { GET } = await route();
    const res = await GET(
      makeRequest({ actor: 'merlin', searchParams: { token: VALID_TOKEN } }),
      makeCtx(),
    );
    expect(res.status).toBe(403);
  });

  it('fails closed (403) when INTERNAL_ESSENCE_TOKEN is not set on the server', async () => {
    vi.unstubAllEnvs();
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx());
    expect(res.status).toBe(403);
  });

  // ── Actor validation → 400 ─────────────────────────────────────────────────

  it('returns 400 when X-Essence-Actor header is absent', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN }), makeCtx());
    expect(res.status).toBe(400);
  });

  it('returns 400 when X-Essence-Actor is an unknown agent name', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'skynet' }), makeCtx());
    expect(res.status).toBe(400);
  });

  // ── Profile resolution → 404 ───────────────────────────────────────────────

  it('returns 404 when the profile does not exist', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('missing'));
    expect(res.status).toBe(404);
  });

  // ── Successful response → 200 ──────────────────────────────────────────────

  it('returns 200 with DTO fields for valid token and existing profile', async () => {
    const { GET, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('u1'));
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    expect(body.profileId).toBe('u1');
    expect(body.retrievalMode).toBe('task_relevant');
    expect(typeof body.retrievedAt).toBe('string');
  });

  // ── Transport DTO — conflict metadata excluded ─────────────────────────────

  it('response does not include unresolvedConflictCount', async () => {
    const { GET, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('u1'));
    const body = await res.json() as Record<string, unknown>;
    expect(body.unresolvedConflictCount).toBeUndefined();
  });

  it('response does not include conflicts array', async () => {
    const { GET, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('u1'));
    const body = await res.json() as Record<string, unknown>;
    expect(body.conflicts).toBeUndefined();
  });

  // ── Layer filtering via EssenceReadService ─────────────────────────────────

  it('summary nodes respect task_relevant mode — aspirations layer excluded', async () => {
    const { GET, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');

    profile.aspirations['Aspirations_Becoming'] = [
      makeInterpretation({ layer: 'aspirations', nodeId: 'Aspirations_Becoming' }),
    ];
    profile.expression['Preferences'] = [makeInterpretation()];
    await repo.saveProfile(profile);
    _setRepository(repo);

    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('u1'));
    expect(res.status).toBe(200);
    const body = await res.json() as { nodes: Record<string, unknown> };
    expect(body.nodes['Preferences']).toBeDefined();
    expect(body.nodes['Aspirations_Becoming']).toBeUndefined();
  });
});
