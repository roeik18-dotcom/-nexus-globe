/**
 * M0 Checkpoint — Two remaining acceptance criteria before M0 is declared COMPLETE.
 *
 * C3 — Crash mid-consume transaction boundary
 *   A crash after commitReviewedProposal() but before applyReviewDecision() must not
 *   leave the system in an inconsistent state. After recovery:
 *     - exactly one active Interpretation for the orientation node
 *     - proposal reaches 'confirmed' terminal status
 *
 *   Safety comes from the replace_single_value write disposition: a second commit
 *   archives the first Interpretation and writes a fresh one, so the active-
 *   interpretation invariant is preserved regardless of how many times we retry.
 *
 * C4 — Cold-start performance with a large proposal store
 *   loadAllProposals() on a FileSystemEssenceProposalRepository containing
 *   N_PROPOSALS entries must complete within LOAD_DEADLINE_MS milliseconds.
 *   This validates the single-file JSON storage model at operational scale.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemEssenceRepository } from '../../essence-fs-repository';
import { FileSystemEssenceProposalRepository } from '../../essence-proposal-fs-repository';
import { EssenceProposalService } from '../proposal-service';
import { PhilosReviewConsumer } from '../philos-review-consumer';
import { EssenceRecoveryRunner } from '../recovery-runner';
import { PipelineRunner } from '../pipeline-runner';
import type {
  EssencePhilosReviewAPI,
  PendingEssenceProposal,
  PhilosReviewDecision,
  ProposalStatus,
} from '../api';
import type { Interpretation, Observation } from '../schema';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'm0-checkpoint-'));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

function freshInstances() {
  const repo = new FileSystemEssenceRepository(dataDir);
  const proposalRepo = new FileSystemEssenceProposalRepository(dataDir);
  const svc = new EssenceProposalService(repo, proposalRepo, new PipelineRunner());
  const philos = new PhilosReviewConsumer(svc);
  const runner = new EssenceRecoveryRunner(proposalRepo, philos);
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

// ── C3: Crash mid-consume ─────────────────────────────────────────────────────

/**
 * Wraps EssencePhilosReviewAPI so that applyReviewDecision() throws on its
 * FIRST call, simulating a process crash after commitReviewedProposal() persisted
 * the Interpretation but before the proposal status was updated to 'confirmed'.
 */
class CrashAfterCommitAPI implements EssencePhilosReviewAPI {
  private crashed = false;

  constructor(private readonly real: EssencePhilosReviewAPI) {}

  async getReviewQueue(profileId: string): Promise<PendingEssenceProposal[]> {
    return this.real.getReviewQueue(profileId);
  }

  async getProposalRecord(proposalId: string): Promise<PendingEssenceProposal | undefined> {
    return this.real.getProposalRecord(proposalId);
  }

  async commitReviewedProposal(proposal: PendingEssenceProposal): Promise<Interpretation> {
    return this.real.commitReviewedProposal(proposal);
  }

  async applyReviewDecision(
    proposalId: string,
    decision: PhilosReviewDecision,
    newStatus: ProposalStatus,
  ): Promise<void> {
    if (!this.crashed) {
      this.crashed = true;
      throw new Error('SIMULATED CRASH: process terminated after commitReviewedProposal');
    }
    return this.real.applyReviewDecision(proposalId, decision, newStatus);
  }
}

describe('M0 Checkpoint C3: crash mid-consume does not produce inconsistent state', () => {
  it('recovery after crash between commitReviewedProposal and applyReviewDecision yields one active interpretation', async () => {
    // ── Phase 1: create proposal ─────────────────────────────────────────────
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'crash test',
      accumulatedConfidence: 'high',
    }, null);

    expect(result.status).toBe('pending_review');
    const proposalId = (result as { proposalId: string }).proposalId;

    // ── Phase 2: simulate crash after commitReviewedProposal ─────────────────
    // commitReviewedProposal: writes Interpretation to profile, saves proposal
    // with committedInterpretationId.
    // applyReviewDecision: throws (simulates process kill).
    // Proposal remains in pending_review with reviewDecisions still empty.
    const crashingAPI = new CrashAfterCommitAPI(instA.svc);
    const crashingPhilos = new PhilosReviewConsumer(crashingAPI);

    await expect(
      crashingPhilos.consume('u1', proposalId),
    ).rejects.toThrow('SIMULATED CRASH');

    // Verify the mid-crash state:
    // - commitReviewedProposal persisted: profile has the interpretation
    // - applyReviewDecision did not run: proposal still pending_review
    const midCrashProposal = await instA.proposalRepo.loadProposal(proposalId);
    expect(midCrashProposal!.status).toBe('pending_review');

    const midCrashProfile = await instA.repo.getProfile('u1');
    const allMidCrash = midCrashProfile!.expression['OrientationResponseDepth'] ?? [];
    const activeMidCrash = allMidCrash.filter(i => !i.archivedAt);
    // Interpretation was written by commitReviewedProposal before the crash.
    expect(activeMidCrash).toHaveLength(1);

    // ── Phase 3: restart (fresh instances over same dataDir) ─────────────────
    const instB = freshInstances();
    const report = await instB.runner.run();

    // Recovery processed the pending_review proposal.
    expect(report.reviewed).toBe(1);

    // ── Phase 4: verify final state is correct ───────────────────────────────

    // Proposal is terminal.
    const finalProposal = await instB.proposalRepo.loadProposal(proposalId);
    expect(finalProposal!.status).toBe('confirmed');
    expect(finalProposal!.committedInterpretationId).toBeDefined();

    // Profile has EXACTLY ONE active interpretation for OrientationResponseDepth.
    // (replace_single_value archived the first commit's interp, wrote a second.)
    const finalProfile = await instB.repo.getProfile('u1');
    const allFinal = finalProfile!.expression['OrientationResponseDepth'] ?? [];
    const activeFinal = allFinal.filter(i => !i.archivedAt);
    const archivedFinal = allFinal.filter(i => i.archivedAt);

    expect(activeFinal).toHaveLength(1);
    expect(activeFinal[0].content).toBe('explanatory');
    expect(activeFinal[0].provenance.createdBy).toBe('philos');

    // The interpretation from the first (crashed) commit is archived — expected
    // artifact of the retry. The single-valued invariant is preserved.
    expect(archivedFinal.length).toBeGreaterThanOrEqual(1);

    // committedInterpretationId matches the active interpretation.
    expect(finalProposal!.committedInterpretationId).toBe(activeFinal[0].id);
  });

  it('repeated recovery after crash is idempotent (no further writes after confirmed)', async () => {
    const instA = freshInstances();
    await instA.repo.createProfile('u1');
    await instA.repo.appendObservation('u1', seedObs('obs-1'));

    const result = await instA.svc.proposeUpdate('u1', {
      nodeId: 'OrientationResponseDepth',
      proposedContent: 'explanatory',
      evidenceObservationIds: ['obs-1'],
      proposedBy: 'merlin',
      proposedAt: new Date().toISOString(),
      rationale: 'idempotency after crash',
      accumulatedConfidence: 'high',
    }, null);

    const proposalId = (result as { proposalId: string }).proposalId;
    const crashingPhilos = new PhilosReviewConsumer(new CrashAfterCommitAPI(instA.svc));
    await expect(crashingPhilos.consume('u1', proposalId)).rejects.toThrow();

    // First recovery: fixes the broken state.
    const instB = freshInstances();
    const report1 = await instB.runner.run();
    expect(report1.reviewed).toBe(1);

    const afterFirst = await instB.repo.getProfile('u1');
    const countAfterFirst = (afterFirst!.expression['OrientationResponseDepth'] ?? []).length;

    // Second recovery: proposal is confirmed → no re-processing.
    const instC = freshInstances();
    const report2 = await instC.runner.run();
    expect(report2.reviewed).toBe(0);
    expect(report2.scanned).toBe(1);

    const afterSecond = await instC.repo.getProfile('u1');
    const countAfterSecond = (afterSecond!.expression['OrientationResponseDepth'] ?? []).length;
    expect(countAfterSecond).toBe(countAfterFirst); // no new writes
  });
});

// ── C4: Cold-start performance ────────────────────────────────────────────────

const N_PROPOSALS = 5_000;
const LOAD_DEADLINE_MS = 2_000;

describe('M0 Checkpoint C4: cold-start performance with a large proposal store', () => {
  it(`loadAllProposals() on ${N_PROPOSALS} proposals completes within ${LOAD_DEADLINE_MS}ms`, async () => {
    // Write proposals.json directly to avoid N × O(read-parse-write) setup cost.
    // This is a file-format test, not a write-throughput test.
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 86400000 * 30).toISOString();

    const store: Record<string, unknown> = {};
    for (let i = 0; i < N_PROPOSALS; i++) {
      const id = `perf-proposal-${i}`;
      store[id] = {
        proposalId: id,
        profileId: `user-${i % 100}`,
        nodeId: 'OrientationResponseDepth',
        layer: 'expression',
        proposedContent: 'brief',
        proposedBy: 'merlin',
        evidenceStatus: 'referenced',
        proposedAt: now,
        expiresAt: future,
        status: 'pending_review',
        conflictsWith: [],
        pipelineStages: [],
        accumulatedConfidence: 'high',
        reviewDecisions: [],
        deferCount: 0,
      };
    }

    writeFileSync(join(dataDir, 'proposals.json'), JSON.stringify(store), 'utf-8');

    const repo = new FileSystemEssenceProposalRepository(dataDir);

    const start = Date.now();
    const all = await repo.loadAllProposals();
    const elapsed = Date.now() - start;

    expect(all).toHaveLength(N_PROPOSALS);
    expect(elapsed).toBeLessThan(LOAD_DEADLINE_MS);
  });

  it('loadProposal() on a large store completes within 500ms', async () => {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 86400000 * 30).toISOString();

    const store: Record<string, unknown> = {};
    const targetId = `perf-proposal-${Math.floor(N_PROPOSALS / 2)}`;

    for (let i = 0; i < N_PROPOSALS; i++) {
      const id = `perf-proposal-${i}`;
      store[id] = {
        proposalId: id,
        profileId: `user-${i % 100}`,
        nodeId: 'OrientationResponseDepth',
        layer: 'expression',
        proposedContent: 'brief',
        proposedBy: 'merlin',
        evidenceStatus: 'referenced',
        proposedAt: now,
        expiresAt: future,
        status: 'confirmed',
        conflictsWith: [],
        pipelineStages: [],
        accumulatedConfidence: 'high',
        reviewDecisions: [],
        deferCount: 0,
        committedInterpretationId: `interp-${i}`,
      };
    }

    writeFileSync(join(dataDir, 'proposals.json'), JSON.stringify(store), 'utf-8');

    const repo = new FileSystemEssenceProposalRepository(dataDir);

    const start = Date.now();
    const found = await repo.loadProposal(targetId);
    const elapsed = Date.now() - start;

    expect(found).toBeDefined();
    expect(found!.proposalId).toBe(targetId);
    expect(elapsed).toBeLessThan(500);
  });
});
