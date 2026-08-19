import { describe, expect, it } from "vitest";
import { TEMPERAMENT_DIMENSIONS, buildUnknownTemperamentReadings } from "../temperamentDimensions";

describe("TEMPERAMENT_DIMENSIONS — exactly the 7 real rows verified against the source, never more", () => {
  it("has exactly 7 real parameters, each citing a real Canonical_ID", () => {
    expect(TEMPERAMENT_DIMENSIONS).toHaveLength(7);
    for (const d of TEMPERAMENT_DIMENSIONS) {
      expect(d.canonical_id).toMatch(/^CAN-SRC-\d+$/);
      expect(d.section).toBe("תודעה, הכרה ואדם");
    }
  });

  it("does not include attention span / persistence / distractibility — not present in the real source under this heading", () => {
    const labels = TEMPERAMENT_DIMENSIONS.map((d) => d.label);
    expect(labels).not.toContain("ATTENTION SPAN");
    expect(labels).not.toContain("PERSISTENCE");
    expect(labels).not.toContain("DISTRACTIBILITY");
  });
});

describe("buildUnknownTemperamentReadings — every subject's position is genuinely unknown", () => {
  it("returns one unknown reading per dimension", () => {
    const readings = buildUnknownTemperamentReadings();
    expect(readings).toHaveLength(7);
    expect(readings.every((r) => r.position.status === "unknown")).toBe(true);
  });
});
