/**
 * WORLD STATISTICS — four synchronized levels over one selection state.
 *
 * GLOBAL · CONTINENT · COUNTRY · ENTITY are projections of the same registry
 * and the same operational spine, not four independently-counted dashboards.
 * Counting the same fact twice in two places is how Community, Network and
 * System came to disagree about membership, and this module exists so that
 * cannot recur at world scale.
 *
 * A COUNTRY WITH ZERO IS A REAL ANSWER. 176 of 177 countries currently hold
 * nothing, and the honest rendering of that is `0` — not omission from the
 * list, and certainly not demo activity added so the map looks alive.
 */
import type { RegistryEntry, ValueGroupRegistry } from "../community/valueGroupRegistry";
import type { ValueGroupUniverse } from "../community/valueGroupUniverse";
import type { GroupOperationalState } from "../community/groupOperationalState";
import type { GroupRelation } from "../community/groupRelations";
import type { GeographicReference } from "./geographicReference";
import { isCountryResolved, isPlottable } from "./geographicReference";
import type { CountryRef } from "./countryReference";

/** A registry group with its resolved geography attached. */
export interface LocatedGroup {
  entry: RegistryEntry;
  geo: GeographicReference;
  state: GroupOperationalState | null;
}

export interface OperationalTotals {
  groups: number;
  real: number; derived: number; demo: number;
  members: number;
  needs: number; resources: number; actions: number;
  effects: number; evidence: number; tensions: number;
  budget_available: number;
  relations: number;
  unresolved_mappings: number;
  value_families: number;
  sub_values: number;
}

export interface GlobalStats extends OperationalTotals {
  /** Reference geography — the world, not PHILOS. Stated separately. */
  countries_in_reference: number;
  continents_in_reference: number;
  /** PHILOS geography. These are the numbers that are almost all zero. */
  countries_with_presence: number;
  groups_country_resolved: number;
  groups_plottable: number;
  groups_unlocated: number;
  /** Taxonomy coverage vs population coverage — never averaged together. */
  populated_sub_values: number;
  populated_families: number;
}

export interface ContinentStats extends OperationalTotals {
  continent: string;
  countries_in_reference: number;
  countries_with_presence: number;
}

export interface CountryStats extends OperationalTotals {
  code: string;
  name: string;
  continent: string;
  /** Distinct value families represented by groups resolved to this country. */
  families_present: string[];
  precisions: Record<string, number>;
}

function totalsFor(groups: readonly LocatedGroup[], relations: readonly GroupRelation[], universe: ValueGroupUniverse): OperationalTotals {
  const ids = new Set(groups.map((g) => g.entry.group.group_id));
  const st = groups.map((g) => g.state).filter(Boolean) as GroupOperationalState[];
  const sum = (f: (s: GroupOperationalState) => number) => st.reduce((a, s) => a + f(s), 0);
  return {
    groups: groups.length,
    real: groups.filter((g) => g.entry.group.provenance === "REAL").length,
    derived: 0,
    demo: groups.filter((g) => g.entry.group.provenance === "DEMO").length,
    // Membership from the spine where it exists, else the registry roster.
    members: groups.reduce((a, g) => a + (g.state && g.state.channels.members === "MEASURED"
      ? g.state.members.filter((m) => m.active).length
      : g.entry.group.members.length), 0),
    needs: sum((s) => s.needs.length),
    resources: sum((s) => s.resources.length),
    actions: sum((s) => s.actions.length),
    effects: sum((s) => s.effects.length) || groups.reduce((a, g) => a + (g.entry.group.effect_count ?? 0), 0),
    evidence: sum((s) => s.evidence.length) || groups.reduce((a, g) => a + (g.entry.group.evidence_count ?? 0), 0),
    tensions: sum((s) => s.tensions.length),
    budget_available: groups.reduce((a, g) => a + (g.state?.budget?.available ?? g.entry.group.budget?.available ?? 0), 0),
    relations: relations.filter((r) => ids.has(r.from_group_id) && ids.has(r.to_group_id)).length,
    unresolved_mappings: groups.filter((g) => g.entry.group.value_mapping_status !== "RESOLVED").length,
    value_families: new Set(groups.map((g) => g.entry.group.value_family_id).filter(Boolean)).size,
    sub_values: new Set(groups.flatMap((g) => [g.entry.group.primary_subvalue_id, ...(g.entry.group.secondary_subvalue_ids ?? [])]).filter(Boolean)).size,
  };
}

export function globalStats(
  located: readonly LocatedGroup[],
  relations: readonly GroupRelation[],
  universe: ValueGroupUniverse,
  countries: readonly CountryRef[],
): GlobalStats {
  const withCountry = located.filter((g) => isCountryResolved(g.geo));
  return {
    ...totalsFor(located, relations, universe),
    countries_in_reference: countries.length,
    continents_in_reference: new Set(countries.map((c) => c.continent)).size,
    countries_with_presence: new Set(withCountry.map((g) => g.geo.country_code)).size,
    groups_country_resolved: withCountry.length,
    groups_plottable: located.filter((g) => isPlottable(g.geo)).length,
    groups_unlocated: located.filter((g) => g.geo.precision === "UNLOCATED").length,
    populated_sub_values: universe.coverage.populated_subvalue_count,
    populated_families: universe.coverage.populated_family_count,
    value_families: universe.coverage.family_count,
    sub_values: universe.coverage.subvalue_count,
  };
}

export function continentStats(
  located: readonly LocatedGroup[],
  relations: readonly GroupRelation[],
  universe: ValueGroupUniverse,
  countries: readonly CountryRef[],
): ContinentStats[] {
  const byContinent = new Map<string, CountryRef[]>();
  for (const c of countries) byContinent.set(c.continent, [...(byContinent.get(c.continent) ?? []), c]);
  return [...byContinent.entries()].map(([continent, list]) => {
    const codes = new Set(list.map((c) => c.code));
    const here = located.filter((g) => g.geo.country_code && codes.has(g.geo.country_code));
    return {
      continent,
      ...totalsFor(here, relations, universe),
      countries_in_reference: list.length,
      countries_with_presence: new Set(here.map((g) => g.geo.country_code)).size,
    };
  }).sort((a, b) => b.groups - a.groups || b.countries_in_reference - a.countries_in_reference);
}

export function countryStats(
  located: readonly LocatedGroup[],
  relations: readonly GroupRelation[],
  universe: ValueGroupUniverse,
  countries: readonly CountryRef[],
): CountryStats[] {
  return countries.map((c) => {
    const here = located.filter((g) => g.geo.country_code === c.code);
    const precisions: Record<string, number> = {};
    for (const g of here) precisions[g.geo.precision] = (precisions[g.geo.precision] ?? 0) + 1;
    return {
      code: c.code, name: c.name, continent: c.continent,
      ...totalsFor(here, relations, universe),
      families_present: [...new Set(here.map((g) => g.entry.group.value_family_id).filter(Boolean))] as string[],
      precisions,
    };
  }).sort((a, b) => b.groups - a.groups || a.name.localeCompare(b.name));
}
