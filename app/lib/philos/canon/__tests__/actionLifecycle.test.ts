/**
 * actionLifecycle.ts — the wired Action/Effect/Learning lifecycle.
 * Synthetic fixtures only. Uses InMemory*Store injected via the accessor
 * test-helpers (`_setActionStore` etc.), same pattern as other accessor
 * tests in this directory — never touches a real data directory.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Action } from "../action";
import { InMemoryActionStore } from "../actionStore";
import { _setActionStore } from "../actionStoreAccessor";
import type { Effect } from "../effect";
import { InMemoryEffectStore } from "../effectStore";
import { _setEffectStore } from "../effectStoreAccessor";
import type { OutcomeVerification } from "../outcomeVerification";
import { InMemoryLearningStore } from "../learningStore";
import { _setLearningStore } from "../learningStoreAccessor";
import { InMemoryVerificationStore } from "../outcomeVerificationStore";
import { _setVerificationStore } from "../outcomeVerificationStoreAccessor";
import type { CellState } from "../cellState";
import {
  ActionReferentialIntegrityError,
  EffectReferentialIntegrityError,
  LearningReferentialIntegrityError,
  recordAction,
  recordEffect,
  recordLearning,
  buildActionLifecycleSummary,
} from "../actionLifecycle";

function verification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "reported feeling less overloaded this evening",
    provenance: "self_reported",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-08-15T12:00:00Z",
    method: "self_report_checkin",
    ...overrides,
  };
}

/** An INDEPENDENT verification: a different named person, an outside kind,
 *  and — because `baseEffect` concerns the subject's internal state — the
 *  subject's explicit consent, per canon §17. */
function independentVerification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return verification({
    verifier_type: "counterparty",
    verifier_id: "person_someone_else",
    subject_consent: true,
    ...overrides,
  });
}

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_1",
    type: "non_transfer",
    owner: "person_test_x",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: ["need_1"],
    reversibility: "reversible",
    time: "2026-08-15T10:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_1",
    action_ref: "action_1",
    subject: "person_test_x",
    concerns_subject_internal_state: true,
    claimed_outcome: verification(),
    context: "evening_session",
    time: "2026-08-15T12:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

const priorState: CellState = { domain: "E", frame: "I", level: -2, stability: 0.4 };
const candidateStatePrime: CellState = { domain: "E", frame: "I", level: -1, stability: 0.5 };

let verificationStore: InMemoryVerificationStore;

beforeEach(() => {
  _setActionStore(new InMemoryActionStore());
  _setEffectStore(new InMemoryEffectStore());
  _setLearningStore(new InMemoryLearningStore());
  verificationStore = new InMemoryVerificationStore();
  _setVerificationStore(verificationStore);
});

describe("recordAction", () => {
  it("records a real, valid Action", async () => {
    const stored = await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    expect(stored.action.action_id).toBe("action_1");
  });

  it("throws before touching the store on a structurally invalid Action", async () => {
    await expect(recordAction(baseAction({ owner: "" }), "2026-08-15T10:00:01Z")).rejects.toBeInstanceOf(
      ActionReferentialIntegrityError,
    );
  });
});

describe("recordEffect — referential integrity against the real Action store", () => {
  it("rejects an Effect whose action_ref names no real, stored Action", async () => {
    await expect(recordEffect(baseEffect(), "2026-08-15T12:00:01Z")).rejects.toBeInstanceOf(
      EffectReferentialIntegrityError,
    );
  });

  it("accepts an Effect once its Action is genuinely recorded", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const stored = await recordEffect(baseEffect(), "2026-08-15T12:00:01Z");
    expect(stored.effect.action_ref).toBe("action_1");
  });
});

describe("recordLearning — referential integrity against the real Effect store, DELTA computed only on state_prime", () => {
  it("rejects a Learning whose effect_ref names no real, stored Effect", async () => {
    await expect(
      recordLearning({
        learning_id: "learning_1",
        prior_state_ref: "cellstate_prior",
        outcome_verification_ref: "verification_1",
        update_method: "manual_review",
        provenance: "self_reported",
        confidence: 0.8,
        time: "2026-08-15T13:00:00Z",
        context: "evening_session",
        effect_ref: "effect_1",
        effect: baseEffect({ verified_outcome: verification() }),
        priorState,
        candidateStatePrime,
        recordedAt: "2026-08-15T13:00:01Z",
      }),
    ).rejects.toBeInstanceOf(LearningReferentialIntegrityError);
  });

  it("computes a real, non-null DELTA when the derivation accepts state_prime", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const verifiedEffect = baseEffect({ verified_outcome: verification({ time: "2026-08-15T12:30:00Z" }) });
    await recordEffect(verifiedEffect, "2026-08-15T12:00:01Z");

    const stored = await recordLearning({
      learning_id: "learning_1",
      prior_state_ref: "cellstate_prior",
      outcome_verification_ref: "verification_1",
      update_method: "manual_review",
      provenance: "self_reported",
      confidence: 0.8,
      time: "2026-08-15T13:00:00Z",
      context: "evening_session",
      effect_ref: "effect_1",
      effect: verifiedEffect,
      priorState,
      candidateStatePrime,
      recordedAt: "2026-08-15T13:00:01Z",
    });

    expect(stored.learning.result.kind).toBe("state_prime");
    expect(stored.delta?.domain).toBe("E");
    expect(stored.delta?.frame).toBe("I");
    expect(stored.delta?.level_delta).toBe(1);
    expect(stored.delta?.stability_delta).toBeCloseTo(0.1);
  });

  it("stores delta: null for a claimed-only Effect — a real, gated no_update Learning, not a fabricated delta", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const claimedOnly = baseEffect();
    await recordEffect(claimedOnly, "2026-08-15T12:00:01Z");

    const stored = await recordLearning({
      learning_id: "learning_1",
      prior_state_ref: "cellstate_prior",
      outcome_verification_ref: "verification_1",
      update_method: "manual_review",
      provenance: "self_reported",
      confidence: 0.8,
      time: "2026-08-15T13:00:00Z",
      context: "evening_session",
      effect_ref: "effect_1",
      effect: claimedOnly,
      priorState,
      candidateStatePrime,
      recordedAt: "2026-08-15T13:00:01Z",
    });

    expect(stored.learning.result).toEqual({ kind: "no_update", reason: "claimed_only" });
    expect(stored.delta).toBeNull();
  });
});

describe("buildActionLifecycleSummary — NO VERIFIED EFFECT != NO EFFECT, CHRONOLOGY != CAUSALITY", () => {
  it("an undefined subject returns an honest empty summary, never throws", async () => {
    const summary = await buildActionLifecycleSummary(undefined);
    expect(summary.actions).toEqual([]);
    expect(summary.counts.actions_total).toBe(0);
  });

  it("a subject with zero recorded Actions gets an honest empty summary", async () => {
    const summary = await buildActionLifecycleSummary("nobody_recorded_yet");
    expect(summary.counts.actions_total).toBe(0);
  });

  it("distinguishes no_effect_recorded from effect_claimed_only from effect_verified", async () => {
    await recordAction(baseAction({ action_id: "action_no_effect" }), "2026-08-15T10:00:01Z");
    await recordAction(baseAction({ action_id: "action_claimed" }), "2026-08-15T10:00:02Z");
    await recordEffect(baseEffect({ effect_id: "effect_claimed", action_ref: "action_claimed" }), "2026-08-15T12:00:01Z");
    await recordAction(baseAction({ action_id: "action_verified" }), "2026-08-15T10:00:03Z");
    await recordEffect(
      baseEffect({ effect_id: "effect_verified", action_ref: "action_verified" }),
      "2026-08-15T12:00:02Z",
    );
    // EVIDENCE IS A SEPARATE RECORD BY A SEPARATE PERSON. Setting
    // `verified_outcome` on the Effect itself no longer makes it verified —
    // that field could be written by the reporter in the same submission.
    await verificationStore.append([{
      verification_id: "verification_1",
      effect_id: "effect_verified",
      recorded_at: "2026-08-15T13:00:00Z",
      verification: independentVerification(),
    }]);

    const summary = await buildActionLifecycleSummary("person_test_x");
    expect(summary.counts.actions_total).toBe(3);
    expect(summary.counts.no_effect_recorded).toBe(1);
    expect(summary.counts.effect_claimed_only).toBe(1);
    expect(summary.counts.effect_verified).toBe(1);

    const noEffect = summary.actions.find((a) => a.action.action.action_id === "action_no_effect");
    expect(noEffect?.verification_state).toBe("no_effect_recorded");
  });

  it("links Effects to Actions only via the explicit action_ref, never by chronological proximity", async () => {
    // Two actions recorded close in time; only ONE has a real Effect referencing it.
    await recordAction(baseAction({ action_id: "action_early" }), "2026-08-15T10:00:01Z");
    await recordAction(baseAction({ action_id: "action_late" }), "2026-08-15T10:00:02Z");
    await recordEffect(baseEffect({ effect_id: "effect_for_early", action_ref: "action_early" }), "2026-08-15T10:00:03Z");

    const summary = await buildActionLifecycleSummary("person_test_x");
    const early = summary.actions.find((a) => a.action.action.action_id === "action_early");
    const late = summary.actions.find((a) => a.action.action.action_id === "action_late");
    expect(early?.effects).toHaveLength(1);
    expect(late?.effects).toHaveLength(0); // never inferred from being recorded moments later
  });
});
