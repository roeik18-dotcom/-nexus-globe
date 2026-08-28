import { describe, expect, it } from "vitest";

import {
  REQUIRED_TIER,
  requiredTierFor,
  type Decision,
  tierAtLeast,
  validateDecision,
} from "../decision";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    decision_id: "dec_001",
    subject: "person_roei",
    statement: "לעבור לעבוד על מסלול ההחלטות במקום על ה-UI",
    because: "המשוב אמר שאין עבודת-משתמש אחת ברורה",
    expected_outcome: "בעוד שבוע יהיו לפחות שלוש החלטות רשומות שאני חוזר אליהן",
    alternatives_considered: ["להמשיך בפישוט ה-UI"],
    confidence: 0.6,
    stakes: "medium",
    decided_at: "2026-08-28T09:00:00+03:00",
    review_due: "2026-09-04T09:00:00+03:00",
    record_origin: "REAL",
    ...overrides,
  };
}

describe("validateDecision", () => {
  it("accepts a complete record", () => {
    expect(validateDecision(decision())).toEqual({ valid: true, errors: [] });
  });

  it("reports every problem at once rather than one per attempt", () => {
    const result = validateDecision(
      decision({ statement: "  ", because: "", confidence: 2, stakes: "huge" as never }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { field: "statement", reason: "empty" },
        { field: "because", reason: "empty" },
        { field: "confidence", reason: "not_a_probability" },
        { field: "stakes", reason: "unknown_value" },
      ]),
    );
  });

  it("requires the expectation — it is what makes the review answerable", () => {
    const result = validateDecision(decision({ expected_outcome: "" }));
    expect(result.errors).toContainEqual({ field: "expected_outcome", reason: "empty" });
  });

  it("refuses a review horizon that is not after the decision", () => {
    const result = validateDecision(
      decision({ decided_at: "2026-08-28T09:00:00+03:00", review_due: "2026-08-28T09:00:00+03:00" }),
    );
    expect(result.errors).toContainEqual({ field: "review_due", reason: "not_after_decided_at" });
  });

  it("refuses a timestamp with no explicit offset", () => {
    const result = validateDecision(decision({ decided_at: "2026-08-28T09:00:00" }));
    expect(result.errors).toContainEqual({ field: "decided_at", reason: "invalid_or_no_offset" });
  });

  it("accepts an empty alternatives list — not every decision has a live one", () => {
    expect(validateDecision(decision({ alternatives_considered: [] })).valid).toBe(true);
  });

  it("refuses an unknown record origin rather than defaulting it to REAL", () => {
    const result = validateDecision(decision({ record_origin: "TRUSTED" as never }));
    expect(result.errors).toContainEqual({ field: "record_origin", reason: "unknown_value" });
  });
});

describe("the stakes → verification tiering", () => {
  it("lets a low-stakes decision be self-attested", () => {
    expect(REQUIRED_TIER.low).toBe("self_attested");
  });

  it("still demands an independent verifier for significant and public claims", () => {
    expect(REQUIRED_TIER.significant).toBe("independent");
    expect(REQUIRED_TIER.public).toBe("independent");
  });

  it("falls back to the STRICTEST tier for an unrecognised stakes value", () => {
    // A malformed record must never buy itself a weaker requirement.
    expect(requiredTierFor("nonsense")).toBe("independent");
  });

  it("treats the floor as a floor, never a ceiling", () => {
    expect(tierAtLeast("independent", "self_attested")).toBe(true);
    expect(tierAtLeast("self_attested", "independent")).toBe(false);
    expect(tierAtLeast("measured", "measured")).toBe(true);
  });
});
