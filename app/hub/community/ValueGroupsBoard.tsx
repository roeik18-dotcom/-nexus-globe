/**
 * ValueGroupsBoard — Community's PRIMARY product surface (Visual Delivery
 * pass). One card per Value Group, over the SAME `ValueGroupView`
 * projections, bridge registry, canon Need/Offer reads and identity link
 * `page.tsx` already computes for the (now secondary) universe explorer —
 * no new store, no new read, no second money model.
 *
 * Each card answers, per group, with a provenance badge on every block:
 *
 *   VALUE        the group's real central value (projection field)
 *   MEMBERS      real member list from the same event projection
 *   QUALITY      honest PARTIAL/UNKNOWN — the source explicitly deferred a
 *                quality formula (`QUALITY_GROUP_MODEL.notes`), and VALUE
 *                GROUP ≠ QUALITY GROUP, so NO score is invented here; the
 *                card states the deferral instead of faking a number
 *   BUDGET       the projection's own BudgetView (received/spent/available)
 *   NEEDS/OFFERS real canon Need/Offer counts for the identity-linked
 *                subject — canon Needs/Offers are SUBJECT-owned records
 *                with no group foreign key today, so they are labeled as
 *                the linked person's, and DEMO groups show UNKNOWN rather
 *                than borrowing the real subject's records
 *   ACTIONS      real ACTION_AFFECTS_COMMUNITY bridge links targeting this
 *                group + the projection's real today-activity count
 *   EFFECTS      the group's real impact claims (ImpactView)
 *   EVIDENCE     the verified subset only — never summed with claims
 *   TREND        computed from the real capital/membership timelines
 *                (balance after last money event, last join) — the ROWS
 *                are real, the trend PHRASING is a rule, so it is STATIC
 *   PERSON↔VALUE the real resolved identity link: is the viewer a
 *                verified member of THIS group, or honestly not linked
 */
import type { ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { GroupRelation } from "@/app/lib/philos/valueSystem/groupResolver";
import { QUALITY_GROUP_MODEL } from "@/app/lib/philos/community/sourceValueModel";
import { PROVENANCE_STYLE, ProvenanceBadge, type Provenance } from "@/app/lib/philos/shell/provenance";
import { COLOR, FS, RADIUS, SPACE, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

export interface ValueGroupCardData {
  view: ValueGroupView;
  provenance: "REAL" | "DEMO";
  /** Real ACTION_AFFECTS_COMMUNITY bridge links targeting this group. */
  bridgeActionCount: number;
  /** Last point of the real capital timeline — `null` = no money event. */
  capital: { balance: number; lastDelta: number; date: string; currency: string } | null;
  /** Last point of the real membership timeline — `null` = no join event. */
  membership: { count: number; lastJoinDate: string } | null;
  openTensions: number;
  /** Viewer's real relation to THIS group via the resolved identity link. */
  personRelation: { linked: boolean; memberId?: string };
  /** Canon Need/Offer counts for the identity-linked subject — only
   *  attached to the REAL group; `null` = no honest way to scope them. */
  linkedSubjectNeeds: number | null;
  linkedSubjectOffers: number | null;
  /** Person↔group relations from the ONE shared Value Group resolver
   *  (`valueSystem/groupResolver.ts`) — real records only, membership
   *  never inferred from value similarity. */
  resolvedRelations: GroupRelation[];
  /** OBSERVATION↔GROUP state for the latest real Observation — separate
   *  graph from person relations, never inherited from membership. */
  observationState: "MATCHED" | "CANDIDATE" | "UNRESOLVED";
  /** Leading Value Family via the base-value registry (STATIC rule). */
  leadingFamily: { family_ref: string; label: string; via_base_value: string } | null;
}

export default function ValueGroupsBoard({ groups, linkedSubject }: { groups: ValueGroupCardData[]; linkedSubject?: string }) {
  const real = groups.filter((g) => g.provenance === "REAL");
  const demo = groups.filter((g) => g.provenance === "DEMO");

  return (
    <section dir="rtl" style={S.band}>
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>קבוצות ערך · VALUE GROUPS</div>
          <h2 style={S.title}>
            VALUE → MEMBERS → BUDGET → NEEDS/OFFERS → ACTIONS → EFFECTS → EVIDENCE → TREND
          </h2>
        </div>
        <div style={S.headMeta}>
          <span style={S.chip}>{real.length} REAL</span>
          <span style={S.chip}>{demo.length} DEMO</span>
          {linkedSubject ? <span style={S.chip}>{linkedSubject}</span> : null}
        </div>
      </header>

      <div style={S.grid}>
        {real.map((g) => <GroupCard key={g.view.group_id} data={g} />)}
        {demo.map((g) => <GroupCard key={g.view.group_id} data={g} />)}
      </div>
      {groups.length === 0 ? (
        <div style={S.empty}>UNKNOWN — אף קבוצת ערך לא נטענה מהלוג</div>
      ) : null}
    </section>
  );
}

function GroupCard({ data }: { data: ValueGroupCardData }) {
  const { view, provenance } = data;
  const verified = view.impact.filter((i) => i.verified);
  const prov: Provenance = provenance === "REAL" ? "REAL" : "DEMO";
  const detailHref = `?mode=groups&community=${encodeURIComponent(view.group_id)}`;

  return (
    <article style={{
      ...S.card,
      /* REAL must dominate DEMO. A REAL group carries a real membership and
         real money; a DEMO group is illustrative. They previously read as
         near-equals (0.82 opacity, comparable borders), so the one real
         group on this board did not stand out among three columns. */
      opacity: provenance === "DEMO" ? 0.62 : 1,
      /* Card chrome comes from the SHARED provenance vocabulary rather than
         two hand-picked rgba values. A card is a claim about where its
         contents came from, and that claim should look the same here as it
         does on every other surface. */
      borderColor: PROVENANCE_STYLE[prov].border,
      borderWidth: provenance === "REAL" ? 2 : 1,
      background: provenance === "REAL" ? PROVENANCE_STYLE.REAL.bg : undefined,
    }}>
      <div style={S.cardHead}>
        <a href={detailHref} style={S.cardTitle}>{view.name}</a>
        <ProvenanceBadge p={prov} />
      </div>
      <div style={S.valueLine}>
        <span style={S.valueWord}>{view.central_value}</span>
        <span style={S.metaFaint}>{view.region} · {view.status} · נפתחה {view.opened_at.slice(0, 10)}</span>
      </div>

      <FieldRow label="VALUE FAMILY" provenance={data.leadingFamily ? "STATIC" : "UNKNOWN"}
        value={data.leadingFamily ? `${data.leadingFamily.family_ref} ${data.leadingFamily.label}` : "UNKNOWN — הערך המרכזי לא ממופה לערך בסיס"}
        meta={data.leadingFamily ? `via ${data.leadingFamily.via_base_value} · CANDIDATE_VALUE_FAMILY / REVIEW_REQUIRED` : undefined}
        italic={!data.leadingFamily} />

      {/* VITALS — the four numbers a person actually scans, as numbers.
          These were four `label: value` rows, which reads as a database
          record: to compare two groups you had to read eight lines instead
          of glancing at eight figures. Detail that was in the `meta` line
          moves to the title attribute and to the DETAILS disclosure — it is
          still here, it just no longer costs a row each. */}
      <div style={S.vitals}>
        <Vital n={view.members.length} label="חברים"
               title={view.members.slice(0, 5).map((m) => m.display_name).join(", ")} />
        <Vital n={view.budget.available} label={`${view.budget.currency} זמין`}
               title={`התקבל ${view.budget.received} · הוצא ${view.budget.spent} · הוקצה ${view.budget.committed}`} />
        <Vital n={view.today.length} label="פעיל היום" />
        <Vital n={verified.length} label="מאומת" accent={verified.length > 0} />
      </div>

      <FieldRow label="NEEDS" provenance={data.linkedSubjectNeeds !== null ? "CANON" : "UNKNOWN"}
        value={data.linkedSubjectNeeds !== null ? `${data.linkedSubjectNeeds} Need פתוח` : "UNKNOWN"}
        meta={data.linkedSubjectNeeds !== null ? "רשומות קנוניות של האדם המקושר — אין שיוך Need↔קבוצה בסכימה" : "אין קישור קנוני בין Need לקבוצה זו"}
        italic={data.linkedSubjectNeeds === null} />

      <FieldRow label="OFFERS" provenance={data.linkedSubjectOffers !== null ? "CANON" : "UNKNOWN"}
        value={data.linkedSubjectOffers !== null ? `${data.linkedSubjectOffers} Offer` : "UNKNOWN"}
        meta={data.linkedSubjectOffers !== null ? "רשומות קנוניות של האדם המקושר" : "אין קישור קנוני בין Offer לקבוצה זו"}
        italic={data.linkedSubjectOffers === null} />

      <FieldRow label="ACTIONS" provenance={data.bridgeActionCount > 0 ? "CANON" : view.today.length > 0 ? "REAL" : "UNKNOWN"}
        value={`${data.bridgeActionCount} Action מקושר · ${view.today.length} פעילות היום`}
        meta={data.bridgeActionCount > 0 ? "ACTION_AFFECTS_COMMUNITY מרישום הגשרים" : "אין Action קנוני שמקושר לקבוצה"}
        italic={data.bridgeActionCount === 0 && view.today.length === 0} />

      <FieldRow label="EFFECTS" provenance={view.impact.length > 0 ? prov : "UNKNOWN"}
        value={`${view.impact.length} Impact claims`}
        meta={view.impact[0] ? view.impact[0].statement : "אין Impact רשום"}
        italic={view.impact.length === 0} />

      <FieldRow label="EVIDENCE" provenance={verified.length > 0 ? prov : "UNKNOWN"}
        value={`${verified.length} / ${view.impact.length} מאומת`}
        meta={verified[0] ? `${verified[0].statement} · ${verified[0].people_affected} מושפעים` : "אין אימות — claims בלבד"}
        italic={verified.length === 0} />

      <FieldRow label="TREND" provenance={data.capital || data.membership ? "STATIC" : "UNKNOWN"}
        value={data.capital
          ? `הון ${data.capital.balance} ${data.capital.currency} (Δ אחרון ${data.capital.lastDelta > 0 ? "+" : ""}${data.capital.lastDelta})`
          : "אין אירוע כספי"}
        meta={data.membership
          ? `חברות: ${data.membership.count} · הצטרפות אחרונה ${data.membership.lastJoinDate}` + (data.openTensions > 0 ? ` · ${data.openTensions} Tension פתוח` : "")
          : "אין אירוע הצטרפות"}
        italic={!data.capital && !data.membership} />

      {/* AUDIT tier — diagnostics, resolved-relation reasoning and raw ids.
          Real and unchanged, but they answered a different question than
          "what is this group doing", so they no longer occupy the card's
          primary column. */}
      <details style={S.cardAudit}>
        <summary style={S.cardAuditSummary}>אבחון · קשרים · פרובננס — DETAILS</summary>
      <FieldRow label="OBSERVATION ↔ GROUP" provenance={data.observationState === "MATCHED" ? "REAL" : "UNKNOWN"}
        value={data.observationState}
        meta={data.observationState === "UNRESOLVED" ? "התצפית האחרונה אינה מצטלבת ערכית עם הקבוצה — חברות אישית אינה מאשרת רלוונטיות" : "join ערכי מהתצפית האחרונה"}
        italic={data.observationState === "UNRESOLVED"} />

      <FieldRow label="QUALITY" provenance="UNKNOWN"
        value={`${QUALITY_GROUP_MODEL.status} — אין נוסחת איכות`}
        meta="המקור דחה זאת במפורש · חברות ≠ איכות · VALUE GROUP ≠ QUALITY GROUP" italic />

      <FieldRow label="RELATIONS" provenance={data.resolvedRelations.length === 0 ? "UNKNOWN" : data.provenance === "DEMO" ? "DEMO" : data.resolvedRelations.some((r) => r.provenance !== "VALUE_JOIN") ? "REAL" : "STATIC"}
        value={data.resolvedRelations.length === 0
          ? "אין קשר אמיתי בין הצופה לקבוצה — לא מומצא"
          : data.resolvedRelations.map((r) => r.relation_type).join(" · ")}
        meta={data.resolvedRelations.length > 0
          ? data.resolvedRelations.map((r) => `${r.relation_type}: ${r.match_reason}`).join(" | ").slice(0, 180)
          : "MEMBER_OF/CONTRIBUTES_TO/BENEFITS_FROM דורשים רשומה אמיתית; חפיפת ערך לבדה אינה חברות"}
        italic={data.resolvedRelations.length === 0} />

      <FieldRow label="PERSON ↔ VALUE" provenance={data.personRelation.linked ? "REAL" : "UNKNOWN"}
        value={data.personRelation.linked ? "חבר מאומת · VERIFIED_SAME_PERSON" : "אין קשר מאומת לצופה"}
        meta={data.personRelation.linked && data.personRelation.memberId ? `member: ${data.personRelation.memberId}` : "הקשר לא נטען — לא מומצא"}
        italic={!data.personRelation.linked} />

      </details>

      <a href={detailHref} style={S.detailLink}>פירוט מלא של הקבוצה ←</a>
    </article>
  );
}

/** One scannable figure. The number leads; the word explains it. */
function Vital({ n, label, title, accent = false }: { n: number; label: string; title?: string; accent?: boolean }) {
  return (
    <span style={S.vital} title={title}>
      <b style={{ ...S.vitalN, color: accent ? "#34d399" : n > 0 ? COLOR.text : COLOR.textFaint }}>{n}</b>
      <span style={S.vitalLabel}>{label}</span>
    </span>
  );
}

function FieldRow({ label, value, meta, provenance, italic }: { label: string; value: string; meta?: string; provenance: Provenance; italic?: boolean }) {
  return (
    <div style={S.fieldRow}>
      <div style={S.fieldHead}>
        <span style={S.fieldLabel}>{label}</span>
        <ProvenanceBadge p={provenance} />
      </div>
      <div style={{ ...S.fieldValue, fontStyle: italic ? "italic" : "normal", color: italic ? "#8798b8" : COLOR.text }}>{value}</div>
      {meta ? <div style={S.fieldMeta}>{meta}</div> : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  vitals: { display: "flex", gap: SPACE.sm, flexWrap: "wrap", margin: "8px 0 6px", paddingBottom: 8, borderBottom: `1px solid ${COLOR.border}` },
  vital: { display: "inline-flex", flexDirection: "column", gap: 0, minWidth: 58 },
  vitalN: { fontSize: FS.head, fontWeight: 700, fontFamily: "ui-monospace, monospace", lineHeight: 1.1 },
  vitalLabel: { fontSize: FS.base, color: COLOR.textDim, lineHeight: 1.3 },
  cardAudit: { marginTop: 6, borderTop: `1px solid ${COLOR.border}`, paddingTop: 4 },
  cardAuditSummary: { cursor: "pointer", fontSize: FS.base, letterSpacing: 1.1, color: COLOR.textFaint, padding: "2px 0" },
  band: {
    background: "linear-gradient(180deg, rgba(91,156,246,0.07), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: 20,
    padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE.md}px`,
    margin: `${SPACE.md}px 20px ${SPACE.lg}px`,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.sm, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.micro, color: COLOR.accent, marginBottom: 4 },
  title: { fontSize: FS.read, fontWeight: 800, margin: 0, color: COLOR.text, direction: "ltr", textAlign: "right" },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: FS.base, fontWeight: 700, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px", fontFamily: "ui-monospace, monospace" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: SPACE.md },
  card: { border: "1px solid", borderRadius: RADIUS.lg, padding: `${SPACE.md}px ${SPACE.lg}px`, background: "rgba(10,14,23,0.5)", display: "flex", flexDirection: "column", gap: 6 },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: FS.head, fontWeight: 800, color: COLOR.text, textDecoration: "none" },
  valueLine: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 2 },
  valueWord: { fontSize: FS.read, fontWeight: 700, color: STATUS.real.text },
  metaFaint: { fontSize: FS.base, color: COLOR.textFaint },
  fieldRow: { borderTop: `1px solid ${COLOR.border}`, paddingTop: 5 },
  fieldHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fieldLabel: { ...TYPE.micro, color: "#8fa3c9", letterSpacing: 0.9 },
  fieldValue: { fontSize: FS.read, fontWeight: 600, lineHeight: 1.4, marginTop: 1 },
  fieldMeta: { fontSize: FS.base, color: COLOR.textDim, lineHeight: 1.35, marginTop: 1 },
  detailLink: { marginTop: 6, fontSize: FS.meta, color: COLOR.accent, textDecoration: "none", fontWeight: 700 },
  empty: { fontSize: FS.meta, fontStyle: "italic", color: "#8798b8", padding: "8px 0" },
};
