/**
 * Internal Essence summary route — auth, actor validation, profile resolution.
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

// Lazy-import the route module so we can control the env before it resolves.
// Vitest caches modules, so _setRepository calls persist across the test file.
async function route() {
  return await import('../route');
}

// Tests ───────────────────────────────────────────────────────────────────────

describe('GET /api/internal/essence/profiles/[profileId]/summary', () => {
  beforeEach(async () => {
    vi.stubEnv('INTERNAL_ESSENCE_TOKEN', VALID_TOKEN);
    // Reset the repository to an empty state before each test.
    const { _setRepository } = await route();
    _setRepository(new InMemoryEssenceRepository());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Token auth ──────────────────────────────────────────────────────────────

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
    vi.unstubAllEnvs(); // remove the token set in beforeEach
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx());
    expect(res.status).toBe(403);
  });

  // ── Actor validation ────────────────────────────────────────────────────────

  it('returns 403 when X-Essence-Actor header is absent', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN }), makeCtx());
    expect(res.status).toBe(403);
  });

  it('returns 403 when X-Essence-Actor is an unknown agent name', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'skynet' }), makeCtx());
    expect(res.status).toBe(403);
  });

  // ── Profile resolution ──────────────────────────────────────────────────────

  it('returns 404 when the profile does not exist', async () => {
    const { GET } = await route();
    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('missing'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with summary for valid token and existing profile', async () => {
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

  it('summary nodes are filtered to task_relevant layers by EssenceReadService', async () => {
    const { GET, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    const profile = await repo.createProfile('u1');

    // Add an interpretation in an aspirations-layer node (Merlin cannot read aspirations)
    profile.aspirations['Aspirations_Becoming'] = [
      makeInterpretation({ layer: 'aspirations', nodeId: 'Aspirations_Becoming' }),
    ];
    // Add a readable expression-layer node
    profile.expression['Preferences'] = [makeInterpretation()];
    await repo.saveProfile(profile);
    _setRepository(repo);

    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('u1'));
    expect(res.status).toBe(200);
    const body = await res.json() as { nodes: Record<string, unknown> };
    expect(body.nodes['Preferences']).toBeDefined();
    expect(body.nodes['Aspirations_Becoming']).toBeUndefined();
  });

  // ── Response does not expose internal conflicts ─────────────────────────────

  it('unresolvedConflictCount is a number but individual conflicts are not returned', async () => {
    const { GET, _setRepository } = await route();
    const repo = new InMemoryEssenceRepository();
    await repo.createProfile('u1');
    _setRepository(repo);

    const res = await GET(makeRequest({ token: VALID_TOKEN, actor: 'merlin' }), makeCtx('u1'));
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.unresolvedConflictCount).toBe('number');
    expect(body.conflicts).toBeUndefined();
  });
});
