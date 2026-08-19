/**
 * Philos Canon — Offer, validated (PHILOS-MELTING-POT-CANON.md §11, donor-side
 * schema closure).
 *
 * Named assertions requested for this pass: OFFER_VALID, OFFER_EXPIRY_REQUIRED,
 * OFFER_CONSENT_REQUIRED, OFFER_WILLINGNESS_REQUIRED,
 * OFFER_COMPETENCE_REPRESENTABLE, OFFER_RESOURCE_TYPED,
 * OFFER_NOT_PERMANENT_PROFILE, NO_CONTRIBUTION_COUNTER, NO_PERSON_SCORE,
 * NO_CROSS_FRAME_AGGREGATION, OFFER_DOES_NOT_CREATE_MATCH,
 * OFFER_DOES_NOT_CREATE_TRANSFER, OFFER_DOES_NOT_CREATE_NEED,
 * CELLSTATE_NEED_TARGET_REGRESSION_PASS.
 */
import { describe, expect, it } from "vitest";
import { type CellState, validateCellState } from "../cellState";
import { type Need, validateNeed } from "../need";
import * as offerModule from "../offer";
import { type Offer, RESOURCE_TYPE_EXAMPLES, validateOffer } from "../offer";
import { type Target, validateTarget } from "../target";

function baseOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    offer_id: "offer_001",
    source: "person_roei",
    source_cell: { domain: "C", frame: "R" },
    available_resource: "mixing/mastering guidance",
    resource_type: "knowledge",
    amount_or_capacity: "2 sessions this month",
    competence: "professional",
    willingness: true,
    consent: true,
    availability: "weekday evenings",
    cost: "none — time only",
    constraints: ["remote only"],
    expiry: "2026-09-12T20:00:00Z",
    provenance: "self_declared",
    ...overrides,
  };
}

describe("OFFER_VALID", () => {
  it("accepts a complete, canon-shaped Offer", () => {
    const result = validateOffer(baseOffer());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts an empty constraints array (no constraints is a valid state, not a missing field)", () => {
    const result = validateOffer(baseOffer({ constraints: [] }));
    expect(result.valid).toBe(true);
  });

  it("accepts a numeric amount_or_capacity as well as a descriptive string", () => {
    expect(validateOffer(baseOffer({ amount_or_capacity: 3 })).valid).toBe(true);
    expect(validateOffer(baseOffer({ amount_or_capacity: "a few hours" })).valid).toBe(true);
  });

  it("has no `time` field — canon's Offer schema closure (§11) does not list one, unlike Observation/Need/Target", () => {
    const offer = baseOffer();
    expect(Object.prototype.hasOwnProperty.call(offer, "time")).toBe(false);
  });
});

describe("OFFER_EXPIRY_REQUIRED", () => {
  it("rejects a missing/unparseable expiry", () => {
    const result = validateOffer(baseOffer({ expiry: "not-a-date" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "expiry",
      reason: "invalid_or_no_offset",
    });
  });

  it("rejects an offsetless expiry (host-timezone non-determinism)", () => {
    const result = validateOffer(baseOffer({ expiry: "2026-09-12T20:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "expiry",
      reason: "invalid_or_no_offset",
    });
  });

  it("accepts a well-formed offset expiry with no comparison against a time field (none exists)", () => {
    const result = validateOffer(baseOffer({ expiry: "2020-01-01T00:00:00Z" }));
    // Deliberately a "past" date relative to today, still passes: with no
    // `time` field on Offer, there is nothing canon-cited to compare expiry
    // against — this validator only checks well-formedness, not staleness.
    expect(result.valid).toBe(true);
  });
});

describe("OFFER_CONSENT_REQUIRED", () => {
  it("rejects consent: false", () => {
    const result = validateOffer(baseOffer({ consent: false }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "consent", reason: "not_true" });
  });

  it("rejects a missing/non-boolean consent", () => {
    const result = validateOffer(
      baseOffer({ consent: undefined as unknown as boolean }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "consent", reason: "not_true" });
  });

  it("mandatory means must be true, not merely present as any truthy-looking value", () => {
    const result = validateOffer(
      baseOffer({ consent: "yes" as unknown as boolean }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "consent", reason: "not_true" });
  });
});

describe("OFFER_WILLINGNESS_REQUIRED", () => {
  it("rejects willingness: false", () => {
    const result = validateOffer(baseOffer({ willingness: false }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "willingness", reason: "not_true" });
  });

  it("rejects a missing willingness", () => {
    const result = validateOffer(
      baseOffer({ willingness: undefined as unknown as boolean }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "willingness", reason: "not_true" });
  });
});

describe("OFFER_COMPETENCE_REPRESENTABLE", () => {
  it("accepts a free-text competence description — not scored or bounded", () => {
    expect(validateOffer(baseOffer({ competence: "beginner" })).valid).toBe(true);
    expect(validateOffer(baseOffer({ competence: "20 years professional experience" })).valid).toBe(
      true,
    );
  });

  it("requires competence to be present (representable means present, not merely inferable)", () => {
    const result = validateOffer(baseOffer({ competence: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "competence", reason: "empty" });
  });
});

describe("OFFER_RESOURCE_TYPED", () => {
  it("accepts every canon-named example resource_type", () => {
    for (const resource_type of RESOURCE_TYPE_EXAMPLES) {
      expect(validateOffer(baseOffer({ resource_type })).valid).toBe(true);
    }
  });

  it("accepts a resource_type NOT in the example list — canon's own list ends in '...', deliberately open-ended", () => {
    const result = validateOffer(baseOffer({ resource_type: "studio_time_slot" }));
    expect(result.valid).toBe(true);
  });

  it("still requires resource_type to be present", () => {
    const result = validateOffer(baseOffer({ resource_type: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "resource_type", reason: "empty" });
  });
});

describe("OFFER_NOT_PERMANENT_PROFILE", () => {
  it("this module exports no store, persistence, or 'all offers for a source' function", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of [
      "saveOffer",
      "offerStore",
      "allOffersFor",
      "offerHistory",
      "donorProfile",
      "capabilityProfile",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("every valid Offer carries its own expiry — ephemerality is structural, not optional", () => {
    const result = validateOffer(baseOffer({ expiry: undefined as unknown as string }));
    expect(result.valid).toBe(false);
  });
});

describe("NO_CONTRIBUTION_COUNTER", () => {
  it("the Offer type carries no cumulative-contribution field", () => {
    const offer = baseOffer();
    for (const forbidden of [
      "contributionCount",
      "totalContributions",
      "timesOffered",
      "history",
    ]) {
      expect(Object.prototype.hasOwnProperty.call(offer, forbidden)).toBe(false);
    }
  });

  it("this module exports no function that increments/tracks a contribution count", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of ["incrementContribution", "trackContribution", "contributionCounter"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_PERSON_SCORE", () => {
  it("the Offer type carries no reputation/social-credit/trust field", () => {
    const offer = baseOffer();
    for (const forbidden of ["reputation", "trustScore", "socialCredit", "rating"]) {
      expect(Object.prototype.hasOwnProperty.call(offer, forbidden)).toBe(false);
    }
  });

  it("this module exports no scoring/ranking/priority function", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of [
      "score",
      "rank",
      "rankOffers",
      "personScore",
      "priority",
      "donorScore",
      "reputationScore",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CROSS_FRAME_AGGREGATION", () => {
  it("this module exports no function that combines multiple Offer instances across frames or subjects", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of [
      "aggregate",
      "aggregateAcrossFrames",
      "combine",
      "merge",
      "sum",
      "totalOffers",
      "crossFrameSummary",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("OFFER_DOES_NOT_CREATE_MATCH", () => {
  it("this module exports no matching/eligibility function of any kind", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of ["match", "createMatch", "matchOfferToNeed", "isPermitted", "canMatch"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("OFFER_DOES_NOT_CREATE_TRANSFER", () => {
  it("this module exports no Transfer-producing function", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of ["createTransfer", "toTransfer", "executeTransfer", "transfer"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("OFFER_DOES_NOT_CREATE_NEED", () => {
  it("this module exports no Need-deriving function — an Offer never manufactures a Need", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of ["createNeed", "deriveNeedFromOffer", "inferNeed", "toNeed"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("no function anywhere in this module triggers automatic intervention", () => {
    const mod = offerModule as unknown as Record<string, unknown>;
    for (const name of ["triggerIntervention", "autoIntervene", "intervene"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("Offer — SystemicChannel on source_cell (canon §18, Offer IS named)", () => {
  it("requires systemic_channel_if_S when source_cell.frame === S", () => {
    const result = validateOffer(baseOffer({ source_cell: { domain: "G", frame: "S" } }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "systemic_channel_if_S",
      reason: "required_when_frame_is_S",
    });
  });

  it("accepts source_cell.frame === S once systemic_channel_if_S is supplied", () => {
    const result = validateOffer(
      baseOffer({
        source_cell: { domain: "G", frame: "S" },
        systemic_channel_if_S: "material",
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("does not require systemic_channel_if_S outside frame=S", () => {
    expect(validateOffer(baseOffer({ source_cell: { domain: "G", frame: "I" } })).valid).toBe(
      true,
    );
  });
});

describe("Offer — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateOffer({} as unknown as Offer)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseOffer();
    expect(validateOffer(input)).toEqual(validateOffer(input));
  });

  it("reports all applicable errors at once, not short-circuited", () => {
    const result = validateOffer(
      baseOffer({ offer_id: "", source: "", consent: false, willingness: false }),
    );
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["consent", "offer_id", "source", "willingness"]);
  });
});

describe("CELLSTATE_NEED_TARGET_REGRESSION_PASS", () => {
  it("CellState still validates correctly", () => {
    const state: CellState = { domain: "E", frame: "I", level: 0.4, stability: 0.7 };
    expect(validateCellState(state).valid).toBe(true);
  });

  it("Need still validates correctly", () => {
    const need: Need = {
      need_id: "need_regress",
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

  it("Target still validates correctly, including the external-intervention rule", () => {
    const target: Target = {
      target_id: "target_regress",
      subject: "person_roei",
      cell: { domain: "C", frame: "R" },
      desired_state: "team alignment restored",
      reference_type: "peer",
      provenance: "manager_suggested",
      consent_status: "granted",
      context: "sprint_retro",
      time: "2026-08-12T20:00:00Z",
      expiry: "2026-09-12T20:00:00Z",
    };
    expect(validateTarget(target).valid).toBe(true);
  });
});
