/**
 * OperationalGroupDetail — the REAL group drill-down (operational-groups
 * pass), rendered at `?mode=groups&community=<id>` above the existing
 * living view. Every section reads the ONE shared
 * `buildOperationalGroupProfile` assembler — no route-local group logic.
 *
 * All 13 required sections render; UNKNOWN is a valid, stated answer
 * (supporters, capabilities, general values, geography have no real
 * record type today and say so). The TRACE at the top is the acceptance
 * chain — Person → Group → Need → Resource → Action → Effect → Evidence —
 * every hop showing the real stored reference that links it, stopping
 * honestly wherever no reference exists.
 */
import type { OperationalGroupProfile } from "@/app/lib/philos/valueSystem/operationalGroup";
import { ProvenanceBadge, type Provenance } from "@/app/lib/philos/shell/provenance";
import { COLOR, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import { SystemDrawer } from "@/app/lib/philos/shell/SystemDrawer";

export default function OperationalGroupDetail({ profile }: { profile: OperationalGroupProfile }) {
  const p = profile;
  const traceComplete = p.trace.every((h) => h.ref !== null);

  return (
    <section dir="rtl" style={S.band}>
      {/* Folded by default — system detail, kept whole, one click away. */}
      <SystemDrawer id="group-detail" title="פירוט קבוצה · מערכת" note="ספירות ומקורות">
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>קבוצה תפעולית · OPERATIONAL VALUE GROUP</div>
          <h2 style={S.title}>{p.name} <span style={{ fontSize: 13, color: COLOR.textDim, fontFamily: "ui-monospace, monospace" }}>{p.group_id}</span></h2>
        </div>
        <div style={S.headMeta}>
          <ProvenanceBadge p="REAL" />
          <span style={S.chip}>{p.members.length} חברים</span>
          <span style={S.chip}>{p.verified_effects} effects מאומתים</span>
        </div>
      </header>

      {/* TRACE — the acceptance chain, real references only */}
      <Sec title={`TRACE · Person → Group → Need → Resource → Action → Effect → Evidence — ${traceComplete ? "שלם" : "נעצר"}`} prov={traceComplete ? "REAL" : "UNKNOWN"}>
        {p.trace.map((h) => (
          <div key={h.step} style={S.row}>
            <span style={{ ...TYPE.micro, color: h.ref ? "#34d399" : "#8798b8", minWidth: 150 }}>{h.step}</span>
            <span style={{ flex: 1, fontSize: 13, color: h.ref ? COLOR.text : "#8798b8", fontStyle: h.ref ? "normal" : "italic" }}>
              {h.detail}
              <span style={{ display: "block", fontSize: 12, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace", direction: "ltr", textAlign: "right" }}>
                {h.ref ? `${h.ref.slice(0, 22)}${h.ref.length > 22 ? "…" : ""} · via ${h.linked_via}` : "אין רשומה מקשרת"}
              </span>
            </span>
          </div>
        ))}
      </Sec>

      <div style={S.grid}>
        <Sec title="OVERVIEW" prov="REAL">
          <KV k="ערך מרכזי" v={p.view.central_value} />
          <KV k="מטרה" v={p.view.goal} />
          <KV k="אזור · סטטוס" v={`${p.view.region} · ${p.view.status}`} />
          <KV k="נפתחה" v={p.view.opened_at.slice(0, 10)} />
        </Sec>

        <Sec title="VALUES" prov={p.leading_family ? "STATIC" : "UNKNOWN"}>
          <KV k="משפחה מובילה" v={p.leading_family ? `${p.leading_family.family_ref} ${p.leading_family.label} (via ${p.leading_family.via_base_value} — כלל, REVIEW_REQUIRED)` : "UNKNOWN — הערך המרכזי לא ממופה לערך בסיס"} />
          <KV k="ערכים כלליים" v={p.general_values.length > 0 ? p.general_values.join(" · ") : "UNKNOWN — אין ערך כללי מקושר לקבוצה"} />
        </Sec>

        <Sec title="MEMBERS + SUPPORTERS" prov="REAL">
          <KV k={`חברים (${p.members.length})`} v={p.members.map((m) => m.display_name).join(", ")} />
          <KV k="תומכים" v="UNKNOWN — אין סוג רשומת supporter במערכת" />
        </Sec>

        <Sec title="NEEDS" prov={p.member_needs.length > 0 ? "CANON" : "UNKNOWN"}>
          {p.member_needs.length === 0 ? <KV k="—" v="אין Need של חבר מקושר" /> : p.member_needs.map((n) => (
            <KV key={n.need.need_id} k={n.need.need_id.slice(0, 10) + "…"} v={`${n.need.desired_change} · בעלים: ${n.need.subject} (חבר) — Need אישי, אין שדה group בסכימה`} />
          ))}
        </Sec>

        <Sec title="CAPABILITIES" prov="UNKNOWN">
          <KV k="—" v="UNKNOWN — אין מאגר Capability קנוני; נתוני PUDM הם LEGACY ואינם מקושרים לקבוצה" />
        </Sec>

        <Sec title="RESOURCES" prov={p.member_offers.length > 0 ? "CANON" : "REAL"}>
          <KV k="תקציב" v={`${p.view.budget.available} ${p.view.budget.currency} זמין · התקבל ${p.view.budget.received} · הוצא ${p.view.budget.spent}`} />
          {p.member_offers.map((o) => (
            <KV key={o.offer.offer_id} k={o.offer.offer_id.slice(0, 10) + "…"} v={`${o.offer.available_resource} (${o.offer.resource_type}) · מקור: ${o.offer.source} (חבר)`} />
          ))}
        </Sec>

        <Sec title="ACTIONS" prov={p.linked_actions.length > 0 ? "CANON" : "UNKNOWN"}>
          {p.linked_actions.length === 0 ? <KV k="—" v="אין Action מקושר לקבוצה (ACTION_AFFECTS_COMMUNITY)" /> : p.linked_actions.map((a) => (
            <KV key={a.action.action.action_id} k={a.action.action.type} v={`${a.action.action.action_id.slice(0, 14)}… · ${a.verification_state} · ${a.action.action.time.slice(0, 10)}`} />
          ))}
          <KV k="Transfers" v={`${p.view.transfers.length} (מתוכם ${p.view.transfers.filter((t) => t.state === "completed").length} הושלמו)`} />
        </Sec>

        <Sec title="EFFECTS" prov={p.effect_claims > 0 ? "CANON" : "UNKNOWN"}>
          <KV k="Claims" v={String(p.effect_claims)} />
          <KV k="מאומתים" v={String(p.verified_effects)} />
        </Sec>

        <Sec title="EVIDENCE" prov={p.evidence_statements.length > 0 ? "CANON" : "UNKNOWN"}>
          {p.evidence_statements.length === 0 ? <KV k="—" v="אין ראיה מאומתת" /> : p.evidence_statements.map((e, i) => <KV key={i} k={`#${i + 1}`} v={e} />)}
        </Sec>

        <Sec title="LEARNING" prov={p.learnings.length > 0 ? "CANON" : "UNKNOWN"}>
          {p.learnings.length === 0 ? <KV k="—" v="אין Learning על פעולות מקושרות — UNKNOWN" /> : p.learnings.map((l) => <KV key={l.learning_id} k={l.kind} v={l.learning_id} />)}
        </Sec>

        <Sec title="RELATIONS" prov="REAL">
          <KV k="PERSON↔GROUP" v={p.resolution.subject_group_relations.length > 0 ? p.resolution.subject_group_relations.map((r) => r.relation_type).join(" · ") : "אין קשר אישי אמיתי"} />
          <KV k="OBSERVATION↔GROUP" v={p.resolution.observation_group_relations.length > 0 ? p.resolution.observation_group_relations.map((r) => r.relation_type).join(" · ") : "UNRESOLVED — אין join ערכי מתצפית"} />
          <KV k="Tensions" v={p.tensions.length > 0 ? p.tensions.map((t) => t.label).join(" · ") : "אין Tension פתוח"} />
        </Sec>

        <Sec title="CAPITAL FLOW" prov={p.capital_flow.length > 0 ? "REAL" : "UNKNOWN"}>
          {p.capital_flow.length === 0 ? <KV k="—" v="אין תנועה כספית" /> : p.capital_flow.slice(-4).map((c, i) => (
            <KV key={i} k={c.date} v={`${c.delta >= 0 ? "+" : ""}${c.delta} → יתרה ${c.balance} ${c.currency}`} />
          ))}
        </Sec>

        <Sec title="TREND" prov="STATIC">
          <KV k="מגמה" v={p.trend} />
          <KV k="חברות לאורך זמן" v={p.membership_over_time.length > 0 ? p.membership_over_time.map((m) => `${m.date}: ${m.count}`).join(" · ") : "אין אירועי הצטרפות"} />
        </Sec>

        <Sec title="QUALITY (נפרד מהקבוצה)" prov="UNKNOWN">
          <KV k={p.quality.status} v={p.quality.note} />
        </Sec>
      </div>
      </SystemDrawer>
    </section>
  );
}

function Sec({ title, prov, children }: { title: string; prov: Provenance; children: React.ReactNode }) {
  return (
    <div style={S.sec}>
      <div style={S.secHead}>
        <span style={S.secTitle}>{title}</span>
        <ProvenanceBadge p={prov} />
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={S.row}>
      <span style={{ ...TYPE.micro, color: "#8fa3c9", minWidth: 110, flexShrink: 0 }}>{k}</span>
      <span style={{ flex: 1, fontSize: 13, color: COLOR.text, lineHeight: 1.45 }}>{v}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(52,211,153,0.06), rgba(11,15,26,0.9))",
    border: "1px solid rgba(52,211,153,0.35)",
    borderRadius: 20,
    padding: `${SPACE.lg}px`,
    margin: `${SPACE.md}px 20px`,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.sm, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.micro, color: "#34d399", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 800, margin: 0, color: COLOR.text },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 12, fontWeight: 700, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px", fontFamily: "ui-monospace, monospace" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: SPACE.md, marginTop: SPACE.md },
  sec: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, background: "rgba(10,14,23,0.45)" },
  secHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  secTitle: { ...TYPE.micro, color: "#8fa3c9", letterSpacing: 0.9 },
  row: { display: "flex", gap: 8, padding: "3px 6px", borderRadius: RADIUS.sm, background: "rgba(90,120,180,0.05)", marginBottom: 3, alignItems: "baseline" },
};
