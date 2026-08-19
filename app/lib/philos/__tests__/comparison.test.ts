import { describe, expect, it } from "vitest";
import { buildBaselineComparison, compareCommunities, winningSide } from "../comparison";
import { projectValueGroup } from "../projectValueGroup";
import { GROUP_ID, VALUE_GROUP_EVENTS, SEED_TODAY } from "../valueGroupLog";
import { DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY } from "../demoCommunities";

describe("compareCommunities — real, compatible dimensions only, no opaque overall score", () => {
  const real = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY)!;
  const demo = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;

  it("returns one metric row per compatible dimension, each independently provenanced", () => {
    const cmp = compareCommunities(real, "REAL", demo, "DEMO");
    expect(cmp.subject_a.provenance).toBe("REAL");
    expect(cmp.subject_b.provenance).toBe("DEMO");
    for (const m of cmp.metrics) {
      expect(m.a.provenance).toBe("REAL");
      expect(m.b.provenance).toBe("DEMO");
      expect(typeof m.a.value).toBe("number");
      expect(typeof m.b.value).toBe("number");
    }
  });

  it("never produces a single combined/opaque score field", () => {
    const cmp = compareCommunities(real, "REAL", demo, "DEMO");
    expect(cmp).not.toHaveProperty("score");
    expect(cmp).not.toHaveProperty("overall");
  });

  it("the demo green-innovation community has a larger real treasury than the real seeded group", () => {
    const cmp = compareCommunities(real, "REAL", demo, "DEMO");
    const treasury = cmp.metrics.find((m) => m.key === "treasury_received")!;
    expect(winningSide(treasury)).toBe("b");
  });
});

describe("buildBaselineComparison — UNKNOWN never rendered as 0", () => {
  it("missing baseline yields null, not 0, and a null delta", () => {
    const c = buildBaselineComparison("level", "level", "level", undefined, 3, "REAL");
    expect(c.baseline).toBeNull();
    expect(c.delta).toBeNull();
    expect(c.current).toBe(3);
  });

  it("a real baseline and current produce a real, checked delta", () => {
    const c = buildBaselineComparison("level", "level", "level", -2, 1, "REAL");
    expect(c.delta).toBe(3);
  });
});

describe("winningSide — UNKNOWN never ranks as a loss", () => {
  it("either side null -> unknown, never a fabricated winner", () => {
    const m = {
      a: { key: "x", label: "x", unit: "", time_range: "", provenance: "REAL" as const, value: null },
      b: { key: "x", label: "x", unit: "", time_range: "", provenance: "REAL" as const, value: 5 },
    };
    expect(winningSide(m)).toBe("unknown");
  });
});
