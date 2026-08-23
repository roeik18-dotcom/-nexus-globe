/**
 * The map must stay truthful and non-degenerate across the whole range the
 * dataset will pass through — from today's 3 groups to a real 500 — without
 * any fixture becoming REAL.
 */
import { describe, expect, it } from "vitest";
import { layoutSpectrum, populationOf } from "../spectrumLayout";
import { buildValueGroupRegistry } from "../valueGroupRegistry";
import { buildValueGroupUniverse } from "../valueGroupUniverse";
import { parseValueGroupJsonl } from "../valueGroupIngest";
import { VALUE_GROUP_EVENTS, SEED_TODAY } from "../../valueGroupLog";
import { DEMO_COMMUNITIES } from "../../demoCommunities";

const fixtureGroups = (n: number) =>
  parseValueGroupJsonl(
    Array.from({ length: n }, (_, i) =>
      JSON.stringify({
        group_id: `fx_${i}`, name: `פיקסצ'ר ${i}`, provenance: "DEMO",
        primary_subvalue_id: `SV${String((i % 223) + 1).padStart(3, "0")}`,
      })).join("\n"),
  ).records;

const universeOf = (opts: Parameters<typeof buildValueGroupRegistry>[0]) =>
  buildValueGroupUniverse(buildValueGroupRegistry(opts));

describe("spectrum layout holds at every scale", () => {
  for (const n of [0, 1, 3, 50, 500]) {
    it(`renders a valid map at ${n} groups`, () => {
      const u = n === 0 ? universeOf({})
        : n === 1 ? universeOf({ events: VALUE_GROUP_EVENTS, today: SEED_TODAY })
        : n === 3 ? universeOf({ events: VALUE_GROUP_EVENTS, demo: DEMO_COMMUNITIES, today: SEED_TODAY })
        : universeOf({ ingested: fixtureGroups(n) });

      const L = layoutSpectrum(u, 1180, 620);

      // The taxonomy is always fully present — population never removes a leaf.
      // 28 real families plus the cross-family review region, which carries the
      // 4 sub-values the source never assigned. 219 + 4 = 223, none dropped.
      expect(L.families).toHaveLength(29);
      expect(L.families.reduce((a, f) => a + f.cells.length, 0)).toBe(223);
      expect(L.families.find((f) => f.family_id === "F--")?.cells).toHaveLength(4);

      // Every rectangle is on-canvas and non-degenerate.
      for (const f of L.families) {
        expect(f.w).toBeGreaterThan(0);
        expect(f.h).toBeGreaterThan(0);
        expect(f.x).toBeGreaterThanOrEqual(-0.001);
        expect(f.y).toBeGreaterThanOrEqual(-0.001);
        expect(f.x + f.w).toBeLessThanOrEqual(1180.001);
        expect(f.y + f.h).toBeLessThanOrEqual(620.001);
        for (const c of f.cells) {
          expect(c.w).toBeGreaterThanOrEqual(0);
          expect(c.h).toBeGreaterThanOrEqual(0);
        }
      }

      // Deterministic: the same input lays out identically, so server and
      // client draw the same geometry and no hydration mismatch is possible.
      expect(JSON.stringify(layoutSpectrum(u, 1180, 620))).toBe(JSON.stringify(L));
    });
  }

  it("keeps the four zero-sub-value families visible rather than collapsing them", () => {
    const L = layoutSpectrum(universeOf({ events: VALUE_GROUP_EVENTS, today: SEED_TODAY }), 1180, 620);
    const empty = L.families.filter((f) => f.subvalue_count === 0);
    expect(empty.length).toBe(4);
    for (const f of empty) {
      expect(f.w).toBeGreaterThan(2);
      expect(f.h).toBeGreaterThan(2);
    }
  });

  it("cell area follows source_count, not group population", () => {
    const L = layoutSpectrum(universeOf({}), 1180, 620);
    const cells = L.families.flatMap((f) => f.cells).filter((c) => c.w > 0 && c.h > 0);
    const deep = cells.filter((c) => c.source_count >= 5);
    const shallow = cells.filter((c) => c.source_count === 1);
    expect(deep.length).toBeGreaterThan(0);
    const avg = (xs: typeof cells) => xs.reduce((a, c) => a + c.w * c.h, 0) / xs.length;
    // With zero groups anywhere, area still varies — so area is not encoding
    // population, which is the separation the two channels depend on.
    expect(avg(deep)).toBeGreaterThan(avg(shallow));
  });

  it("population buckets are the three the map draws", () => {
    expect(populationOf(0)).toBe("NONE");
    expect(populationOf(1)).toBe("ONE");
    expect(populationOf(2)).toBe("MANY");
    expect(populationOf(97)).toBe("MANY");
  });

  it("500 fixture groups populate 223 leaves without promoting any to REAL", () => {
    const reg = buildValueGroupRegistry({ ingested: fixtureGroups(500) });
    expect(reg.real_count).toBe(0);
    expect(reg.demo_count).toBe(500);
    const L = layoutSpectrum(buildValueGroupUniverse(reg), 1180, 620);
    const populated = L.families.flatMap((f) => f.cells).filter((c) => c.group_count > 0);
    expect(populated).toHaveLength(223);
    expect(populated.every((c) => c.group_count >= 2)).toBe(true);
  });
});
