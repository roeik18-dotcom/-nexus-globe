import { describe, expect, it } from "vitest";
import { PROPAGATION_MATRIX, SURFACES, matrixSummary } from "../propagationMatrix";

describe("propagation matrix", () => {
  it("covers every concept against all 7 surfaces", () => {
    expect(SURFACES).toHaveLength(7);
    for (const row of PROPAGATION_MATRIX) {
      for (const s of SURFACES) expect(row.cells[s]).toBeDefined();
    }
  });

  it("names a gap CLASS for every UNRESOLVED cell — never a bare 'missing'", () => {
    for (const row of PROPAGATION_MATRIX) {
      for (const s of SURFACES) {
        const c = row.cells[s];
        if (c.kind === "UNRESOLVED") {
          expect(c.gap).toBeDefined();
          expect(c.note).toBeTruthy();
        }
      }
    }
  });

  it("does not count the shared PersonFrame as propagation", () => {
    const s = JSON.stringify(PROPAGATION_MATRIX);
    expect(s.includes("PersonFrame")).toBe(false);
    expect(s.includes("personFrame")).toBe(false);
  });

  it("keeps Marketplace out of the contradiction/value ontology rows", () => {
    for (const concept of ["Source Contradiction Mention (110)", "Contradiction→Value Relation (4)",
      "Personal Value", "Group Value"]) {
      const row = PROPAGATION_MATRIX.find((r) => r.concept === concept)!;
      expect(row.cells.marketplace.kind).toBe("NOT_APPLICABLE");
    }
  });

  it("never marks a conceptual value level as DIRECT anywhere", () => {
    for (const concept of ["Personal Value", "Group Value"]) {
      const row = PROPAGATION_MATRIX.find((r) => r.concept === concept)!;
      for (const s of SURFACES) expect(row.cells[s].kind).not.toBe("DIRECT");
    }
  });

  it("summarises without inventing a score", () => {
    const s = matrixSummary();
    expect(s.rows).toBe(PROPAGATION_MATRIX.length);
    expect(s.surfaces).toBe(7);
    expect(s.counts.DIRECT + s.counts.DERIVED + s.counts.REFERENCE
      + s.counts.UNRESOLVED + s.counts.NOT_APPLICABLE).toBe(s.rows * 7);
    expect(s).not.toHaveProperty("score");
  });
});
