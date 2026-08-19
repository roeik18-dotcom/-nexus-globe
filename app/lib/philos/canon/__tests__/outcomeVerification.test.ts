/**
 * Philos Canon — OutcomeVerification, validated (PHILOS-MELTING-POT-CANON.md
 * §17).
 *
 * Named assertions this file covers: VERIFICATION_VALID, VERIFIER_TYPE_ENFORCED.
 */
import { describe, expect, it } from "vitest";
import {
  type OutcomeVerification,
  validateOutcomeVerification,
  type VerifierType,
} from "../outcomeVerification";

function baseVerification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "recipient completed a self-produced mix using the guidance",
    provenance: "self_reported_in_followup",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-09-01T00:00:00Z",
    method: "follow-up interview",
    ...overrides,
  };
}

describe("VERIFICATION_VALID", () => {
  it("accepts a complete, canon-shaped OutcomeVerification", () => {
    const result = validateOutcomeVerification(baseVerification());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("subject_consent is optional — absence is valid, not an error", () => {
    const v = baseVerification();
    expect(Object.prototype.hasOwnProperty.call(v, "subject_consent")).toBe(false);
    expect(validateOutcomeVerification(v).valid).toBe(true);
  });

  it("accepts confidence at the 0 and 1 boundaries", () => {
    expect(validateOutcomeVerification(baseVerification({ confidence: 0 })).valid).toBe(true);
    expect(validateOutcomeVerification(baseVerification({ confidence: 1 })).valid).toBe(true);
  });
});

describe("VERIFIER_TYPE_ENFORCED", () => {
  it("accepts every canon-named verifier_type, including the underscore form 'observed_measured'", () => {
    const types: VerifierType[] = ["self", "counterparty", "third_party", "observed_measured"];
    for (const verifier_type of types) {
      expect(validateOutcomeVerification(baseVerification({ verifier_type })).valid).toBe(true);
    }
  });

  it("rejects a verifier_type outside canon's closed vocabulary", () => {
    const result = validateOutcomeVerification(
      baseVerification({ verifier_type: "observed/measured" as unknown as VerifierType }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "verifier_type", reason: "invalid" });
  });

  it("rejects the slash form specifically — canon's own token uses an underscore", () => {
    const result = validateOutcomeVerification(
      baseVerification({ verifier_type: "system" as unknown as VerifierType }),
    );
    expect(result.valid).toBe(false);
  });
});

describe("OutcomeVerification — required-field rejection", () => {
  it("rejects an empty statement", () => {
    const result = validateOutcomeVerification(baseVerification({ statement: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "statement", reason: "empty" });
  });

  it("rejects an offsetless time", () => {
    const result = validateOutcomeVerification(baseVerification({ time: "2026-09-01T00:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "time", reason: "invalid_or_no_offset" });
  });

  it("rejects confidence out of [0,1]", () => {
    expect(validateOutcomeVerification(baseVerification({ confidence: 1.5 })).valid).toBe(false);
    expect(validateOutcomeVerification(baseVerification({ confidence: -0.1 })).valid).toBe(false);
  });

  it("rejects an empty method", () => {
    const result = validateOutcomeVerification(baseVerification({ method: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "method", reason: "empty" });
  });

  it("rejects a non-boolean subject_consent when present", () => {
    const result = validateOutcomeVerification(
      baseVerification({ subject_consent: "yes" as unknown as boolean }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "subject_consent",
      reason: "not_a_boolean_if_present",
    });
  });
});

describe("OutcomeVerification — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() =>
      validateOutcomeVerification({} as unknown as OutcomeVerification),
    ).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseVerification();
    expect(validateOutcomeVerification(input)).toEqual(validateOutcomeVerification(input));
  });
});
