/**
 * ADMIN RESOLVER v1 — free-text label → administrative unit, as an EXPLICIT
 * inference that says so.
 *
 * The ruling: a raw geographic string may not be silently upgraded into a
 * canonical country. Resolving "תל אביב" to Israel is a real, defensible
 * inference — and it is still an inference. Every result this module produces
 * carries `provenance: "DERIVED"`, this resolver's name and version, the
 * reference dataset it consulted, and a confidence. `raw_label` is copied
 * through untouched, so nothing here can overwrite what a human wrote.
 *
 * WHAT IT WILL NOT DO. It will not produce `latitude`/`longitude`. Not for a
 * city, not for a region, not ever — a coordinate is a separate sourcing act,
 * and "תל אביב" resolving to Israel at CITY precision means the label named a
 * city, not that PHILOS knows where that city is.
 *
 * THE GAZETTEER IS DELIBERATELY TINY. It covers the labels PHILOS actually
 * holds and nothing else. A label it does not know resolves to UNLOCATED with
 * its reason stated — a wrong country is worse than an honest unknown, and a
 * large speculative gazetteer is how wrong countries get in.
 */
import {
  type GeographicReference, type GeoConfidence, unlocated,
} from "./geographicReference";

export const RESOLVER_NAME = "philos-admin-resolver";
export const RESOLVER_VERSION = "1.0.0";
export const RESOLVER_ID = `${RESOLVER_NAME}@${RESOLVER_VERSION}`;

/** The reference the country codes are checked against — the same dataset the
 *  globe draws, so a resolved code always matches a drawable polygon. */
export const REFERENCE_DATASET = "Natural Earth 110m admin-0 (public domain)";

interface GazetteerEntry {
  /** Matched case-insensitively against the trimmed raw label. */
  labels: string[];
  country_code: string;
  country_name: string;
  continent: string;
  kind: "CITY" | "REGION";
  /** The administrative name, as the gazetteer records it. */
  name: string;
  confidence: GeoConfidence;
  /** Why this confidence and not a higher one. */
  note: string;
}

/**
 * Only the labels PHILOS holds today. Growing this list is a deliberate act
 * with its own evidence, not something a future feature does incidentally.
 */
const GAZETTEER: GazetteerEntry[] = [
  {
    labels: ["תל אביב", "תל־אביב", "תל אביב-יפו", "tel aviv"],
    country_code: "ISR", country_name: "Israel", continent: "Asia",
    kind: "CITY", name: "תל אביב", confidence: "HIGH",
    note: "שם עיר חד-משמעי; המדינה נגזרת ממנו בביטחון גבוה. אין קואורדינטה.",
  },
  {
    labels: ["רמת גן", "רמת־גן", "ramat gan"],
    country_code: "ISR", country_name: "Israel", continent: "Asia",
    kind: "CITY", name: "רמת גן", confidence: "HIGH",
    note: "שם עיר חד-משמעי; המדינה נגזרת ממנו בביטחון גבוה. אין קואורדינטה.",
  },
  {
    labels: ["צפון הארץ", "הצפון", "northern israel"],
    country_code: "ISR", country_name: "Israel", continent: "Asia",
    kind: "REGION", name: "צפון הארץ", confidence: "MEDIUM",
    note: "מונח אזורי מדובר, לא יחידה מנהלית רשמית. נשאר ברמת REGION — אין נקודה ואין מרכז מנהלי.",
  },
];

/**
 * Resolve one label. Total: an unknown label returns UNLOCATED with a reason
 * rather than a guess.
 */
export function resolveAdministrative(
  raw_label: string | null | undefined,
  source: string,
): GeographicReference {
  const raw = (raw_label ?? "").trim();
  if (!raw) return unlocated(null, source);

  const key = raw.toLowerCase();
  const hit = GAZETTEER.find((g) => g.labels.some((l) => l.toLowerCase() === key));
  if (!hit) {
    return {
      ...unlocated(raw, source),
      because: `"${raw}" אינו מופיע בגזטיר של ${RESOLVER_ID} — נשאר UNLOCATED במקום להיפתר למדינה שגויה`,
    };
  }

  return {
    // THE RAW STRING SURVIVES. Everything below is layered over it, never onto it.
    raw_label: raw,
    country_code: hit.country_code,
    country_name: hit.country_name,
    continent: hit.continent,
    ...(hit.kind === "CITY" ? { city_name: hit.name } : { region_name: hit.name }),
    // Deliberately absent, and unreachable from here.
    latitude: undefined,
    longitude: undefined,
    precision: hit.kind,
    provenance: "DERIVED",
    source,
    resolver: RESOLVER_ID,
    confidence: hit.confidence,
    because: `${hit.note} מקור ייחוס: ${REFERENCE_DATASET}.`,
  };
}

/** What the resolver can currently recognise — for the audit layer to state
 *  its own reach rather than implying it covers the world. */
export const RESOLVER_COVERAGE = {
  resolver: RESOLVER_ID,
  reference: REFERENCE_DATASET,
  known_labels: GAZETTEER.reduce((n, g) => n + g.labels.length, 0),
  known_places: GAZETTEER.length,
  countries: [...new Set(GAZETTEER.map((g) => g.country_code))],
  produces_coordinates: false,
} as const;
