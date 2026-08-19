/**
 * Philos Canon — Matching, validated (PHILOS-MELTING-POT-CANON.md §10,
 * boolean gate).
 *
 * Named assertions requested for this pass: MATCH_VALID_ALL_GATES_TRUE,
 * MATCH_REJECT_CAN_FALSE, MATCH_REJECT_WANTS_FALSE, MATCH_REJECT_ALLOWED_FALSE,
 * MATCH_REJECT_APPROPRIATE_FALSE, MATCH_REJECT_AVAILABLE_FALSE,
 * MATCH_REJECT_CONSENT_FALSE, MATCH_MISSING_GATE_INVALID,
 * MATCH_EXPIRED_NEED_REJECTED, MATCH_EXPIRED_OFFER_REJECTED,
 * MATCH_DOES_NOT_CREATE_TRANSFER, MATCH_DOES_NOT_CREATE_ACTION,
 * MATCH_DOES_NOT_ALLOCATE_AMOUNT, NO_OPTIMIZER, NO_PERSON_SCORE,
 * NO_CONTRIBUTION_COUNTER, NO_CROSS_FRAME_AGGREGATION,
 * CELLSTATE_NEED_TARGET_OFFER_REGRESSION_PASS.
 */
import { describe, expect, it } from "vitest";
import { type CellState, validateCellState } from "../cellState";
import * as matchModule from "../matching";
import {
  evaluateMatch,
  type MatchAttempt,
  validateMatchAttempt,
} from "../matching";
import { type Need, validateNeed } from "../need";
import { type Offer, validateOffer } from "../offer";
import { type Target, validateTarget } from "../target";

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_match_001",
    subject: "person_b",
    desired_change: "learn mixing fundamentals",
    scope: { kind: "cells", cells: [{ domain: "C", frame: "R" }] },
    provenance: "self_reported",
    context: "skill_gap",
    time: "2026-08-01T00:00:00Z",
    expiry: "2026-12-01T00:00:00Z",
    consent_scope: "visible_to_matched_offers",
    ...overrides,
  };
}

function baseOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    offer_id: "offer_match_001",
    source: "person_a",
    source_cell: { domain: "C", frame: "R" },
    available_resource: "mixing mentorship",
    resource_type: "knowledge",
    amount_or_capacity: "2 sessions",
    competence: "professional",
    willingness: true,
    consent: true,
    availability: "weekends",
    cost: "none",
    constraints: [],
    expiry: "2026-12-01T00:00:00Z",
    provenance: "self_declared",
    ...overrides,
  };
}

function baseAttempt(overrides: Partial<MatchAttempt> = {}): MatchAttempt {
  return {
    match_id: "match_001",
    need_ref: "need_match_001",
    offer_ref: "offer_match_001",
    source: "person_a",
    target: "person_b",
    cell: { domain: "C", frame: "R" },
    CAN: true,
    WANTS: true,
    ALLOWED: true,
    APPROPRIATE: true,
    AVAILABLE: true,
    CONSENT: true,
    context: "mentorship_matching_round",
    time: "2026-08-15T00:00:00Z",
    ...overrides,
  };
}

describe("MATCH_VALID_ALL_GATES_TRUE", () => {
  it("permits a match when all six gates are true, refs match, and nothing is expired", () => {
    const need = baseNeed();
    const offer = baseOffer();
    expect(validateNeed(need).valid).toBe(true);
    expect(validateOffer(offer).valid).toBe(true);
    const result = evaluateMatch(baseAttempt(), need, offer);
    expect(result.decision).toBe("permitted");
    expect(result.rejection_reasons).toEqual([]);
    expect(result.match_id).toBe("match_001");
  });
});

describe("MATCH_REJECT_CAN_FALSE", () => {
  it("rejects when CAN is false, even if all other five gates are true", () => {
    const result = evaluateMatch(baseAttempt({ CAN: false }), baseNeed(), baseOffer());
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("CAN_false");
  });
});

describe("MATCH_REJECT_WANTS_FALSE", () => {
  it("rejects when WANTS is false", () => {
    const result = evaluateMatch(baseAttempt({ WANTS: false }), baseNeed(), baseOffer());
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("WANTS_false");
  });
});

describe("MATCH_REJECT_ALLOWED_FALSE", () => {
  it("rejects when ALLOWED is false", () => {
    const result = evaluateMatch(baseAttempt({ ALLOWED: false }), baseNeed(), baseOffer());
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("ALLOWED_false");
  });
});

describe("MATCH_REJECT_APPROPRIATE_FALSE", () => {
  it("rejects when APPROPRIATE is false (safety/appropriateness is a hard gate)", () => {
    const result = evaluateMatch(baseAttempt({ APPROPRIATE: false }), baseNeed(), baseOffer());
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("APPROPRIATE_false");
  });
});

describe("MATCH_REJECT_AVAILABLE_FALSE", () => {
  it("rejects when AVAILABLE is false", () => {
    const result = evaluateMatch(baseAttempt({ AVAILABLE: false }), baseNeed(), baseOffer());
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("AVAILABLE_false");
  });
});

describe("MATCH_REJECT_CONSENT_FALSE", () => {
  it("rejects when CONSENT is false (consent is a hard gate, never a soft cost)", () => {
    const result = evaluateMatch(baseAttempt({ CONSENT: false }), baseNeed(), baseOffer());
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("CONSENT_false");
  });

  it("five true gates cannot outweigh one false gate — no soft-cost override", () => {
    const result = evaluateMatch(
      baseAttempt({ CAN: true, WANTS: true, ALLOWED: true, APPROPRIATE: true, AVAILABLE: true, CONSENT: false }),
      baseNeed(),
      baseOffer(),
    );
    expect(result.decision).toBe("not_permitted");
  });
});

describe("MATCH_MISSING_GATE_INVALID", () => {
  it("a missing (non-boolean) gate makes the attempt invalid, never assumed true", () => {
    const attempt = baseAttempt({ AVAILABLE: undefined as unknown as boolean });
    const structural = validateMatchAttempt(attempt);
    expect(structural.valid).toBe(false);
    expect(structural.errors).toContainEqual({ field: "AVAILABLE", reason: "not_a_boolean" });

    const result = evaluateMatch(attempt, baseNeed(), baseOffer());
    expect(result.decision).toBe("invalid");
    expect(result.rejection_reasons).toEqual(["attempt_malformed"]);
  });

  it("'invalid' (under-specified) is a distinct decision from 'not_permitted' (fully specified, formula false)", () => {
    const missing = evaluateMatch(
      baseAttempt({ CONSENT: undefined as unknown as boolean }),
      baseNeed(),
      baseOffer(),
    );
    const falseGate = evaluateMatch(baseAttempt({ CONSENT: false }), baseNeed(), baseOffer());
    expect(missing.decision).toBe("invalid");
    expect(falseGate.decision).toBe("not_permitted");
    expect(missing.decision).not.toBe(falseGate.decision);
  });

  it("a truthy non-boolean (e.g. the string 'true') is still rejected as invalid, never coerced", () => {
    const attempt = baseAttempt({ CAN: "true" as unknown as boolean });
    const result = evaluateMatch(attempt, baseNeed(), baseOffer());
    expect(result.decision).toBe("invalid");
  });
});

describe("MATCH_EXPIRED_NEED_REJECTED", () => {
  it("rejects a match whose referenced Need has already expired as of attempt.time", () => {
    const expiredNeed = baseNeed({
      time: "2026-01-01T00:00:00Z",
      expiry: "2026-02-01T00:00:00Z", // expired before the attempt's time below
    });
    const result = evaluateMatch(
      baseAttempt({ time: "2026-08-15T00:00:00Z" }),
      expiredNeed,
      baseOffer(),
    );
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("need_expired");
  });

  it("rejects even when all six gates are true — expiry is checked independently of the boolean formula", () => {
    const expiredNeed = baseNeed({ expiry: "2026-08-14T00:00:00Z" });
    const result = evaluateMatch(
      baseAttempt({
        time: "2026-08-15T00:00:00Z",
        CAN: true,
        WANTS: true,
        ALLOWED: true,
        APPROPRIATE: true,
        AVAILABLE: true,
        CONSENT: true,
      }),
      expiredNeed,
      baseOffer(),
    );
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("need_expired");
  });
});

describe("MATCH_EXPIRED_OFFER_REJECTED", () => {
  it("rejects a match whose referenced Offer has already expired as of attempt.time", () => {
    const expiredOffer = baseOffer({ expiry: "2026-08-01T00:00:00Z" });
    const result = evaluateMatch(
      baseAttempt({ time: "2026-08-15T00:00:00Z" }),
      baseNeed(),
      expiredOffer,
    );
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("offer_expired");
  });
});

describe("MATCH_DOES_NOT_CREATE_TRANSFER", () => {
  it("this module exports no Transfer-producing function", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of ["createTransfer", "toTransfer", "executeTransfer", "transfer"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("MatchResult carries no transfer/flow fields — 'Matching ≠ Flow' (canon §10)", () => {
    const result = evaluateMatch(baseAttempt(), baseNeed(), baseOffer());
    for (const forbidden of ["amount", "resource", "flow", "transfer_id"]) {
      expect(Object.prototype.hasOwnProperty.call(result, forbidden)).toBe(false);
    }
  });
});

describe("MATCH_DOES_NOT_CREATE_ACTION", () => {
  it("this module exports no Action-producing function", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of ["createAction", "toAction", "executeAction", "action"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("MATCH_DOES_NOT_ALLOCATE_AMOUNT", () => {
  it("MatchResult's only fields are match_id, decision, rejection_reasons — no amount/quantity", () => {
    const result = evaluateMatch(baseAttempt(), baseNeed(), baseOffer());
    expect(Object.keys(result).sort()).toEqual(["decision", "match_id", "rejection_reasons"]);
  });

  it("this module exports no allocation function", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of ["allocate", "allocateAmount", "computeAllocation"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_OPTIMIZER", () => {
  it("this module exports no scoring/optimizing/threshold function", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of [
      "score",
      "optimize",
      "bestMatch",
      "rankMatches",
      "matchScore",
      "objectiveFunction",
      "costFunction",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("the decision is a pure boolean AND over six gates, not a weighted/thresholded sum", () => {
    // Every combination with at least one false gate must reject, regardless
    // of how many gates are true — proven exhaustively for single-false cases.
    const gates: (keyof MatchAttempt)[] = [
      "CAN",
      "WANTS",
      "ALLOWED",
      "APPROPRIATE",
      "AVAILABLE",
      "CONSENT",
    ];
    for (const gate of gates) {
      const attempt = baseAttempt({ [gate]: false } as Partial<MatchAttempt>);
      const result = evaluateMatch(attempt, baseNeed(), baseOffer());
      expect(result.decision).toBe("not_permitted");
    }
  });
});

describe("NO_PERSON_SCORE", () => {
  it("the MatchAttempt/MatchResult types carry no reputation/trust/score field", () => {
    const attempt = baseAttempt();
    const result = evaluateMatch(attempt, baseNeed(), baseOffer());
    for (const forbidden of ["reputation", "trustScore", "score", "priority"]) {
      expect(Object.prototype.hasOwnProperty.call(attempt, forbidden)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result, forbidden)).toBe(false);
    }
  });
});

describe("NO_CONTRIBUTION_COUNTER", () => {
  it("this module exports no contribution-tracking function or field", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of ["incrementContribution", "trackContribution", "matchHistory"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("no permanent match profile — this module exports no store/persistence function", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of ["saveMatch", "matchStore", "allMatchesFor"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CROSS_FRAME_AGGREGATION", () => {
  it("this module exports no function that combines multiple MatchAttempt/MatchResult instances across frames or subjects", () => {
    const mod = matchModule as unknown as Record<string, unknown>;
    for (const name of ["aggregate", "aggregateAcrossFrames", "combine", "merge", "sum"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("Matching — referential integrity (Need is sovereign, Offer does not auto-create a match)", () => {
  it("rejects when need_ref does not match the referenced Need's need_id", () => {
    const result = evaluateMatch(
      baseAttempt({ need_ref: "some_other_need" }),
      baseNeed(),
      baseOffer(),
    );
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("need_ref_mismatch");
  });

  it("rejects when offer_ref does not match the referenced Offer's offer_id", () => {
    const result = evaluateMatch(
      baseAttempt({ offer_ref: "some_other_offer" }),
      baseNeed(),
      baseOffer(),
    );
    expect(result.decision).toBe("not_permitted");
    expect(result.rejection_reasons).toContain("offer_ref_mismatch");
  });

  it("evaluateMatch requires a real Need and Offer object — it cannot be called with only gate booleans", () => {
    expect(evaluateMatch.length).toBe(3); // (attempt, need, offer) — no fewer parameters
  });
});

describe("Matching — SystemicChannel on cell (canon §18, Matching IS named)", () => {
  it("requires systemic_channel_if_S when cell.frame === S", () => {
    const attempt = baseAttempt({ cell: { domain: "G", frame: "S" } });
    const structural = validateMatchAttempt(attempt);
    expect(structural.valid).toBe(false);
    expect(structural.errors).toContainEqual({
      field: "systemic_channel_if_S",
      reason: "required_when_frame_is_S",
    });
  });

  it("accepts cell.frame === S once systemic_channel_if_S is supplied", () => {
    const attempt = baseAttempt({
      cell: { domain: "G", frame: "S" },
      systemic_channel_if_S: "economic",
    });
    expect(validateMatchAttempt(attempt).valid).toBe(true);
  });
});

describe("Matching — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() =>
      evaluateMatch({} as unknown as MatchAttempt, baseNeed(), baseOffer()),
    ).not.toThrow();
  });

  it("is deterministic — same inputs, same output", () => {
    const attempt = baseAttempt();
    const need = baseNeed();
    const offer = baseOffer();
    expect(evaluateMatch(attempt, need, offer)).toEqual(evaluateMatch(attempt, need, offer));
  });
});

describe("CELLSTATE_NEED_TARGET_OFFER_REGRESSION_PASS", () => {
  it("CellState still validates correctly", () => {
    const state: CellState = { domain: "G", frame: "R", level: -0.2, stability: 0.6 };
    expect(validateCellState(state).valid).toBe(true);
  });

  it("Need still validates correctly", () => {
    expect(validateNeed(baseNeed()).valid).toBe(true);
  });

  it("Target still validates correctly", () => {
    const target: Target = {
      target_id: "target_regress_2",
      subject: "person_b",
      cell: { domain: "C", frame: "R" },
      desired_state: "mixing competence at professional level",
      reference_type: "self_goal",
      provenance: "self_declared",
      consent_status: "granted",
      context: "skill_development",
      time: "2026-08-01T00:00:00Z",
      expiry: "2026-12-01T00:00:00Z",
    };
    expect(validateTarget(target).valid).toBe(true);
  });

  it("Offer still validates correctly", () => {
    expect(validateOffer(baseOffer()).valid).toBe(true);
  });
});
