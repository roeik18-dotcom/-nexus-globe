/**
 * UNIVERSAL SEARCH — one index over geography and PHILOS entities alike.
 *
 * THE POINT OF THE `geo` FIELD ON EVERY RESULT: selecting a result navigates
 * the globe to the HIGHEST TRUTHFUL precision that result supports, and to
 * nothing finer. A country-resolved group flies to its country; a CITY-level
 * group flies to its country too, because PHILOS knows the city's name and not
 * its position; an UNLOCATED group does not move the globe at all — it opens
 * its panel where it stands. A search result never invents a map position in
 * order to have somewhere to fly.
 *
 * EVERY sub-value and EVERY group is in this index, including the 223 leaves
 * with no groups and the groups with no geography. "Discoverable" is the
 * requirement; "printed on the globe simultaneously" is not.
 */
import type { RegistryEntry } from "../community/valueGroupRegistry";
import type { ValueGroupUniverse } from "../community/valueGroupUniverse";
import type { GroupOperationalState } from "../community/groupOperationalState";
import type { CountryRef } from "./countryReference";
import type { GeographicReference } from "./geographicReference";

export type SearchKind =
  | "CONTINENT" | "COUNTRY" | "REGION" | "CITY"
  | "GROUP" | "VALUE_FAMILY" | "SUB_VALUE"
  | "NEED" | "RESOURCE" | "ACTION" | "EFFECT" | "EVIDENCE";

export interface SearchResult {
  id: string;
  kind: SearchKind;
  label: string;
  /** Short second line — the count or the context that disambiguates. */
  detail: string;
  /** Where selecting this should take the globe. `null` = nowhere: the entity
   *  has no truthful position, so the globe stays put and the panel opens. */
  focus: { kind: "CONTINENT"; name: string } | { kind: "COUNTRY"; code: string } | null;
  /** The selection this result sets, carried into the coordinated views. */
  select: { group_id?: string; subvalue_id?: string; family_id?: string; country_code?: string; continent?: string };
  precision?: GeographicReference["precision"];
}

export interface SearchIndex { entries: SearchResult[] }

export function buildSearchIndex(input: {
  countries: readonly CountryRef[];
  universe: ValueGroupUniverse;
  groups: readonly { entry: RegistryEntry; geo: GeographicReference; state: GroupOperationalState | null }[];
}): SearchIndex {
  const entries: SearchResult[] = [];

  for (const name of [...new Set(input.countries.map((c) => c.continent))]) {
    entries.push({
      id: `continent:${name}`, kind: "CONTINENT", label: name,
      detail: `${input.countries.filter((c) => c.continent === name).length} מדינות · גאוגרפיית ייחוס`,
      focus: { kind: "CONTINENT", name }, select: { continent: name },
    });
  }

  for (const c of input.countries) {
    entries.push({
      id: `country:${c.code}`, kind: "COUNTRY", label: c.name,
      detail: `${c.continent} · ${c.code}`,
      focus: { kind: "COUNTRY", code: c.code }, select: { country_code: c.code },
    });
  }

  for (const f of input.universe.families) {
    entries.push({
      id: `family:${f.family_id}`, kind: "VALUE_FAMILY", label: f.name_he,
      detail: `${f.family_id} · ${f.subvalue_count} תת-ערכים · ${f.group_count} קבוצות`,
      focus: null, select: { family_id: f.family_id },
    });
    for (const s of f.subvalues) {
      entries.push({
        id: `subvalue:${s.subvalue_id}`, kind: "SUB_VALUE", label: s.name_he,
        detail: `${s.subvalue_id} · ${s.source_count} מקורות · ${s.group_count} קבוצות`,
        focus: null, select: { subvalue_id: s.subvalue_id, family_id: f.family_id },
      });
    }
  }
  for (const s of input.universe.unfamilied) {
    entries.push({
      id: `subvalue:${s.subvalue_id}`, kind: "SUB_VALUE", label: s.name_he,
      detail: `${s.subvalue_id} · בין-משפחתי · ${s.group_count} קבוצות`,
      focus: null, select: { subvalue_id: s.subvalue_id },
    });
  }

  for (const g of input.groups) {
    const geo = g.geo;
    // Highest TRUTHFUL precision — never finer than the evidence.
    const focus: SearchResult["focus"] = geo.country_code
      ? { kind: "COUNTRY", code: geo.country_code }
      : geo.continent ? { kind: "CONTINENT", name: geo.continent } : null;
    entries.push({
      id: `group:${g.entry.group.group_id}`, kind: "GROUP", label: g.entry.group.name,
      detail: geo.precision === "UNLOCATED"
        ? `${g.entry.group.provenance} · ללא גאוגרפיה מתועדת`
        : `${g.entry.group.provenance} · ${geo.country_name ?? "—"} · ${geo.precision}${geo.raw_label ? ` · "${geo.raw_label}"` : ""}`,
      focus, select: { group_id: g.entry.group.group_id, country_code: geo.country_code },
      precision: geo.precision,
    });

    const st = g.state;
    if (!st) continue;
    const push = (kind: SearchKind, id: string, label: string, detail: string) =>
      entries.push({ id: `${kind.toLowerCase()}:${id}`, kind, label, detail, focus,
        select: { group_id: g.entry.group.group_id, country_code: geo.country_code } });
    for (const n of st.needs) push("NEED", n.need_id, n.description ?? n.need_id, `${g.entry.group.name} · ${n.status}`);
    for (const r of st.resources) push("RESOURCE", r.resource_id, r.description ?? r.resource_id, `${g.entry.group.name} · ${r.status}`);
    for (const a of st.actions) push("ACTION", a.action_id, a.description ?? a.action_id, `${g.entry.group.name} · ${a.status}`);
    for (const e of st.effects) push("EFFECT", e.effect_id, e.description ?? e.effect_id, `${g.entry.group.name} · ${e.status}`);
    for (const v of st.evidence) push("EVIDENCE", v.evidence_id, v.note ?? v.evidence_id, `${g.entry.group.name}`);
  }

  return { entries };
}

/** Substring match, ranked: exact, then prefix, then contains. Deliberately
 *  not fuzzy — a fuzzy hit on a value name would be the same category of
 *  mistake `valueMapping` refuses to make. */
export function search(index: SearchIndex, q: string, limit = 40): SearchResult[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const scored: { r: SearchResult; s: number }[] = [];
  for (const r of index.entries) {
    const l = r.label.toLowerCase();
    const d = r.detail.toLowerCase();
    let s = -1;
    if (l === needle) s = 0;
    else if (l.startsWith(needle)) s = 1;
    else if (l.includes(needle)) s = 2;
    else if (d.includes(needle)) s = 3;
    if (s >= 0) scored.push({ r, s });
  }
  return scored.sort((a, b) => a.s - b.s || a.r.label.length - b.r.label.length)
    .slice(0, limit).map((x) => x.r);
}
