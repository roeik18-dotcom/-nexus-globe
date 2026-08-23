/**
 * COUNTRY REFERENCE — the world, from Natural Earth 110m admin-0.
 *
 * REFERENCE GEOGRAPHY IS NOT PHILOS DATA. These 177 countries and 8 continents
 * are public-domain cartography; drawing them asserts nothing about PHILOS.
 * That distinction is why the globe can exist at all while PHILOS holds three
 * free-text labels and zero coordinates: the world is real, and PHILOS's
 * presence in it is almost entirely empty — which the map then says out loud.
 *
 * This module exposes the INDEX (code, name, continent) for statistics,
 * search and the accessible hierarchy. The polygons themselves are served
 * from `/globe/ne_110m_admin_0_countries.geojson` and fetched by the globe
 * client, so 477KB of coastline never enters a server render.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CountryRef {
  /** `ADM0_A3` — the same key `adminResolver` emits. */
  code: string;
  name: string;
  continent: string;
}


export { CONTINENT_FILL, CONTINENT_STROKE, GEOJSON_PUBLIC_PATH } from "./continentPalette";

let _cache: CountryRef[] | null = null;

/** Reads the dataset once. A missing file yields an EMPTY index rather than a
 *  throw — the world base is reference data, and its absence is a reportable
 *  fact, not a crash. */
export function loadCountries(): CountryRef[] {
  if (_cache) return _cache;
  const p = join(process.cwd(), "public", "globe", "ne_110m_admin_0_countries.geojson");
  if (!existsSync(p)) { _cache = []; return _cache; }
  try {
    const fc = JSON.parse(readFileSync(p, "utf8")) as {
      features: { properties: Record<string, unknown> }[];
    };
    _cache = fc.features.map((f) => ({
      code: String(f.properties.ADM0_A3 ?? ""),
      name: String(f.properties.NAME ?? f.properties.ADMIN ?? ""),
      continent: String(f.properties.CONTINENT ?? "Unknown"),
    })).filter((c) => c.code && c.name);
  } catch {
    _cache = [];
  }
  return _cache;
}

export function continentsOf(countries: readonly CountryRef[]): { name: string; countries: number }[] {
  const m = new Map<string, number>();
  for (const c of countries) m.set(c.continent, (m.get(c.continent) ?? 0) + 1);
  return [...m.entries()].map(([name, n]) => ({ name, countries: n }))
    .sort((a, b) => b.countries - a.countries);
}

export const countryByCode = (countries: readonly CountryRef[], code: string) =>
  countries.find((c) => c.code === code);
