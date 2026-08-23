/**
 * CONTINENT PALETTE — client-safe. No filesystem, no server-only import.
 *
 * Split out of `countryReference.ts` because that module reads the Natural
 * Earth file with `node:fs`, and the globe is a client component: pulling the
 * loader in for three constants dragged `node:fs` into the browser bundle and
 * failed the build. Constants live here; the reader stays on the server.
 *
 * GEOGRAPHY OWNS THIS CHANNEL AND NOTHING ELSE. No operational meaning may
 * reuse a continent hue, or the map would say two things with one cue. The
 * values are deliberately muted — the base is a ground for entity marks to sit
 * on, not a competitor for attention.
 */
export const GEOJSON_PUBLIC_PATH = "/globe/ne_110m_admin_0_countries.geojson";

/* Two things forced these lighter than the first attempt. One: the polygon
   caps are lit geometry, and at near-black they rendered indistinguishable
   from the sphere — the globe read as an empty circle. Two, and the real
   reason: `CONTINENTS_DISTINGUISHABLE` is an acceptance criterion, and eight
   shades of dark navy do not distinguish anything. These stay muted enough to
   be a ground for entity marks, and separated enough in hue AND lightness to
   be told apart at world altitude. */
export const CONTINENT_FILL: Record<string, string> = {
  "Africa":        "#8a6b3a",
  "Asia":          "#3f6f9c",
  "Europe":        "#6b5aa8",
  "North America": "#3d8a72",
  "South America": "#9c5f86",
  "Oceania":       "#4a8fa0",
  "Antarctica":    "#7b8496",
  "Seven seas (open ocean)": "#243149",
};

/* Borders: one step lighter than the fill of the same family, so a country
   edge reads as an edge without introducing a second hue and a second
   meaning. */
export const CONTINENT_STROKE: Record<string, string> = {
  "Africa":        "#c9a66b",
  "Asia":          "#7fb4de",
  "Europe":        "#a396e0",
  "North America": "#72c9ac",
  "South America": "#d194b8",
  "Oceania":       "#84c6d6",
  "Antarctica":    "#b3bcca",
  "Seven seas (open ocean)": "#3d5175",
};
