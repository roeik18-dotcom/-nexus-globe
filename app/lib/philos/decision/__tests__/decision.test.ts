import { describe, expect, it } from "vitest";

import { type Decision, hasChosenAction, validateDecision } from "../decision";
import {
  levelAtLeast,
  REQUIRED_LEVEL,
  requiredLevelFor,
} from "../evidenceAxes";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    decision_id: "dec_001",
    case_id: "case_001",
    subject: "person_roei",
    statement: "לעבור לעבוד על מסלול ההחלטות במקום על ה-UI",
    because: "המשוב אמר שאין עבודת-משתמש אחת ברורה",
    decision_logic: "העדפתי את המסלול שמייצר ראיה מוקדם יותר",
    expected_outcome: "בעוד שבוע יהיו לפחות שלוש החלטות רשומות שאני חוזר אליהן",
    alternatives_considered: ["להמשיך בפישוט ה-UI"],
    observation_refs: [],
    chosen_action: { kind: "no_action_yet", because: "טרם בוצעה פעולה" },
    confidence: 0.6,
    stakes: "medium",
    decided_at: "2026-08-28T09:00:00+03:00",
    review_horizon: "2026-09-04T09:00:00+03:00",
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
      decision({ decided_at: "2026-08-28T09:00:00+03:00", review_horizon: "2026-08-28T09:00:00+03:00" }),
    );
    expect(result.errors).toContainEqual({ field: "review_horizon", reason: "not_after_decided_at" });
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

describe("the risk → outcome-verification policy", () => {
  it("lets a low-risk decision be self-attested", () => {
    expect(REQUIRED_LEVEL.low).toBe("self_attested");
  });

  it("accepts measured or corroborated for a significant decision", () => {
    // The floor is `measured`; `corroborated` is above it and also passes.
    expect(REQUIRED_LEVEL.significant).toBe("measured");
    expect(levelAtLeast("corroborated", REQUIRED_LEVEL.significant)).toBe(true);
  });

  it("demands independent verification for a public or irreversible claim", () => {
    expect(REQUIRED_LEVEL.public).toBe("independently_verified");
  });

  it("falls back to the STRICTEST level for an unrecognised risk value", () => {
    // A malformed record must never buy itself a weaker requirement.
    expect(requiredLevelFor("nonsense")).toBe("independently_verified");
  });

  it("treats the floor as a floor, never a ceiling", () => {
    expect(levelAtLeast("independently_verified", "self_attested")).toBe(true);
    expect(levelAtLeast("self_attested", "independently_verified")).toBe(false);
  });
});

describe("the decision→action link", () => {
  it("requires `no_action_yet` to say why", () => {
    const r = validateDecision(
      decision({ chosen_action: { kind: "no_action_yet", because: "  " } }),
    );
    expect(r.errors).toContainEqual({ field: "chosen_action", reason: "empty_reference" });
  });

  it("requires an `action` variant to name a real reference", () => {
    const r = validateDecision(decision({ chosen_action: { kind: "action", action_ref: "" } }));
    expect(r.errors).toContainEqual({ field: "chosen_action", reason: "empty_reference" });
  });

  it("tells 'nothing done yet' apart from 'action linked'", () => {
    expect(hasChosenAction(decision())).toBe(false);
    expect(
      hasChosenAction(decision({ chosen_action: { kind: "action", action_ref: "act_1" } })),
    ).toBe(true);
  });

  it("requires a case_id — a decision outside a case is unreachable", () => {
    expect(validateDecision(decision({ case_id: "" })).errors).toContainEqual({
      field: "case_id",
      reason: "empty",
    });
  });

  it("requires the decision logic that selected this option", () => {
    expect(validateDecision(decision({ decision_logic: "" })).errors).toContainEqual({
      field: "decision_logic",
      reason: "empty",
    });
  });
});
