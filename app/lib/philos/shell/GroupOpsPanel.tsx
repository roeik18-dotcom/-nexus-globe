/**
 * GroupOpsPanel — the shared "operational group" projection for Brain
 * (reasoning variant) and Dynamics (trajectory variant), both fed by the
 * ONE `buildOperationalGroupProfile` assembler — no terminal-local group
 * derivation.
 *
 *   variant="reasoning"   Brain: what changed / why / evidence /
 *                         contradictions / unknown / next action — every
 *                         line from a real record or an explicit UNKNOWN.
 *   variant="trajectory"  Dynamics: members / resources / needs / actions /
 *                         effects / learning / trend OVER TIME — the real
 *                         membership + capital timelines, honest counts.
 */
import { buildOperationalGroupProfile } from "@/app/lib/philos/valueSystem/operationalGroup";
import { ProvenanceBadge } from "./provenance";
import { COLOR, RADIUS, SPACE, TYPE } from "./designTokens";

export default async function GroupOpsPanel({ variant }: { variant: "reasoning" | "trajectory" }) {
  const p = await buildOperationalGroupProfile().catch(() => null);
  if (!p) {
    return (
      <section dir="rtl" style={S.band}>
        <div style={S.head}><span style={S.eyebrow}>קבוצה תפעולית</span><ProvenanceBadge p="UNKNOWN" /></div>
        <div style={S.empty}>אין קבוצת ערך רשומה ביומן</div>
      </section>
    );
  }

  if (variant === "reasoning") {
    const lastAction = p.linked_actions[0] ?? null;
    const claimedOnly = p.linked_actions.flatMap((a) => a.effects.filter((e) => !e.verified));
    return (
      <section dir="rtl" style={S.band}>
        <div style={S.head}>
          <span style={S.eyebrow}>הסבר קבוצה · GROUP REASONING — {p.name}</span>
          <ProvenanceBadge p="REAL" />
        </div>
        <Row k="WHAT CHANGED" v={lastAction
          ? `Action מקושר ${lastAction.action.action.action_id.slice(0, 14)}… (${lastAction.action.action.type}) · ${lastAction.verification_state}`
          : p.capital_flow.length > 0
            ? `תנועת הון אחרונה: ${p.capital_flow[p.capital_flow.length - 1].delta} → ${p.capital_flow[p.capital_flow.length - 1].balance}`
            : "לא נצפה שינוי קבוצתי"} />
        <Row k="WHY" v={p.evidence_statements[0] ? `תוצאה מאומתת: ${p.evidence_statements[0]}` : "אין סיבה מאומתת — UNKNOWN"} />
        <Row k="EVIDENCE" v={p.evidence_statements.length > 0 ? `${p.evidence_statements.length} ראיות מאומתות` : "אין ראיה מאומתת"} />
        <Row k="CONTRADICTIONS" v={p.tensions.length > 0 ? p.tensions.map((t) => t.label).join(" · ") : "אין Tension פתוח"} />
        <Row k="UNKNOWN" v={`supporters: UNKNOWN · capabilities: UNKNOWN · learning: ${p.learnings.length === 0 ? "אין" : p.learnings.length}${claimedOnly.length > 0 ? ` · ${claimedOnly.length} Effect claimed בלבד` : ""}`} />
        <Row k="NEXT ACTION" v={claimedOnly.length > 0
          ? `אמת Effect claimed (${claimedOnly[0].effect.effect.effect_id.slice(0, 14)}…)`
          : p.member_needs.length > 0
            ? `טפל ב-Need פתוח: ${p.member_needs[0].need.desired_change.slice(0, 40)}…`
            : "אין פעולה קבוצתית נגזרת — UNKNOWN"} />
      </section>
    );
  }

  // trajectory
  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>מסלול קבוצה · GROUP TRAJECTORY — {p.name}</span>
        <ProvenanceBadge p="REAL" />
      </div>
      <Row k="MEMBERS לאורך זמן" v={p.membership_over_time.length > 0
        ? p.membership_over_time.map((m) => `${m.date}: ${m.count}`).join(" → ")
        : "אין אירועי הצטרפות"} />
      <Row k="RESOURCES (הון)" v={p.capital_flow.length > 0
        ? p.capital_flow.map((c) => `${c.date}: ${c.delta >= 0 ? "+" : ""}${c.delta}→${c.balance}`).join(" → ")
        : "אין תנועה כספית"} />
      <Row k="NEEDS" v={`${p.member_needs.length} של חברים מקושרים (אין שדה group ב-Need)`} />
      <Row k="ACTIONS" v={`${p.linked_actions.length} מקושרות (bridge) · ${p.view.transfers.length} transfers`} />
      <Row k="EFFECTS" v={`${p.effect_claims} claims · ${p.verified_effects} מאומתים`} />
      <Row k="LEARNING" v={p.learnings.length > 0 ? `${p.learnings.length} (${p.learnings.map((l) => l.kind).join(", ")})` : "טרם נרשמה מסקנה"} />
      <Row k="TREND" v={p.trend} />
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={S.row}>
      <span style={{ ...TYPE.micro, color: "#8fa3c9", minWidth: 130, flexShrink: 0 }}>{k}</span>
      <span style={{ flex: 1, fontSize: 13, color: COLOR.text, lineHeight: 1.5 }}>{v}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(52,211,153,0.05), rgba(11,15,26,0.85))",
    border: "1px solid rgba(52,211,153,0.3)",
    borderRadius: 16,
    padding: `${SPACE.md}px ${SPACE.lg}px`,
    margin: `${SPACE.md}px 0`,
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  eyebrow: { ...TYPE.micro, color: "#34d399" },
  row: { display: "flex", gap: 8, padding: "4px 8px", borderRadius: RADIUS.sm, background: "rgba(90,120,180,0.05)", marginBottom: 3, alignItems: "baseline" },
  empty: { fontSize: 13, fontStyle: "italic", color: "#8798b8" },
};
