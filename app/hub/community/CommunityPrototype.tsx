"use client";

/**
 * CommunityPrototype — recovery board task R5.2: LIVE wiring pass.
 * Iteration 3: the map/layout (family positions, the 3 real relation
 * edges) is UNCHANGED from iteration 2 — that part was visually
 * accepted and this pass was scoped to leave it alone. What changed is
 * the detail panel and network strip, which now read real, server-
 * computed data (`live: PrototypeLiveData`, built in `page.tsx` from
 * the SAME real stores every other surface reads — `groupRegistry.ts`,
 * `valueRegistry.ts`, canon `needStoreAccessor`/`offerStoreAccessor`/
 * `actionStoreAccessor`/`effectStoreAccessor`) instead of hardcoded
 * numbers. No join is fabricated: where canon has no real group-scoped
 * link (Need/Offer/Action/Effect carry no group_id — the same gap
 * documented across every other surface this session), the panel states
 * that precisely rather than implying a false per-group count.
 *
 * The family layout itself still uses two static, already-verified
 * constant sources (`RAW_FAMILIES`, `SOURCE_VALUE_RELATIONS`) — real
 * data, not a live join, and out of this pass's scope per the user's
 * own instruction to preserve the accepted visual composition.
 *
 * Still a separate acceptance route (`?view=prototype`), not promoted
 * to production.
 */
import { useMemo, useState } from "react";
import { RAW_FAMILIES, SUBVALUES, type RawFamily } from "@/app/lib/philos/community/valueUniverse328";
import { SOURCE_VALUE_RELATIONS } from "@/app/lib/philos/community/sourceValueModel";
import { PhilosContainer, PhilosFlow, StatusTag, type PhilosFlowStep } from "@/app/lib/philos/visual/PhilosPrimitives";

export interface PrototypeLiveFamilyGroup {
  group_id: string;
  group_name: string;
  status: "REAL" | "DEMO";
  central_value: string;
  member_count: number;
  verified_effects: number;
  members: { person_id: string; display_name: string }[];
}

export interface PrototypeLiveData {
  /** family_id -> real/DEMO groups whose central_value matched one of
   *  this family's subvalues (the same join Brain L6/Marketplace/World
   *  already use). */
  familyGroups: Record<string, PrototypeLiveFamilyGroup[]>;
  /** Real canon `findNeedsForSubject` count for the one identity-linked
   *  subject — person-scoped, NOT group-scoped (Need carries no
   *  group_id in canon). */
  canonNeedsCount: number;
  canonOffersCount: number;
  /** Real canon actionStore/effectStore counts — system-wide, NOT
   *  group-scoped (canon Action/Effect carry no group_id either). */
  canonActionsCount: number;
  canonEffectsCount: number;
  canonVerifiedEffectsCount: number;
  identityLinked: boolean;
  /** Real network totals — same `groupRegistry`/`people` reduce every
   *  other surface's network strip already uses. `legacyVerifiedEffects`
   *  is the pre-canon `group.impact.verified` count (a DIFFERENT, older
   *  real signal from canon Effect — never merged, see `groupRegistry.ts`). */
  realGroupsCount: number;
  peopleCount: number;
  legacyVerifiedEffectsCount: number;
}

function wordsOf(s: string): string[] {
  return s.split(/[\s,./ ]+/).map((w) => w.replace(/^ו/, "")).filter(Boolean);
}

interface FamilyEdge {
  a: string;
  b: string;
  type: "TENSION" | "OPPOSITION" | "CONTINUUM" | "SOCIAL_RELATION";
}

function buildFamilyEdges(): FamilyEdge[] {
  const familyWords = new Map<string, Set<string>>();
  for (const f of RAW_FAMILIES) familyWords.set(f.id, new Set(wordsOf(f.name_he + " " + f.content_he)));
  const edges = new Map<string, FamilyEdge>();
  for (const r of SOURCE_VALUE_RELATIONS) {
    const famsA = RAW_FAMILIES.filter((f) => familyWords.get(f.id)!.has(r.pole_a));
    const famsB = RAW_FAMILIES.filter((f) => familyWords.get(f.id)!.has(r.pole_b));
    for (const fa of famsA) for (const fb of famsB) {
      if (fa.id === fb.id) continue;
      const key = [fa.id, fb.id].sort().join("-");
      if (!edges.has(key)) edges.set(key, { a: fa.id, b: fb.id, type: r.relation_type as FamilyEdge["type"] });
    }
  }
  return [...edges.values()];
}

const FAMILY_EDGES = buildFamilyEdges();
const CONNECTED_IDS = new Set(FAMILY_EDGES.flatMap((e) => [e.a, e.b]));

const SUBVALUE_COUNT: Record<string, number> = {};
for (const sv of SUBVALUES) {
  if (sv.family_id) SUBVALUE_COUNT[sv.family_id] = (SUBVALUE_COUNT[sv.family_id] ?? 0) + 1;
}

interface LaidOutFamily extends RawFamily {
  x: number;
  y: number;
  r: number;
  connected: boolean;
  edgeCount: number;
  hasRealGroup: boolean;
}

/**
 * Deterministic, non-physics layout: connected families pulled toward
 * the center (in their own small real clusters, positioned by hand from
 * the actual 3-edge graph above — not randomly, not force-simulated);
 * disconnected families placed on an outer ring via a golden-angle
 * spiral (even, non-overlapping, no meaning claimed by exact angle —
 * only the ring itself, "no verified relation," is meaningful).
 */
function layoutFamilies(familyGroups: Record<string, PrototypeLiveFamilyGroup[]>): LaidOutFamily[] {
  const CX = 500, CY = 300;
  const manualCore: Record<string, { x: number; y: number }> = {
    F01: { x: 460, y: 200 }, // חיים וכבוד האדם
    F02: { x: 540, y: 250 }, // חופש ואוטונומיה — bridges F01 and F25
    F25: { x: 470, y: 320 }, // כבוד והכרה הדדית
    F04: { x: 640, y: 420 }, // ביטחון ויציבות
    F12: { x: 720, y: 380 }, // התפתחות ושיפור
  };
  const periphery = RAW_FAMILIES.filter((f) => !CONNECTED_IDS.has(f.id));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: LaidOutFamily[] = [];
  RAW_FAMILIES.forEach((f) => {
    const svCount = SUBVALUE_COUNT[f.id] ?? 0;
    const edgeCount = FAMILY_EDGES.filter((e) => e.a === f.id || e.b === f.id).length;
    const connected = CONNECTED_IDS.has(f.id);
    let x: number, y: number;
    if (connected) {
      x = manualCore[f.id].x;
      y = manualCore[f.id].y;
    } else {
      const i = periphery.findIndex((p) => p.id === f.id);
      const angle = i * golden;
      const radius = 250 + (i % 3) * 30;
      x = CX + radius * Math.cos(angle);
      y = CY + radius * Math.sin(angle) * 0.82;
    }
    const r = Math.max(20, Math.min(38, 18 + svCount * 0.9));
    const hasRealGroup = (familyGroups[f.id] ?? []).some((g) => g.status === "REAL");
    out.push({ ...f, x, y, r, connected, edgeCount, hasRealGroup });
  });
  return out;
}

const EDGE_STYLE: Record<FamilyEdge["type"], { stroke: string; dash?: string }> = {
  TENSION: { stroke: "#f2635c" },
  OPPOSITION: { stroke: "#f2635c", dash: "2 4" },
  CONTINUUM: { stroke: "#5aa6ff", dash: "5 4" },
  SOCIAL_RELATION: { stroke: "#a78bfa" },
};

/**
 * R5.2, section 3 — the exact decision tree the user specified, applied
 * to a specific real group's own real signals. Real signals only:
 * `hasGroup` (real/DEMO group presence, per family), `needs`/`offers`
 * (real canon counts — see `PrototypeLiveData`'s own field docs for the
 * person-vs-group-scope caveat, surfaced in the panel, not hidden here),
 * `actions`/`effects`/`verifiedEffects` (real canon counts, system-wide).
 * Never invents a step the architecture doesn't support — EVALUATE
 * MATCH/COMMIT/RECORD EFFECT/VERIFY EVIDENCE all route to the SAME real
 * write forms (`EvaluateMatchForm`/`CreateActionForm`/`CreateEffectForm`)
 * Marketplace already renders; RECORD NEED/OFFER route to Community's
 * own real `mode=needs`/`mode=resources` forms.
 */
function computeNextAction(hasGroup: boolean, needs: number, offers: number, actions: number, effects: number, verifiedEffects: number): { label: string; href: string } {
  if (!hasGroup) return { label: "מצא / הקם קבוצה · FIND / FORM GROUP", href: "/hub/community?mode=groups" };
  if (needs === 0) return { label: "רשום Need · RECORD NEED", href: "/hub/community?mode=needs" };
  if (offers === 0) return { label: "רשום / מצא Resource · OFFER / FIND RESOURCE", href: "/hub/community?mode=resources" };
  if (actions === 0) return { label: "בדוק התאמה", href: "/marketplace" };
  if (effects === 0) return { label: "בצע / רשום Action · COMMIT / ACT", href: "/marketplace" };
  if (verifiedEffects === 0) return { label: "רשום Effect · RECORD EFFECT", href: "/marketplace" };
  if (verifiedEffects < effects) return { label: "אמת ראיה · ADD / VERIFY EVIDENCE", href: "/marketplace" };
  return { label: "סקור השפעה / למידה · REVIEW IMPACT / LEARNING", href: "/dynamics" };
}

export default function CommunityPrototype({ live }: { live: PrototypeLiveData }) {
  const [search, setSearch] = useState("");
  const [includeDemo, setIncludeDemo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [nav, setNav] = useState<"OVERVIEW" | "VALUES" | "GROUPS" | "NETWORK" | "QUALITY">("OVERVIEW");

  const laidOut = useMemo(() => layoutFamilies(live.familyGroups), [live.familyGroups]);

  const searchMatchIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim();
    return new Set(RAW_FAMILIES.filter((f) => f.name_he.includes(q) || f.content_he.includes(q)).map((f) => f.id));
  }, [search]);

  const selected = selectedId ? laidOut.find((f) => f.id === selectedId) : undefined;
  const relatedEdges = selected ? FAMILY_EDGES.filter((e) => e.a === selected.id || e.b === selected.id) : [];
  const relatedFamilyIds = new Set(relatedEdges.map((e) => (e.a === selectedId ? e.b : e.a)));
  const selectedSubvalues = selected ? SUBVALUES.filter((sv) => sv.family_id === selected.id) : [];
  const selectedGroups = selected ? (live.familyGroups[selected.id] ?? []).filter((g) => includeDemo || g.status === "REAL") : [];
  const selectedGroupDetail = selectedGroupId ? selectedGroups.find((g) => g.group_id === selectedGroupId) : undefined;

  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.protoBadge}>PROTOTYPE — R5.2 live selectors · map layout static (accepted), panel data real</div>

      <nav style={S.localNav}>
        {(["OVERVIEW", "VALUES", "GROUPS", "NETWORK", "QUALITY"] as const).map((n) => (
          <button key={n} onClick={() => setNav(n)} style={{ ...S.navBtn, ...(nav === n ? S.navBtnActive : {}) }}>{n}</button>
        ))}
        <a href="/hub/community" style={S.auditLink}>← production Community</a>
      </nav>

      <div style={S.hero}>
        <div style={S.heroTitle}>PHILOS COMMUNITY</div>
        <div style={S.heroSub}>VALUE UNIVERSE — 28 families · 251 normalized values · 3 verified relations</div>
        <div style={S.searchRow}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש ערך…" style={S.searchInput} />
          <div style={S.realDemoToggle}>
            <button onClick={() => setIncludeDemo(false)} style={{ ...S.toggleBtn, ...(!includeDemo ? S.toggleBtnActive : {}) }}>REAL</button>
            <button onClick={() => setIncludeDemo(true)} style={{ ...S.toggleBtn, ...(includeDemo ? S.toggleBtnActiveDemo : {}) }}>INCLUDE DEMO</button>
          </div>
        </div>
        {includeDemo ? <div style={S.demoNote}>DEMO — תצוגה מקדימה בלבד, לא מקושרת לנתוני DEMO אמיתיים בבדיקה זו.</div> : null}
      </div>

      <div style={{ display: "flex", gap: 0, maxWidth: 1300, margin: "0 auto", alignItems: "flex-start" }}>
        {/* MAP — SVG, real center/periphery layout */}
        <div style={{ ...S.mapArea, flex: selected ? "0 0 66%" : "0 0 100%" }}>
          <svg viewBox="140 90 720 470" style={S.svg}>
            {/* edges — only real, verified relations, drawn once */}
            {FAMILY_EDGES.map((e) => {
              const a = laidOut.find((f) => f.id === e.a)!;
              const b = laidOut.find((f) => f.id === e.b)!;
              const dim = selected && selected.id !== e.a && selected.id !== e.b;
              const style = EDGE_STYLE[e.type];
              return (
                <line
                  key={`${e.a}-${e.b}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={style.stroke} strokeWidth={dim ? 1 : 2} strokeDasharray={style.dash}
                  opacity={dim ? 0.15 : 0.85}
                />
              );
            })}
            {/* nodes */}
            {laidOut.map((f) => {
              const isSelected = selectedId === f.id;
              const isRelated = relatedFamilyIds.has(f.id);
              const isSearchMiss = searchMatchIds && !searchMatchIds.has(f.id);
              const dim = (selected && !isSelected && !isRelated) || isSearchMiss;
              const svCount = SUBVALUE_COUNT[f.id] ?? 0;
              return (
                <g
                  key={f.id}
                  onClick={() => { setSelectedId(f.id); setSelectedGroupId(null); }}
                  style={{ cursor: "pointer" }}
                  opacity={dim ? 0.22 : 1}
                >
                  <circle
                    cx={f.x} cy={f.y} r={isSelected ? f.r * 1.35 : f.r}
                    fill={f.hasRealGroup ? "rgba(52,211,153,0.14)" : f.connected ? "rgba(91,156,246,0.1)" : "rgba(90,120,180,0.06)"}
                    stroke={isSelected ? "#5b9cf6" : f.hasRealGroup ? "#34d399" : f.connected ? "#5aa6ff" : "rgba(90,120,180,0.4)"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text x={f.x} y={f.y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: isSelected ? 10.5 : 8.5, fontWeight: 700, fill: "#e6ebf5", pointerEvents: "none" }}>
                    {truncate(f.name_he, isSelected ? 22 : 12)}
                  </text>
                  <text x={f.x} y={f.y + f.r + (isSelected ? 16 : 11)} textAnchor="middle" style={{ fontSize: 12, fill: "#8aa0c8", pointerEvents: "none" }}>
                    {svCount}{(() => { const gc = (live.familyGroups[f.id] ?? []).filter((g) => includeDemo || g.status === "REAL").length; return gc > 0 ? ` · ${gc} קבוצה` : ""; })()}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={S.legend}>
            <LegendItem color="#34d399" label="קבוצה אמיתית" dot />
            <LegendItem color="#5aa6ff" label="ערך מחובר (יש יחס מאומת)" dot />
            <LegendItem color="#f2635c" label="TENSION" line />
            <LegendItem color="#5aa6ff" label="CONTINUUM" line dash />
          </div>
          <div style={S.mapNote}>3 יחסים מאומתים מתוך 38, מחברים 5/28 משפחות. 23 משפחות ללא יחס מאומת — מוצגות בהיקף, לא מוסתרות.</div>
        </div>

        {/* DETAIL PANEL */}
        {selected ? (
          <div style={S.detailPanel}>
            <button onClick={() => { setSelectedId(null); setSelectedGroupId(null); }} style={S.drawerClose}>✕ סגור</button>
            <div style={S.drawerTitle}>{selected.name_he}</div>
            <div style={S.drawerDef}>{selected.content_he}</div>

            <DrawerSection title={`SUBVALUES (${selectedSubvalues.length})`}>
              {selectedSubvalues.length === 0 ? <Empty>0</Empty> : (
                <div style={S.chipRow}>
                  {selectedSubvalues.slice(0, 16).map((sv) => <span key={sv.subvalue_id} style={S.chip}>{sv.name_he}</span>)}
                  {selectedSubvalues.length > 16 ? <span style={S.chipMore}>+{selectedSubvalues.length - 16}</span> : null}
                </div>
              )}
            </DrawerSection>

            <DrawerSection title={`RELATED VALUES / TENSIONS / CONTINUUM (${relatedEdges.length})`}>
              {relatedEdges.length === 0 ? (
                <Empty>0 — אין יחס מאומת למשפחה זו כרגע. מוצג ביושר, לא מומצא.</Empty>
              ) : (
                <div style={S.list}>
                  {relatedEdges.map((e) => {
                    const otherId = e.a === selected.id ? e.b : e.a;
                    const other = RAW_FAMILIES.find((f) => f.id === otherId);
                    return (
                      <div key={otherId} style={S.listRow}>
                        <span>{other?.name_he}</span>
                        <span style={{ ...S.listMeta, color: EDGE_STYLE[e.type].stroke }}>{e.type}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </DrawerSection>

            <DrawerSection title={`REAL GROUPS (${selectedGroups.length})`}>
              {selectedGroups.length === 0 ? (
                <Empty>0 קבוצות אמיתיות{includeDemo ? "/DEMO" : ""} סביב משפחה זו כרגע.</Empty>
              ) : (
                <div style={S.list}>
                  {selectedGroups.map((g) => (
                    <button key={g.group_id} onClick={() => setSelectedGroupId(g.group_id)} style={{ ...S.listRow, ...S.listRowBtn, borderColor: selectedGroupId === g.group_id ? "#5b9cf6" : "transparent" }}>
                      <span>{g.group_name} · {g.central_value}</span>
                      <StatusTag status={g.status === "REAL" ? "real" : "demo"}>{g.status} · {g.member_count} חברים</StatusTag>
                    </button>
                  ))}
                </div>
              )}
            </DrawerSection>

            {/* GROUP DRILL-DOWN — R5.2 section 4: real GROUP/VALUE/MEMBERS/
                NEEDS/RESOURCES/ACTIONS/EFFECTS/EVIDENCE/IMPACT + next action */}
            {selectedGroupDetail ? (
              <DrawerSection title={`קבוצה · ${selectedGroupDetail.group_name}`}>
                {/* CONTAINER hierarchy — VALUE → GROUP → PEOPLE, the same
                    shared grammar Human Config's HUMAN → CURRENT CONFIG
                    nesting uses. Real data only, unchanged from before. */}
                <PhilosContainer label="VALUE" labelEn={selectedGroupDetail.central_value} status="real">
                  <PhilosContainer label="GROUP" labelEn={selectedGroupDetail.group_name} status={selectedGroupDetail.status === "REAL" ? "real" : "demo"} dense>
                    <div style={S.listRow}><span>PEOPLE</span><span style={S.listMeta}>{selectedGroupDetail.member_count}</span></div>
                    {selectedGroupDetail.members.length > 0 ? (
                      <div style={S.chipRow}>
                        {selectedGroupDetail.members.slice(0, 10).map((m) => <span key={m.person_id} style={S.chip}>{m.display_name}</span>)}
                        {selectedGroupDetail.members.length > 10 ? <span style={S.chipMore}>+{selectedGroupDetail.members.length - 10}</span> : null}
                      </div>
                    ) : null}
                  </PhilosContainer>
                </PhilosContainer>

                {/* FLOW — NEED/RESOURCE ↕ ACTION → EFFECT, system-wide
                    canon counts (real; gap notes preserved below,
                    unchanged in meaning). */}
                <div style={{ marginTop: 10 }}>
                  <PhilosFlow
                    steps={[
                      { key: "needs", label: "צרכים", labelEn: "NEEDS", state: live.canonNeedsCount > 0 ? "done" : "pending" },
                      { key: "resources", label: "משאבים", labelEn: "RESOURCES", state: live.canonOffersCount > 0 ? "done" : "pending" },
                      { key: "actions", label: "פעולות", labelEn: "ACTIONS", state: live.canonActionsCount > 0 ? "done" : "pending" },
                      { key: "effects", label: "השפעות", labelEn: "EFFECTS", state: live.canonEffectsCount > 0 ? (live.canonVerifiedEffectsCount > 0 ? "done" : "current") : "pending" },
                    ] satisfies PhilosFlowStep[]}
                    direction="vertical"
                  />
                </div>

                <div style={S.groupCard}>
                  <div style={S.listRow}>
                    <span>NEEDS (canon, person-scoped)</span>
                    <span style={S.listMeta}>{live.canonNeedsCount} — Need אינו נושא group_id ב-canon, לא ניתן לקשר לקבוצה זו ספציפית</span>
                  </div>
                  <div style={S.listRow}>
                    <span>RESOURCES (canon, person-scoped)</span>
                    <span style={S.listMeta}>{live.canonOffersCount} — אותו פער: Offer אינו נושא group_id</span>
                  </div>
                  <div style={S.listRow}>
                    <span>ACTIONS (canon, system-wide)</span>
                    <span style={S.listMeta}>{live.canonActionsCount} — Action קנוני אינו נושא group_id</span>
                  </div>
                  <div style={S.listRow}>
                    <span>EFFECTS (canon, system-wide)</span>
                    <span style={S.listMeta}>{live.canonEffectsCount}</span>
                  </div>
                  <div style={S.listRow}>
                    <span>EVIDENCE (canon verified_outcome)</span>
                    <span style={{ ...S.listMeta, color: live.canonVerifiedEffectsCount > 0 ? "#34d399" : undefined }}>{live.canonVerifiedEffectsCount} מאומת מתוך {live.canonEffectsCount}</span>
                  </div>
                  <div style={S.listRow}>
                    <span>IMPACT (legacy group.impact, per-group אמיתי)</span>
                    <span style={{ ...S.listMeta, color: "#34d399" }}>{selectedGroupDetail.verified_effects} מאומת</span>
                  </div>
                </div>
                {(() => {
                  const next = computeNextAction(true, live.canonNeedsCount, live.canonOffersCount, live.canonActionsCount, live.canonEffectsCount, live.canonVerifiedEffectsCount);
                  return <a href={next.href} style={S.nextActionBtn}>{next.label} →</a>;
                })()}
              </DrawerSection>
            ) : null}

            <DrawerSection title="LIVE STATE (family-level)">
              <div style={S.note}>
                Needs {live.canonNeedsCount} · Resources {live.canonOffersCount} · Actions {live.canonActionsCount} · Effects {live.canonEffectsCount} ({live.canonVerifiedEffectsCount} מאומת) — ספירות מערכתיות אמיתיות (canon), לא פר-משפחה: אין group_id/value_context על Need/Offer/Action/Effect כיום.
              </div>
              {!live.identityLinked ? <div style={{ ...S.note, color: "#fbbf24", marginTop: 4 }}>אין קישור זהות — הספירות הנ"ל עשויות שלא לשקף את המשתמש הנוכחי.</div> : null}
            </DrawerSection>

            <DrawerSection title="NEXT VALID ACTION">
              {(() => {
                const hasRealGroup = selectedGroups.some((g) => g.status === "REAL") || (includeDemo && selectedGroups.length > 0);
                const next = computeNextAction(hasRealGroup, live.canonNeedsCount, live.canonOffersCount, live.canonActionsCount, live.canonEffectsCount, live.canonVerifiedEffectsCount);
                return <a href={next.href} style={S.nextActionBtn}>{next.label} →</a>;
              })()}
            </DrawerSection>
          </div>
        ) : null}
      </div>

      <div style={S.networkStrip}>
        <NetStat label="קבוצות אמיתיות" value={live.realGroupsCount} />
        <NetStat label="אנשים" value={live.peopleCount} />
        <NetStat label="צרכים (canon)" value={live.canonNeedsCount} />
        <NetStat label="משאבים (canon)" value={live.canonOffersCount} />
        <NetStat label="Actions (canon)" value={live.canonActionsCount} />
        <NetStat label="Effects מאומתים (legacy)" value={live.legacyVerifiedEffectsCount} color="#34d399" />
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function LegendItem({ color, label, dot, line, dash }: { color: string; label: string; dot?: boolean; line?: boolean; dash?: boolean }) {
  return (
    <div style={S.legendItem}>
      {dot ? <span style={{ ...S.legendDot, background: color }} /> : null}
      {line ? <span style={{ ...S.legendLine, background: color, ...(dash ? { backgroundImage: `linear-gradient(90deg, ${color} 60%, transparent 40%)`, backgroundSize: "6px 2px" } : {}) }} /> : null}
      <span>{label}</span>
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
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", color: "#e6ebf5", background: "#0b0f1a", minHeight: "100vh", paddingBottom: 40 },
  protoBadge: { textAlign: "center", fontSize: 13, fontWeight: 700, color: "#0b0f1a", background: "#fbbf24", padding: "4px 0" },
  localNav: { display: "flex", alignItems: "center", gap: 6, padding: "12px 20px", borderBottom: "1px solid rgba(90,120,180,0.15)" },
  navBtn: { fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 12, border: "1px solid rgba(90,120,180,0.3)", background: "transparent", color: "#8fa3c9", cursor: "pointer" },
  navBtnActive: { color: "#0b0f1a", background: "#5b9cf6", borderColor: "#5b9cf6" },
  auditLink: { marginInlineStart: "auto", fontSize: 13, color: "#6c86b5", textDecoration: "none" },

  hero: { textAlign: "center", padding: "20px 20px 6px" },
  heroTitle: { fontSize: 26, fontWeight: 800, letterSpacing: 2, color: "#f2f6fc" },
  heroSub: { fontSize: 13, color: "#5b9cf6", marginTop: 6, fontWeight: 600 },
  searchRow: { display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" },
  searchInput: { fontSize: 15, padding: "9px 16px", borderRadius: 20, border: "1px solid rgba(90,120,180,0.3)", background: "rgba(18,24,38,0.6)", color: "#e6ebf5", width: 260, textAlign: "center" },
  realDemoToggle: { display: "flex", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(90,120,180,0.3)" },
  toggleBtn: { fontSize: 13, fontWeight: 700, padding: "8px 14px", border: "none", background: "transparent", color: "#8fa3c9", cursor: "pointer" },
  toggleBtnActive: { background: "#34d399", color: "#0b0f1a" },
  toggleBtnActiveDemo: { background: "#fbbf24", color: "#0b0f1a" },
  demoNote: { fontSize: 13, color: "#fbbf24", marginTop: 8 },

  mapArea: { padding: "8px 12px" },
  svg: { width: "100%", height: "auto", display: "block" },
  legend: { display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", padding: "6px 10px", fontSize: 12 },
  legendItem: { display: "flex", alignItems: "center", gap: 5, color: "#8fa3c9" },
  legendDot: { width: 9, height: 9, borderRadius: "50%", display: "inline-block" },
  legendLine: { width: 18, height: 2, display: "inline-block" },
  mapNote: { textAlign: "center", fontSize: 12, color: "#6c86b5", marginTop: 2 },

  detailPanel: { flex: "0 0 34%", maxWidth: 380, padding: "14px 18px", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 14, margin: "8px 20px 0 0" },
  drawerClose: { fontSize: 13, color: "#8fa3c9", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 10 },
  drawerTitle: { fontSize: 17, fontWeight: 800, color: "#f2f6fc" },
  drawerDef: { fontSize: 13, color: "#9fb0d0", marginTop: 6, lineHeight: 1.6 },
  drawerSection: { marginTop: 14 },
  drawerSectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#6c86b5", marginBottom: 4 },
  pending: { fontSize: 13, color: "#6c86b5", fontStyle: "italic" },
  note: { fontSize: 13, color: "#8fa3c9", lineHeight: 1.6 },

  chipRow: { display: "flex", flexWrap: "wrap", gap: 5 },
  chip: { fontSize: 12, padding: "3px 8px", borderRadius: 8, border: "1px solid rgba(90,120,180,0.3)", color: "#dbe6f6" },
  chipMore: { fontSize: 12, padding: "3px 8px", color: "#6c86b5" },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  listRow: { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(90,120,180,0.06)", fontSize: 13 },
  listRowBtn: { border: "1px solid transparent", cursor: "pointer", color: "#e6ebf5", fontFamily: "inherit", textAlign: "right", width: "100%" },
  listMeta: { fontSize: 12, fontWeight: 700 },
  empty: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic" },
  groupCard: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 },
  nextActionBtn: { display: "inline-block", fontSize: 13, fontWeight: 700, color: "#0b0f1a", background: "#5b9cf6", padding: "8px 14px", borderRadius: 8, textDecoration: "none" },

  networkStrip: { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", padding: "18px 20px 6px" },
  netStat: { textAlign: "center", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 12, padding: "10px 16px", minWidth: 92 },
  netStatValue: { fontSize: 20, fontWeight: 800 },
  netStatLabel: { fontSize: 12, color: "#8fa3c9", marginTop: 3 },
};
