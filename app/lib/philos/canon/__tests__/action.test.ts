/**
 * Philos Canon — Action, validated (PHILOS-MELTING-POT-CANON.md §13).
 *
 * Named assertions this file covers: ACTION_VALID_NON_TRANSFER (plus base
 * coverage feeding transfer.test.ts's ACTION_VALID_TRANSFER /
 * TRANSFER_IS_ACTION_SUBTYPE), and this module's own NO_PERSON_SCORE,
 * NO_OPTIMIZER, NO_CONTRIBUTION_COUNTER, NO_CROSS_FRAME_AGGREGATION.
 */
import { describe, expect, it } from "vitest";
import { type Action, validateAction } from "../action";
import * as actionModule from "../action";

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_001",
    type: "non_transfer",
    owner: "person_roei",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: ["need_ref:need_match_001"],
    reversibility: "reversible",
    time: "2026-08-15T00:00:00Z",
    provenance: "self_initiated",
    ...overrides,
  };
}

describe("ACTION_VALID_NON_TRANSFER", () => {
  it("accepts a canon-shaped non_transfer Action — canon's own example: removing a barrier", () => {
    const action = baseAction({
      type: "non_transfer",
      inputs: ["barrier_ref:studio_access_restriction"],
    });
    const result = validateAction(action);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("a non_transfer Action may use either mechanism_scope — only 'transfer' is scope-restricted", () => {
    expect(validateAction(baseAction({ mechanism_scope: "self_regulation" })).valid).toBe(true);
    expect(validateAction(baseAction({ mechanism_scope: "melting_pot" })).valid).toBe(true);
  });

  it("effect_ref is optional — an Action can exist before any Effect is measured (§24 pipeline order)", () => {
    const withoutEffectRef = baseAction();
    expect(Object.prototype.hasOwnProperty.call(withoutEffectRef, "effect_ref")).toBe(false);
    expect(validateAction(withoutEffectRef).valid).toBe(true);

    const withEffectRef = baseAction({ effect_ref: "effect_pending_001" });
    expect(validateAction(withEffectRef).valid).toBe(true);
  });

  it("rejects an empty effect_ref when the field is present", () => {
    const result = validateAction(baseAction({ effect_ref: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "effect_ref", reason: "empty_if_present" });
  });
});

describe("Action — required-field rejection", () => {
  it("rejects an invalid type", () => {
    const result = validateAction(baseAction({ type: "conversion" as unknown as Action["type"] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "type", reason: "invalid" });
  });

  it("rejects an invalid mechanism_scope", () => {
    const result = validateAction(
      baseAction({ mechanism_scope: "group" as unknown as Action["mechanism_scope"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "mechanism_scope", reason: "invalid" });
  });

  it("rejects consent: false — mandatory means must be true", () => {
    const result = validateAction(baseAction({ consent: false }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "consent", reason: "not_true" });
  });

  it("rejects a non-array inputs", () => {
    const result = validateAction(baseAction({ inputs: "need_001" as unknown as string[] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "inputs", reason: "not_an_array" });
  });
});

describe("Action — does not imply Effect, does not update State' (canon §17/§24)", () => {
  it("this module exports no function that marks an Effect as succeeded/verified or updates any state", () => {
    const mod = actionModule as unknown as Record<string, unknown>;
    for (const name of [
      "markSucceeded",
      "markVerified",
      "updateState",
      "updateCellState",
      "applyEffect",
      "resolveEffect",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_PERSON_SCORE", () => {
  it("the Action type carries no reputation/trust/score field", () => {
    const action = baseAction();
    for (const forbidden of ["reputation", "trustScore", "score", "priority"]) {
      expect(Object.prototype.hasOwnProperty.call(action, forbidden)).toBe(false);
    }
  });

  it("this module exports no scoring/ranking function", () => {
    const mod = actionModule as unknown as Record<string, unknown>;
    for (const name of ["score", "rank", "rankActions", "priority"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_OPTIMIZER", () => {
  it("this module exports no optimizing/objective-function/threshold function", () => {
    const mod = actionModule as unknown as Record<string, unknown>;
    for (const name of ["optimize", "bestAction", "objectiveFunction", "costFunction"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CONTRIBUTION_COUNTER", () => {
  it("this module exports no contribution-tracking or persistence function", () => {
    const mod = actionModule as unknown as Record<string, unknown>;
    for (const name of [
      "incrementContribution",
      "trackContribution",
      "actionHistory",
      "saveAction",
      "actionStore",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_CROSS_FRAME_AGGREGATION", () => {
  it("this module exports no function that combines multiple Action instances across frames or subjects", () => {
    const mod = actionModule as unknown as Record<string, unknown>;
    for (const name of ["aggregate", "aggregateAcrossFrames", "combine", "merge", "sum"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("Action — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateAction({} as unknown as Action)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseAction();
    expect(validateAction(input)).toEqual(validateAction(input));
  });

  it("reports all applicable errors at once, not short-circuited", () => {
    const result = validateAction(baseAction({ action_id: "", owner: "", consent: false }));
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["action_id", "consent", "owner"]);
  });
});
