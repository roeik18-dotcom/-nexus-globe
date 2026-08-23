/**
 * ONE LOADER for the world view: reference geography, resolved PHILOS
 * geography, four statistical levels, and the search index — assembled once so
 * the globe, the statistics, the network and the entity panel are coordinated
 * views over the same objects rather than four independent reads.
 */
import { loadValueGroupWorld, type ValueGroupWorld } from "../community/loadValueGroupWorld";
import { loadCountries, continentsOf, type CountryRef } from "./countryReference";
import { resolveAdministrative, RESOLVER_COVERAGE } from "./adminResolver";
import { unlocated, type GeographicReference } from "./geographicReference";
import { buildSearchIndex, type SearchIndex } from "./worldSearch";
import {
  globalStats, continentStats, countryStats,
  type LocatedGroup, type GlobalStats, type ContinentStats, type CountryStats,
} from "./worldStatistics";

export interface WorldView {
  group: ValueGroupWorld;
  countries: CountryRef[];
  continents: { name: string; countries: number }[];
  located: LocatedGroup[];
  /** Groups whose geography could not be resolved. First-class, not residue. */
  unlocated: LocatedGroup[];
  global: GlobalStats;
  byContinent: ContinentStats[];
  byCountry: CountryStats[];
  search: SearchIndex;
  resolverCoverage: typeof RESOLVER_COVERAGE;
}

export async function loadWorldView(opts?: { requestedGroup?: unknown }): Promise<WorldView> {
  const group = await loadValueGroupWorld({ requestedGroup: opts?.requestedGroup });
  const countries = loadCountries();

  /* RESOLUTION. Each group's own free-text `geography` goes through the
     explicit resolver; a group with no label gets UNLOCATED without one. The
     raw string is preserved on the reference either way. */
  const located: LocatedGroup[] = group.registry.entries.map((entry) => {
    const raw = entry.group.geography ?? null;
    const geo: GeographicReference = raw
      ? resolveAdministrative(raw, `שדה geography של הקבוצה (${entry.group.source})`)
      : unlocated(null, `שדה geography של הקבוצה (${entry.group.source})`);
    return { entry, geo, state: group.operational.get(entry.group.group_id) ?? null };
  });

  return {
    group,
    countries,
    continents: continentsOf(countries),
    located,
    unlocated: located.filter((g) => g.geo.precision === "UNLOCATED"),
    global: globalStats(located, group.relations, group.universe, countries),
    byContinent: continentStats(located, group.relations, group.universe, countries),
    byCountry: countryStats(located, group.relations, group.universe, countries),
    search: buildSearchIndex({ countries, universe: group.universe, groups: located }),
    resolverCoverage: RESOLVER_COVERAGE,
  };
}
