import { describe, expect, it } from "vitest";

import { appraise, APPRAISALS, assertsRelevance, validateAppraisal, type Appraisal } from "../gap";
import {
  checkTradeoff,
  checkValueImpact,
  impactMatchedExpectation,
  tradeoffContradictions,
  validateValueConflict,
  validateValueTradeoff,
  type ValueConflict,
  type ValueImpact,
  type ValueTradeoff,
} from "../valueMechanism";

describe("GATE 1 — a gap is not a problem until a value says so", () => {
  it("refuses shortage/threat/opportunity with no value cited", () => {
    for (const kind of ["shortage", "threat", "opportunity"] as const) {
      const r = appraise({ kind, value_refs: [], heldValueIds: ["v_love"] });
      expect(r.ok).toBe(false);
      expect(r.refusal).toBe("no_value_cited");
    }
  });

  it("allows dismissal with no value — refusing to care needs no justification", () => {
    for (const kind of ["acceptable_tradeoff", "not_relevant"] as const) {
      expect(appraise({ kind, value_refs: [], heldValueIds: [] }).ok).toBe(true);
    }
  });

  it("refuses a value the appraiser has not declared", () => {
    const r = appraise({
      kind: "shortage",
      value_refs: ["v_status"],
      heldValueIds: ["v_love"],
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("value_not_held_by_appraiser");
    expect(r.message).toContain("v_status");
  });

  it("accepts a cited value the appraiser holds, and returns it as the basis", () => {
    const r = appraise({
      kind: "shortage",
      value_refs: ["v_love", "  "],
      heldValueIds: ["v_love"],
    });
    expect(r.ok).toBe(true);
    expect(r.basis).toEqual(["v_love"]);
  });

  it("keeps the rule structurally, not only in the writer", () => {
    // Even if some future writer forgets to call `appraise`, the record
    // cannot exist in the forbidden shape.
    const a = {
      appraisal_id: "ap_1",
      case_id: "case_1",
      gap_ref: "gap_1",
      appraiser: "person_roei",
      kind: "shortage",
      value_refs: [],
      because: "כי",
      salience: "high",
      appraised_at: "2026-08-28T09:00:00+03:00",
      context: "ctx",
      record_origin: "REAL",
    } as Appraisal;
    expect(validateAppraisal(a).errors).toContainEqual({
      field: "value_refs",
      reason: "required_for_this_kind",
    });
  });

  it("marks exactly the three kinds that assert relevance", () => {
    expect(APPRAISALS.filter(assertsRelevance)).toEqual(["shortage", "threat", "opportunity"]);
  });
});

describe("GATE 2 — a decision may not ignore a conflict it already recorded", () => {
  const conflicts = [
    { conflict_id: "c_active", tension_level: "active" as const },
    { conflict_id: "c_latent", tension_level: "latent" as const },
  ];

  it("refuses a decision that leaves an active conflict unanswered", () => {
    const r = checkTradeoff({
      tradeoff: {
        conflict_refs: [],
        prioritized_value_refs: ["v_love"],
        deprioritized_value_refs: ["v_status"],
      },
      caseConflicts: conflicts,
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("conflict_unanswered");
    expect(r.unanswered).toEqual(["c_active"]);
  });

  it("exempts latent conflicts — noticing is not facing", () => {
    const r = checkTradeoff({
      tradeoff: {
        conflict_refs: ["c_active"],
        prioritized_value_refs: ["v_love"],
        deprioritized_value_refs: ["v_status"],
      },
      caseConflicts: conflicts,
    });
    expect(r.ok).toBe(true);
  });

  it("refuses a tradeoff that gives nothing up", () => {
    const r = checkTradeoff({
      tradeoff: {
        conflict_refs: ["c_active"],
        prioritized_value_refs: ["v_love"],
        deprioritized_value_refs: [],
      },
      caseConflicts: conflicts,
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("no_price_paid");
  });

  it("refuses the same value on both sides", () => {
    const r = checkTradeoff({
      tradeoff: {
        conflict_refs: ["c_active"],
        prioritized_value_refs: ["v_love"],
        deprioritized_value_refs: ["v_love"],
      },
      caseConflicts: conflicts,
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("value_on_both_sides");
  });

  it("passes a case with no conflicts at all", () => {
    expect(checkTradeoff({ caseConflicts: [] }).ok).toBe(true);
  });

  it("keeps 'a tradeoff costs something' structurally too", () => {
    const t = {
      tradeoff_id: "t_1",
      case_id: "case_1",
      decision_ref: "dec_1",
      conflict_refs: [],
      prioritized_value_refs: ["v_love"],
      deprioritized_value_refs: [],
      rationale: "כי",
      decided_at: "2026-08-28T09:00:00+03:00",
      record_origin: "REAL",
    } as ValueTradeoff;
    expect(validateValueTradeoff(t).errors).toContainEqual({
      field: "deprioritized_value_refs",
      reason: "empty_list",
    });
  });
});

describe("GATE 3 — a claim about a value moving needs evidence", () => {
  it("refuses a non-unknown direction with no evidence", () => {
    const r = checkValueImpact({
      observed_direction: "advanced",
      evidence_refs: [],
      value_ref: "v_love",
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("observed_without_evidence");
  });

  it("always permits `unknown`, so nobody is pushed into inventing a direction", () => {
    expect(
      checkValueImpact({ observed_direction: "unknown", evidence_refs: [], value_ref: "v_love" }).ok,
    ).toBe(true);
  });

  it("refuses an impact on a value the decision never weighed", () => {
    const r = checkValueImpact({
      observed_direction: "advanced",
      evidence_refs: ["ver_1"],
      value_ref: "v_unrelated",
      tradeoffValues: ["v_love", "v_status"],
    });
    expect(r.ok).toBe(false);
    expect(r.refusal).toBe("value_not_in_tradeoff");
  });

  it("accepts a weighed value with evidence", () => {
    expect(
      checkValueImpact({
        observed_direction: "set_back",
        evidence_refs: ["ver_1"],
        value_ref: "v_status",
        tradeoffValues: ["v_love", "v_status"],
      }).ok,
    ).toBe(true);
  });
});

describe("the conflict record", () => {
  const base: ValueConflict = {
    conflict_id: "c_1",
    case_id: "case_1",
    value_a_ref: "v_love",
    value_b_ref: "v_status",
    subject: "person_roei",
    context: "יחסים מול קבוצת חברים",
    tension_level: "active",
    evidence_refs: ["ver_1"],
    recognised_at: "2026-08-28T09:00:00+03:00",
    record_origin: "REAL",
  };

  it("accepts a complete record", () => {
    expect(validateValueConflict(base).valid).toBe(true);
  });

  it("refuses a value in conflict with itself", () => {
    expect(validateValueConflict({ ...base, value_b_ref: "v_love" }).errors).toContainEqual({
      field: "value_b_ref",
      reason: "same_as_value_a",
    });
  });

  it("requires evidence above `latent` — a live conflict is a claim", () => {
    expect(validateValueConflict({ ...base, evidence_refs: [] }).errors).toContainEqual({
      field: "evidence_refs",
      reason: "required_above_latent",
    });
  });

  it("allows a latent conflict with no evidence", () => {
    expect(
      validateValueConflict({ ...base, tension_level: "latent", evidence_refs: [] }).valid,
    ).toBe(true);
  });
});

describe("did the decision serve the value it said it would", () => {
  const impact = (over: Partial<ValueImpact>): ValueImpact => ({
    impact_id: "i_1",
    case_id: "case_1",
    effect_ref: "eff_1",
    value_ref: "v_love",
    expected_direction: "advanced",
    observed_direction: "advanced",
    evidence_refs: ["ver_1"],
    observed_at: "2026-09-04T09:00:00+03:00",
    record_origin: "REAL",
    ...over,
  });

  it("says nothing when either side is unknown", () => {
    expect(impactMatchedExpectation(impact({ observed_direction: "unknown" }))).toBeNull();
  });

  it("names the impacts that contradicted the tradeoff's own prediction", () => {
    const contradicted = tradeoffContradictions([
      impact({}),
      impact({ impact_id: "i_2", value_ref: "v_status", expected_direction: "set_back", observed_direction: "advanced" }),
      impact({ impact_id: "i_3", observed_direction: "unknown" }),
    ]);
    expect(contradicted.map((i) => i.impact_id)).toEqual(["i_2"]);
  });
});
