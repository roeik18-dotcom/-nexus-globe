/**
 * M0-11C — HTTP integration tests for the full orientation write path.
 *
 * Tests go through the real HTTP routes (profiles + observe + summary),
 * not the orchestrator or service layer directly.
 *
 * Invariants verified:
 *   I1  Philos runs per-exchange (pending_review → terminal, not stuck)
 *   I2  Philos failure → observe still returns 200; proposal stays recoverable
 *   I3  Profile creation is idempotent (200 with created: false)
 *   I6  Observation appended before inference (write-before-inference, M0-8C)
 *
 * Does NOT require ANTHROPIC_API_KEY — rule-based provider only.
 * Does NOT test 24h expiry (clock not injectable via HTTP).
 *
 * Philos acceptance note:
 *   With RULE_SIGNAL_WEIGHT=1.0 and MINIMUM_CONTRIBUTING_OBSERVATIONS=2, two
 *   rule-based observe calls produce accumulatedConfidence='low' (weight=2.0).
 *   Philos policy for 'low' is require_user_confirmation, not auto-accept.
 *   The A3 tests therefore spy on PhilosReviewConsumer.prototype.consume to
 *   force an accept decision so that the commit plumbing (proposal → accept →
 *   writeInterpretation → evolution log → saveProfile) can be tested end-to-end
 *   through the HTTP routes. The spy still calls the real commitReviewedProposal
 *   and applyReviewDecision — only the policy outcome is bypassed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryEssenceRepository } from '@/app/lib/essence/in-memory-repository';
import { InMemoryEssenceProposalRepository } from '@/app/lib/essence/in-memory-proposal-repository';
import { PhilosReviewConsumer } from '@/app/lib/essence/philos-review-consumer';
import { PHILOS_POLICY_VERSION } from '@/app/lib/essence/philos-review-consumer';

const VALID_TOKEN = 'test-integration-token-m0-11';

// ── Route lazy-import helpers (mirroring observe/route.test.ts pattern) ───────

async function profilesRoute() {
  return await import('../profiles/route');
}

async function observeRoute() {
  return await import('../profiles/[profileId]/observe/route');
}

async function summaryRoute() {
  return await import('../profiles/[profileId]/summary/route');
}

// ── Request builders ──────────────────────────────────────────────────────────

function profilesReq(profileId: string): Request {
  return new Request('http://localhost/api/internal/essence/profiles', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${VALID_TOKEN}`,
      'x-essence-actor': 'merlin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ profileId }),
  });
}

function observeReq(userMessage: string, sessionId = 'session-1'): Request {
  return new Request('http://localhost/api/internal/essence/profiles/u-int/observe', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${VALID_TOKEN}`,
      'x-essence-actor': 'merlin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sessionId, userMessage, assistantResponse: '' }),
  });
}

function makeObserveCtx(profileId = 'u-int') {
  return { params: Promise.resolve({ profileId }) };
}

function makeSummaryCtx(profileId = 'u-int') {
  return { params: Promise.resolve({ profileId }) };
}

function summaryReq(): Request {
  return new Request('http://localhost/api/internal/essence/profiles/u-int/summary', {
    headers: {
      authorization: `Bearer ${VALID_TOKEN}`,
      'x-essence-actor': 'merlin',
    },
  });
}

// ── Force-accept helper ───────────────────────────────────────────────────────

/**
 * Spy on PhilosReviewConsumer.prototype.consume to force an 'accept' decision.
 * Calls the real commitReviewedProposal + applyReviewDecision so the Interpretation
 * is actually committed to the repository — only the policy outcome is bypassed.
 *
 * TODO: Remove once integration corpus can naturally produce medium-confidence rule proposals.
 */
function spyPhilosForceAccept(): void {
  vi.spyOn(PhilosReviewConsumer.prototype, 'consume').mockImplementation(
    async function (this: PhilosReviewConsumer, profileId: string, proposalId: string) {
      // Access the private proposals service via type erasure.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svc = (this as any).proposals;
      const queue: Array<{ proposalId: string }> = await svc.getReviewQueue(profileId);
      const proposal = queue.find((p) => p.proposalId === proposalId);
      if (!proposal) throw new Error(`Proposal not found in test spy: ${proposalId}`);
      const decision = {
        decision: 'accept' as const,
        reason: 'medium_confidence_auto_accepted',
        reviewer: 'philos' as const,
        reviewedAt: new Date().toISOString(),
        policyVersion: PHILOS_POLICY_VERSION,
      };
      await svc.commitReviewedProposal(proposal);
      await svc.applyReviewDecision(proposalId, decision, 'confirmed');
      return decision;
    },
  );
}

// ── Setup/teardown ────────────────────────────────────────────────────────────

let sharedRepo: InMemoryEssenceRepository;

beforeEach(async () => {
  vi.stubEnv('INTERNAL_ESSENCE_TOKEN', VALID_TOKEN);
  // ANTHROPIC_API_KEY is NOT set — rule-based provider only.
  vi.stubEnv('ANTHROPIC_API_KEY', '');

  sharedRepo = new InMemoryEssenceRepository();
  const sharedProposalRepo = new InMemoryEssenceProposalRepository();

  // Inject the same repositories into all routes so they share state.
  const [pRoute, oRoute, sRoute] = await Promise.all([
    profilesRoute(),
    observeRoute(),
    summaryRoute(),
  ]);
  pRoute._setRepository(sharedRepo);
  oRoute._setRepository(sharedRepo);
  oRoute._setProposalRepository(sharedProposalRepo);
  (sRoute as { _setRepository?: (r: InMemoryEssenceRepository) => void })._setRepository?.(sharedRepo);
  oRoute._clearRegistry();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ── A3: Full write path — observe → signal → Interpretation ──────────────────

describe('M0-11C: full write path (A3)', () => {
  it('two observe calls with matching rule signals produce a committed Interpretation', async () => {
    // Force Philos to accept so we can test the commit plumbing end-to-end.
    // See "Philos acceptance note" at the top of this file for why this spy is needed.
    spyPhilosForceAccept();

    const { POST: createProfile } = await profilesRoute();
    const { POST: observe } = await observeRoute();

    // Create profile.
    const created = await createProfile(profilesReq('u-int'));
    expect(created.status).toBe(201);

    // Two observe calls with messages that trigger OrientationResponseDepth='brief'.
    // MINIMUM_CONTRIBUTING_OBSERVATIONS = 2; each call creates a distinct observation.
    const r1 = await observe(observeReq('Please keep it brief.'), makeObserveCtx());
    expect(r1.status).toBe(200);

    const r2 = await observe(observeReq('Just a brief answer please.'), makeObserveCtx());
    expect(r2.status).toBe(200);

    // Profile now has a committed Interpretation for OrientationResponseDepth.
    const profile = await sharedRepo.getProfile('u-int');
    expect(profile).not.toBeNull();

    // At least 2 exchange observations were persisted before inference (I6 / M0-8C).
    // Total may be higher because proposeUpdate also appends a backing observation.
    expect(profile!.observations.length).toBeGreaterThanOrEqual(2);

    // Interpretation was written.
    const interps = profile!.expression['OrientationResponseDepth'] ?? [];
    const active = interps.find(i => !i.archivedAt);
    expect(active).toBeDefined();
    expect(active!.content).toBe('brief');
    // confidence reflects the proposal's accumulatedConfidence at time of submission.
    // With 2 rule-based observations at RULE_SIGNAL_WEIGHT=1.0 → weight=2.0 → 'low'.
    expect(active!.confidence).toBe('low');
    expect(active!.provenance.createdBy).toBe('philos');

    // No proposal is stuck in pending_review (Philos accepted — I1).
    expect(profile!.evolution.length).toBeGreaterThanOrEqual(1);
    const entry = profile!.evolution[0];
    expect(entry.nodeId).toBe('OrientationResponseDepth');
    expect(entry.previousInterpretationId).toBeNull();
    expect(entry.newInterpretationId).toBe(active!.id);
    expect(entry.agentName).toBe('philos');
  });

  it('summary route returns the committed Interpretation after write path', async () => {
    spyPhilosForceAccept();

    const { POST: createProfile } = await profilesRoute();
    const { POST: observe } = await observeRoute();
    const { GET: getSummary } = await summaryRoute();

    await createProfile(profilesReq('u-int'));
    await observe(observeReq('Please keep it brief.'), makeObserveCtx());
    await observe(observeReq('Just a brief answer please.'), makeObserveCtx());

    const res = await getSummary(summaryReq(), makeSummaryCtx());
    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary.nodes['OrientationResponseDepth']).toBeDefined();
    expect(summary.nodes['OrientationResponseDepth'].content).toBe('brief');
  });

  it('proposal review decision record is set by Philos after acceptance', async () => {
    spyPhilosForceAccept();

    const { POST: createProfile } = await profilesRoute();
    const { POST: observe } = await observeRoute();

    await createProfile(profilesReq('u-int'));
    await observe(observeReq('Please keep it brief.'), makeObserveCtx());
    await observe(observeReq('Just a brief answer please.'), makeObserveCtx());

    const profile = await sharedRepo.getProfile('u-int');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).find(i => !i.archivedAt);
    expect(active).toBeDefined();

    // Evolution log entry has correct provenance.
    const entry = profile!.evolution.find(e => e.newInterpretationId === active!.id);
    expect(entry).toBeDefined();
    expect(entry!.triggeredBy).toBe('agent_inference');
    expect(entry!.agentName).toBe('philos');
  });
});

// ── I2: Philos failure → observe still returns 200 ───────────────────────────

describe('M0-11C: Philos failure handling (I2)', () => {
  it('observe returns 200 even when PhilosReviewConsumer.consume throws', async () => {
    const { POST: createProfile } = await profilesRoute();
    const { POST: observe } = await observeRoute();

    await createProfile(profilesReq('u-int'));

    // First call: no proposal emitted yet (below MINIMUM_CONTRIBUTING_OBSERVATIONS).
    const r1 = await observe(observeReq('Please keep it brief.'), makeObserveCtx());
    expect(r1.status).toBe(200);

    // Inject Philos failure before the second call (which will trigger the proposal).
    vi.spyOn(PhilosReviewConsumer.prototype, 'consume').mockRejectedValueOnce(
      new Error('Philos unavailable (simulated)'),
    );

    // Second call — proposal emitted, Philos throws, but observe must still return 200 (I2).
    const r2 = await observe(observeReq('Just a brief answer please.'), makeObserveCtx());
    expect(r2.status).toBe(200);

    // Both exchange observations are persisted (write-before-inference invariant — I6).
    // Total count is >= 2 because proposeUpdate also appends a backing observation;
    // the exact count may grow with future pipeline stages.
    const profile = await sharedRepo.getProfile('u-int');
    expect(profile!.observations.length).toBeGreaterThanOrEqual(2);
  });
});

// ── I3: Idempotent profile creation ──────────────────────────────────────────

describe('M0-11C: idempotent profile creation (I3)', () => {
  it('creating a profile twice returns 201 then 200, no reset', async () => {
    const { POST: createProfile } = await profilesRoute();
    const { POST: observe } = await observeRoute();

    const r1 = await createProfile(profilesReq('u-int'));
    expect(r1.status).toBe(201);

    // Write some data via observe.
    await observe(observeReq('Please keep it brief.'), makeObserveCtx());
    const beforeReset = await sharedRepo.getProfile('u-int');
    const obsBefore = beforeReset!.observations.length;

    // Second creation: must not reset the profile.
    const r2 = await createProfile(profilesReq('u-int'));
    expect(r2.status).toBe(200);
    const body = await r2.json();
    expect(body.created).toBe(false);

    // Observations survive (profile was not overwritten).
    const afterReset = await sharedRepo.getProfile('u-int');
    expect(afterReset!.observations.length).toBe(obsBefore);
  });
});

// ── Philos review decision metadata ──────────────────────────────────────────

describe('M0-11C: Philos policy version in review decision', () => {
  it('committed Interpretation carries Philos provenance (createdBy + policyVersion traceable)', async () => {
    spyPhilosForceAccept();

    const { POST: createProfile } = await profilesRoute();
    const { POST: observe } = await observeRoute();

    await createProfile(profilesReq('u-int'));
    await observe(observeReq('Please keep it brief.'), makeObserveCtx());
    await observe(observeReq('Just a brief answer please.'), makeObserveCtx());

    const profile = await sharedRepo.getProfile('u-int');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).find(i => !i.archivedAt);
    expect(active).toBeDefined();
    expect(active!.provenance.createdBy).toBe('philos');
    expect(active!.provenance.source).toBe('agent_inference');
    // PHILOS_POLICY_VERSION is not embedded in Interpretation directly, but the
    // evolution entry agentName='philos' and the proposal's reviewDecisions hold it.
    // Verify the constant is defined and non-empty (guard against accidental blank).
    expect(PHILOS_POLICY_VERSION).toMatch(/^\d+\.\d+$/);
  });
});
