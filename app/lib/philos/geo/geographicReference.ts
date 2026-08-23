/**
 * GEOGRAPHIC TRUTH MODEL — five precisions that must never collapse.
 *
 * PHILOS holds three geographic facts in total, and all three are free text a
 * human typed: "תל אביב", "רמת גן", "צפון הארץ". Zero coordinates exist
 * anywhere in the product. The temptation is to geocode those strings and put
 * three dots on a globe; the result would be a map that looks populated and
 * asserts locations nobody recorded.
 *
 * So precision is a first-class field, and an entity is placed only at the
 * precision its evidence actually supports:
 *
 *   COUNTRY    the country is known; nothing finer
 *   REGION     a sub-national area is named — "צפון הארץ" is this, not a point
 *   CITY       a city is named. STILL NOT A COORDINATE.
 *   EXACT      latitude/longitude were sourced, with provenance
 *   UNLOCATED  no geography was recorded. A state, not a gap to be filled.
 *
 * THE RULE THAT MAKES THE REST HONEST: a city name does not become an exact
 * coordinate. `latitude`/`longitude` are absent unless separately sourced, and
 * no code path in this module can produce them from a label.
 *
 * AND A DERIVED COUNTRY NEVER MASQUERADES AS SOURCE DATA. Resolving "תל אביב"
 * to Israel is an inference. It is recorded as `provenance: "DERIVED"` with the
 * resolver's name and version, the reference dataset it consulted, and a
 * confidence — and `raw_label` is preserved untouched beside it, so the string
 * a human actually wrote is always recoverable.
 */

export type GeographicPrecision = "COUNTRY" | "REGION" | "CITY" | "EXACT" | "UNLOCATED";

/** REAL — the source itself carried this geography. DERIVED — PHILOS inferred
 *  it and says how. DEMO — declared demonstration data. */
export type GeoProvenance = "REAL" | "DERIVED" | "DEMO";

export type GeoConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface GeographicReference {
  /** EXACTLY what the source said. Never normalised, never overwritten. */
  raw_label: string | null;

  /** ISO 3166-1 alpha-3, matching the Natural Earth `ADM0_A3` property. */
  country_code?: string;
  country_name?: string;
  continent?: string;
  region_name?: string;
  city_name?: string;

  /** Present ONLY when separately sourced. No resolver in this module writes
   *  these — a label can never become a point here. */
  latitude?: number;
  longitude?: number;

  precision: GeographicPrecision;
  provenance: GeoProvenance;
  /** Where the geography came from, in words. */
  source: string;
  /** Named + versioned when `provenance === "DERIVED"`. Absent otherwise. */
  resolver?: string;
  confidence?: GeoConfidence;
  /** Why this precision and not a finer one. Always present. */
  because: string;
}

/** The UNLOCATED constant. An entity with no recorded geography gets this —
 *  it is a real answer, and it keeps the entity in every list, search result
 *  and statistic rather than dropping it because it cannot be plotted. */
export function unlocated(raw_label: string | null, source: string): GeographicReference {
  return {
    raw_label,
    precision: "UNLOCATED",
    provenance: raw_label ? "REAL" : "REAL",
    source,
    because: raw_label
      ? `"${raw_label}" לא נפתר לאף יחידה מנהלית מוכרת`
      : "לא נרשמה גאוגרפיה כלל",
  };
}

/** True when this reference can be drawn as a point on a globe. Only EXACT
 *  qualifies — everything else is an area or a name, and drawing an area as a
 *  dot is the fabrication this model exists to prevent. */
export const isPlottable = (g: GeographicReference): boolean =>
  g.precision === "EXACT" && typeof g.latitude === "number" && typeof g.longitude === "number";

/** True when this reference can shade a country polygon. */
export const isCountryResolved = (g: GeographicReference): boolean =>
  Boolean(g.country_code) && g.precision !== "UNLOCATED";
