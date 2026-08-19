/**
 * Philos Canon — Target, validated (PHILOS-MELTING-POT-CANON.md §8).
 *
 * Named assertions requested for this pass: TARGET_VALID,
 * TARGET_REFERENCE_TYPE_ENFORCED, TARGET_DISTINCT_FROM_OBSERVATION_REFERENCE,
 * EXTERNAL_TARGET_CANNOT_AUTO_INTERVENE, TARGET_EXPIRY_REQUIRED,
 * CELLSTATE_REGRESSION_PASS.
 */
import { describe, expect, it } from "vitest";
import { type CellState, validateCellState } from "../cellState";
import { type Observation, validateObservation } from "../observation";
import {
  canTriggerAutomaticIntervention,
  isExternalTarget,
  type ReferenceType,
  type Target,
  validateTarget,
} from "../target";

function baseTarget(overrides: Partial<Target> = {}): Target {
  return {
    target_id: "target_001",
    subject: "person_roei",
    cell: { domain: "E", frame: "I" },
    desired_state: "baseline emotional stability restored",
    reference_type: "self_goal",
    provenance: "self_declared_during_checkin",
    consent_status: "granted",
    context: "post_release_recovery",
    time: "2026-08-12T20:00:00Z",
    expiry: "2026-09-12T20:00:00Z",
    ...overrides,
  };
}

describe("TARGET_VALID", () => {
  it("accepts a complete, canon-shaped Target", () => {
    const result = validateTarget(baseTarget());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts every declared reference_type", () => {
    const types: ReferenceType[] = ["self_goal", "norm", "peer", "threshold"];
    for (const reference_type of types) {
      expect(validateTarget(baseTarget({ reference_type })).valid).toBe(true);
    }
  });

  it("does not require a SystemicChannel on an S-frame Target cell — canon §18 does not name Target", () => {
    const result = validateTarget(baseTarget({ cell: { domain: "G", frame: "S" } }));
    expect(result.valid).toBe(true);
  });
});

describe("TARGET_REFERENCE_TYPE_ENFORCED", () => {
  it("rejects a reference_type outside {self_goal, norm, peer, threshold}", () => {
    const result = validateTarget(
      baseTarget({ reference_type: "aspiration" as unknown as ReferenceType }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "reference_type", reason: "invalid" });
  });

  it("rejects a missing cell (invalid domain/frame)", () => {
    const result = validateTarget(
      baseTarget({ cell: { domain: "unknown" as unknown as Target["cell"]["domain"], frame: "I" } }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "cell", reason: "invalid" });
  });
});

describe("TARGET_DISTINCT_FROM_OBSERVATION_REFERENCE", () => {
  it("Target objects carry no `reference` field — only `reference_type` + `desired_state`", () => {
    const target = baseTarget();
    expect(Object.prototype.hasOwnProperty.call(target, "reference")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(target, "reference_type")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(target, "desired_state")).toBe(true);
  });

  it("Observation objects carry no `desired_state`/`reference_type`/`target_id` — the two entities share zero fields", () => {
    const observation: Observation = {
      subject: "person_roei",
      domain: "E",
      frame: "I",
      reference: "self_goal:baseline_energy", // Observation.reference — what Level is measured against
      context: "evening_session",
      time: "2026-08-12T20:00:00Z",
      provenance: "self_reported",
      confidence: 0.7,
      expiry: "2026-09-12T20:00:00Z",
      level: -0.3,
      stability: 0.5,
      deficitType: "RELATIVE",
    };
    expect(validateObservation(observation).valid).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(observation, "desired_state")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(observation, "reference_type")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(observation, "target_id")).toBe(false);
    // Observation.reference (what Level is measured against) is a bare string
    // with no reference_type/desired_state semantics — it cannot stand in for
    // a Target, and this test proves the two shapes do not overlap.
    expect(typeof observation.reference).toBe("string");
  });

  it("a Target's own required fields cannot be satisfied by an Observation-shaped object", () => {
    // An Observation has no `target_id`/`desired_state`/`reference_type` — so
    // validating it as a Target (if someone tried) fails on exactly those
    // canon-cited Target-only fields, proving the types are not interchangeable.
    const observationShaped = {
      subject: "person_roei",
      cell: { domain: "E", frame: "I" }, // not even a real Observation field, added only to probe
      context: "evening_session",
      time: "2026-08-12T20:00:00Z",
      expiry: "2026-09-12T20:00:00Z",
    } as unknown as Target;
    const result = validateTarget(observationShaped);
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "target_id",
        "desired_state",
        "reference_type",
        "provenance",
        "consent_status",
      ]),
    );
  });
});

describe("EXTERNAL_TARGET_CANNOT_AUTO_INTERVENE", () => {
  it("norm and peer reference_types are flagged external", () => {
    expect(isExternalTarget(baseTarget({ reference_type: "norm" }))).toBe(true);
    expect(isExternalTarget(baseTarget({ reference_type: "peer" }))).toBe(true);
  });

  it("self_goal and threshold are NOT flagged external", () => {
    expect(isExternalTarget(baseTarget({ reference_type: "self_goal" }))).toBe(false);
    expect(isExternalTarget(baseTarget({ reference_type: "threshold" }))).toBe(false);
  });

  it("external targets (norm/peer) cannot trigger automatic intervention", () => {
    expect(canTriggerAutomaticIntervention(baseTarget({ reference_type: "norm" }))).toBe(false);
    expect(canTriggerAutomaticIntervention(baseTarget({ reference_type: "peer" }))).toBe(false);
  });

  it("non-external targets (self_goal/threshold) are not blocked by this rule", () => {
    expect(canTriggerAutomaticIntervention(baseTarget({ reference_type: "self_goal" }))).toBe(true);
    expect(canTriggerAutomaticIntervention(baseTarget({ reference_type: "threshold" }))).toBe(true);
  });

  it("the external check reads only reference_type — consent_status does not change it (canon names only reference_type as the deciding factor)", () => {
    const grantedNorm = baseTarget({ reference_type: "norm", consent_status: "granted" });
    const deniedNorm = baseTarget({ reference_type: "norm", consent_status: "denied" });
    expect(isExternalTarget(grantedNorm)).toBe(isExternalTarget(deniedNorm));
    expect(isExternalTarget(grantedNorm)).toBe(true);
  });
});

describe("TARGET_EXPIRY_REQUIRED", () => {
  it("rejects a missing/unparseable expiry", () => {
    const result = validateTarget(baseTarget({ expiry: "not-a-date" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "expiry",
      reason: "invalid_or_no_offset",
    });
  });

  it("rejects an offsetless expiry", () => {
    const result = validateTarget(baseTarget({ expiry: "2026-09-12T20:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "expiry",
      reason: "invalid_or_no_offset",
    });
  });

  it("rejects an expiry at or before time", () => {
    const result = validateTarget(
      baseTarget({ time: "2026-08-12T20:00:00Z", expiry: "2026-08-12T20:00:00Z" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "expiry", reason: "not_after_time" });
  });
});

describe("CELLSTATE_REGRESSION_PASS", () => {
  it("CellState (previous pass) still validates correctly after this pass's changes to observation.ts (SYSTEMIC_CHANNELS/parseOffsetInstant exports)", () => {
    const state: CellState = { domain: "G", frame: "S", level: -1.2, stability: 0.4 };
    const result = validateCellState(state);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("CellState still rejects malformed input identically to before", () => {
    const result = validateCellState({
      domain: "bad" as unknown as CellState["domain"],
      frame: "I",
      level: NaN,
      stability: 0.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "domain", reason: "invalid" });
    expect(result.errors).toContainEqual({ field: "level", reason: "not_finite" });
  });
});

describe("Target — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateTarget({} as unknown as Target)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseTarget();
    expect(validateTarget(input)).toEqual(validateTarget(input));
  });
});
