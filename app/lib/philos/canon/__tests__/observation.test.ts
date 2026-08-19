/**
 * Philos Canon — Observation, validated (PHILOS-MELTING-POT-CANON.md §6).
 *
 * The first canon-shaped runtime edge: a pure schema + validator for the first
 * entity in canon's own generative chain (§24). No CellState, Need, Target,
 * Offer, Matching, Action, Transfer, Effect, Learning, or Pattern/Syndrome is
 * exercised here — those do not exist yet, by design (canon's own dependency
 * order, not an oversight).
 */
import { describe, expect, it } from "vitest";
import {
  type Observation,
  validateObservation,
} from "../observation";

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_roei",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-12T20:00:00Z",
    provenance: "self_reported",
    confidence: 0.7,
    expiry: "2026-09-12T20:00:00Z",
    level: -0.3,
    stability: 0.5,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

describe("validateObservation — the well-formed case", () => {
  it("accepts a complete, canon-shaped Observation", () => {
    const result = validateObservation(baseObservation());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts frame=S with a valid systemicChannel", () => {
    const result = validateObservation(
      baseObservation({ frame: "S", systemicChannel: "institutional" }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("all applicable errors are reported at once, not short-circuited", () => {
    const result = validateObservation(
      baseObservation({
        subject: "",
        domain: "X" as Observation["domain"],
        confidence: 5,
      }),
    );
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["confidence", "domain", "subject"]);
  });
});

describe("validateObservation — required-field rejection (canon §6)", () => {
  it("rejects an empty subject", () => {
    const result = validateObservation(baseObservation({ subject: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "subject", reason: "empty" });
  });

  it("rejects an invalid domain (only G/E/C are canon §3)", () => {
    const result = validateObservation(
      baseObservation({ domain: "physical" as unknown as Observation["domain"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "domain", reason: "invalid" });
  });

  it("rejects an invalid frame (only I/R/S are canon §3)", () => {
    const result = validateObservation(
      baseObservation({ frame: "group" as unknown as Observation["frame"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "frame", reason: "invalid" });
  });

  it("rejects an empty reference", () => {
    const result = validateObservation(baseObservation({ reference: "  " }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "reference", reason: "empty" });
  });

  it("rejects an empty context", () => {
    const result = validateObservation(baseObservation({ context: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "context", reason: "empty" });
  });

  it("rejects an invalid provenance", () => {
    const result = validateObservation(
      baseObservation({ provenance: "guess" as unknown as Observation["provenance"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "provenance", reason: "invalid" });
  });

  it("rejects an invalid deficitType", () => {
    const result = validateObservation(
      baseObservation({ deficitType: "SEVERE" as unknown as Observation["deficitType"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "deficitType", reason: "invalid" });
  });
});

describe("validateObservation — time/expiry hardening (matches eventCausality.ts discipline)", () => {
  it("rejects an offsetless time (non-deterministic host-timezone read)", () => {
    const result = validateObservation(baseObservation({ time: "2026-08-12T20:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "time", reason: "invalid_or_no_offset" });
  });

  it("rejects an unparseable time", () => {
    const result = validateObservation(baseObservation({ time: "not-a-date" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "time", reason: "invalid_or_no_offset" });
  });

  it("rejects an offsetless expiry", () => {
    const result = validateObservation(baseObservation({ expiry: "2026-09-12T20:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "expiry", reason: "invalid_or_no_offset" });
  });

  it("rejects an expiry at or before time (observations must not expire in the past)", () => {
    const result = validateObservation(
      baseObservation({ time: "2026-08-12T20:00:00Z", expiry: "2026-08-12T20:00:00Z" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "expiry", reason: "not_after_time" });
  });

  it("rejects an expiry before time", () => {
    const result = validateObservation(
      baseObservation({ time: "2026-08-12T20:00:00Z", expiry: "2026-08-01T00:00:00Z" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "expiry", reason: "not_after_time" });
  });

  it("does not check expiry-after-time when time itself is invalid (no false compounding)", () => {
    const result = validateObservation(
      baseObservation({ time: "garbage", expiry: "2026-09-12T20:00:00Z" }),
    );
    const expiryErrors = result.errors.filter((e) => e.field === "expiry");
    expect(expiryErrors).toEqual([]);
  });
});

describe("validateObservation — confidence, level, stability", () => {
  it("rejects confidence above 1", () => {
    const result = validateObservation(baseObservation({ confidence: 1.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "confidence", reason: "not_a_probability" });
  });

  it("rejects negative confidence", () => {
    const result = validateObservation(baseObservation({ confidence: -0.1 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "confidence", reason: "not_a_probability" });
  });

  it("accepts confidence at the 0 and 1 boundaries", () => {
    expect(validateObservation(baseObservation({ confidence: 0 })).valid).toBe(true);
    expect(validateObservation(baseObservation({ confidence: 1 })).valid).toBe(true);
  });

  it("accepts a signed level (deficit and surplus both valid — canon §4)", () => {
    expect(validateObservation(baseObservation({ level: -2.4 })).valid).toBe(true);
    expect(validateObservation(baseObservation({ level: 2.4 })).valid).toBe(true);
    expect(validateObservation(baseObservation({ level: 0 })).valid).toBe(true);
  });

  it("rejects a non-finite level", () => {
    const result = validateObservation(baseObservation({ level: NaN }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "level", reason: "not_finite" });
  });

  it("does NOT bound stability to any range — canon does not specify one", () => {
    // Deliberately out of [0,1] and even negative: canon never states a scale for
    // Stability, so this validator must not silently invent and enforce one.
    expect(validateObservation(baseObservation({ stability: 42 })).valid).toBe(true);
    expect(validateObservation(baseObservation({ stability: -7 })).valid).toBe(true);
  });

  it("still rejects a non-finite stability (a type floor, not a canon range)", () => {
    const result = validateObservation(baseObservation({ stability: Infinity }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "stability", reason: "not_finite" });
  });
});

describe("validateObservation — SystemicChannel (canon §18)", () => {
  it("requires systemicChannel when frame === S", () => {
    const result = validateObservation(baseObservation({ frame: "S" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "systemicChannel",
      reason: "required_when_frame_is_S",
    });
  });

  it("rejects an out-of-vocabulary systemicChannel on frame=S", () => {
    const result = validateObservation(
      baseObservation({
        frame: "S",
        systemicChannel: "spiritual" as unknown as Observation["systemicChannel"],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "systemicChannel", reason: "invalid" });
  });

  it("does NOT require systemicChannel on frame=I or frame=R", () => {
    expect(validateObservation(baseObservation({ frame: "I" })).valid).toBe(true);
    expect(validateObservation(baseObservation({ frame: "R" })).valid).toBe(true);
  });

  it("permits (does not forbid) a systemicChannel on frame=I — canon requires it FOR S, never forbids it elsewhere", () => {
    const result = validateObservation(
      baseObservation({ frame: "I", systemicChannel: "economic" }),
    );
    expect(result.valid).toBe(true);
  });

  it("still enforces the closed vocabulary even when the field is optional (frame=I)", () => {
    const result = validateObservation(
      baseObservation({
        frame: "I",
        systemicChannel: "made_up" as unknown as Observation["systemicChannel"],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "systemicChannel", reason: "invalid" });
  });

  it("accepts every declared SystemicChannel value on frame=S", () => {
    const channels: NonNullable<Observation["systemicChannel"]>[] = [
      "institutional",
      "material",
      "economic",
      "informational",
      "environmental",
      "other",
    ];
    for (const c of channels) {
      const result = validateObservation(baseObservation({ frame: "S", systemicChannel: c }));
      expect(result.valid).toBe(true);
    }
  });
});

describe("validateObservation — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() =>
      validateObservation({} as unknown as Observation),
    ).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseObservation();
    const a = validateObservation(input);
    const b = validateObservation(input);
    expect(a).toEqual(b);
  });
});
