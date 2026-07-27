/**
 * M0-13D — In-Flight Proposal Persistence: restart invariant tests.
 *
 * Main acceptance scenario:
 *   instance A creates a pending proposal
 *   → instance A terminates (simulated by constructing a fresh repo from the same dataDir)
 *   → instance B opens the same data directory
 *   → loads the same proposal
 *   → Philos consumes it
 *   → Interpretation committed once
 *   → proposal reaches terminal state once
 *
 * Also covers:
 *   D1  Double-consume after restart is idempotent (Interpretation not duplicated)
 *   D2  Terminal proposals are never reopened
 *   D3  P2 invariant: reviewDecisions is append-only across restarts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemEssenceRepository } from '../../essence-fs-repository';
import { FileSystemEssenceProposalRepository } from '../../essence-proposal-fs-repository';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { PipelineRunner } from '../pipeline-runner';
import type { Observation } from '../schema';

let dataDir: string;

function freshInstances() {
  const repo = new FileSystemEssenceRepository(dataDir);
  const proposalRepo = new FileSystemEssenceProposalRepository(dataDir);
  const svc = new EssenceProposalService(repo, proposalRepo, new PipelineRunner());
  const philos = new PhilosReviewConsumer(svc);
  return { repo, proposalRepo, svc, philos };
}

function seedObs(id: string): Observation {
  return {
    id,
    source: 'agent_inference',
    recordedBy: 'merlin',
    content: `evidence for ${id}`,
    sessionId: null,
    observedAt: new Date().toISOString(),
    evidenceIds: [],
    correctsObservationId: null,
  };
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'm0-13-'));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

// ── Main acceptance scenario ───────────────────────────────────────────────────

describe('M0-13D: restart invariant — pending_review proposal survives process restart', () => {
  it('instance B loads proposal created by instance A and Philos accepts it', async () => {
    // ── Instance A: create profile, propose ───────────────────────────────────
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test restart',
      accumulatedConfidence: 'high',
    }, null);

    expect(result.status).toBe('pending_review');
    const proposalId = (result as { proposalId: string }).proposalId;

    // ── Instance A is now "terminated" (goes out of scope) ────────────────────
    // ── Instance B: open same data directory, process pending proposal ────────
    const instB = freshInstances();

    // Proposal must be loadable by instance B.
    const loaded = await instB.proposalRepo.loadProposal(proposalId);
    expect(loaded).toBeDefined();
    expect(loaded!.proposalId).toBe(proposalId);
    expect(loaded!.status).toBe('pending_review');
    expect(loaded!.proposedContent).toBe('explanatory');
    expect(loaded!.accumulatedConfidence).toBe('high');
    expect(loaded!.reviewDecisions).toHaveLength(0);

    // Philos consumes the proposal — should accept it.
    const decision = await instB.philos.consume('u1', proposalId);
    expect(decision.decision).toBe('accept');

    // Interpretation is committed to the profile.
    const profile = await instB.repo.getProfile('u1');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).find(i => !i.archivedAt);
    expect(active).toBeDefined();
    expect(active!.content).toBe('explanatory');
    expect(active!.provenance.createdBy).toBe('philos');

    // Proposal is now confirmed.
    const finalRecord = await instB.proposalRepo.loadProposal(proposalId);
    expect(finalRecord!.status).toBe('confirmed');
    expect(finalRecord!.committedInterpretationId).toBe(active!.id);
    expect(finalRecord!.reviewDecisions).toHaveLength(1);
    expect(finalRecord!.reviewDecisions[0].decision).toBe('accept');
  });
});

// ── D1: Double-consume after restart is idempotent ────────────────────────────

describe('M0-13D (D1): double-consume after restart does not duplicate the Interpretation', () => {
  it('second consume on a confirmed proposal returns the same decision, no new interp', async () => {
    // Instance A: create and accept a proposal.
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'high',
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    const firstDecision = await instA.philos.consume('u1', proposalId);
    expect(firstDecision.decision).toBe('accept');

    const afterFirst = await instA.repo.getProfile('u1');
    const countAfterFirst = (afterFirst!.expression['OrientationResponseDepth'] ?? []).length;

    // Instance B: double-consume.
    const instB = freshInstances();
    const secondDecision = await instB.philos.consume('u1', proposalId);
    expect(secondDecision.decision).toBe('accept');
    expect(secondDecision.reviewedAt).toBe(firstDecision.reviewedAt); // same timestamp

    const afterSecond = await instB.repo.getProfile('u1');
    const countAfterSecond = (afterSecond!.expression['OrientationResponseDepth'] ?? []).length;
    expect(countAfterSecond).toBe(countAfterFirst); // no new interpretation written

    // reviewDecisions still has exactly 1 entry (P2: append-only, no duplication).
    const record = await instB.proposalRepo.loadProposal(proposalId);
    expect(record!.reviewDecisions).toHaveLength(1);
  });
});

// ── D2: Terminal proposals are never reopened ─────────────────────────────────

describe('M0-13D (D2): terminal proposals cannot be reopened across restarts', () => {
  it('rejected proposal stays rejected in instance B', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'speculative', // → reject by policy
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    await instA.philos.consume('u1', proposalId);

    // Instance B: proposal is still rejected, no evolution.
    const instB = freshInstances();
    const record = await instB.proposalRepo.loadProposal(proposalId);
    expect(record!.status).toBe('rejected');

    const profile = await instB.repo.getProfile('u1');
    expect(profile!.evolution).toHaveLength(0);
    expect((profile!.expression['OrientationResponseDepth'] ?? []).filter(i => !i.archivedAt)).toHaveLength(0);
  });
});

// ── D3: P2 — reviewDecisions is append-only across restarts ───────────────────

describe('M0-13D (D3): reviewDecisions append-only invariant (P2)', () => {
  it('reviewDecisions accumulated across instances are never lost or reordered', async () => {
    // Use require_user_confirmation to get a non-terminal state with a review decision.
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'low', // → require_user_confirmation
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    const decision = await instA.philos.consume('u1', proposalId);
    expect(decision.decision).toBe('require_user_confirmation');

    // Instance B: review decision from instance A must be present.
    const instB = freshInstances();
    const record = await instB.proposalRepo.loadProposal(proposalId);
    expect(record!.status).toBe('pending_user_confirmation');
    expect(record!.reviewDecisions).toHaveLength(1);
    expect(record!.reviewDecisions[0].decision).toBe('require_user_confirmation');
    expect(record!.reviewDecisions[0].reviewer).toBe('philos');
  });
});

// ── loadProposalsByProfile across instances ───────────────────────────────────

describe('M0-13D: loadProposalsByProfile survives restart', () => {
  it('proposals created in instance A are visible in instance B via profile query', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));
    await instA.repo.appendObservation('u1', seedObs('obs-2'));

    // Create two proposals for the same profile.
    const r1 = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test1',
      accumulatedConfidence: 'low',
    }, null);
    expect(r1.status).toBe('pending_review');
    await instA.philos.consume('u1', (r1 as { proposalId: string }).proposalId);

    // Wait 1ms to avoid identical timestamps causing pipeline dedup.
    await new Promise(r => setTimeout(r, 1));

    const r2 = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-2'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test2',
      accumulatedConfidence: 'medium',
    }, null);

    // Instance B.
    const instB = freshInstances();
    const proposals = await instB.proposalRepo.loadProposalsByProfile('u1');
    expect(proposals.length).toBeGreaterThanOrEqual(2);
    expect(proposals.every(p => p.profileId === 'u1')).toBe(true);

    // No proposals for a different profile.
    const other = await instB.proposalRepo.loadProposalsByProfile('u2');
    expect(other).toHaveLength(0);

    // Suppress unused variable warning
    void r2;
  });
});
