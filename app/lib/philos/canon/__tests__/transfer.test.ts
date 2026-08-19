/**
 * Philos Canon — Transfer, validated (PHILOS-MELTING-POT-CANON.md §11,
 * "Transfer ⊂ Action").
 *
 * Named assertions requested for this pass: ACTION_VALID_TRANSFER,
 * TRANSFER_IS_ACTION_SUBTYPE, SELF_REGULATION_CANNOT_CREATE_INTERPERSONAL_
 * TRANSFER, MELTING_POT_TRANSFER_VALID, TRANSFER_REQUIRES_MATCH_PERMISSION,
 * TRANSFER_REJECTS_EXPIRED_MATCH, TRANSFER_REQUIRES_CONVERSION_MECHANISM,
 * CAPACITY_IS_NOT_RESOURCE, TRANSFER_REQUIRES_RESOURCE_TYPE,
 * CLAIMED_NOT_VERIFIED, TRANSFER_DOES_NOT_UPDATE_STATE,
 * TRANSFER_DOES_NOT_CREATE_EFFECT_SUCCESS, NO_PERSON_SCORE, NO_OPTIMIZER,
 * NO_CONTRIBUTION_COUNTER, NO_CROSS_FRAME_AGGREGATION,
 * FULL_PRIOR_RUNTIME_REGRESSION_PASS.
 */
import { describe, expect, it } from "vitest";
import { validateAction } from "../action";
import { type CellState, validateCellState } from "../cellState";
import { evaluateMatch, type MatchAttempt, type MatchResult } from "../matching";
import { type Need, validateNeed } from "../need";
import { type Offer, validateOffer } from "../offer";
import { type Target, validateTarget } from "../target";
import * as transferModule from "../transfer";
import {
  type Transfer,
  validateTransfer,
  validateTransferAgainstMatch,
} from "../transfer";

function baseTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    action_id: "action_transfer_001",
    type: "transfer",
    owner: "group_studio_collective",
    mechanism_scope: "melting_pot",
    consent: true,
    inputs: ["need_ref:need_match_001", "offer_ref:offer_match_001"],
    reversibility: "irreversible_knowledge_transfer_reversible_time_only",
    time: "2026-08-15T00:00:00Z",
    provenance: "matched_via_melting_pot",
    source: "person_a",
    target: "person_b",
    source_cell: { domain: "C", frame: "R" },
    target_cell: { domain: "C", frame: "R" },
    resource: "mixing mentorship session",
    resource_type: "knowledge",
    amount: "2 sessions",
    conversion_mechanism: "explanation/mentoring",
    cost: "1 hour donor time per session",
    expiry_or_validity: "2026-09-15T00:00:00Z",
    claimed_outcome: "recipient completed a self-produced mix using the guidance",
    ...overrides,
  };
}

const PERMITTED_MATCH: MatchResult = {
  match_id: "match_001",
  decision: "permitted",
  rejection_reasons: [],
};

describe("ACTION_VALID_TRANSFER", () => {
  it("a complete, canon-shaped Transfer passes validateTransfer()", () => {
    const result = validateTransfer(baseTransfer());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("TRANSFER_IS_ACTION_SUBTYPE", () => {
  it("a Transfer object satisfies validateAction() directly — no adaptation needed", () => {
    const transfer = baseTransfer();
    const result = validateAction(transfer); // Transfer IS an Action structurally
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("validateTransfer's errors are a strict superset check — running validateAction first, never duplicated", () => {
    const malformed = baseTransfer({ owner: "", conversion_mechanism: "" });
    const actionErrors = validateAction(malformed).errors;
    const transferErrors = validateTransfer(malformed).errors;
    for (const e of actionErrors) {
      expect(transferErrors).toContainEqual(e);
    }
    // and the transfer-specific error is present too, not swallowed
    expect(transferErrors).toContainEqual({ field: "conversion_mechanism", reason: "empty" });
  });

  it("Transfer carries every base Action field, narrowed and extended, not a parallel lookalike type", () => {
    const transfer = baseTransfer();
    for (const actionField of [
      "action_id",
      "type",
      "owner",
      "mechanism_scope",
      "consent",
      "inputs",
      "reversibility",
      "time",
      "provenance",
    ]) {
      expect(Object.prototype.hasOwnProperty.call(transfer, actionField)).toBe(true);
    }
    expect(transfer.type).toBe("transfer");
  });
});

describe("SELF_REGULATION_CANNOT_CREATE_INTERPERSONAL_TRANSFER", () => {
  it("rejects a Transfer whose mechanism_scope is self_regulation", () => {
    const result = validateTransfer(baseTransfer({ mechanism_scope: "self_regulation" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "mechanism_scope",
      reason: "transfer_requires_melting_pot",
    });
  });

  it("rejects it even when every other field is otherwise perfectly valid", () => {
    const result = validateTransfer(
      baseTransfer({ mechanism_scope: "self_regulation", consent: true }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      field: "mechanism_scope",
      reason: "transfer_requires_melting_pot",
    });
  });
});

describe("MELTING_POT_TRANSFER_VALID", () => {
  it("accepts a Transfer with mechanism_scope === melting_pot and interpersonal source/target", () => {
    const result = validateTransfer(
      baseTransfer({ mechanism_scope: "melting_pot", source: "person_a", target: "person_b" }),
    );
    expect(result.valid).toBe(true);
  });

  it("supports the whole→individual direction (§14) — owner as the group, source as the group's cell, target as the individual", () => {
    const result = validateTransfer(
      baseTransfer({
        owner: "group_studio_collective",
        source: "group_studio_collective",
        target: "person_b",
        mechanism_scope: "melting_pot",
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("TRANSFER_REQUIRES_MATCH_PERMISSION", () => {
  it("rejects a Transfer whose match decision is not_permitted", () => {
    const notPermitted: MatchResult = {
      match_id: "match_x",
      decision: "not_permitted",
      rejection_reasons: ["CONSENT_false"],
    };
    const result = validateTransferAgainstMatch(baseTransfer(), notPermitted);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "match", reason: "matching_not_permitted" });
  });

  it("rejects a Transfer whose match decision is invalid (under-specified attempt)", () => {
    const invalid: MatchResult = {
      match_id: "match_y",
      decision: "invalid",
      rejection_reasons: ["attempt_malformed"],
    };
    const result = validateTransferAgainstMatch(baseTransfer(), invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "match", reason: "matching_not_permitted" });
  });

  it("accepts a Transfer whose match decision is permitted, all else being valid", () => {
    const result = validateTransferAgainstMatch(baseTransfer(), PERMITTED_MATCH);
    expect(result.valid).toBe(true);
  });

  it("actually runs evaluateMatch end-to-end and feeds its real decision into the Transfer check", () => {
    const need: Need = {
      need_id: "need_match_001",
      subject: "person_b",
      desired_change: "learn mixing fundamentals",
      scope: { kind: "cells", cells: [{ domain: "C", frame: "R" }] },
      provenance: "self_reported",
      context: "skill_gap",
      time: "2026-08-01T00:00:00Z",
      expiry: "2026-12-01T00:00:00Z",
      consent_scope: "visible_to_matched_offers",
    };
    const offer: Offer = {
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
    };
    const attempt: MatchAttempt = {
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
    };
    const match = evaluateMatch(attempt, need, offer);
    expect(match.decision).toBe("permitted");
    expect(validateTransferAgainstMatch(baseTransfer(), match).valid).toBe(true);
  });
});

describe("TRANSFER_REJECTS_EXPIRED_MATCH", () => {
  it("a Transfer is rejected when its match was computed from an expired Need — evaluateMatch already reflects this, re-checked here, not re-derived", () => {
    const expiredNeed: Need = {
      need_id: "need_expired",
      subject: "person_b",
      desired_change: "learn mixing fundamentals",
      scope: { kind: "domain", domain: "C" },
      provenance: "self_reported",
      context: "skill_gap",
      time: "2026-01-01T00:00:00Z",
      expiry: "2026-02-01T00:00:00Z",
      consent_scope: "visible_to_matched_offers",
    };
    const offer: Offer = {
      offer_id: "offer_expired_check",
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
    };
    const attempt: MatchAttempt = {
      match_id: "match_expired",
      need_ref: "need_expired",
      offer_ref: "offer_expired_check",
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
    };
    const match = evaluateMatch(attempt, expiredNeed, offer);
    expect(match.decision).toBe("not_permitted");
    expect(match.rejection_reasons).toContain("need_expired");

    const result = validateTransferAgainstMatch(baseTransfer(), match);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "match", reason: "matching_not_permitted" });
  });
});

describe("TRANSFER_REQUIRES_CONVERSION_MECHANISM", () => {
  it("rejects a Transfer with an empty conversion_mechanism — Capacity never becomes Resource automatically (§11)", () => {
    const result = validateTransfer(baseTransfer({ conversion_mechanism: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "conversion_mechanism", reason: "empty" });
  });

  it("this module exports no function that fills a Transfer's conversion_mechanism automatically or derives a Transfer from a bare CellState", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of [
      "autoFillFromCellState",
      "deriveTransferFromCellState",
      "autoConvert",
      "cellToCellFill",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("CAPACITY_IS_NOT_RESOURCE", () => {
  it("CellState (four fields only) carries no resource/resource_type/amount field — Resource lives strictly in the transfer layer", () => {
    const state: CellState = { domain: "G", frame: "I", level: 0.6, stability: 0.5 };
    expect(validateCellState(state).valid).toBe(true);
    for (const forbidden of ["resource", "resource_type", "amount", "capacity"]) {
      expect(Object.prototype.hasOwnProperty.call(state, forbidden)).toBe(false);
    }
  });

  it("Transfer's resource/resource_type/amount are independent fields — never derived from a CellState.level surplus reading", () => {
    const transfer = baseTransfer();
    expect(typeof transfer.resource).toBe("string");
    expect(typeof transfer.resource_type).toBe("string");
    // no field on Transfer is literally named "capacity" — amount_or_capacity
    // belongs to Offer (the donor-side ephemeral assertion); Transfer only
    // ever carries the already-converted `resource`/`amount`.
    expect(Object.prototype.hasOwnProperty.call(transfer, "capacity")).toBe(false);
  });
});

describe("TRANSFER_REQUIRES_RESOURCE_TYPE", () => {
  it("rejects an empty resource_type", () => {
    const result = validateTransfer(baseTransfer({ resource_type: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "resource_type", reason: "empty" });
  });

  it("accepts a resource_type outside canon's illustrative list — same open-endedness already established for Offer", () => {
    const result = validateTransfer(baseTransfer({ resource_type: "studio_time_slot" }));
    expect(result.valid).toBe(true);
  });
});

describe("CLAIMED_NOT_VERIFIED", () => {
  it("a Transfer is valid with only claimed_outcome — verified_outcome is optional and absent by default", () => {
    const transfer = baseTransfer();
    expect(Object.prototype.hasOwnProperty.call(transfer, "verified_outcome")).toBe(false);
    expect(validateTransfer(transfer).valid).toBe(true);
  });

  it("claimed_outcome and verified_outcome are independent fields — setting one never sets the other", () => {
    const transfer = baseTransfer({ claimed_outcome: "recipient reports improved mix quality" });
    expect(transfer.verified_outcome).toBeUndefined();
  });

  it("rejects a missing/empty claimed_outcome regardless of verified_outcome", () => {
    const result = validateTransfer(
      baseTransfer({ claimed_outcome: "", verified_outcome: "confirmed by third party" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "claimed_outcome", reason: "empty" });
  });
});

describe("TRANSFER_DOES_NOT_UPDATE_STATE", () => {
  it("this module exports no function that mutates or updates any CellState/State'", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of ["updateState", "updateCellState", "applyToState", "mutateState"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("TRANSFER_DOES_NOT_CREATE_EFFECT_SUCCESS", () => {
  it("this module exports no function that marks an outcome verified/succeeded or creates an Effect record", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of [
      "markVerified",
      "markSucceeded",
      "createEffect",
      "toEffect",
      "verifyOutcome",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("an unverified claimed_outcome never implies a decision field asserting success", () => {
    const transfer = baseTransfer();
    for (const forbidden of ["succeeded", "verified", "effect_status"]) {
      expect(Object.prototype.hasOwnProperty.call(transfer, forbidden)).toBe(false);
    }
  });
});

describe("NO_PERSON_SCORE", () => {
  it("the Transfer type carries no reputation/trust/score field", () => {
    const transfer = baseTransfer();
    for (const forbidden of ["reputation", "trustScore", "score", "priority"]) {
      expect(Object.prototype.hasOwnProperty.call(transfer, forbidden)).toBe(false);
    }
  });

  it("this module exports no scoring/ranking function", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of ["score", "rank", "rankTransfers", "donorScore", "recipientScore"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_OPTIMIZER", () => {
  it("this module exports no anti-depletion-optimization or objective function — representable inputs only, not evaluated", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of [
      "optimize",
      "evaluateAntiDepletion",
      "isTransferAllowed",
      "objectiveFunction",
      "costFunction",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CONTRIBUTION_COUNTER", () => {
  it("this module exports no contribution-tracking, history, or persistence function", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of [
      "incrementContribution",
      "trackContribution",
      "transferHistory",
      "saveTransfer",
      "transferStore",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CROSS_FRAME_AGGREGATION", () => {
  it("this module exports no function that combines multiple Transfer instances across frames or subjects", () => {
    const mod = transferModule as unknown as Record<string, unknown>;
    for (const name of ["aggregate", "aggregateAcrossFrames", "combine", "merge", "sum"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("Transfer — SystemicChannel on both cells (canon §18, Transfer IS named)", () => {
  it("requires source_systemic_channel_if_S when source_cell.frame === S", () => {
    const result = validateTransfer(
      baseTransfer({ source_cell: { domain: "G", frame: "S" } }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "source_systemic_channel_if_S",
      reason: "required_when_frame_is_S",
    });
  });

  it("requires target_systemic_channel_if_S when target_cell.frame === S, independently of source_cell", () => {
    const result = validateTransfer(
      baseTransfer({ target_cell: { domain: "E", frame: "S" } }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "target_systemic_channel_if_S",
      reason: "required_when_frame_is_S",
    });
  });

  it("accepts both cells at frame=S once both channels are supplied", () => {
    const result = validateTransfer(
      baseTransfer({
        source_cell: { domain: "G", frame: "S" },
        source_systemic_channel_if_S: "material",
        target_cell: { domain: "E", frame: "S" },
        target_systemic_channel_if_S: "economic",
      }),
    );
    expect(result.valid).toBe(true);
  });
});

describe("Transfer — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateTransfer({} as unknown as Transfer)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseTransfer();
    expect(validateTransfer(input)).toEqual(validateTransfer(input));
  });
});

describe("FULL_PRIOR_RUNTIME_REGRESSION_PASS", () => {
  it("CellState still validates correctly", () => {
    const state: CellState = { domain: "C", frame: "S", level: 1.1, stability: 0.3 };
    // frame S with no systemicChannel field on CellState at all — CellState
    // itself carries no SystemicChannel field (§18 does not name CellState),
    // confirming this boundary is undisturbed by this pass.
    expect(validateCellState(state).valid).toBe(true);
  });

  it("Need still validates correctly", () => {
    const need: Need = {
      need_id: "need_regress_3",
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
      target_id: "target_regress_3",
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
      offer_id: "offer_regress_3",
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

  it("Matching still evaluates correctly, including expiry gating", () => {
    const need: Need = {
      need_id: "need_regress_match",
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
      offer_id: "offer_regress_match",
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
      match_id: "match_regress",
      need_ref: "need_regress_match",
      offer_ref: "offer_regress_match",
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
});
