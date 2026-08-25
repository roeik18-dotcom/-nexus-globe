/**
 * ANALYSIS UNIT CONTRACT — the integrity rules, checked mechanically.
 *
 * The two rules under test are the ones that keep this model honest:
 * UNKNOWN is an absence and never a quantity, and a number always names a
 * source. Everything else in the module is data.
 */
import { describe, expect, it } from "vitest";

import {
  ANALYSIS_UNITS, DEPARTMENTS_6, FOUNDATION_4, MODEL_STATUS,
  type AnalysisUnitReading, checkReadingIntegrity, readingsByUnit, unknownReading,
} from "../analysisUnit";

function reading(over: Partial<AnalysisUnitReading> = {}): AnalysisUnitReading {
  return {
    unitId: "time", status: "observed", direction: null,
    intensity: null, confidence: null, sourceRefs: [], explanation: null, ...over,
  };
}

describe("the two groups", () => {
  it("is 4 + 6 = 10, kept as two distinct groups", () => {
    expect(FOUNDATION_4).toHaveLength(4);
    expect(DEPARTMENTS_6).toHaveLength(6);
    expect(ANALYSIS_UNITS).toHaveLength(10);
    expect(FOUNDATION_4.every((u) => u.group === "FOUNDATION")).toBe(true);
    expect(DEPARTMENTS_6.every((u) => u.group === "DEPARTMENT")).toBe(true);
  });

  it("stays labelled SYNTHESIS until a canon source is proven", () => {
    expect(MODEL_STATUS).toBe("SYNTHESIS");
  });

  it("exposes no aggregate, total or score of any kind", () => {
    for (const u of ANALYSIS_UNITS) {
      expect(u).not.toHaveProperty("weight");
      expect(u).not.toHaveProperty("score");
    }
    expect(reading()).not.toHaveProperty("weight");
  });
});

describe("(d) UNKNOWN is not zero", () => {
  it("a bare unknown reading is sound and carries three nulls", () => {
    const u = unknownReading("energy");
    expect(u.direction).toBeNull();
    expect(u.intensity).toBeNull();
    expect(u.confidence).toBeNull();
    expect(checkReadingIntegrity(u)).toEqual([]);
  });

  it("rejects an unknown reading carrying a direction", () => {
    expect(checkReadingIntegrity(reading({ status: "unknown", direction: 0 })))
      .toContain("unknown_with_direction");
  });

  it("rejects an unknown reading carrying a numeric intensity", () => {
    expect(checkReadingIntegrity(reading({
      status: "unknown", intensity: 0, sourceRefs: ["obs_1"],
    }))).toContain("unknown_with_intensity");
  });

  it("rejects an unknown reading carrying a numeric confidence", () => {
    expect(checkReadingIntegrity(reading({
      status: "unknown", confidence: 0.5, sourceRefs: ["obs_1"],
    }))).toContain("unknown_with_confidence");
  });
});

describe("(e) a number requires a source, and prose is not a source", () => {
  it("rejects `measured` with no source ref", () => {
    expect(checkReadingIntegrity(reading({ status: "measured" })))
      .toContain("measured_without_source");
  });

  it("rejects an intensity justified only by prose", () => {
    const errors = checkReadingIntegrity(reading({
      intensity: 0.8, explanation: "נראה גבוה מאוד לפי הפרסום", sourceRefs: [],
    }));
    expect(errors).toContain("intensity_without_source");
  });

  it("rejects a confidence justified only by prose", () => {
    const errors = checkReadingIntegrity(reading({
      confidence: 0.9, explanation: "אני די בטוח", sourceRefs: [],
    }));
    expect(errors).toContain("confidence_without_source");
  });

  it("accepts a measured reading that names its source", () => {
    expect(checkReadingIntegrity(reading({
      status: "measured", intensity: 0.4, confidence: 0.7, sourceRefs: ["obs_1", "ev_2"],
    }))).toEqual([]);
  });
});

describe("readingsByUnit", () => {
  it("fills every absent unit with an explicit unknown, never a zero", () => {
    const map = readingsByUnit([reading({ unitId: "social", status: "observed", direction: 1 })]);
    expect(Object.keys(map)).toHaveLength(10);
    expect(map.social.status).toBe("observed");
    expect(map.matter.status).toBe("unknown");
    expect(map.matter.intensity).toBeNull();
  });
});
