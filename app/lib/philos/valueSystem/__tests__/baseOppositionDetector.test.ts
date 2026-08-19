import { describe, expect, it } from "vitest";
import { detectBaseOppositions, listBaseOppositions } from "../baseOppositionDetector";

describe("base oppositions — the source's own 24, never a mapping", () => {
  it("recovers both poles for every listed opposition, including the mojibake separator", () => {
    const all = listBaseOppositions();
    expect(all.length).toBeGreaterThanOrEqual(22);
    for (const o of all) {
      expect(o.poles).toHaveLength(2);
      expect(o.poles[0].length).toBeGreaterThan(1);
      expect(o.poles[1].length).toBeGreaterThan(1);
    }
    // the row whose arrow was mangled to `½` must be recovered, not dropped
    expect(all.some((o) => o.contradiction_id === "cn_restraint_scope")).toBe(true);
  });

  it("never guesses a missing pole — a malformed wording is skipped, not halved", () => {
    for (const o of listBaseOppositions()) expect(o.source_wording).toMatch(/↔|½/);
  });

  it("detects a named pole from real source wording", () => {
    const d = detectBaseOppositions("יש כאן הרבה פחד ולא ברור מה עושים");
    const willFear = d.find((x) => x.contradiction_id === "cn_will_fear");
    expect(willFear).toBeDefined();
    expect(willFear!.matched_pole).toBe("פחד");
    expect(willFear!.pole_index).toBe(1);
  });

  it("tolerates a Hebrew prefix but does not stem or fuzzy-match", () => {
    expect(detectBaseOppositions("הפחד גדול").some((x) => x.contradiction_id === "cn_will_fear")).toBe(true);
    // an unrelated word must NOT match
    expect(detectBaseOppositions("הליכה בפארק").some((x) => x.contradiction_id === "cn_will_fear")).toBe(false);
  });

  it("reports every detection as INTERPRETED, never measured", () => {
    for (const d of detectBaseOppositions("לחץ ותקווה וגם ספק")) {
      expect(d.epistemic_status).toBe("INTERPRETED_CONTRADICTION");
      expect(d.magnitude).toBe("UNRESOLVED");
    }
  });

  it("marks NO_MAPPING on every result — the 5 runtime classes stay separate", () => {
    const d = detectBaseOppositions("פחד ולחץ");
    expect(d.length).toBeGreaterThan(0);
    for (const x of d) expect(x.mapping_status).toBe("NO_MAPPING_TO_RUNTIME_CLASSES");
    // and nothing here carries a runtime class name
    const s = JSON.stringify(d);
    for (const cls of ["INTERNAL_VS_EXTERNAL", "PHYSICAL_VS_EMOTIONAL", "EMOTIONAL_VS_COGNITIVE",
      "COGNITIVE_VS_PHYSICAL_ACTION", "DECLARED_VALUE_VS_ACTION"]) {
      expect(s.includes(cls)).toBe(false);
    }
  });

  it("reports an opposition once even when both poles appear", () => {
    const d = detectBaseOppositions("בין רצון לפחד");
    expect(d.filter((x) => x.contradiction_id === "cn_will_fear")).toHaveLength(1);
  });

  it("is total over empty/junk input", () => {
    for (const v of ["", "   ", null as unknown as string, undefined as unknown as string]) {
      expect(detectBaseOppositions(v)).toEqual([]);
    }
  });
});
