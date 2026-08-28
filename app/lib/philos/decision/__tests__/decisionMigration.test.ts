import { describe, expect, it } from "vitest";

import {
  CAUSAL_SUPPORT_V1_TO_V2,
  describePlan,
  type DecisionReviewV1,
  type DecisionV1,
  migrateDecisions,
  migrateReviews,
  TIER_V1_TO_LEVEL,
} from "../decisionMigration";
import { CAUSAL_RELATION } from "../evidenceAxes";

const v1Decision: DecisionV1 = {
  decision_id: "dec_v1",
  subject: "person_roei",
  statement: "החלטה ישנה",
  because: "סיבה",
  expected_outcome: "ציפייה",
  alternatives_considered: ["חלופה"],
  confidence: 0.6,
  stakes: "significant",
  decided_at: "2026-08-28T09:00:00+03:00",
  review_due: "2026-09-04T09:00:00+03:00",
  record_origin: "REAL",
};

const v1Review: DecisionReviewV1 = {
  review_id: "rev_v1",
  decision_ref: "dec_v1",
  reviewer: "person_roei",
  what_happened: "זה קרה",
  expectation_met: "met",
  surprise: "לא ציפיתי לחלק הזה",
  verification_tier: "self_attested",
  causal_support: "plausibly_contributed",
  reviewed_at: "2026-09-04T10:00:00+03:00",
  reviewed_early: false,
  record_origin: "REAL",
};

describe("the v1 → v2 rename that IS mechanical", () => {
  it("maps every v1 causal rung onto a real v2 rung", () => {
    const mapped = Object.values(CAUSAL_SUPPORT_V1_TO_V2);
    expect(mapped).toHaveLength(5);
    for (const v of mapped) expect(CAUSAL_RELATION).toContain(v);
  });

  it("preserves the order — no record changes rung in the rename", () => {
    const v1Order = [
      "happened_after",
      "correlated",
      "plausibly_contributed",
      "causally_supported",
      "experimentally_shown",
    ];
    expect(v1Order.map((k) => CAUSAL_SUPPORT_V1_TO_V2[k])).toEqual([...CAUSAL_RELATION]);
  });

  it("records what a v1 tier CLAIMED without letting it be written back", () => {
    // The v2 outcome level is derived from the canon Effect. This map exists
    // so a report can say what v1 asserted, not so anything can store it.
    expect(TIER_V1_TO_LEVEL.independent).toBe("independently_verified");
  });
});

describe("migrating v1 decisions", () => {
  it("never adapts one automatically — case_id and decision_logic cannot be derived", () => {
    const plan = migrateDecisions([v1Decision]);
    expect(plan.ready).toBe(0);
    expect(plan.needs_attention).toBe(1);
    expect(plan.entries[0].to).toBeUndefined();
    expect(plan.entries[0].missing).toContain("case_id");
    expect(plan.entries[0].missing).toContain("decision_logic");
  });

  it("does not fabricate a chosen action", () => {
    const plan = migrateDecisions([v1Decision]);
    expect(plan.entries[0].missing).toContain("chosen_action");
    expect(plan.entries[0].to).toBeUndefined();
  });

  it("is pure — it returns a plan and writes nothing", async () => {
    const before = JSON.stringify(v1Decision);
    migrateDecisions([v1Decision]);
    expect(JSON.stringify(v1Decision)).toBe(before);
  });
});

describe("migrating v1 reviews", () => {
  it("says where each duplicated field BELONGS rather than retyping it", () => {
    const plan = migrateReviews([v1Review]);
    const moves = plan.entries[0].moves;
    expect(moves.find((m) => m.field === "what_happened")!.to).toBe(
      "Effect.claimed_outcome.statement",
    );
    expect(moves.find((m) => m.field === "reviewer")!.to).toBe(
      "OutcomeVerification.verifier_id",
    );
    expect(moves.find((m) => m.field === "verification_tier")!.to).toContain(
      "OutcomeVerification.verifier_type",
    );
    expect(moves.find((m) => m.field === "surprise")!.to).toBe("Learning.context");
  });

  it("refuses to synthesise the Effect a v2 review requires", () => {
    // v2 needs `effect_ref`; creating that Effect needs an `action_ref` v1
    // never held, and inventing one would fabricate the causal link.
    const plan = migrateReviews([v1Review]);
    expect(plan.entries[0].missing).toContain("effect_ref");
    expect(plan.entries[0].to).toBeUndefined();
    expect(plan.ready).toBe(0);
  });

  it("only asks for a Learning when the v1 record actually held one", () => {
    const withSurprise = migrateReviews([v1Review]).entries[0];
    expect(withSurprise.missing).toContain("learning_for_surprise");

    const without = migrateReviews([{ ...v1Review, surprise: "   " }]).entries[0];
    expect(without.missing).not.toContain("learning_for_surprise");
    expect(without.moves.some((m) => m.field === "surprise")).toBe(false);
  });

  it("handles an empty log without inventing entries", () => {
    const plan = migrateReviews([]);
    expect(plan.entries).toEqual([]);
    expect(plan.needs_attention).toBe(0);
  });
});

describe("the report", () => {
  it("states the counts and every field that moves", () => {
    const text = describePlan(migrateDecisions([v1Decision]), migrateReviews([v1Review]));
    expect(text).toContain("v1 decisions: 1");
    expect(text).toContain("v1 reviews:   1");
    expect(text).toContain("what_happened → Effect.claimed_outcome.statement");
  });
});
