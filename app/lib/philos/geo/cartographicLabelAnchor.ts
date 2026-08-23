/**
 * CARTOGRAPHIC LABEL ANCHORS — where a country's NAME is drawn.
 *
 * WHAT THIS IS NOT. It is not a location for any PHILOS entity, it never
 * reaches the resolver, and it is never written into geographic truth. It is a
 * rendering coordinate derived from a country's own published boundary, the
 * same way a cartographer places a label — and it exists only so a map can be
 * read. `FAKE_COORDINATES = 0` is about PHILOS entities and stays 0; deriving
 * where to print "Brazil" from Brazil's own polygon asserts nothing about
 * PHILOS.
 *
 * THE DEFECT THIS REPLACES. The code assumed `LABEL_X` / `LABEL_Y` existed on
 * the Natural Earth features. They do not — the dataset carries `LABELRANK`,
 * `MIN_LABEL` and `MAX_LABEL` and no label coordinates at all. With a `?? 0`
 * fallback every one of the 125 country labels resolved to (0, 0) and stacked
 * on a single point in the Gulf of Guinea.
 *
 * SO THERE IS NO FALLBACK HERE. A feature whose anchor cannot be derived
 * returns `null` and is not labelled. An unlabelled country is a readable map;
 * 125 names on one pixel is not.
 */
import { geoCentroid, geoContains, geoArea } from "d3-geo";

export interface LabelAnchor {
  lng: number;
  lat: number;
  /** How this anchor was derived, so the method is auditable per feature. */
  method: "CENTROID" | "LARGEST_COMPONENT_CENTROID";
}

type Ring = number[][];
type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

interface Feature { type: "Feature"; geometry: Geometry | null; properties?: Record<string, unknown> }

const finite = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 &&
  Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
  Math.abs(p[0] as number) <= 180 && Math.abs(p[1] as number) <= 90;

/**
 * Derive one anchor. Returns `null` rather than guessing.
 *
 * Two passes, in order:
 *   1. `geoCentroid` of the whole feature — correct for a single landmass.
 *   2. If that centroid does not fall INSIDE the feature, fall back to the
 *      centroid of its LARGEST component. A country split across an ocean
 *      (Indonesia, the United States with Alaska and Hawaii) has a whole-shape
 *      centroid out at sea; the dominant landmass is where a reader expects
 *      the name.
 */
export function deriveLabelAnchor(feature: Feature): LabelAnchor | null {
  const g = feature?.geometry;
  if (!g) return null;

  const whole = geoCentroid(feature as never);
  if (finite(whole) && geoContains(feature as never, whole)) {
    return { lng: whole[0], lat: whole[1], method: "CENTROID" };
  }

  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates) && g.coordinates.length > 0) {
    let best: { area: number; anchor: [number, number] } | null = null;
    for (const rings of g.coordinates) {
      const part = { type: "Polygon" as const, coordinates: rings };
      const area = geoArea(part as never);
      if (!Number.isFinite(area) || area <= 0) continue;
      const c = geoCentroid(part as never);
      if (!finite(c)) continue;
      if (!best || area > best.area) best = { area, anchor: c };
    }
    if (best) return { lng: best.anchor[0], lat: best.anchor[1], method: "LARGEST_COMPONENT_CENTROID" };
  }

  // A single-polygon feature whose centroid lies outside itself (a deep
  // crescent) still gets that centroid — it is on the right part of the map,
  // which is what a label needs. Only a NON-FINITE result yields null.
  if (finite(whole)) return { lng: whole[0], lat: whole[1], method: "CENTROID" };
  return null;
}

/* ── LABEL DENSITY ────────────────────────────────────────────────────────
   Natural Earth publishes its own cartographic priority per feature:
   `LABELRANK` (1 = most prominent), plus `MIN_LABEL` / `MAX_LABEL`, the zoom
   window at which the label is meant to appear. Using the dataset's own
   editorial judgement is both deterministic and better than a hand-written
   list of "important" countries — which would be an opinion about geopolitics
   dressed as a rendering rule. */

export type LabelTier = "WORLD" | "CONTINENT" | "COUNTRY" | "LOCAL";

/**
 * Camera altitude → a Natural Earth-style zoom number. Monotonic and pure.
 *
 * Calibrated against the dataset rather than guessed: `MIN_LABEL` in this file
 * runs 1.7 … 6.0, so a world-tier zoom of 1.5 sat BELOW the lowest threshold
 * and admitted nothing — the world view had no labels at all. 1.8 clears the
 * 1.7 band (18 features), and each step up opens the next real cluster:
 * 3.0 → +72, 4.5 → +46, 6.5 → the tail.
 */
export function zoomForAltitude(altitude: number): number {
  if (altitude > 1.9) return 1.8;
  if (altitude > 1.1) return 3;
  if (altitude > 0.6) return 4.5;
  return 6.5;
}

export const tierForAltitude = (altitude: number): LabelTier =>
  altitude > 1.9 ? "WORLD" : altitude > 1.1 ? "CONTINENT" : altitude > 0.6 ? "COUNTRY" : "LOCAL";

/** Hard ceiling per tier. Even with the dataset's own gating, a dense tier can
 *  still crowd; this caps what is drawn and the cap is applied by priority, so
 *  the labels that survive are the ones the dataset ranks highest. */
const TIER_CAP: Record<LabelTier, number> = { WORLD: 12, CONTINENT: 28, COUNTRY: 55, LOCAL: 95 };

export interface DensityInput {
  properties?: Record<string, unknown>;
  anchor: LabelAnchor | null;
}

/**
 * Choose which features get a label. Deterministic: same inputs, same output,
 * with ties broken by name so the set never flickers between renders.
 *
 * `selectedCode` is ALWAYS eligible — a country the reader has chosen must be
 * able to show its own name regardless of rank.
 */
export function selectLabels<T extends DensityInput>(
  features: readonly T[],
  opts: { altitude: number; selectedCode?: string | null; codeOf: (f: T) => string; nameOf: (f: T) => string },
): T[] {
  const tier = tierForAltitude(opts.altitude);
  const zoom = zoomForAltitude(opts.altitude);
  const cap = TIER_CAP[tier];

  const eligible = features.filter((f) => {
    if (!f.anchor) return false;                      // no anchor, no label. No fallback.
    if (opts.selectedCode && opts.codeOf(f) === opts.selectedCode) return true;
    const min = Number(f.properties?.MIN_LABEL);
    const max = Number(f.properties?.MAX_LABEL);
    // The dataset's own zoom window, when it publishes one.
    if (Number.isFinite(min) && zoom < min) return false;
    if (Number.isFinite(max) && zoom > max) return false;
    return true;
  });

  const rank = (f: T) => {
    const r = Number(f.properties?.LABELRANK);
    return Number.isFinite(r) ? r : 99;
  };

  const sorted = [...eligible].sort((a, b) => {
    const aSel = opts.selectedCode && opts.codeOf(a) === opts.selectedCode ? -1 : 0;
    const bSel = opts.selectedCode && opts.codeOf(b) === opts.selectedCode ? -1 : 0;
    if (aSel !== bSel) return aSel - bSel;            // selection first, always
    return rank(a) - rank(b) || opts.nameOf(a).localeCompare(opts.nameOf(b));
  });

  return sorted.slice(0, cap);
}
