import { describe, expect, it } from "vitest";

import type { Decision } from "../decision";
import {
  checkCausalClaim,
  DEFAULT_CAUSAL_SUPPORT,
  type DecisionReview,
  meetsStakesFloor,
  validateDecisionReview,
} from "../decisionReview";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    decision_id: "dec_001",
    subject: "person_roei",
    statement: "לעבור למסלול ההחלטות",
    because: "אין עבודת-משתמש אחת ברורה",
    expected_outcome: "שלוש החלטות רשומות תוך שבוע",
    alternatives_considered: ["להמשיך בפישוט ה-UI"],
    confidence: 0.6,
    stakes: "low",
    decided_at: "2026-08-28T09:00:00+03:00",
    review_due: "2026-09-04T09:00:00+03:00",
    record_origin: "REAL",
    ...overrides,
  };
}

function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    review_id: "rev_001",
    decision_ref: "dec_001",
    reviewer: "person_roei",
    what_happened: "נרשמו ארבע החלטות, שתיים מהן נסקרו",
    expectation_met: "met",
    verification_tier: "self_attested",
    causal_support: "happened_after",
    reviewed_at: "2026-09-04T10:00:00+03:00",
    reviewed_early: false,
    record_origin: "REAL",
    ...overrides,
  };
}

describe("validateDecisionReview", () => {
  it("accepts a complete record", () => {
    expect(validateDecisionReview(review())).toEqual({ valid: true, errors: [] });
  });

  it("accepts cannot_tell as a real outcome, not a failure to review", () => {
    const r = review({ expectation_met: "cannot_tell" });
    expect(validateDecisionReview(r).valid).toBe(true);
  });

  it("requires the person's own account of what happened", () => {
    expect(validateDecisionReview(review({ what_happened: "   " })).errors).toContainEqual({
      field: "what_happened",
      reason: "empty",
    });
  });

  it("refuses an unknown causal rung rather than coercing it", () => {
    expect(
      validateDecisionReview(review({ causal_support: "obviously_caused" as never })).errors,
    ).toContainEqual({ field: "causal_support", reason: "unknown_value" });
  });

  it("records reviewed_early explicitly — it is never hidden", () => {
    expect(validateDecisionReview(review({ reviewed_early: undefined as never })).errors).toContainEqual({
      field: "reviewed_early",
      reason: "not_a_boolean",
    });
  });
});

describe("the causal ladder", () => {
  it("gives chronology away for free", () => {
    const check = checkCausalClaim({
      claimed: "happened_after",
      decision: decision({ alternatives_considered: [] }),
      expectation_met: "cannot_tell",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("happened_after");
    expect(check.capped).toBe(false);
  });

  it("defaults to the weakest rung", () => {
    expect(DEFAULT_CAUSAL_SUPPORT).toBe("happened_after");
  });

  it("refuses correlation when the expectation could not be resolved", () => {
    const check = checkCausalClaim({
      claimed: "correlated",
      decision: decision(),
      expectation_met: "cannot_tell",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("happened_after");
    expect(check.capped).toBe(true);
    expect(check.reasons).toContain("expectation_unresolved");
  });

  it("lets a low-stakes self-attested review reach plausibly_contributed", () => {
    // `low` requires only self_attested, so the tier gate is satisfied.
    const check = checkCausalClaim({
      claimed: "plausibly_contributed",
      decision: decision({ stakes: "low" }),
      expectation_met: "met",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("plausibly_contributed");
    expect(check.capped).toBe(false);
  });

  it("does NOT let a significant decision reach it on self-attestation alone", () => {
    const check = checkCausalClaim({
      claimed: "plausibly_contributed",
      decision: decision({ stakes: "significant" }),
      expectation_met: "met",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("correlated");
    expect(check.capped).toBe(true);
    expect(check.reasons).toContain("verification_below_stakes");
  });

  it("refuses causal support when nothing else was ever on the table", () => {
    // With no alternative, "this is why it happened" has no competitor to
    // have beaten — the claim is unfalsifiable by construction.
    const check = checkCausalClaim({
      claimed: "causally_supported",
      decision: decision({ stakes: "low", alternatives_considered: [] }),
      expectation_met: "met",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("plausibly_contributed");
    expect(check.reasons).toContain("no_alternative_considered");
  });

  it("treats a whitespace-only alternative as no alternative", () => {
    const check = checkCausalClaim({
      claimed: "causally_supported",
      decision: decision({ stakes: "low", alternatives_considered: ["   "] }),
      expectation_met: "met",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("plausibly_contributed");
  });

  it("grants causally_supported when the expectation resolved, the tier holds and an alternative existed", () => {
    const check = checkCausalClaim({
      claimed: "causally_supported",
      decision: decision({ stakes: "significant", alternatives_considered: ["להמשיך ב-UI"] }),
      expectation_met: "not_met",
      verification_tier: "independent",
    });
    expect(check.entitled).toBe("causally_supported");
    expect(check.capped).toBe(false);
  });

  it("reserves experimentally_shown for a named repetition or control", () => {
    const base = {
      claimed: "experimentally_shown" as const,
      decision: decision({ stakes: "significant", alternatives_considered: ["אחרת"] }),
      expectation_met: "met" as const,
      verification_tier: "independent" as const,
    };
    expect(checkCausalClaim(base).entitled).toBe("causally_supported");
    expect(checkCausalClaim(base).reasons).toContain("no_comparison_basis");
    expect(checkCausalClaim({ ...base, comparison_basis: "חזרה על אותו תנאי בשבוע שאחרי" }).entitled)
      .toBe("experimentally_shown");
  });

  it("never rejects — an over-claim is recorded at the rung it earns", () => {
    const check = checkCausalClaim({
      claimed: "experimentally_shown",
      decision: decision({ alternatives_considered: [] }),
      expectation_met: "cannot_tell",
      verification_tier: "self_attested",
    });
    expect(check.entitled).toBe("happened_after");
    expect(check.capped).toBe(true);
  });

  it("reports only the conditions that actually bound the claim made", () => {
    // A review asking for `correlated` should not be told about comparison
    // bases it never wanted.
    const check = checkCausalClaim({
      claimed: "correlated",
      decision: decision({ stakes: "significant", alternatives_considered: [] }),
      expectation_met: "cannot_tell",
      verification_tier: "self_attested",
    });
    expect(check.reasons).toEqual(["expectation_unresolved"]);
  });

  it("coerces an unknown claimed rung to the default rather than throwing", () => {
    const check = checkCausalClaim({
      claimed: "definitely_caused" as never,
      decision: decision(),
      expectation_met: "met",
      verification_tier: "self_attested",
    });
    expect(check.claimed).toBe("happened_after");
    expect(check.entitled).toBe("happened_after");
  });
});

describe("meetsStakesFloor", () => {
  it("does not mark a low-stakes self-attested review as deficient", () => {
    expect(meetsStakesFloor(decision({ stakes: "low" }), review())).toBe(true);
  });

  it("marks a public claim without an independent verifier as below its floor", () => {
    expect(meetsStakesFloor(decision({ stakes: "public" }), review())).toBe(false);
  });
});
