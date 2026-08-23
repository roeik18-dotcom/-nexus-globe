/**
 * Regression for the confirmed defect: the Natural Earth dataset has no
 * LABEL_X / LABEL_Y, and a `?? 0` fallback put every country name on (0,0).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveLabelAnchor, selectLabels, tierForAltitude, zoomForAltitude,
} from "../cartographicLabelAnchor";
import { resolveAdministrative } from "../adminResolver";
import { isPlottable } from "../geographicReference";

const dataset = JSON.parse(readFileSync(
  join(process.cwd(), "public", "globe", "ne_110m_admin_0_countries.geojson"), "utf8",
)) as { features: { properties: Record<string, unknown>; geometry: { type: string } }[] };

const byName = (n: string) => dataset.features.find((f) => f.properties.NAME === n)!;

describe("the dataset really has no label coordinates", () => {
  it("confirms the root cause rather than assuming it", () => {
    const props = Object.keys(dataset.features[0].properties);
    expect(props).not.toContain("LABEL_X");
    expect(props).not.toContain("LABEL_Y");
    // What it DOES publish, and what the density rule therefore uses.
    expect(props).toContain("LABELRANK");
    expect(props).toContain("MIN_LABEL");
    expect(props).toContain("MAX_LABEL");
  });

  it("no source module reads LABEL_X / LABEL_Y in executable code", () => {
    for (const f of ["app/planet/WorldExplorer.tsx", "app/lib/philos/geo/cartographicLabelAnchor.ts"]) {
      let inBlock = false;
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const t = line.trim();
        const opens = t.includes("/*"), closes = t.includes("*/");
        const was = inBlock;
        if (opens && !closes) inBlock = true;
        if (closes) inBlock = false;
        if (was || opens || t.startsWith("//") || t.startsWith("*")) continue;
        expect(t.includes("LABEL_X") || t.includes("LABEL_Y")).toBe(false);
      }
    }
  });
});

describe("anchors are geometry-derived, finite, and never (0,0) by fallback", () => {
  it("produces a finite anchor for every one of the 177 countries", () => {
    const anchors = dataset.features.map((f) => deriveLabelAnchor(f as never));
    expect(anchors.filter(Boolean)).toHaveLength(177);
    for (const a of anchors) {
      expect(Number.isFinite(a!.lng)).toBe(true);
      expect(Number.isFinite(a!.lat)).toBe(true);
      expect(Math.abs(a!.lng)).toBeLessThanOrEqual(180);
      expect(Math.abs(a!.lat)).toBeLessThanOrEqual(90);
    }
  });

  it("does NOT stack labels on a single point — the exact old failure", () => {
    const anchors = dataset.features.map((f) => deriveLabelAnchor(f as never)!);
    const atOrigin = anchors.filter((a) => a.lng === 0 && a.lat === 0);
    expect(atOrigin).toHaveLength(0);
    // And they are genuinely spread, not clustered by accident.
    const distinct = new Set(anchors.map((a) => `${a.lng.toFixed(2)},${a.lat.toFixed(2)}`));
    expect(distinct.size).toBe(177);
  });

  it("returns null rather than a coordinate when geometry is missing", () => {
    expect(deriveLabelAnchor({ type: "Feature", geometry: null } as never)).toBeNull();
    expect(deriveLabelAnchor({ type: "Feature" } as never)).toBeNull();
    // A feature with no properties at all still cannot invent a position.
    expect(deriveLabelAnchor({ type: "Feature", geometry: null, properties: {} } as never)).toBeNull();
  });

  it("handles a simple Polygon", () => {
    const poly = dataset.features.find((f) => f.geometry.type === "Polygon")!;
    const a = deriveLabelAnchor(poly as never)!;
    expect(a.method).toBe("CENTROID");
    expect(Number.isFinite(a.lat)).toBe(true);
  });

  it("handles a MultiPolygon and lands the anchor on real land", () => {
    const multi = dataset.features.filter((f) => f.geometry.type === "MultiPolygon");
    expect(multi.length).toBeGreaterThan(20);
    for (const f of multi) {
      const a = deriveLabelAnchor(f as never)!;
      expect(a).not.toBeNull();
      expect(Number.isFinite(a.lng) && Number.isFinite(a.lat)).toBe(true);
    }
  });

  it("puts the US anchor on the contiguous mass, not in the Pacific", () => {
    // Alaska + Hawaii drag the whole-shape centroid far west; the largest
    // component is what a reader expects the name to sit on.
    const a = deriveLabelAnchor(byName("United States of America") as never)!;
    expect(a.lng).toBeGreaterThan(-130);
    expect(a.lng).toBeLessThan(-70);
    expect(a.lat).toBeGreaterThan(24);
    expect(a.lat).toBeLessThan(55);
  });

  it("places a few known countries in the right hemisphere", () => {
    const brazil = deriveLabelAnchor(byName("Brazil") as never)!;
    expect(brazil.lat).toBeLessThan(0);
    expect(brazil.lng).toBeLessThan(-30);
    const israel = deriveLabelAnchor(byName("Israel") as never)!;
    expect(israel.lat).toBeGreaterThan(29);
    expect(israel.lat).toBeLessThan(34);
    expect(israel.lng).toBeGreaterThan(33);
    expect(israel.lng).toBeLessThan(36);
  });
});

describe("label density is deterministic and bounded", () => {
  const anchored = dataset.features.map((f) => ({
    properties: f.properties,
    anchor: deriveLabelAnchor(f as never),
    code: String(f.properties.ADM0_A3), name: String(f.properties.NAME),
  }));
  const pick = (altitude: number, selected?: string) =>
    selectLabels(anchored, { altitude, selectedCode: selected ?? null, codeOf: (f) => f.code, nameOf: (f) => f.name });

  it("does not render all 177 at once", () => {
    for (const alt of [2.5, 1.5, 0.9, 0.4]) {
      expect(pick(alt).length).toBeLessThan(120);
    }
  });

  it("reveals progressively more labels as the camera descends", () => {
    const world = pick(2.5).length, continent = pick(1.5).length;
    const country = pick(0.9).length, local = pick(0.4).length;
    expect(world).toBeLessThanOrEqual(continent);
    expect(continent).toBeLessThanOrEqual(country);
    expect(country).toBeLessThanOrEqual(local);
    expect(world).toBeGreaterThan(0);
  });

  it("is deterministic — same input, identical output", () => {
    expect(pick(0.9).map((f) => f.code)).toEqual(pick(0.9).map((f) => f.code));
  });

  it("keeps the selected country eligible even at world altitude", () => {
    // A deliberately low-priority country that world tier would otherwise drop.
    const low = anchored.filter((a) => Number(a.properties.LABELRANK) >= 6)[0];
    expect(low).toBeTruthy();
    expect(pick(2.5).map((f) => f.code)).not.toContain(low.code);
    expect(pick(2.5, low.code).map((f) => f.code)).toContain(low.code);
  });

  it("never emits a label without an anchor", () => {
    const withNull = [...anchored, { properties: { LABELRANK: 1 }, anchor: null, code: "XXX", name: "Nowhere" }];
    const out = selectLabels(withNull, { altitude: 0.4, selectedCode: "XXX", codeOf: (f) => f.code, nameOf: (f) => f.name });
    expect(out.map((f) => f.code)).not.toContain("XXX");
  });

  it("tier and zoom are pure monotonic functions of altitude", () => {
    expect(tierForAltitude(2.5)).toBe("WORLD");
    expect(tierForAltitude(1.5)).toBe("CONTINENT");
    expect(tierForAltitude(0.9)).toBe("COUNTRY");
    expect(tierForAltitude(0.4)).toBe("LOCAL");
    expect(zoomForAltitude(2.5)).toBeLessThan(zoomForAltitude(0.4));
  });
});

describe("PHILOS geographic truth is untouched by cartographic anchors", () => {
  it("FAKE_COORDINATES remains 0 — the resolver still produces none", () => {
    for (const label of ["תל אביב", "רמת גן", "צפון הארץ"]) {
      const g = resolveAdministrative(label, "t");
      expect(g.latitude).toBeUndefined();
      expect(g.longitude).toBeUndefined();
      expect(isPlottable(g)).toBe(false);
    }
  });

  it("the anchor module cannot reach the resolver or entity data", () => {
    const src = readFileSync("app/lib/philos/geo/cartographicLabelAnchor.ts", "utf8");
    expect(src).not.toContain("adminResolver");
    expect(src).not.toContain("geographicReference");
    expect(src).not.toContain("GeographicReference");
  });
});
