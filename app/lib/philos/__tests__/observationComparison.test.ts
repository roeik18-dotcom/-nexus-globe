import { describe, expect, it } from "vitest";
import { buildObservationFeatures, compareObservations } from "../observationComparison";

const obs = (o: Partial<Parameters<typeof buildObservationFeatures>[0]> = {}) =>
  buildObservationFeatures({
    canon_event_id: "e1", subject: "s", observed_at: "2026-08-01T00:00:00Z",
    domain: "E", frame: "I", level: -1, stability: 0, text: "", ...o,
  });

describe("observation comparison — the three refusals", () => {
  it("OPEN_LOOP when there is no t1", () => {
    const r = compareObservations({ t0: obs(), t1: null });
    expect(r.status).toBe("OPEN_LOOP");
    expect(r.attribution).toBe("OPEN_LOOP");
    expect(r.comparisons).toEqual([]);
    expect(r.blocked_because.join()).toContain("הלולאה פתוחה");
  });

  it("NO_PRIOR when there is no observation at all", () => {
    expect(compareObservations({ t0: null, t1: null }).status).toBe("NO_PRIOR");
  });

  it("NOT_COMPARABLE when the two observations measure different cells", () => {
    const r = compareObservations({ t0: obs({ domain: "E" }), t1: obs({ canon_event_id: "e2", domain: "G" }) });
    const cell = r.comparisons.find((c) => c.feature_kind === "MEASURED_CELL")!;
    expect(cell.verdict).toBe("NOT_COMPARABLE");
    expect(cell.level_delta).toBeUndefined();
  });

  it("NO_ATTRIBUTION_TO_ACTION without a verified Effect linking them", () => {
    const r = compareObservations({ t0: obs(), t1: obs({ canon_event_id: "e2", level: 1 }) });
    expect(r.attribution).toBe("NO_ATTRIBUTION_TO_ACTION");
    expect(r.blocked_because.join()).toContain("קרונולוגיה אינה סיבתיות");
  });

  it("attributes ONLY when the caller proves a verified Effect links them", () => {
    const r = compareObservations({ t0: obs(), t1: obs({ canon_event_id: "e2" }), verifiedEffectLinksThem: true });
    expect(r.attribution).toBe("ATTRIBUTED_VIA_VERIFIED_EFFECT");
    expect(r.blocked_because).toEqual([]);
  });
});

describe("observation comparison — like-with-like only", () => {
  it("compares the same measured cell arithmetically, never as a judgement", () => {
    const r = compareObservations({ t0: obs({ level: -1 }), t1: obs({ canon_event_id: "e2", level: 1 }) });
    const cell = r.comparisons.find((c) => c.feature_kind === "MEASURED_CELL")!;
    expect(cell.level_delta).toBe(2);
    // no evaluative vocabulary anywhere in the result
    const s = JSON.stringify(r);
    for (const w of ["improved", "worsened", "resolved", "better", "worse", "השתפר", "החמיר", "נפתר"]) {
      expect(s.includes(w)).toBe(false);
    }
  });

  it("compares runtime classes only against runtime classes", () => {
    const r = compareObservations({
      t0: obs({ runtimeClassRefs: ["INTERNAL_VS_EXTERNAL"] }),
      t1: obs({ canon_event_id: "e2", runtimeClassRefs: ["INTERNAL_VS_EXTERNAL", "PHYSICAL_VS_EMOTIONAL"] }),
    });
    const rc = r.comparisons.filter((c) => c.feature_kind === "RUNTIME_CLASS");
    expect(rc.find((c) => c.feature_id === "INTERNAL_VS_EXTERNAL")!.verdict).toBe("SAME");
    expect(rc.find((c) => c.feature_id === "PHYSICAL_VS_EMOTIONAL")!.verdict).toBe("ABSENT_TO_PRESENT");
  });

  it("compares source poles as poles, and pairs as pairs — never crossed", () => {
    const r = compareObservations({
      t0: obs({ text: "יש פחד" }),
      t1: obs({ canon_event_id: "e2", text: "בין רצון לפחד" }),
    });
    const poles = r.comparisons.filter((c) => c.feature_kind === "SOURCE_POLE");
    const pairs = r.comparisons.filter((c) => c.feature_kind === "SOURCE_PAIR");
    expect(poles.some((c) => c.feature_id === "cn_will_fear#1" && c.verdict === "SAME")).toBe(true);
    expect(poles.some((c) => c.feature_id === "cn_will_fear#0" && c.verdict === "ABSENT_TO_PRESENT")).toBe(true);
    // the PAIR only appears at t1
    expect(pairs.find((c) => c.feature_id === "cn_will_fear")!.verdict).toBe("ABSENT_TO_PRESENT");
    // a runtime class never appears in a source comparison
    expect(poles.every((c) => !c.feature_id.includes("_VS_"))).toBe(true);
  });

  it("carries source mentions as mentions, never as established contradictions", () => {
    const f = obs({ text: "בין רצון לפחד" });
    expect(f.source_mentions.every((m) => m.contradiction_established === false)).toBe(true);
  });
});
