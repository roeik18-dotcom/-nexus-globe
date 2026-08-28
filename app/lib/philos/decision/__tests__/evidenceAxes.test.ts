import { describe, expect, it } from "vitest";

import type { Effect } from "@/app/lib/philos/canon/effect";
import type { OutcomeVerification } from "@/app/lib/philos/canon/outcomeVerification";
import {
  CAUSAL_RELATION,
  checkCausalRelation,
  DEFAULT_CAUSAL_RELATION,
  meetsRiskFloor,
  outcomeVerificationLevel,
  REQUIRED_LEVEL,
} from "../evidenceAxes";

function verification(over: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "התוצאה התרחשה",
    provenance: "בדיקה",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-08-28T10:00:00+03:00",
    method: "בדיקה ידנית",
    ...over,
  };
}

function effect(over: Partial<Effect> = {}): Effect {
  return {
    effect_id: "eff_1",
    action_ref: "act_1",
    subject: "person_roei",
    concerns_subject_internal_state: false,
    claimed_outcome: verification(),
    context: "ctx",
    time: "2026-08-28T10:00:00+03:00",
    provenance: "self-initiated",
    ...over,
  };
}

describe("axis 1 — the outcome level is DERIVED from canon, never stored", () => {
  it("reads an unverified Effect as self-attested", () => {
    expect(outcomeVerificationLevel(effect())).toBe("self_attested");
  });

  it("maps each canon verifier type onto exactly one level", () => {
    const of = (t: OutcomeVerification["verifier_type"]) =>
      outcomeVerificationLevel(effect({ verified_outcome: verification({ verifier_type: t }) }));
    expect(of("self")).toBe("self_attested");
    expect(of("observed_measured")).toBe("measured");
    expect(of("counterparty")).toBe("corroborated");
    expect(of("third_party")).toBe("independently_verified");
  });

  it("defers to canon's own gate rather than overriding it", () => {
    // A third-party check of the subject's INTERNAL state without consent is
    // not verified per `isEffectVerified`. This module must not present it as
    // independently verified.
    const e = effect({
      concerns_subject_internal_state: true,
      verified_outcome: verification({ verifier_type: "third_party" }),
    });
    expect(outcomeVerificationLevel(e)).toBe("corroborated");
  });

  it("is total — a missing effect is self-attested, never a crash", () => {
    expect(outcomeVerificationLevel(undefined)).toBe("self_attested");
  });
});

describe("the risk policy", () => {
  it("permits self-attestation at low risk", () => {
    expect(meetsRiskFloor("self_attested", "low")).toBe(true);
  });

  it("accepts measured OR corroborated at significant risk", () => {
    expect(meetsRiskFloor("measured", "significant")).toBe(true);
    expect(meetsRiskFloor("corroborated", "significant")).toBe(true);
    expect(meetsRiskFloor("self_attested", "significant")).toBe(false);
  });

  it("requires independent verification for public or irreversible claims", () => {
    expect(meetsRiskFloor("corroborated", "public")).toBe(false);
    expect(meetsRiskFloor("independently_verified", "public")).toBe(true);
    expect(REQUIRED_LEVEL.public).toBe("independently_verified");
  });
});

describe("axis 2 — the causal relation", () => {
  const base = {
    risk_level: "low" as const,
    outcome_level: "self_attested" as const,
    expectation_resolved: true,
    alternative_explanations: ["אולי זה היה העונה"],
  };

  it("gives chronology away for free", () => {
    const r = checkCausalRelation({
      ...base,
      claimed: "occurred_after",
      expectation_resolved: false,
      alternative_explanations: [],
    });
    expect(r.entitled).toBe("occurred_after");
    expect(r.capped).toBe(false);
  });

  it("defaults to the weakest rung", () => {
    expect(DEFAULT_CAUSAL_RELATION).toBe("occurred_after");
  });

  it("refuses association when the expectation could not be resolved", () => {
    const r = checkCausalRelation({ ...base, claimed: "associated_with", expectation_resolved: false });
    expect(r.entitled).toBe("occurred_after");
    expect(r.reasons).toContain("expectation_unresolved");
  });

  it("refuses causal support with no alternative explanation", () => {
    const r = checkCausalRelation({
      ...base,
      claimed: "causally_supported",
      alternative_explanations: [],
    });
    expect(r.entitled).toBe("probably_contributed");
    expect(r.reasons).toContain("no_alternative_explanations");
  });

  it("reserves the top rung for a named repetition or control", () => {
    const args = { ...base, claimed: "experimentally_demonstrated" as const };
    expect(checkCausalRelation(args).entitled).toBe("causally_supported");
    expect(
      checkCausalRelation({ ...args, comparison_basis: "אותו תנאי בשבוע שאחרי" }).entitled,
    ).toBe("experimentally_demonstrated");
  });

  it("never rejects — an over-claim is returned at the rung it earns", () => {
    const r = checkCausalRelation({
      ...base,
      claimed: "experimentally_demonstrated",
      expectation_resolved: false,
      alternative_explanations: [],
    });
    expect(r.entitled).toBe("occurred_after");
    expect(r.capped).toBe(true);
  });
});

describe("THE SEPARATION: verifying an outcome never raises causality", () => {
  it("leaves a weak claim exactly where it was, at every outcome level", () => {
    // Same review, same everything, four verification levels. The causal
    // relation must not move: nobody claimed more than "it happened after".
    for (const outcome_level of [
      "self_attested",
      "measured",
      "corroborated",
      "independently_verified",
    ] as const) {
      const r = checkCausalRelation({
        claimed: "occurred_after",
        risk_level: "low",
        outcome_level,
        expectation_resolved: true,
        alternative_explanations: ["חלופה"],
        comparison_basis: "חזרה",
      });
      expect(r.entitled).toBe("occurred_after");
      expect(r.capped).toBe(false);
    }
  });

  it("independent verification alone does not reach probably_contributed", () => {
    // Everything is independently verified, but the reviewer claimed only
    // association — that is what gets stored.
    const r = checkCausalRelation({
      claimed: "associated_with",
      risk_level: "public",
      outcome_level: "independently_verified",
      expectation_resolved: true,
      alternative_explanations: ["חלופה"],
    });
    expect(r.entitled).toBe("associated_with");
  });

  it("can only ever LOWER a claim, never raise one", () => {
    // Exhaustive: for every claim and every outcome level, the result index
    // is never greater than the claimed index.
    for (const claimed of CAUSAL_RELATION) {
      for (const outcome_level of [
        "self_attested",
        "measured",
        "corroborated",
        "independently_verified",
      ] as const) {
        const r = checkCausalRelation({
          claimed,
          risk_level: "low",
          outcome_level,
          expectation_resolved: true,
          alternative_explanations: ["a"],
          comparison_basis: "b",
        });
        expect(CAUSAL_RELATION.indexOf(r.entitled)).toBeLessThanOrEqual(
          CAUSAL_RELATION.indexOf(claimed),
        );
      }
    }
  });

  it("uses the outcome axis only as a NECESSARY condition, stated as such", () => {
    // Below the floor, the causal claim is capped — that is a block, not a
    // boost. Above the floor it is merely permitted, never granted.
    const below = checkCausalRelation({
      claimed: "probably_contributed",
      risk_level: "public",
      outcome_level: "self_attested",
      expectation_resolved: true,
      alternative_explanations: [],
    });
    expect(below.entitled).toBe("associated_with");
    expect(below.reasons).toContain("outcome_below_risk_floor");
  });
});
