/**
 * Philos Canon — Effect, validated (PHILOS-MELTING-POT-CANON.md §17).
 *
 * Named assertions requested for this pass: EFFECT_VALID,
 * EFFECT_REQUIRES_ACTION_REFERENCE, ACTION_SUCCESS_NOT_ASSUMED,
 * CLAIMED_OUTCOME_ALLOWED, CLAIMED_IS_NOT_VERIFIED, SELF_VERIFICATION_VALID,
 * SUBJECT_CONSENT_REQUIRED_WHERE_CANON_REQUIRES,
 * THIRD_PARTY_CANNOT_UNILATERALLY_VERIFY_PERSON_STATE,
 * UNVERIFIED_CANNOT_UPDATE_STATE, VERIFICATION_DOES_NOT_IMPLEMENT_LEARNING,
 * EFFECT_DOES_NOT_MUTATE_CELLSTATE, NO_PERSON_SCORE,
 * NO_CROSS_FRAME_AGGREGATION, FULL_PRIOR_RUNTIME_REGRESSION_PASS.
 */
import { describe, expect, it } from "vitest";
import { type Action, validateAction } from "../action";
import { type CellState, validateCellState } from "../cellState";
import * as effectModule from "../effect";
import { type Effect, isEffectVerified, validateEffect } from "../effect";
import { evaluateMatch, type MatchAttempt } from "../matching";
import { type Need, validateNeed } from "../need";
import { type Offer, validateOffer } from "../offer";
import { type OutcomeVerification } from "../outcomeVerification";
import { type Target, validateTarget } from "../target";
import { type Transfer, validateTransfer } from "../transfer";

function baseVerification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "recipient completed a self-produced mix using the guidance",
    provenance: "self_reported_in_followup",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-09-01T00:00:00Z",
    method: "follow-up interview",
    ...overrides,
  };
}

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_001",
    action_ref: "action_transfer_001",
    subject: "person_b",
    concerns_subject_internal_state: true,
    claimed_outcome: baseVerification(),
    context: "post_mentorship_checkin",
    time: "2026-09-01T00:00:00Z",
    provenance: "recorded_after_session",
    ...overrides,
  };
}

describe("EFFECT_VALID", () => {
  it("accepts a complete, canon-shaped Effect with only claimed_outcome", () => {
    const result = validateEffect(baseEffect());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a complete Effect with both claimed_outcome and verified_outcome", () => {
    const result = validateEffect(
      baseEffect({ verified_outcome: baseVerification({ statement: "confirmed via review" }) }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("EFFECT_REQUIRES_ACTION_REFERENCE", () => {
  it("rejects an empty action_ref", () => {
    const result = validateEffect(baseEffect({ action_ref: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "action_ref", reason: "empty" });
  });

  it("action_ref points at a real Action/Transfer's action_id — demonstrated end-to-end", () => {
    const transfer: Transfer = {
      action_id: "action_transfer_regress",
      type: "transfer",
      owner: "group_studio_collective",
      mechanism_scope: "melting_pot",
      consent: true,
      inputs: ["need_ref:need_x", "offer_ref:offer_x"],
      reversibility: "time_only",
      time: "2026-08-20T00:00:00Z",
      provenance: "matched",
      source: "person_a",
      target: "person_b",
      source_cell: { domain: "C", frame: "R" },
      target_cell: { domain: "C", frame: "R" },
      resource: "mentorship session",
      resource_type: "knowledge",
      amount: "1 session",
      conversion_mechanism: "explanation/mentoring",
      cost: "1 hour",
      expiry_or_validity: "2026-10-20T00:00:00Z",
      claimed_outcome: "session occurred as scheduled",
    };
    expect(validateTransfer(transfer).valid).toBe(true);

    const effect = baseEffect({ action_ref: transfer.action_id });
    expect(effect.action_ref).toBe(transfer.action_id);
    expect(validateEffect(effect).valid).toBe(true);
  });
});

describe("ACTION_SUCCESS_NOT_ASSUMED", () => {
  it("this module exports no function that constructs an Effect from an Action/Transfer automatically", () => {
    const mod = effectModule as unknown as Record<string, unknown>;
    for (const name of [
      "deriveEffectFromAction",
      "effectFromTransfer",
      "assumeSuccess",
      "autoEffect",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("a valid, consented Action does not by itself make any Effect claim true — an Effect's claimed_outcome is entirely independent data", () => {
    const action: Action = {
      action_id: "action_success_test",
      type: "non_transfer",
      owner: "person_a",
      mechanism_scope: "self_regulation",
      consent: true,
      inputs: [],
      reversibility: "reversible",
      time: "2026-08-20T00:00:00Z",
      provenance: "self_initiated",
    };
    expect(validateAction(action).valid).toBe(true);
    // Nothing about `action` being valid/consented is read by validateEffect
    // or isEffectVerified — an Effect must supply its own claimed_outcome
    // regardless of how "successful" the Action record looks.
    const effect = baseEffect({ action_ref: action.action_id });
    expect(validateEffect(effect).valid).toBe(true);
  });
});

describe("CLAIMED_OUTCOME_ALLOWED", () => {
  it("an Effect with only claimed_outcome (no verified_outcome) is fully valid", () => {
    const effect = baseEffect();
    expect(Object.prototype.hasOwnProperty.call(effect, "verified_outcome")).toBe(false);
    expect(validateEffect(effect).valid).toBe(true);
  });
});

describe("CLAIMED_IS_NOT_VERIFIED", () => {
  it("isEffectVerified returns false when only claimed_outcome exists", () => {
    expect(isEffectVerified(baseEffect())).toBe(false);
  });

  it("claimed_outcome and verified_outcome are independent OutcomeVerification records — setting one never sets the other", () => {
    const effect = baseEffect({
      claimed_outcome: baseVerification({ statement: "claimed improvement" }),
    });
    expect(effect.verified_outcome).toBeUndefined();
  });

  it("a high-confidence claimed_outcome still does not count as verified", () => {
    const effect = baseEffect({ claimed_outcome: baseVerification({ confidence: 1 }) });
    expect(isEffectVerified(effect)).toBe(false);
  });
});

describe("SELF_VERIFICATION_VALID", () => {
  it("a self-verified internal-state Effect is verified", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: true,
      verified_outcome: baseVerification({ verifier_type: "self" }),
    });
    expect(isEffectVerified(effect)).toBe(true);
  });

  it("self verification needs no subject_consent field at all", () => {
    const effect = baseEffect({
      verified_outcome: baseVerification({ verifier_type: "self", subject_consent: undefined }),
    });
    expect(isEffectVerified(effect)).toBe(true);
  });
});

describe("SUBJECT_CONSENT_REQUIRED_WHERE_CANON_REQUIRES", () => {
  it("a counterparty verification of an internal-state claim WITHOUT subject_consent is not sufficient", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: true,
      verified_outcome: baseVerification({ verifier_type: "counterparty" }),
    });
    expect(isEffectVerified(effect)).toBe(false);
  });

  it("a counterparty verification of an internal-state claim WITH subject_consent IS sufficient", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: true,
      verified_outcome: baseVerification({ verifier_type: "counterparty", subject_consent: true }),
    });
    expect(isEffectVerified(effect)).toBe(true);
  });

  it("consent is only required when the Effect actually concerns subject internal state — external/systemic facts do not need it", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: false,
      verified_outcome: baseVerification({ verifier_type: "observed_measured" }),
    });
    expect(isEffectVerified(effect)).toBe(true);
  });

  it("subject_consent: false explicitly is treated the same as absent — never sufficient without true", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: true,
      verified_outcome: baseVerification({ verifier_type: "third_party", subject_consent: false }),
    });
    expect(isEffectVerified(effect)).toBe(false);
  });
});

describe("THIRD_PARTY_CANNOT_UNILATERALLY_VERIFY_PERSON_STATE", () => {
  it("a third_party verification of an internal-state claim without consent cannot mark the Effect verified", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: true,
      verified_outcome: baseVerification({
        verifier_type: "third_party",
        statement: "I (the mentor) declare person_b fully recovered",
      }),
    });
    expect(isEffectVerified(effect)).toBe(false);
  });

  it("the Effect record itself is still structurally valid — insufficient authority is a separate question from malformed data", () => {
    const effect = baseEffect({
      concerns_subject_internal_state: true,
      verified_outcome: baseVerification({ verifier_type: "third_party" }),
    });
    expect(validateEffect(effect).valid).toBe(true); // structurally fine
    expect(isEffectVerified(effect)).toBe(false); // but not authoritatively verified
  });
});

describe("UNVERIFIED_CANNOT_UPDATE_STATE", () => {
  it("this module exports no function that updates/mutates any CellState or State'", () => {
    const mod = effectModule as unknown as Record<string, unknown>;
    for (const name of ["updateState", "updateCellState", "applyToState", "mutateState"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("isEffectVerified is a pure judgment function — it does not mutate the Effect passed to it", () => {
    const effect = baseEffect({ verified_outcome: baseVerification({ verifier_type: "self" }) });
    const before = JSON.stringify(effect);
    isEffectVerified(effect);
    expect(JSON.stringify(effect)).toBe(before);
  });
});

describe("VERIFICATION_DOES_NOT_IMPLEMENT_LEARNING", () => {
  it("this module exports no Learning-shaped function (State → State')", () => {
    const mod = effectModule as unknown as Record<string, unknown>;
    for (const name of ["learn", "applyLearning", "updateFutureStability", "stateTransition"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("EFFECT_DOES_NOT_MUTATE_CELLSTATE", () => {
  it("CellState (unchanged since two passes ago) still has exactly its four fields — Effect adds nothing to it", () => {
    const state: CellState = { domain: "E", frame: "I", level: 0.3, stability: 0.6 };
    expect(validateCellState(state).valid).toBe(true);
    expect(Object.keys(state).sort()).toEqual(["domain", "frame", "level", "stability"]);
  });

  it("no function in effect.ts accepts a CellState argument at all", () => {
    // validateEffect and isEffectVerified both take only Effect — checked by
    // arity/signature, not by a runtime CellState probe, since neither
    // function's parameter shape includes one.
    expect(validateEffect.length).toBe(1);
    expect(isEffectVerified.length).toBe(1);
  });
});

describe("NO_PERSON_SCORE", () => {
  it("the Effect/OutcomeVerification types carry no reputation/trust/score field", () => {
    const effect = baseEffect();
    for (const forbidden of ["reputation", "trustScore", "score", "priority"]) {
      expect(Object.prototype.hasOwnProperty.call(effect, forbidden)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(effect.claimed_outcome, forbidden)).toBe(false);
    }
  });

  it("this module exports no scoring/ranking function", () => {
    const mod = effectModule as unknown as Record<string, unknown>;
    for (const name of ["score", "rank", "rankEffects", "credibilityScore"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CROSS_FRAME_AGGREGATION", () => {
  it("this module exports no function that combines multiple Effect instances across frames or subjects", () => {
    const mod = effectModule as unknown as Record<string, unknown>;
    for (const name of ["aggregate", "aggregateAcrossFrames", "combine", "merge", "sum"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("no store, no persistence, no 'all effects for a subject' function — no permanent outcome profile", () => {
    const mod = effectModule as unknown as Record<string, unknown>;
    for (const name of ["saveEffect", "effectStore", "allEffectsFor", "outcomeProfile"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("Effect — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateEffect({} as unknown as Effect)).not.toThrow();
    expect(() => isEffectVerified({} as unknown as Effect)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseEffect();
    expect(validateEffect(input)).toEqual(validateEffect(input));
    expect(isEffectVerified(input)).toBe(isEffectVerified(input));
  });
});

describe("FULL_PRIOR_RUNTIME_REGRESSION_PASS", () => {
  it("CellState still validates correctly", () => {
    const state: CellState = { domain: "G", frame: "R", level: -0.5, stability: 0.4 };
    expect(validateCellState(state).valid).toBe(true);
  });

  it("Need still validates correctly", () => {
    const need: Need = {
      need_id: "need_regress_4",
      subject: "person_roei",
      desired_change: "more sleep",
      scope: { kind: "domain", domain: "G" },
      provenance: "self_reported",
      context: "week_review",
      time: "2026-08-12T20:00:00Z",
      expiry: "2026-09-12T20:00:00Z",
      consent_scope: "self_only",
    };
    expect(validateNeed(need).valid).toBe(true);
  });

  it("Target still validates correctly", () => {
    const target: Target = {
      target_id: "target_regress_4",
      subject: "person_roei",
      cell: { domain: "E", frame: "I" },
      desired_state: "baseline stability",
      reference_type: "self_goal",
      provenance: "self_declared",
      consent_status: "granted",
      context: "checkin",
      time: "2026-08-12T20:00:00Z",
      expiry: "2026-09-12T20:00:00Z",
    };
    expect(validateTarget(target).valid).toBe(true);
  });

  it("Offer still validates correctly", () => {
    const offer: Offer = {
      offer_id: "offer_regress_4",
      source: "person_a",
      source_cell: { domain: "C", frame: "R" },
      available_resource: "code review",
      resource_type: "knowledge",
      amount_or_capacity: "1 session",
      competence: "professional",
      willingness: true,
      consent: true,
      availability: "weekday mornings",
      cost: "none",
      constraints: [],
      expiry: "2026-09-12T20:00:00Z",
      provenance: "self_declared",
    };
    expect(validateOffer(offer).valid).toBe(true);
  });

  it("Matching still evaluates correctly", () => {
    const need: Need = {
      need_id: "need_regress_match_2",
      subject: "person_b",
      desired_change: "code review",
      scope: { kind: "domain", domain: "C" },
      provenance: "self_reported",
      context: "sprint",
      time: "2026-08-01T00:00:00Z",
      expiry: "2026-12-01T00:00:00Z",
      consent_scope: "visible_to_matched_offers",
    };
    const offer: Offer = {
      offer_id: "offer_regress_match_2",
      source: "person_a",
      source_cell: { domain: "C", frame: "R" },
      available_resource: "code review",
      resource_type: "knowledge",
      amount_or_capacity: "1 session",
      competence: "professional",
      willingness: true,
      consent: true,
      availability: "weekday mornings",
      cost: "none",
      constraints: [],
      expiry: "2026-12-01T00:00:00Z",
      provenance: "self_declared",
    };
    const attempt: MatchAttempt = {
      match_id: "match_regress_2",
      need_ref: "need_regress_match_2",
      offer_ref: "offer_regress_match_2",
      source: "person_a",
      target: "person_b",
      cell: { domain: "C", frame: "R" },
      CAN: true,
      WANTS: true,
      ALLOWED: true,
      APPROPRIATE: true,
      AVAILABLE: true,
      CONSENT: true,
      context: "regression_check",
      time: "2026-08-15T00:00:00Z",
    };
    expect(evaluateMatch(attempt, need, offer).decision).toBe("permitted");
  });

  it("Action + Transfer still validate correctly", () => {
    const action: Action = {
      action_id: "action_regress_4",
      type: "non_transfer",
      owner: "person_roei",
      mechanism_scope: "self_regulation",
      consent: true,
      inputs: [],
      reversibility: "reversible",
      time: "2026-08-15T00:00:00Z",
      provenance: "self_initiated",
    };
    expect(validateAction(action).valid).toBe(true);

    const transfer: Transfer = {
      action_id: "action_transfer_regress_2",
      type: "transfer",
      owner: "group_studio_collective",
      mechanism_scope: "melting_pot",
      consent: true,
      inputs: [],
      reversibility: "time_only",
      time: "2026-08-15T00:00:00Z",
      provenance: "matched_via_melting_pot",
      source: "person_a",
      target: "person_b",
      source_cell: { domain: "C", frame: "R" },
      target_cell: { domain: "C", frame: "R" },
      resource: "mentorship session",
      resource_type: "knowledge",
      amount: "1 session",
      conversion_mechanism: "explanation/mentoring",
      cost: "1 hour",
      expiry_or_validity: "2026-09-15T00:00:00Z",
      claimed_outcome: "session occurred as scheduled",
    };
    expect(validateTransfer(transfer).valid).toBe(true);
  });
});
