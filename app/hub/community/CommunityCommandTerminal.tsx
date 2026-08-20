/**
 * CommunityCommandTerminal — the ONE coherent Community command view for a
 * Value Group (real or DEMO). Consolidation pass: this component now also
 * absorbs what `CollectiveCapacity.tsx` uniquely showed (the potential-vs-
 * effective-capacity concept note + its four honestly-UNKNOWN coordination
 * factors) and a real Tension section (`tension.ts::buildCommunityTensions`,
 * the SAME shared shape Hub/Dynamics/Brain use) — `CollectiveCapacity.tsx`
 * is no longer rendered on `/hub/community` (deleted from the route, not
 * merely hidden) since everything it showed now lives here, in one place,
 * instead of two differently-styled sections repeating the same numbers.
 *
 * Renders a `ValueGroupView` (`projectValueGroup.ts`, unmodified) plus
 * sibling projections over the SAME event log (`buildCapitalTimeline`,
 * `buildContributorRanking`, `buildCommunityTensions`) — no parallel money
 * model, no fabricated ranking, no page-specific tension logic.
 *
 * REAL / DEMO / UNKNOWN provenance is explicit at the component level
 * (`provenance` prop) and repeated on every chart, never left implicit.
 * "Quality groups" was a section this component deliberately did NOT
 * build for a long time — at that point, no real quality-group taxonomy
 * existed anywhere in this codebase to recover, and inventing one would
 * have been exactly the forbidden replacement taxonomy. That gap is now
 * closed: Mission B's 328-entry Board reconciliation surfaced a REAL,
 * source-extracted quality-group model (`sourceValueModel.ts`'s
 * `QUALITY_GROUP_MODEL`/`RUNTIME_QUALITY_GROUP_CRITERIA`/
 * `GROUP_HIERARCHY_AXES`), now its own standalone directory at
 * `?mode=quality` (`QualityGroupView.tsx`) — not duplicated here, since
 * it isn't per-group (canon has no per-group quality qualification, see
 * that model's own notes).
 */
import type { ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { CapitalTimelinePoint, ContributorRankingEntry } from "@/app/lib/philos/projectValueGroup";
import type { TensionItem } from "@/app/lib/philos/tension";
import { DEMO_SCENARIO_RELATED_ALLOCATION } from "@/app/lib/philos/canon/demoMarketplaceScenario";
import { linksByRelation, type EntityLink } from "@/app/lib/philos/bridge/entityLink";

export type Provenance = "REAL" | "DEMO";

const SEVERITY_COLOR: Record<TensionItem["severity"], string> = { high: "#f2635c", medium: "#fbbf24", low: "#8aa0c8", unknown: "#6c86b5" };

export default function CommunityCommandTerminal({
  group,
  capital,
  contributors,
  tensions,
  provenance,
  bridgeLinks,
  valueFamilyLabel,
}: {
  group: ValueGroupView;
  capital: CapitalTimelinePoint[];
  contributors: ContributorRankingEntry[];
  tensions: TensionItem[];
  provenance: Provenance;
  bridgeLinks: EntityLink[];
  /** Mission B, continuation — see `CommunityLivingView.tsx`'s own doc
   *  on this same prop. */
  valueFamilyLabel?: string;
}) {
  const membershipLinks = linksByRelation(bridgeLinks, "PERSON_MEMBER_OF_COMMUNITY").filter((l) => l.target.canonical_id === group.group_id);
  const needLinks = linksByRelation(bridgeLinks, "COMMUNITY_HAS_NEED").filter((l) => l.source.canonical_id === group.group_id);
  const actionLinks = linksByRelation(bridgeLinks, "ACTION_AFFECTS_COMMUNITY").filter((l) => l.target.canonical_id === group.group_id);
  const regionLink = linksByRelation(bridgeLinks, "COMMUNITY_LOCATED_IN_REGION").find((l) => l.source.canonical_id === group.group_id);
  const badgeColor = provenance === "DEMO" ? "#fbbf24" : "#34d399";
  const maxBalance = Math.max(1, ...capital.map((p) => Math.abs(p.balance)));
  const activeMembers = new Set(contributors.filter((c) => c.event_count > 0).map((c) => c.person_id));

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <div>
          <span style={{ ...S.badge, color: badgeColor, borderColor: `${badgeColor}55` }}>{provenance}</span>
          <h1 style={S.title}>{group.name}</h1>
        </div>
        <span style={S.sub}>
          {group.central_value} · {group.region} · {group.status}
          {valueFamilyLabel ? <> · <span style={{ color: "#34d399" }}>{valueFamilyLabel}</span></> : null}
        </span>
      </div>

      {/* AT A GLANCE — the 10 command-terminal questions, answered from real fields only */}
      <div style={S.glance}>
        <Glance q="כמה כסף יש לקהילה?" a={`₪${group.budget.available.toLocaleString()} זמין`} />
        <Glance q="כמה הושקע?" a={`₪${group.budget.spent.toLocaleString()}`} />
        <Glance q="כמה משתמשים?" a={`${group.members.length}`} />
        <Glance q="מי מוביל?" a={contributors[0] ? contributors[0].display_name : "לא ידוע"} />
        <Glance q="מה קרה?" a={`${group.event_count} אירועים אמיתיים`} />
      </div>

      {/* TENSION / PRIORITY — the SAME shared shape Hub/Dynamics/Brain use */}
      <SectionHead>מתח · TENSION / PRIORITY</SectionHead>
      {tensions.length === 0 ? (
        <Empty>נבדק — אין Tension פתוח כרגע.</Empty>
      ) : (
        <div style={S.rankList}>
          {tensions.map((t) => (
            <div key={t.id} style={S.tensionRow}>
              <span style={{ ...S.tensionSeverity, color: SEVERITY_COLOR[t.severity] }}>{t.severity}</span>
              <span style={S.allocTitle}>{t.label}</span>
              <span style={S.allocMeta}>{t.current_state}</span>
              {t.possible_action ? <span style={S.provenanceNote}>→ {t.possible_action}</span> : null}
            </div>
          ))}
        </div>
      )}

      {/* TREASURY */}
      <SectionHead>אוצר · TREASURY</SectionHead>
      <div style={S.metricsRow}>
        <Metric label="התקבל (סה״כ)" value={group.budget.received} color="#34d399" />
        <Metric label="הושקע" value={group.budget.spent} color="#f2635c" />
        <Metric label="מחויב (מאושר, טרם הועבר)" value={group.budget.committed} color="#fbbf24" />
        <Metric label="זמין" value={group.budget.available} color="#5b9cf6" />
      </div>
      <ChartMeta metric="יתרה מצטברת" unit={`${capital[0]?.currency ?? "ILS"}`} range={capital.length ? `${capital[0].date} → ${capital[capital.length - 1].date}` : "אין נתון"} provenance={provenance} />
      {capital.length === 0 ? (
        <Empty>אין תנועת כסף רשומה.</Empty>
      ) : (
        <div style={S.timeline}>
          {capital.map((p) => (
            <div key={p.event_id} style={S.timelineBar} title={`${p.date} · ${p.delta >= 0 ? "+" : ""}${p.delta} → יתרה ${p.balance}`}>
              <div style={{ ...S.timelineFill, height: `${Math.max(4, (Math.abs(p.balance) / maxBalance) * 60)}px`, background: p.balance >= 0 ? "#34d399" : "#f2635c" }} />
              <div style={S.timelineLabel}>{p.date.slice(5)}</div>
            </div>
          ))}
        </div>
      )}

      {/* INVESTMENT */}
      <SectionHead>השקעה · INVESTMENT</SectionHead>
      <ChartMeta metric="הקצאות לפי מצב" unit="₪, מספר" range={group.opened_at} provenance={provenance} />
      {group.allocations.length === 0 ? (
        <Empty>אין הצעת הקצאה רשומה.</Empty>
      ) : (
        <div style={S.allocList}>
          {group.allocations.map((a) => (
            <div key={a.allocation_id} style={S.allocRow}>
              <span style={S.allocTitle}>{a.title}</span>
              <span style={S.allocMeta}>₪{a.amount.toLocaleString()} · {a.people_affected_estimate} אנשים</span>
              <span style={{ ...S.allocState, color: ALLOC_COLOR[a.state] }}>{ALLOC_LABEL[a.state]} · {a.votes_for}/{a.votes_required} קולות</span>
              {/* Community -> Marketplace -> Action -> Effect wiring (DEMO):
                  a real, targeted link — only this one allocation has a real
                  corresponding DEMO Marketplace scenario
                  (`demoMarketplaceScenario.ts`), so only this row links,
                  never a generic pattern applied to every allocation. */}
              {a.allocation_id === DEMO_SCENARIO_RELATED_ALLOCATION ? (
                <a href="/marketplace" style={S.demoFlowLink}>DEMO · ראה מסלול Marketplace שיכול לסגור פער זה →</a>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div style={{ ...S.provenanceNote, marginTop: 6 }}>
        Effects/תוצאות אמיתיות: {group.impact.filter((i) => i.verified).length} מאומתות ·{" "}
        {group.impact.filter((i) => i.rejected).length} נדחו ·{" "}
        {group.impact.filter((i) => !i.verified && !i.rejected).length} ממתינות
      </div>

      {/* USERS */}
      <SectionHead>משתמשים · USERS</SectionHead>
      <div style={S.metricsRow}>
        <Metric label="סה״כ חברים" value={group.members.length} color="#5b9cf6" unit="count" />
        <Metric label="פעילים (יצרו אירוע אמיתי)" value={activeMembers.size} color="#34d399" unit="count" />
        <Metric label="מובילים (leaders)" value={group.leaders.length} color="#a78bfa" unit="count" />
      </div>
      <div style={S.provenanceNote}>
        <b>יכולת פוטנציאלית</b> × תיאום · אמון · יישור ערכים · משאבים ← <b>יכולת קולקטיבית אפקטיבית</b> — מושג רעיוני, לא נוסחה מדעית.
        {" "}תיאום, אמון, יישור ערכים ומגבלות — לא ידוע, אין נתון אמיתי הממדד גורמים אלה כיום.
      </div>

      {/* MOST ACTIVE — renamed from "LEADING USERS" (ledger §38): the
          metric is a real event-count, not leadership/merit — "leading"
          falsely implied a value judgment this ranking never makes. */}
      <SectionHead>הכי פעילים · MOST ACTIVE</SectionHead>
      <ChartMeta metric="דירוג לפי מספר אירועים אמיתיים" unit="ספירה" range="כל הלוג" provenance={provenance} />
      <div style={S.provenanceNote}>ספירת פעילות אמיתית — לא ציון ערך/מוניטין (canon §21 אוסר ציון גלובלי).</div>
      <div style={S.rankList}>
        {contributors.slice(0, 6).map((c, i) => (
          <div key={c.person_id} style={S.rankRow}>
            <span style={S.rankPos}>#{i + 1}</span>
            <span style={S.rankName}>{c.display_name}</span>
            <span style={S.rankBar}><span style={{ ...S.rankBarFill, width: `${(c.event_count / (contributors[0]?.event_count || 1)) * 100}%` }} /></span>
            <span style={S.rankCount}>{c.event_count}</span>
          </div>
        ))}
      </div>

      {/* Mission B — the "no quality-group model" gap this section used
          to state is closed (see this file's own header); QUALITY GROUPS
          is now a real, standalone directory, not per-group data, so it
          links out rather than duplicating content here. */}
      <SectionHead>קבוצת איכות · QUALITY GROUP</SectionHead>
      <Empty>
        אין הסמכת איכות פר-קבוצה — הדגם עצמו כלל-מערכתי, לא פר-Value-Group (ראה QUALITY_GROUP_MODEL). <a href="/hub/community?mode=quality" style={{ color: "#5b9cf6" }}>צפה במודל המלא →</a>
      </Empty>

      {/* NEXT VALID ACTION — Mission B, B3. One real, computed CTA, scoped
          to THIS group's own real Tensions — the same "never invent
          urgency" discipline Hub/Brain/Dynamics already established. */}
      <SectionHead>הפעולה הבאה התקפה · NEXT VALID ACTION</SectionHead>
      {tensions.length > 0 ? (
        <div style={{ fontSize: 13, color: "#dbe6f6", padding: "8px 10px", borderRadius: 8, background: "rgba(242,99,92,0.08)", border: "1px solid rgba(242,99,92,0.25)" }}>
          בדוק Tension: {tensions[0].label} — <a href="/dynamics" style={{ color: "#5b9cf6" }}>Dynamics →</a>
        </div>
      ) : group.members.length === 0 ? (
        <Empty>0 חברים — אין פעולה מוצדקת עד שמישהו יצטרף.</Empty>
      ) : (
        <Empty>נבדק — אין Tension פתוח כרגע, אין פעולה דחופה מוצדקת.</Empty>
      )}

      {/* BRIDGE — Canonical Cross-Entity Link Registry. This community's own
          real member ids (`group.members[].person_id`) are the SAME ids
          Planet's globe already draws as nodes (`projectGlobeGraph`), so
          the membership count below is a real, checked cross-surface link,
          not a projection. */}
      <SectionHead>גשר · CROSS-ENTITY BRIDGE</SectionHead>
      <div style={S.glance}>
        <Glance q="חברים מקושרים ל-Planet" a={`${membershipLinks.length} · אותם מזהים בדיוק`} />
        <Glance q="צרכים מקושרים ל-Marketplace" a={needLinks.length > 0 ? `${needLinks.length} (DEMO)` : "0"} />
        <Glance q="Actions המשפיעים על הקהילה" a={actionLinks.length > 0 ? `${actionLinks.length} (DEMO)` : "0"} />
        <Glance q="הקשר מרחבי · SPATIAL CONTEXT" a={regionLink ? `${group.region} (${regionLink.provenance})` : "לא ידוע"} />
      </div>
      <div style={S.provenanceNote}>
        {membershipLinks.length > 0 ? (
          <>כל חבר בקהילה זו מופיע כ-node אמיתי ב-<a href="/planet" style={{ color: "#5b9cf6" }}>Planet</a> תחת אותו מזהה בדיוק — אין תרגום מזהים.</>
        ) : (
          "לא נבדקה חברות עבור קהילה זו."
        )}
        {" "}
        {regionLink ? (
          <>ה-COMMUNITY_LOCATED_IN_REGION למעלה נגזר ישירות מהשדה האמיתי group.region (event: group.opened) — לא הומצא. גם ב-<a href="/planet" style={{ color: "#5b9cf6" }}>Planet</a> ניתן לראות קישור זה עבור כל node שמזהה זה.</>
        ) : (
          "אין שדה region אמיתי לקהילה זו — לא ידוע."
        )}
      </div>
    </section>
  );
}

const ALLOC_LABEL: Record<string, string> = { voting: "בהצבעה", approved: "אושר", transferred: "הועבר" };
const ALLOC_COLOR: Record<string, string> = { voting: "#fbbf24", approved: "#5b9cf6", transferred: "#34d399" };

function Glance({ q, a }: { q: string; a: string }) {
  return (
    <div style={S.glanceItem}>
      <div style={S.glanceQ}>{q}</div>
      <div style={S.glanceA}>{a}</div>
    </div>
  );
}

/**
 * `unit` fixes a real display bug (ledger §38): every call site used to
 * render `value` with a hardcoded ₪ prefix, so member/leader/active-member
 * COUNTS rendered as "₪9" instead of "9" — money and counts were never
 * actually the same unit, the formatting just assumed they were. Explicit
 * per call site now, never inferred from the number's magnitude.
 */
function Metric({ label, value, color, unit = "money" }: { label: string; value: number; color: string; unit?: "money" | "count" }) {
  return (
    <div style={{ minWidth: 130 }}>
      <div style={{ fontSize: 12, letterSpacing: 1, color: "#6c86b5", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color }}>{unit === "money" ? `₪${value.toLocaleString()}` : value.toLocaleString()}</div>
    </div>
  );
}

function ChartMeta({ metric, unit, range, provenance }: { metric: string; unit: string; range: string; provenance: Provenance }) {
  return (
    <div style={S.chartMeta}>
      metric: {metric} · unit: {unit} · range: {range} · provenance: <b style={{ color: provenance === "DEMO" ? "#fbbf24" : "#34d399" }}>{provenance}</b>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div style={S.sectionHead}>{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.emptyRow}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "18px 20px", marginTop: 16, fontFamily: "system-ui", color: "#e6ebf5" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  badge: { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid", marginLeft: 8, fontFamily: "ui-monospace, monospace" },
  title: { fontSize: 17, fontWeight: 800, display: "inline", margin: 0, color: "#f0f4fc" },
  sub: { fontSize: 13, color: "#7f97c2" },

  glance: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 },
  glanceItem: { background: "rgba(91,156,246,0.06)", border: "1px solid rgba(90,120,180,0.18)", borderRadius: 8, padding: "8px 10px" },
  glanceQ: { fontSize: 12, color: "#6c86b5" },
  glanceA: { fontSize: 15, fontWeight: 700, color: "#e8edf6", marginTop: 3 },

  sectionHead: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  metricsRow: { display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 8 },

  chartMeta: { fontSize: 12, color: "#6c86b5", fontFamily: "ui-monospace, monospace", marginBottom: 6 },
  timeline: { display: "flex", alignItems: "flex-end", gap: 6, height: 90, padding: "0 4px", overflowX: "auto" },
  timelineBar: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", minWidth: 28 },
  timelineFill: { width: 14, borderRadius: 3 },
  timelineLabel: { fontSize: 12, color: "#6c86b5", marginTop: 4 },

  allocList: { display: "flex", flexDirection: "column", gap: 4 },
  allocRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(90,120,180,0.06)", flexWrap: "wrap" },
  tensionRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, background: "rgba(242,99,92,0.06)", flexWrap: "wrap" },
  tensionSeverity: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", minWidth: 50, fontFamily: "ui-monospace, monospace" },
  demoFlowLink: { fontSize: 12, color: "#fbbf24", textDecoration: "none", fontWeight: 700 },
  allocTitle: { fontSize: 13, color: "#e8edf6" },
  allocMeta: { fontSize: 13, color: "#8aa0c8" },
  allocState: { fontSize: 13, fontWeight: 700 },

  rankList: { display: "flex", flexDirection: "column", gap: 4 },
  rankRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  rankPos: { color: "#6c86b5", minWidth: 24 },
  rankName: { minWidth: 100, color: "#dbe6f6" },
  rankBar: { flex: 1, height: 8, background: "rgba(90,120,180,0.15)", borderRadius: 4, overflow: "hidden" },
  rankBarFill: { display: "block", height: "100%", background: "#5b9cf6" },
  rankCount: { minWidth: 24, textAlign: "right", color: "#8aa0c8" },

  provenanceNote: { fontSize: 13, color: "#6c86b5", lineHeight: 1.6 },
  emptyRow: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic", padding: "4px 2px", lineHeight: 1.6 },
};
