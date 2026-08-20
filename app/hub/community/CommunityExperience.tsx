"use client";

/**
 * CommunityExperience — the NEW primary `/hub/community` screen.
 *
 * Architecturally separate from `CommunityUniverse.tsx` (the prior
 * tabs/cards/lists stack, now LEGACY/AUDIT only, reachable via
 * `?view=audit`). This file is the EXPERIENCE LAYER: it takes the SAME
 * real data `page.tsx` already computes (families, subvalues, group
 * registry, people, relations, network counts) and renders it as one
 * hero + one large Value Map + one live-network strip + a contextual
 * detail drawer — never a re-derivation of any fact.
 *
 * No data rewrite: every number here traces to the same real sources
 * `CommunityUniverse.tsx` reads (`valueUniverse328.ts`,
 * `valueUniverseClassification.ts`, `groupRegistry.ts`,
 * `sourceValueModel.ts`). REAL/DEMO is explicit and defaults to REAL
 * ONLY — DEMO is opt-in, never blended in silently.
 */
import { useMemo, useState } from "react";
import type { RawFamily } from "@/app/lib/philos/community/valueUniverse328";
import type { GroupRegistryEntry } from "@/app/lib/philos/community/groupRegistry";
import type { SourceValueRelation } from "@/app/lib/philos/community/sourceValueModel";
import type { PersonRow } from "./CommunityUniverse";
import type { UniverseSubvalueView } from "./ValueUniverseView";
import { PROMOTION_STATUS_COLOR, SCOPE_COLOR } from "./colors";

export interface FamilyGroupLink {
  group_id: string;
  group_name: string;
  status: "REAL" | "DEMO";
  central_value: string;
  member_count: number;
  verified_effects: number;
}

export interface NetworkStats {
  realGroups: number;
  demoGroups: number;
  people: number;
  needs: number;
  resources: number;
  activeActions: number;
  verifiedEffects: number;
}

export default function CommunityExperience({
  families, subvalues, familyGroups, sourceValueRelations, people, groupRegistry, network, viewerLinked,
}: {
  families: RawFamily[];
  subvalues: UniverseSubvalueView[];
  familyGroups: Record<string, FamilyGroupLink[]>;
  sourceValueRelations: SourceValueRelation[];
  people: PersonRow[];
  groupRegistry: GroupRegistryEntry[];
  network: NetworkStats;
  viewerLinked: boolean;
}) {
  const [includeDemo, setIncludeDemo] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [localNav, setLocalNav] = useState<"OVERVIEW" | "VALUES" | "GROUPS" | "NETWORK" | "QUALITY">("OVERVIEW");

  const subvaluesByFamily = useMemo(() => {
    const map = new Map<string, UniverseSubvalueView[]>();
    for (const sv of subvalues) {
      if (!sv.family_id) continue;
      const arr = map.get(sv.family_id) ?? [];
      arr.push(sv);
      map.set(sv.family_id, arr);
    }
    return map;
  }, [subvalues]);

  const visibleFamilies = useMemo(() => {
    if (!search.trim()) return families;
    const q = search.trim();
    return families.filter((f) => {
      if (f.name_he.includes(q) || f.content_he.includes(q)) return true;
      return (subvaluesByFamily.get(f.id) ?? []).some((sv) => sv.name_he.includes(q));
    });
  }, [families, search, subvaluesByFamily]);

  const selectedFamily = selectedFamilyId ? families.find((f) => f.id === selectedFamilyId) : undefined;
  const selectedSubvalues = selectedFamilyId ? (subvaluesByFamily.get(selectedFamilyId) ?? []) : [];
  const selectedGroups = selectedFamilyId
    ? (familyGroups[selectedFamilyId] ?? []).filter((g) => includeDemo || g.status === "REAL")
    : [];

  const shownNetwork = includeDemo
    ? { ...network, groups: network.realGroups + network.demoGroups }
    : { ...network, groups: network.realGroups };

  return (
    <div dir="rtl" style={S.wrap}>
      {/* LOCAL NAV — exactly 5 */}
      <nav style={S.localNav}>
        {(["OVERVIEW", "VALUES", "GROUPS", "NETWORK", "QUALITY"] as const).map((n) => (
          <button key={n} onClick={() => setLocalNav(n)} style={{ ...S.navBtn, ...(localNav === n ? S.navBtnActive : {}) }}>{n}</button>
        ))}
        <a href="?view=audit" style={S.auditLink}>DETAILS / AUDIT →</a>
      </nav>

      {/* HERO */}
      <div style={S.hero}>
        <div style={S.heroTitle}>PHILOS COMMUNITY</div>
        <div style={S.heroSub}>VALUE UNIVERSE — {families.length} families · {families.length + subvalues.length} values</div>
        <div style={S.searchRow}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש ערך…"
            style={S.searchInput}
          />
          <div style={S.realDemoToggle}>
            <button onClick={() => setIncludeDemo(false)} style={{ ...S.toggleBtn, ...(!includeDemo ? S.toggleBtnActive : {}) }}>REAL</button>
            <button onClick={() => setIncludeDemo(true)} style={{ ...S.toggleBtn, ...(includeDemo ? S.toggleBtnActiveDemo : {}) }}>INCLUDE DEMO</button>
          </div>
        </div>
      </div>

      {/* VALUE MAP — the majority of the first viewport */}
      <div style={S.mapWrap}>
        {visibleFamilies.map((f) => {
          const svs = subvaluesByFamily.get(f.id) ?? [];
          const groups = (familyGroups[f.id] ?? []).filter((g) => includeDemo || g.status === "REAL");
          const hasReal = groups.some((g) => g.status === "REAL") || (familyGroups[f.id] ?? []).some((g) => g.status === "REAL");
          const size = Math.max(84, Math.min(150, 84 + svs.length * 2));
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFamilyId(f.id)}
              title={`${svs.length} subvalues · ${groups.length} real/DEMO group(s)`}
              style={{
                ...S.node,
                width: size, height: size,
                borderColor: hasReal ? "#34d399" : "rgba(90,120,180,0.35)",
                background: hasReal ? "rgba(52,211,153,0.08)" : "rgba(90,120,180,0.05)",
              }}
            >
              <span style={S.nodeLabel}>{f.name_he}</span>
              <span style={S.nodeMeta}>{svs.length} · {groups.length}</span>
            </button>
          );
        })}
      </div>

      {/* LIVE NETWORK STRIP */}
      <div style={S.networkStrip}>
        <NetStat label={includeDemo ? "קבוצות (REAL+DEMO)" : "קבוצות אמיתיות"} value={shownNetwork.groups} />
        <NetStat label="אנשים" value={network.people} />
        <NetStat label="צרכים (Need)" value={network.needs} />
        <NetStat label="משאבים (Offer)" value={network.resources} />
        <NetStat label="Actions פעילים" value={network.activeActions} />
        <NetStat label="Effects מאומתים" value={network.verifiedEffects} color="#34d399" />
      </div>

      {localNav === "GROUPS" ? (
        <GroupsPanel groupRegistry={groupRegistry} includeDemo={includeDemo} />
      ) : localNav === "NETWORK" ? (
        <NetworkPanel people={people} viewerLinked={viewerLinked} />
      ) : localNav === "QUALITY" ? (
        <QualityPanel />
      ) : null}

      {/* DETAIL DRAWER */}
      {selectedFamily ? (
        <>
          <div style={S.scrim} onClick={() => setSelectedFamilyId(null)} />
          <div style={S.drawer}>
            <button onClick={() => setSelectedFamilyId(null)} style={S.drawerClose}>✕ סגור</button>
            <div style={S.drawerTitle}>{selectedFamily.name_he}</div>
            <div style={S.drawerDef}>{selectedFamily.content_he}</div>

            <DrawerSection title={`SUBVALUES (${selectedSubvalues.length})`}>
              {selectedSubvalues.length === 0 ? <Empty>0</Empty> : (
                <div style={S.chipRow}>
                  {selectedSubvalues.slice(0, 24).map((sv) => (
                    <span key={sv.subvalue_id} style={{ ...S.chip, borderColor: `${PROMOTION_STATUS_COLOR[sv.status]}66`, color: PROMOTION_STATUS_COLOR[sv.status] }}>
                      {sv.name_he}
                    </span>
                  ))}
                  {selectedSubvalues.length > 24 ? <span style={S.chipMore}>+{selectedSubvalues.length - 24}</span> : null}
                </div>
              )}
            </DrawerSection>

            <DrawerSection title="SCOPE">
              {(() => {
                const scoped = selectedSubvalues.filter((sv) => sv.scope);
                if (scoped.length === 0) return <Empty>0 תת-ערכים רצים בזמן אמת במשפחה זו — אין scope אמיתי להראות.</Empty>;
                return (
                  <div style={S.chipRow}>
                    {scoped.map((sv) => (
                      <span key={sv.subvalue_id} style={{ ...S.chip, borderColor: `${SCOPE_COLOR[sv.scope!]}66`, color: SCOPE_COLOR[sv.scope!] }}>
                        {sv.name_he} · {sv.scope}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </DrawerSection>

            <DrawerSection title="RELATIONS — Tension / Opposition / Continuum / Social">
              {(() => {
                const names = new Set(selectedSubvalues.map((sv) => sv.name_he));
                const rels = sourceValueRelations.filter((r) => names.has(r.pole_a) || names.has(r.pole_b));
                if (rels.length === 0) return <Empty>0 — אין יחס מקור תואם למשפחה זו.</Empty>;
                return (
                  <div style={S.list}>
                    {rels.slice(0, 10).map((r) => (
                      <div key={r.relation_id} style={S.listRow}>
                        <span>{r.pole_a} ↔ {r.pole_b}</span>
                        <span style={S.listMeta}>{r.relation_type}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </DrawerSection>

            <DrawerSection title={`REAL GROUPS (${selectedGroups.length})`}>
              {selectedGroups.length === 0 ? (
                <Empty>0 קבוצות אמיתיות{includeDemo ? "/DEMO" : ""} סביב משפחה זו כרגע.</Empty>
              ) : (
                <div style={S.list}>
                  {selectedGroups.map((g) => (
                    <a key={g.group_id} href={`?view=audit&mode=groups&community=${encodeURIComponent(g.group_id)}`} style={{ ...S.listRow, textDecoration: "none" }}>
                      <span>{g.group_name} · {g.central_value}</span>
                      <span style={{ ...S.listMeta, color: g.status === "REAL" ? "#34d399" : "#fbbf24" }}>{g.status} · {g.member_count} חברים · {g.verified_effects} Effect מאומת</span>
                    </a>
                  ))}
                </div>
              )}
            </DrawerSection>

            <DrawerSection title="WHAT CAN I DO?">
              <div style={S.actionRow}>
                <a href="?view=audit&mode=needs" style={S.actionBtn}>ADVANCE — צור Need</a>
                <span style={S.actionDisabled} title="אין אות איום אמיתי ב-canon">DEFEND (לא זמין)</span>
                {selectedGroups.length > 0 ? (
                  <a href={`?view=audit&mode=groups&community=${encodeURIComponent(selectedGroups[0].group_id)}`} style={S.actionBtn}>מצא קבוצה →</a>
                ) : (
                  <a href="?view=audit&mode=groups" style={S.actionBtn}>הקם קבוצה (CANDIDATE) →</a>
                )}
              </div>
            </DrawerSection>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NetStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={S.netStat}>
      <div style={{ ...S.netStatValue, color: color ?? "#e6ebf5" }}>{value}</div>
      <div style={S.netStatLabel}>{label}</div>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.drawerSection}>
      <div style={S.drawerSectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function GroupsPanel({ groupRegistry, includeDemo }: { groupRegistry: GroupRegistryEntry[]; includeDemo: boolean }) {
  const shown = groupRegistry.filter((g) => includeDemo || g.status === "REAL");
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>GROUPS ({shown.length})</div>
      {shown.length === 0 ? <Empty>0</Empty> : (
        <div style={S.list}>
          {shown.map((g) => (
            <a key={g.group_id} href={`?view=audit&mode=groups&community=${encodeURIComponent(g.group_id)}`} style={{ ...S.listRow, textDecoration: "none" }}>
              <span>{g.name} · {g.central_value}</span>
              <span style={{ ...S.listMeta, color: g.status === "REAL" ? "#34d399" : "#fbbf24" }}>{g.status} · {g.member_count} חברים</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function NetworkPanel({ people, viewerLinked }: { people: PersonRow[]; viewerLinked: boolean }) {
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>NETWORK — {people.length} people</div>
      {!viewerLinked ? <div style={S.note}>אין גשר זהות מאומת עבורך — נראה רק סטטיסטיקה כללית.</div> : null}
      <a href="?view=audit&mode=relations" style={S.linkOut}>מפת יחסים מלאה · RELATION MAP →</a>
    </div>
  );
}

function QualityPanel() {
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>QUALITY GROUPS</div>
      <div style={S.note}>VALUE GROUP ≠ QUALITY GROUP. חברות ≠ איכות. פופולריות ≠ איכות. כסף ≠ איכות. אין Global Human Score.</div>
      <a href="?view=audit&mode=quality" style={S.linkOut}>מודל האיכות המלא →</a>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", color: "#e6ebf5", background: "#0b0f1a", minHeight: "100vh", paddingBottom: 40 },
  localNav: { display: "flex", alignItems: "center", gap: 6, padding: "12px 20px", borderBottom: "1px solid rgba(90,120,180,0.15)" },
  navBtn: { fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 12, border: "1px solid rgba(90,120,180,0.3)", background: "transparent", color: "#8fa3c9", cursor: "pointer" },
  navBtnActive: { color: "#0b0f1a", background: "#5b9cf6", borderColor: "#5b9cf6" },
  auditLink: { marginInlineStart: "auto", fontSize: 13, color: "#6c86b5", textDecoration: "none" },

  hero: { textAlign: "center", padding: "28px 20px 10px" },
  heroTitle: { fontSize: 26, fontWeight: 800, letterSpacing: 2, color: "#f2f6fc" },
  heroSub: { fontSize: 15, color: "#5b9cf6", marginTop: 6, fontWeight: 600 },
  searchRow: { display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" },
  searchInput: { fontSize: 15, padding: "9px 16px", borderRadius: 20, border: "1px solid rgba(90,120,180,0.3)", background: "rgba(18,24,38,0.6)", color: "#e6ebf5", width: 260, textAlign: "center" },
  realDemoToggle: { display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(90,120,180,0.3)" },
  toggleBtn: { fontSize: 13, fontWeight: 700, padding: "8px 14px", border: "none", background: "transparent", color: "#8fa3c9", cursor: "pointer" },
  toggleBtnActive: { background: "#34d399", color: "#0b0f1a" },
  toggleBtnActiveDemo: { background: "#fbbf24", color: "#0b0f1a" },

  mapWrap: { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 14, padding: "24px 20px", maxWidth: 1100, margin: "0 auto" },
  node: { borderRadius: "50%", border: "2px solid", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 8, textAlign: "center" },
  nodeLabel: { fontSize: 13, fontWeight: 700, color: "#e6ebf5", lineHeight: 1.25 },
  nodeMeta: { fontSize: 12, color: "#8aa0c8", marginTop: 4 },

  networkStrip: { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", padding: "16px 20px", maxWidth: 900, margin: "0 auto" },
  netStat: { textAlign: "center", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 12, padding: "10px 16px", minWidth: 90 },
  netStatValue: { fontSize: 20, fontWeight: 800 },
  netStatLabel: { fontSize: 12, color: "#8fa3c9", marginTop: 3 },

  panel: { maxWidth: 700, margin: "16px auto", padding: "14px 18px", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 14 },
  panelTitle: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", marginBottom: 10 },
  linkOut: { display: "inline-block", marginTop: 8, fontSize: 13, color: "#5b9cf6", textDecoration: "none" },

  /* DELIBERATELY viewport-owned, and the only two left in the social family.
     A modal scrim and its drawer are not PRIMARY_STAGE content: their whole
     job is to cover the window and take focus until dismissed. Containing
     them inside a stage would make the scrim cover only part of the screen,
     which is worse than the bug the containment pass fixed. Converted
     nothing here, on purpose. */
  scrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 },
  drawer: { position: "fixed", top: 0, bottom: 0, insetInlineEnd: 0, width: "min(420px, 92vw)", background: "#0f1522", borderInlineStart: "1px solid rgba(90,120,180,0.25)", zIndex: 41, overflowY: "auto", padding: 20 },
  drawerClose: { fontSize: 13, color: "#8fa3c9", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 },
  drawerTitle: { fontSize: 18, fontWeight: 800, color: "#f2f6fc" },
  drawerDef: { fontSize: 13, color: "#9fb0d0", marginTop: 6, lineHeight: 1.6 },
  drawerSection: { marginTop: 18 },
  drawerSectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#6c86b5", marginBottom: 6 },

  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { fontSize: 13, padding: "4px 10px", borderRadius: 10, border: "1px solid" },
  chipMore: { fontSize: 13, padding: "4px 10px", color: "#6c86b5" },

  list: { display: "flex", flexDirection: "column", gap: 4 },
  listRow: { display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: 6, background: "rgba(90,120,180,0.06)", fontSize: 13, color: "#dbe6f6", flexWrap: "wrap" },
  listMeta: { fontSize: 12, color: "#8aa0c8" },

  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  actionBtn: { fontSize: 13, fontWeight: 600, color: "#0b0f1a", background: "#5b9cf6", padding: "8px 14px", borderRadius: 8, textDecoration: "none" },
  actionDisabled: { fontSize: 13, color: "#6c86b5", padding: "8px 14px", borderRadius: 8, border: "1px dashed rgba(90,120,180,0.3)" },

  note: { fontSize: 13, color: "#8fa3c9", lineHeight: 1.6 },
  empty: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic" },
};
