/**
 * M0-14 — Recovery Runner integration tests.
 *
 * Main acceptance scenario:
 *   instance A persists pending_review
 *   → process stops (simulated by fresh FileSystem instances over the same dataDir)
 *   → instance B starts → recovery runner discovers proposal
 *   → Philos consumes it → one Interpretation committed
 *   → repeated recovery run is a no-op
 *
 * Also covers:
 *   R1  pending_user_confirmation proposals are skipped
 *   R2  expired proposals are marked terminal and not sent to Philos
 *   R3  confirmed/rejected/expired proposals are skipped (already terminal)
 *   R4  report counts are accurate
 *   R5  recovery errors on individual proposals do not abort the run
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemEssenceRepository } from '../../essence-fs-repository';
import { FileSystemEssenceProposalRepository } from '../../essence-proposal-fs-repository';
import { InMemoryEssenceRepository } from '../in-memory-repository';
import { InMemoryEssenceProposalRepository } from '../in-memory-proposal-repository';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { EssenceRecoveryRunner } from '../recovery-runner';
import { PipelineRunner } from '../pipeline-runner';
import type { Observation } from '../schema';

let dataDir: string;

function freshInstances(overrideClock?: { now(): number }) {
  const repo = new FileSystemEssenceRepository(dataDir);
  const proposalRepo = new FileSystemEssenceProposalRepository(dataDir);
  const svc = new EssenceProposalService(repo, proposalRepo, new PipelineRunner());
  const philos = new PhilosReviewConsumer(svc, overrideClock);
  const runner = new EssenceRecoveryRunner(proposalRepo, philos, overrideClock);
  return { repo, proposalRepo, svc, philos, runner };
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
  dataDir = mkdtempSync(join(tmpdir(), 'm0-14-'));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

// ── Main acceptance scenario ───────────────────────────────────────────────────

describe('M0-14: recovery runner — main acceptance scenario', () => {
  it('instance B recovery runner finds and Philos-accepts a pending_review proposal from instance A', async () => {
    // ── Instance A: create profile and leave a pending proposal ───────────────
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'recovery test',
      accumulatedConfidence: 'high',
    }, null);

    expect(result.status).toBe('pending_review');
    const proposalId = (result as { proposalId: string }).proposalId;

    // ── Instance B: server restarts, recovery runner runs ─────────────────────
    const instB = freshInstances();
    const report = await instB.runner.run();

    expect(report.scanned).toBe(1);
    expect(report.reviewed).toBe(1);
    expect(report.expired).toBe(0);
    expect(report.skipped).toBe(0);

    // Proposal is now confirmed.
    const record = await instB.proposalRepo.loadProposal(proposalId);
    expect(record!.status).toBe('confirmed');

    // Interpretation is written to the profile.
    const profile = await instB.repo.getProfile('u1');
    const active = (profile!.expression['OrientationResponseDepth'] ?? []).find(i => !i.archivedAt);
    expect(active).toBeDefined();
    expect(active!.content).toBe('explanatory');
    expect(active!.provenance.createdBy).toBe('philos');
  });

  it('second recovery run after first succeeds is a no-op (report shows 0 reviewed)', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'idempotency test',
      accumulatedConfidence: 'high',
    }, null);

    // First recovery run.
    const instB = freshInstances();
    const report1 = await instB.runner.run();
    expect(report1.reviewed).toBe(1);

    // Second recovery run (same instance).
    const instC = freshInstances();
    const report2 = await instC.runner.run();
    expect(report2.reviewed).toBe(0);
    expect(report2.scanned).toBe(1); // still sees the proposal, just skips it
  });
});

// ── R1: pending_user_confirmation proposals are skipped ───────────────────────

describe('M0-14 (R1): pending_user_confirmation proposals are skipped by recovery', () => {
  it('proposal awaiting user confirmation remains unchanged after recovery run', async () => {
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
    await instA.philos.consume('u1', proposalId); // moves to pending_user_confirmation

    const instB = freshInstances();
    const report = await instB.runner.run();

    expect(report.skipped).toBe(1);
    expect(report.reviewed).toBe(0);

    const record = await instB.proposalRepo.loadProposal(proposalId);
    expect(record!.status).toBe('pending_user_confirmation');
  });
});

// ── R2: expired proposals are marked terminal ──────────────────────────────────

describe('M0-14 (R2): expired proposals are marked terminal, not sent to Philos', () => {
  it('past-expiresAt pending_review proposal is expired by recovery runner, not consumed by Philos', async () => {
    // Create proposal with a clock that will expire.
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'expiry test',
      accumulatedConfidence: 'high',
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    const record = await instA.proposalRepo.loadProposal(proposalId);
    expect(record!.status).toBe('pending_review');

    // Advance clock past expiresAt to simulate time passing.
    const futureTime = new Date(record!.expiresAt).getTime() + 1000;
    const futureClock = { now: () => futureTime };

    const instB = freshInstances(futureClock);
    const report = await instB.runner.run();

    expect(report.expired).toBe(1);
    expect(report.reviewed).toBe(0);
    expect(report.scanned).toBe(1);

    const finalRecord = await instB.proposalRepo.loadProposal(proposalId);
    expect(finalRecord!.status).toBe('expired');
  });

  it('expired proposal stays expired on subsequent recovery run', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'brief',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'expiry idempotency',
      accumulatedConfidence: 'high',
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    const record = await instA.proposalRepo.loadProposal(proposalId);
    const futureTime = new Date(record!.expiresAt).getTime() + 1000;
    const futureClock = { now: () => futureTime };

    // First run: expires the proposal.
    const instB = freshInstances(futureClock);
    const report1 = await instB.runner.run();
    expect(report1.expired).toBe(1);

    // Second run: proposal is already terminal (expired).
    const instC = freshInstances(futureClock);
    const report2 = await instC.runner.run();
    expect(report2.expired).toBe(0);
    expect(report2.scanned).toBe(1);
  });
});

// ── R3: already-terminal proposals are skipped ────────────────────────────────

describe('M0-14 (R3): already-terminal proposals are skipped', () => {
  it('confirmed proposal is skipped (scanned but not reviewed)', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'test',
      accumulatedConfidence: 'high',
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    await instA.philos.consume('u1', proposalId); // confirms the proposal

    const instB = freshInstances();
    const report = await instB.runner.run();

    expect(report.scanned).toBe(1);
    expect(report.reviewed).toBe(0);
    expect(report.expired).toBe(0);
    expect(report.skipped).toBe(0);
  });

  it('rejected proposal is skipped', async () => {
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
      accumulatedConfidence: 'speculative', // → rejected
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    await instA.philos.consume('u1', proposalId);

    const instB = freshInstances();
    const report = await instB.runner.run();

    expect(report.scanned).toBe(1);
    expect(report.reviewed).toBe(0);
  });
});

// ── R4: report counts across mixed proposal set ───────────────────────────────

describe('M0-14 (R4): report counts are accurate for a mixed proposal set', () => {
  it('scanned=4, reviewed=1, skipped=1, expired=1, terminal=1 (not counted)', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));
    await instA.repo.appendObservation('u1', seedObs('obs-2'));
    await instA.repo.appendObservation('u1', seedObs('obs-3'));

    // Proposal A: pending_review (high confidence → Philos will accept)
    await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'pending review',
      accumulatedConfidence: 'high',
    }, null);

    // Proposal B: will become pending_user_confirmation
    const r2 = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationCommunicationStyle',
      proposedContent: 'direct',
      evidenceObservationIds: ['obs-2'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'needs user confirm',
      accumulatedConfidence: 'low',
    }, null);
    await instA.philos.consume('u1', (r2 as { proposalId: string }).proposalId);

    // Proposal C: already confirmed
    const r3 = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationTaskFraming',
      proposedContent: 'action_first',
      evidenceObservationIds: ['obs-3'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'confirmed',
      accumulatedConfidence: 'high',
    }, null);
    await instA.philos.consume('u1', (r3 as { proposalId: string }).proposalId);

    // Proposal D: injected directly with a past expiresAt — simulates a proposal
    // that was left in pending_review and whose TTL has elapsed before recovery runs.
    const now = new Date();
    await instA.proposalRepo.saveProposal({
      proposalId: 'proposal-d-expired',
      profileId: 'u1',
      nodeId: 'OrientationDecisionStyle',
      layer: 'expression',
      proposedContent: 'decisive',
      proposedBy: 'merlin',
      evidenceStatus: 'referenced',
      proposedAt: new Date(now.getTime() - 10000).toISOString(),
      expiresAt: new Date(now.getTime() - 5000).toISOString(), // already past
      status: 'pending_review',
      conflictsWith: [],
      pipelineStages: [],
      accumulatedConfidence: 'high',
      reviewDecisions: [],
      deferCount: 0,
      evidenceObservationIds: [],
    });

    const instB = freshInstances();
    const report = await instB.runner.run();

    // scanned: 4 total proposals (A pending_review, B pending_user_confirmation, C confirmed, D expired)
    expect(report.scanned).toBe(4);
    // reviewed: A (pending_review, not expired)
    expect(report.reviewed).toBe(1);
    // skipped: B (pending_user_confirmation)
    expect(report.skipped).toBe(1);
    // expired: D (past expiresAt)
    expect(report.expired).toBe(1);
    // C (confirmed) is not counted in any of the above action buckets
  });
});

// ── R5: recovery errors on individual proposals do not abort the run ───────────

describe('M0-14 (R5): error in one proposal does not abort recovery run', () => {
  it('run continues past a proposal with a corrupt profileId, others are processed', async () => {
    // Use in-memory repositories so we can inject a bad proposal directly.
    const proposalRepo = new InMemoryEssenceProposalRepository();
    const repo = new InMemoryEssenceRepository();

    await repo.createProfile('u1');
    const svc = new EssenceProposalService(repo, proposalRepo, new PipelineRunner());
    const philos = new PhilosReviewConsumer(svc);
    const runner = new EssenceRecoveryRunner(proposalRepo, philos);

    // Seed a valid pending_review proposal.
    await (repo as { appendObservation(id: string, obs: Observation): Promise<void> }).appendObservation(
      'u1',
      seedObs('obs-1'),
    );
    const goodResult = await svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'good proposal',
      accumulatedConfidence: 'high',
    }, null);
    const goodId = (goodResult as { proposalId: string }).proposalId;

    // Inject a bad proposal with a nonexistent profileId.
    const now = new Date();
    await proposalRepo.saveProposal({
      proposalId: 'bad-proposal-id',
      profileId: 'nonexistent-profile',
      nodeId: 'OrientationCommunicationStyle',
      layer: 'expression',
      proposedContent: 'direct',
      proposedBy: 'merlin',
      evidenceStatus: 'referenced',
      proposedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      status: 'pending_review',
      conflictsWith: [],
      pipelineStages: [],
      accumulatedConfidence: 'high',
      reviewDecisions: [],
      deferCount: 0,
      evidenceObservationIds: [],
    });

    const report = await runner.run();

    // scanned: 2 proposals
    expect(report.scanned).toBe(2);
    // good proposal was processed successfully
    expect(report.reviewed).toBe(1);

    const goodRecord = await proposalRepo.loadProposal(goodId);
    expect(goodRecord!.status).toBe('confirmed');
  });
});
