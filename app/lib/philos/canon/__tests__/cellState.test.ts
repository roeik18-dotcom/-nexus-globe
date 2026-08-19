/**
 * Philos Canon — CellState, validated (PHILOS-MELTING-POT-CANON.md §4).
 *
 * Second canon-shaped runtime edge. No derivation from Observation is exercised
 * here — none exists, by design (see cellState.ts's header for why building one
 * would be unsupported invented aggregation, not an oversight).
 */
import { describe, expect, it } from "vitest";
import {
  ALL_CELLS,
  type CellState,
  validateCellState,
} from "../cellState";

function baseCellState(overrides: Partial<CellState> = {}): CellState {
  return {
    domain: "E",
    frame: "I",
    level: -0.3,
    stability: 0.6,
    ...overrides,
  };
}

describe("validateCellState — the well-formed case", () => {
  it("accepts a complete, canon-shaped CellState", () => {
    const result = validateCellState(baseCellState());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts every one of the 9 locked cells", () => {
    for (const cell of ALL_CELLS) {
      const result = validateCellState(baseCellState(cell));
      expect(result.valid).toBe(true);
    }
  });

  it("all applicable errors are reported at once, not short-circuited", () => {
    const result = validateCellState(
      baseCellState({
        domain: "X" as CellState["domain"],
        frame: "Y" as CellState["frame"],
        level: NaN,
      }),
    );
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["domain", "frame", "level"]);
  });
});

describe("validateCellState — the 3×3 identity (canon §3)", () => {
  it("ALL_CELLS is exactly the 9-cell product, no fourth Domain", () => {
    expect(ALL_CELLS).toHaveLength(9);
    const domains = new Set(ALL_CELLS.map((c) => c.domain));
    const frames = new Set(ALL_CELLS.map((c) => c.frame));
    expect([...domains].sort()).toEqual(["C", "E", "G"]);
    expect([...frames].sort()).toEqual(["I", "R", "S"]);
  });

  it("rejects a domain outside G/E/C", () => {
    const result = validateCellState(
      baseCellState({ domain: "physical" as unknown as CellState["domain"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "domain", reason: "invalid" });
  });

  it("rejects a frame outside I/R/S", () => {
    const result = validateCellState(
      baseCellState({ frame: "group" as unknown as CellState["frame"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "frame", reason: "invalid" });
  });
});

describe("validateCellState — Level and Stability (canon §4)", () => {
  it("accepts a signed level — deficit, equilibrium, and surplus all valid", () => {
    expect(validateCellState(baseCellState({ level: -5 })).valid).toBe(true);
    expect(validateCellState(baseCellState({ level: 0 })).valid).toBe(true);
    expect(validateCellState(baseCellState({ level: 5 })).valid).toBe(true);
  });

  it("rejects a non-finite level", () => {
    const result = validateCellState(baseCellState({ level: NaN }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "level", reason: "not_finite" });
  });

  it("does NOT bound stability to any range — canon does not specify one", () => {
    expect(validateCellState(baseCellState({ stability: 99 })).valid).toBe(true);
    expect(validateCellState(baseCellState({ stability: -12 })).valid).toBe(true);
  });

  it("still rejects a non-finite stability (a type floor, not a canon range)", () => {
    const result = validateCellState(baseCellState({ stability: Infinity }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "stability", reason: "not_finite" });
  });
});

describe("validateCellState — field exclusions (deliberate, per canon)", () => {
  it("the CellState type carries no tension field at the type level", () => {
    // Compile-time guarantee, asserted at runtime too: a CellState object with
    // only the 4 canon-cited fields is valid and complete — nothing extra is
    // required, matching canon §4's explicit exclusion of Tension from CellState.
    const state = baseCellState();
    expect(Object.keys(state).sort()).toEqual(["domain", "frame", "level", "stability"]);
  });
});

describe("validateCellState — determinism and purity", () => {
  it("never throws on malformed input", () => {
    expect(() => validateCellState({} as unknown as CellState)).not.toThrow();
  });

  it("is deterministic — same input, same output", () => {
    const input = baseCellState();
    const a = validateCellState(input);
    const b = validateCellState(input);
    expect(a).toEqual(b);
  });
});
