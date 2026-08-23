"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- react-globe.gl accessors are untyped */
/**
 * WORLD EXPLORER — the globe as a spatial index of PHILOS, not a decorative
 * Earth.
 *
 * WHAT IS REAL HERE, AND WHAT IS EMPTY. The 177 country polygons and 8
 * continents are Natural Earth reference cartography — public-domain
 * geography that asserts nothing about PHILOS. Everything PHILOS knows about
 * where it exists in that world is three free-text strings and zero
 * coordinates. So the map is honest in a specific way: the world is fully
 * drawn, and PHILOS's presence in it is one country and a lane of unlocated
 * groups. No dot is placed anywhere, because no dot was recorded anywhere.
 *
 * CHANNEL SEPARATION (visualGrammar.ts): geography owns the base fill and
 * nothing else. Continent identity is a stable muted family; a country with
 * PHILOS presence is distinguished by STROKE WEIGHT and a marker, never by
 * repainting it into some other hue — repainting would make "has groups" and
 * "is in Africa" compete for one cue.
 *
 * SEMANTIC ZOOM. Country labels are not painted across the globe at world
 * altitude. Below a threshold, the countries in view get names; the selected
 * one always does. Everything remains discoverable by search, by the
 * accessible hierarchy, and by keyboard — discoverable is the requirement,
 * simultaneously printed is not.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import { STATE, INTERACTION } from "@/app/lib/philos/shell/visualGrammar";
import { CONTINENT_FILL, CONTINENT_STROKE, GEOJSON_PUBLIC_PATH } from "@/app/lib/philos/geo/continentPalette";
import { search, type SearchIndex, type SearchResult } from "@/app/lib/philos/geo/worldSearch";
import {
  deriveLabelAnchor, selectLabels, tierForAltitude, type LabelAnchor,
} from "@/app/lib/philos/geo/cartographicLabelAnchor";
import type { GlobalStats, ContinentStats, CountryStats } from "@/app/lib/philos/geo/worldStatistics";
import type { GeographicPrecision } from "@/app/lib/philos/geo/geographicReference";

export interface ExplorerGroup {
  group_id: string;
  name: string;
  provenance: "REAL" | "DEMO";
  mine: boolean;
  members: number;
  precision: GeographicPrecision;
  raw_label: string | null;
  country_code?: string;
  country_name?: string;
  continent?: string;
  resolver?: string;
  confidence?: string;
  because: string;
}

export interface WorldExplorerProps {
  global: GlobalStats;
  byContinent: ContinentStats[];
  byCountry: CountryStats[];
  groups: ExplorerGroup[];
  searchIndex: SearchIndex;
  resolver: { resolver: string; reference: string; known_places: number; countries: readonly string[]; produces_coordinates: boolean };
  initialGroup: string | null;
  /** ISO-3 of the country the SELECTED entity's geography resolved to. The
   *  globe opens focused on it. It is an AREA, never a point: the resolution
   *  is administrative and no coordinate was ever recorded, so nothing is
   *  drawn as a marker. `null` = the entity is UNLOCATED, or none selected. */
  initialCountry?: string | null;
  /** Viewer has no recorded relations — a note, not a reason to hide the map. */
  emptyNodeNote?: boolean;
}

const PRECISION_LABEL: Record<GeographicPrecision, string> = {
  COUNTRY: "מדינה", REGION: "אזור", CITY: "עיר", EXACT: "קואורדינטה", UNLOCATED: "ללא גאוגרפיה",
};
/** Precision is its own channel — a glyph, not a hue, so it never competes
 *  with provenance or with continent identity. */
const PRECISION_GLYPH: Record<GeographicPrecision, string> = {
  COUNTRY: "▢", REGION: "▨", CITY: "◉", EXACT: "✚", UNLOCATED: "○",
};

function Stat({ label, value, of, tone }: { label: string; value: number | string; of?: number; tone?: "on" | "off" }) {
  const zero = value === 0 || value === "0";
  return (
    <div style={{ display: "flex", gap: SPACE.sm, alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ fontSize: FS.meta, color: COLOR.textDim, flex: 1, minWidth: 96 }}>{label}</span>
      <span style={{ fontSize: FS.base, fontVariantNumeric: "tabular-nums",
        color: tone === "on" ? "#7fe0ab" : zero ? COLOR.textFaint : COLOR.text }}>
        {value}{of !== undefined ? <span style={{ color: COLOR.textFaint }}> / {of}</span> : null}
      </span>
    </div>
  );
}

export default function WorldExplorer(props: WorldExplorerProps) {
  const [Globe, setGlobe] = useState<any>(null);
  const globeRef = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  /* SIZE comes from the real container, measured synchronously before paint.
     A `ResizeObserver` alone was not enough: its first callback is delivered
     at the end of a frame, so the globe mounted at whatever default was in
     state and stayed there until a frame ran. `0` as that default produced a
     blank canvas; a hardcoded 900 produced a canvas that ignored its
     container. Neither is a size — so there is no steady-state default here at
     all. `useLayoutEffect` reads `clientWidth` directly, and the observer only
     handles LATER changes. */
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [polygons, setPolygons] = useState<any[]>([]);
  const [altitude, setAltitude] = useState(2.5);
  const [country, setCountry] = useState<string | null>(props.initialCountry ?? null);
  const [continent, setContinent] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(props.initialGroup);
  const [q, setQ] = useState("");
  /* CONDITIONAL RENDER, not <details>. A closed <details> on this page still
     laid its children out — `open` read false while their measured height was
     186–343px, so "collapsed" content was contributing to the first view. With
     state, closed means NOT RENDERED, which is what the density target asks
     for and what the DOM then actually shows. */
  const [showPrecision, setShowPrecision] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [provFilter, setProvFilter] = useState<Set<string>>(new Set());
  const [precFilter, setPrecFilter] = useState<Set<string>>(new Set());

  useEffect(() => { let ok = true; import("react-globe.gl").then((m) => { if (ok) setGlobe(() => m.default); }); return () => { ok = false; }; }, []);
  useEffect(() => {
    let ok = true;
    fetch(GEOJSON_PUBLIC_PATH).then((r) => r.json()).then((fc) => { if (ok) setPolygons(fc.features ?? []); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  const measure = useCallback((el: HTMLDivElement) => {
    const w = el.clientWidth;
    if (w > 0) setSize({ w, h: Math.max(420, el.clientHeight || Math.round(w * 0.62)) });
  }, []);
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return;
    measure(el);
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el); return () => ro.disconnect();
  }, [measure]);

  const results = useMemo(() => search(props.searchIndex, q), [q, props.searchIndex]);

  /* CARTOGRAPHIC ANCHORS, derived once from each country's own boundary. */
  const anchored = useMemo(() => polygons.map((f: any) => ({
    feature: f,
    properties: f.properties as Record<string, unknown>,
    anchor: deriveLabelAnchor(f) as LabelAnchor | null,
    code: String(f.properties?.ADM0_A3 ?? ""),
    name: String(f.properties?.NAME ?? ""),
  })), [polygons]);

  const countriesWithPresence = useMemo(
    () => new Set(props.byCountry.filter((c) => c.groups > 0).map((c) => c.code)),
    [props.byCountry]);

  const labelMode = tierForAltitude(altitude);

  const labels = useMemo(() => selectLabels(anchored, {
    altitude, selectedCode: country, codeOf: (f) => f.code, nameOf: (f) => f.name,
  }).map((f) => ({ lat: f.anchor!.lat, lng: f.anchor!.lng, text: f.name, code: f.code })),
  [anchored, altitude, country]);

  const onZoom = useCallback((pov: { altitude?: number }) => {
    const a = pov?.altitude ?? 2.5;
    setAltitude((prev) => {
      const tier = (x: number) => (x > 1.9 ? 0 : x > 1.1 ? 1 : x > 0.6 ? 2 : 3);
      return tier(prev) === tier(a) ? prev : a;
    });
  }, []);

  const polygonLabel = useCallback((d: any) => {
    const pr = d.properties ?? {};
    const code = String(pr.ADM0_A3 ?? "");
    const st = props.byCountry.find((c) => c.code === code);
    return `<div style="font:500 13px system-ui;color:#f2f6fc">${pr.NAME ?? ""}</div>`
      + `<div style="font:12px system-ui;color:#9fb0d0">${pr.CONTINENT ?? ""}</div>`
      + `<div style="font:12px system-ui;color:${st && st.groups > 0 ? "#7fe0ab" : "#6c86b5"}">`
      + `${st ? st.groups : 0} קבוצות · ${st ? st.members : 0} חברים</div>`;
  }, [props.byCountry]);

  /* Geometry-derived focus. Never LABEL_X/LABEL_Y — they do not exist. */
  const focusCountry = useCallback((code: string, feature?: any) => {
    setCountry(code);
    const rec = anchored.find((a) => a.code === code);
    const anchor = rec?.anchor ?? (feature ? deriveLabelAnchor(feature) : null);
    if (anchor && globeRef.current) {
      globeRef.current.pointOfView({ lat: anchor.lat, lng: anchor.lng, altitude: 0.85 }, 900);
    }
  }, [anchored]);

  const onSelectResult = useCallback((r: SearchResult) => {
    setQ("");
    if (r.select.group_id) setGroup(r.select.group_id);
    if (r.select.continent) setContinent(r.select.continent);
    if (r.focus?.kind === "COUNTRY") focusCountry(r.focus.code);
    else if (r.select.country_code) setCountry(r.select.country_code);
  }, [focusCountry]);

  const visibleGroups = props.groups.filter((g) =>
    (provFilter.size === 0 || provFilter.has(g.provenance)) &&
    (precFilter.size === 0 || precFilter.has(g.precision)) &&
    (!country || g.country_code === country) &&
    (!continent || g.continent === continent));
  const unlocatedGroups = visibleGroups.filter((g) => g.precision === "UNLOCATED");
  const selected = props.groups.find((g) => g.group_id === group) ?? null;
  const countryStat = country ? props.byCountry.find((c) => c.code === country) ?? null : null;

  /* Below 900px the overlay would cover the globe, so it becomes a bottom
     card instead. Measured from the stage itself, not a media query, because
     the stage is what the panel sits on. */
  const narrow = size.w > 0 && size.w < 900;

  /* ONE context object. Name, one status line, at most four figures — each a
     single semantic unit rather than a label and a number as two marks. */
  const ctx = selected ? {
    title: selected.name,
    tone: selected.provenance === "REAL" ? STATE.REAL.hue : STATE.DEMO.hue,
    status: `${selected.provenance}${selected.mine ? " · אתה כאן" : ""} · ${PRECISION_GLYPH[selected.precision]} ${PRECISION_LABEL[selected.precision]}`,
    metrics: [
      `${selected.members} חברים`,
      `${selected.country_name ?? "—"}`,
      `${selected.raw_label ?? "—"}`,
    ],
  } : countryStat ? {
    title: countryStat.name,
    tone: countryStat.groups ? "#7fe0ab" : COLOR.textFaint,
    status: `${countryStat.continent} · ${countryStat.real} REAL / ${countryStat.demo} DEMO`,
    metrics: [
      `${countryStat.groups} קבוצות`,
      `${countryStat.members} חברים`,
      `${countryStat.budget_available.toLocaleString()} תקציב`,
      `${countryStat.relations} קשרים`,
    ],
  } : null;

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n);
  };

  /* ── COMPOSITION ────────────────────────────────────────────────────────
     One surface, not a stack. The globe is the page; the header, the
     contextual panel, the KPI rail and the audit drawer are chrome around it.
     Everything that was a stacked section before — four statistics cards, the
     unlocated lane, the continent list, the accessible hierarchy, the resolver
     note — now lives either in the side panel or behind the drawer. Nothing is
     hidden with CSS: what is not composed here is not rendered. */
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px 16px", minHeight: "calc(100vh - 64px)" }}>

      {/* ── HEADER · search + filters + the single headline figure ───────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 340px", minWidth: 240 }}>
          <input id="world-search" value={q} onChange={(e) => setQ(e.target.value)}
            aria-label={`חיפוש ${props.searchIndex.entries.length} אובייקטים — יבשת, מדינה, קבוצה, משפחת ערך, תת-ערך, צורך, משאב, פעולה, אפקט, ראיה`}
            placeholder={`חיפוש ${props.searchIndex.entries.length} אובייקטים — מדינה · קבוצה · ערך · צורך · פעולה`}
            style={{ width: "100%", minBlockSize: 36, padding: `6px ${SPACE.md}px`, fontSize: FS.base,
              background: COLOR.bgCard, border: `1px solid ${COLOR.borderStrong}`, borderRadius: RADIUS.md, color: COLOR.text }} />
          {results.length > 0 ? (
            <ul role="listbox" aria-label="תוצאות חיפוש" style={{ listStyle: "none", margin: "4px 0 0", padding: 0,
              position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 20,
              maxHeight: 300, overflowY: "auto", background: COLOR.bgRaised,
              border: `1px solid ${COLOR.borderStrong}`, borderRadius: RADIUS.md }}>
              {results.map((r) => (
                <li key={r.id}>
                  <button onClick={() => onSelectResult(r)}
                    style={{ display: "flex", width: "100%", gap: SPACE.md, alignItems: "baseline", minBlockSize: 34,
                      padding: `5px ${SPACE.md}px`, background: "transparent", border: "none",
                      borderBottom: `1px solid ${COLOR.border}`, cursor: "pointer", textAlign: "start", color: COLOR.text }}>
                    <span style={{ fontSize: FS.tag, color: COLOR.textFaint, minWidth: 78 }}>{r.kind}</span>
                    <span style={{ fontSize: FS.base, flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: FS.meta, color: COLOR.textDim }}>{r.detail}</span>
                    {r.focus === null ? <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>ללא מיקום</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Filters, inline. Provenance is two chips; precision folds into a
            popover so five glyph buttons stop competing with the search. */}
        {(["REAL", "DEMO"] as const).map((p) => (
          <button key={p} onClick={() => toggle(provFilter, p, setProvFilter)} aria-pressed={provFilter.has(p)}
            style={{ minBlockSize: 32, padding: `3px ${SPACE.md}px`, borderRadius: RADIUS.pill, cursor: "pointer",
              background: provFilter.has(p) ? "rgba(91,156,246,0.18)" : "transparent",
              border: `1.5px ${p === "DEMO" ? "dotted" : "solid"} ${STATE[p].hue}`, color: COLOR.text, fontSize: FS.meta }}>{p}</button>
        ))}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowPrecision((v) => !v)} aria-expanded={showPrecision}
            style={{ minBlockSize: 32, padding: `3px ${SPACE.md}px`, borderRadius: RADIUS.pill, cursor: "pointer",
              background: "transparent", border: `1px solid ${COLOR.border}`, color: COLOR.textDim, fontSize: FS.meta }}>דיוק ▾</button>
          {showPrecision ? (
          <div style={{ position: "absolute", insetInlineEnd: 0, marginTop: 4, zIndex: 20, display: "flex", flexDirection: "column", gap: 2,
            padding: SPACE.sm, background: COLOR.bgRaised, border: `1px solid ${COLOR.borderStrong}`, borderRadius: RADIUS.md }}>
            {(Object.keys(PRECISION_LABEL) as GeographicPrecision[]).map((p) => (
              <button key={p} onClick={() => toggle(precFilter, p, setPrecFilter)} aria-pressed={precFilter.has(p)}
                style={{ minBlockSize: 32, padding: `3px ${SPACE.md}px`, borderRadius: RADIUS.sm, cursor: "pointer",
                  whiteSpace: "nowrap", textAlign: "start",
                  background: precFilter.has(p) ? "rgba(91,156,246,0.18)" : "transparent",
                  border: "none", color: COLOR.textDim, fontSize: FS.meta }}>
                {PRECISION_GLYPH[p]} {PRECISION_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}
        </div>
        {(country || continent || group || provFilter.size || precFilter.size) ? (
          <button onClick={() => { setCountry(null); setContinent(null); setGroup(null); setProvFilter(new Set()); setPrecFilter(new Set()); }}
            style={{ minBlockSize: 32, padding: `3px ${SPACE.md}px`, borderRadius: RADIUS.pill, cursor: "pointer",
              background: "transparent", border: `1px solid ${COLOR.borderStrong}`, color: COLOR.text, fontSize: FS.meta }}>איפוס</button>
        ) : null}
      </div>

      {/* ── STAGE · the globe is the page ────────────────────────────────── */}
      {/* The globe IS the stage. The contextual panel floats over it rather
          than taking a column beside it — a map that shares half its width
          with a sidebar is a sidebar with a map next to it. Below 900px the
          panel returns to normal flow, where an overlay would cover the
          subject instead of annotating it. */}
      <div ref={boxRef} style={{ position: "relative", flex: 1, minHeight: 520,
        background: COLOR.bg, border: `0.5px solid ${COLOR.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          {Globe && size.w > 0 ? (
            <Globe ref={globeRef} width={size.w} height={size.h}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="/globe/earth-dark.jpg"
              atmosphereColor="#5aa6ff" atmosphereAltitude={0.22}
              polygonsData={polygons}
              polygonAltitude={(d: any) => (String(d.properties?.ADM0_A3) === country ? 0.03 : 0.008)}
              polygonCapColor={(d: any) => CONTINENT_FILL[String(d.properties?.CONTINENT)] ?? "#1a2233"}
              polygonSideColor={() => "rgba(10,14,23,0.6)"}
              polygonStrokeColor={(d: any) => {
                const code = String(d.properties?.ADM0_A3);
                if (code === country) return INTERACTION.selected.ringColor;
                if (countriesWithPresence.has(code)) return "#7fe0ab";
                return CONTINENT_STROKE[String(d.properties?.CONTINENT)] ?? "#2c3550";
              }}
              polygonLabel={polygonLabel}
              onPolygonClick={(d: any) => focusCountry(String(d.properties?.ADM0_A3), d)}
              onZoom={onZoom}
              labelsData={labels}
              labelLat={(d: any) => d.lat} labelLng={(d: any) => d.lng} labelText={(d: any) => d.text}
              labelAltitude={0.045}
              labelSize={0.9} labelDotRadius={0.22} labelResolution={3}
              labelColor={(d: any) => (countriesWithPresence.has(d.code) ? "#eaf3ff" : "rgba(200,214,236,0.9)")}
            />
          ) : null}
        </div>
          {/* Legend, collapsed to a single affordance so it stops being a
              four-line block sitting on the map. */}
          <div style={{ position: "absolute", insetInlineStart: SPACE.sm, bottom: SPACE.sm, maxWidth: 300 }}>
            <button onClick={() => setShowLegend((v) => !v)} aria-expanded={showLegend}
              style={{ minBlockSize: 32, padding: `2px ${SPACE.md}px`, background: "rgba(10,14,23,0.85)",
                border: `0.5px solid ${COLOR.border}`, borderRadius: RADIUS.pill, cursor: "pointer",
                fontSize: FS.meta, color: COLOR.textDim }}>{`מקרא · ${labelMode}`}</button>
            {showLegend ? (
            <div style={{ marginTop: 4, padding: `${SPACE.sm}px ${SPACE.md}px`, background: "rgba(10,14,23,0.92)",
              border: `0.5px solid ${COLOR.border}`, borderRadius: RADIUS.md, fontSize: FS.meta, color: COLOR.textDim }}>
              <div style={{ color: COLOR.textFaint }}>מילוי = יבשת · מתאר ירוק = נוכחות PHILOS · לבן = נבחרה</div>
              <div style={{ color: COLOR.textFaint }}>תוויות לפי גובה מבט</div>
              <div style={{ color: "#f0b45c" }}>0 נקודות — אין קואורדינטה מתועדת באף ישות</div>
            </div>
          ) : null}
          </div>

        {/* ── CONTEXT OVERLAY ────────────────────────────────────────────
            Name, one provenance line, four figures, one expand control. It was
            a miniature dashboard floating on the map — continents, unlocated
            groups and every operational count, all always-on. Depth is real
            and belongs one interaction away, not stacked over the subject.
            Below 900px it becomes a bottom card so it never covers the globe. */}
        <aside style={{
          position: "absolute", insetInlineStart: 8,
          ...(narrow ? { bottom: 8, insetInlineEnd: 8, width: "auto" } : { top: 8, width: 264 }),
          background: "rgba(10,14,23,0.9)", border: `0.5px solid ${COLOR.border}`,
          borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, maxHeight: "46%", overflowY: "auto" }}>
          {ctx ? (<>
            <div style={{ fontSize: FS.read, color: COLOR.text }}>{ctx.title}</div>
            <div style={{ fontSize: FS.meta, color: ctx.tone, marginBottom: 4 }}>{ctx.status}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: `0 ${SPACE.md}px`,
              fontSize: FS.meta, color: COLOR.textDim, fontVariantNumeric: "tabular-nums" }}>
              {ctx.metrics.map((m) => <span key={m}>{m}</span>)}
            </div>
          </>) : (
            <div style={{ fontSize: FS.meta, color: COLOR.textDim }}>
              בחר מדינה על הגלובוס · {props.global.countries_with_presence}/{props.global.countries_in_reference} עם נוכחות
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}
              style={{ minBlockSize: 32, background: "transparent", border: "none", cursor: "pointer",
                fontSize: FS.meta, color: COLOR.accent, padding: 0 }}>עוד ▾</button>
            {showMore ? (
            <div style={{ marginTop: 4, borderTop: `1px solid ${COLOR.border}`, paddingTop: 4 }}>
              {selected ? (
                <div style={{ fontSize: FS.meta, color: COLOR.textDim }}>
                  תווית מקורית <code style={{ color: COLOR.text }}>{selected.raw_label ?? "—"}</code>
                  {selected.resolver ? ` · DERIVED · ${selected.confidence}` : ""}
                </div>
              ) : null}
              {props.byContinent.map((c) => (
                <button key={c.continent} onClick={() => setContinent(c.continent)}
                  style={{ display: "flex", gap: SPACE.sm, alignItems: "center", minBlockSize: 32, width: "100%",
                    padding: "1px 0", background: "transparent", border: "none", cursor: "pointer", textAlign: "start" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                    background: CONTINENT_FILL[c.continent], border: `1px solid ${CONTINENT_STROKE[c.continent]}` }} />
                  <span style={{ fontSize: FS.meta, color: COLOR.text, flex: 1 }}>{`${c.continent} · ${c.countries_in_reference} · ${c.groups}`}</span>
                </button>
              ))}
              <div style={{ fontSize: FS.meta, color: COLOR.textFaint, marginTop: 4 }}>
                {`ללא גאוגרפיה מתועדת · ${unlocatedGroups.length}`}
              </div>
              {unlocatedGroups.map((g) => (
                <button key={g.group_id} onClick={() => setGroup(g.group_id)}
                  style={{ minBlockSize: 32, padding: `2px ${SPACE.sm}px`, marginTop: 2, borderRadius: RADIUS.pill,
                    cursor: "pointer", background: "transparent", color: COLOR.text, fontSize: FS.meta,
                    border: `1.5px ${g.provenance === "DEMO" ? "dotted" : "solid"} ${STATE[g.provenance].hue}` }}>{`○ ${g.name}`}</button>
              ))}
              {props.emptyNodeNote ? (
                <div style={{ fontSize: FS.meta, color: "#f0b45c", marginTop: 4 }}>אין לך קשרים מתועדים — המפה גלובלית בכל מקרה.</div>
              ) : null}
            </div>
          ) : null}
          </div>
        </aside>
      </div>

      {/* ── FOOTER RAIL · four figures and the drawer, one row ──────────
          Each KPI is ONE semantic unit — "3 קבוצות", not a number and a label
          as two competing marks. The other ten figures live in the drawer. */}
      <div style={{ background: COLOR.bgCard, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md }}>
          <button onClick={() => setShowDrawer((v) => !v)} aria-expanded={showDrawer}
            style={{ minBlockSize: 34, width: "100%", padding: `4px ${SPACE.md}px`, cursor: "pointer",
              background: "transparent", border: "none", textAlign: "start",
              fontSize: FS.meta, color: COLOR.textDim, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: `0 ${SPACE.lg}px` }}>
          {/* REACH IS STATED ONCE, BY `NetworkPositionMap`. Countries with
              presence, groups, members and plottable all render there as the
              REACH row of the same primary workspace — restating them on this
              button meant the reader met `1/177 · 3 · 23` twice on one page
              with nothing to say which was authoritative. The figures are not
              removed from the product: they are the same `props.global` the
              REACH row reads, and every one of them is still in the drawer
              below. Only the second PRESENTATION is gone. What stays here is
              the one figure REACH does not carry. */}
          <span style={{ color: props.global.populated_sub_values ? COLOR.text : COLOR.textFaint }}>{`${props.global.populated_sub_values}/${props.global.sub_values} ערכים מאוכלסים`}</span>
          <span style={{ marginInlineStart: "auto", color: COLOR.accent }}>דאטה · ביקורת ▾</span>
          </span>
          </button>
          {showDrawer ? (
        <div style={{ padding: `0 ${SPACE.md}px ${SPACE.md}px` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: `2px ${SPACE.lg}px`, margin: `${SPACE.sm}px 0`,
            fontSize: FS.meta, color: COLOR.textDim, fontVariantNumeric: "tabular-nums" }}>
            {[
              `${props.global.continents_in_reference} יבשות`,
              `${props.global.budget_available.toLocaleString()} תקציב`,
              `${props.global.needs} צרכים`, `${props.global.resources} משאבים`,
              `${props.global.actions} פעולות`, `${props.global.effects} אפקטים`,
              `${props.global.evidence} ראיות`, `${props.global.tensions} מתחים`,
              `${props.global.relations} קשרים`,
              `${props.global.unresolved_mappings}/${props.global.groups} מיפויים פתוחים`,
              `${props.global.groups_unlocated} ללא גאוגרפיה`,
            ].map((k) => <span key={k}>{k}</span>)}
          </div>
          <p style={{ fontSize: FS.meta, color: COLOR.textFaint, maxWidth: "80ch" }}>
            {`${props.resolver.resolver} · ${props.resolver.reference} · מכיר ${props.resolver.known_places} מקומות ב-${props.resolver.countries.join(", ")} · אינו מייצר קואורדינטות. כל פתרון מדינה מסומן DERIVED ושומר את המחרוזת המקורית לצידו.`}
          </p>
          {props.byContinent.map((c) => (
            <details key={c.continent} style={{ borderTop: `1px solid ${COLOR.border}` }}>
              <summary style={{ minBlockSize: 32, gap: SPACE.sm,
                padding: "3px 0", cursor: "pointer", fontSize: FS.meta, color: COLOR.text }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                  background: CONTINENT_FILL[c.continent], border: `1px solid ${CONTINENT_STROKE[c.continent]}` }} />
                {`${c.continent} · ${c.countries_in_reference} מדינות · ${c.groups} קבוצות`}
              </summary>
              <div style={{ paddingInlineStart: SPACE.lg }}>
                {props.byCountry.filter((x) => x.continent === c.continent).map((x) => (
                  <button key={x.code} onClick={() => focusCountry(x.code)}
                    style={{ display: "block", minBlockSize: 32, padding: "1px 4px", background: "transparent",
                      border: "none", cursor: "pointer", fontSize: FS.meta, textAlign: "start",
                      color: x.groups > 0 ? COLOR.text : COLOR.textFaint }}>
                    {`${x.name} · ${x.groups}`}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null}
        </div>
    </div>
  );
}
