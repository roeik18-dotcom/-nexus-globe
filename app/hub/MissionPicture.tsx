/**
 * Mission / Orientation Picture — Hub = NOW. Composed from
 * `MissionOrientation`, itself composed entirely from data this page
 * already computed (`core`/`tensions`/`lifecycle`/`bridgeRegistry`/
 * `carryForward`) — no new fact, no destiny/motivational prose, no
 * opaque score. A real subject with no Value Domain attached and no
 * behavioral/relational data anywhere in canon shows exactly that,
 * honestly, rather than a fabricated-looking "complete" profile.
 */
import type { MissionOrientation } from "@/app/lib/philos/mission/missionOrientation";

export default function MissionPicture({ mission }: { mission: MissionOrientation }) {
  const knownDims = [mission.available_energy, mission.available_time, mission.available_capital, mission.uncertainty, mission.confidence, mission.learning]
    .filter((d) => d.status !== "unknown").length;
  const totalCore = 6;

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <h3 style={S.title}>Mission / Orientation Picture — {mission.subject}</h3>
        <span style={{ ...S.badge, color: mission.provenance === "DEMO" ? "#fbbf24" : "#34d399" }}>{mission.provenance}</span>
      </div>
      <div style={S.note}>תמונת אוריינטציה נוכחית, לא ניבוי ייעוד — מחושבת מחדש מהמצב האמיתי, לא משפט קבוע.</div>

      {/* MISSION FUNNEL — one primary visual per this task's own "hard
          visual rules": PERSON→NEED→VALUE→CAPABILITY→CONSTRAINT→
          CONTRIBUTION→RECIPIENT→ACTION→EXPECTED→OBSERVED→REALIZED. Each
          stage's real count/known-state is shown; a stage with nothing
          real behind it renders "לא ידוע" rather than being hidden — the
          break in the chain IS the information. */}
      <div style={S.funnel}>
        <FunnelStage label="PERSON" value={mission.subject} />
        <FunnelStage label="NEED/TENSION" value={mission.needs.length + mission.tensions.length > 0 ? `${mission.needs.length + mission.tensions.length} פתוח` : "לא ידוע"} />
        <FunnelStage label="VALUE" value={mission.values.length > 0 ? `${mission.values.length} מופעל` : "לא ידוע"} />
        <FunnelStage label="CAPABILITY" value={mission.capabilities.length > 0 ? `${mission.capabilities.length} פרמטר` : "לא ידוע"} />
        <FunnelStage label="CONSTRAINT" value={mission.constraints[0]?.status !== "unknown" ? `${mission.constraints.length}` : "לא ידוע"} />
        <FunnelStage label="CONTRIBUTION" value={mission.possible_contributions[0]?.status !== "unknown" ? "ידוע" : "לא ידוע"} />
        <FunnelStage label="RECIPIENT" value={mission.recipients[0]?.status !== "unknown" ? "ידוע" : "לא ידוע"} />
        <FunnelStage label="ACTION" value={mission.candidate_actions.length > 0 ? `${mission.candidate_actions.length}` : "לא ידוע"} />
        <FunnelStage label="EXPECTED EFFECT" value={mission.values.some((v) => v.expected_effect.status !== "unknown") ? "ידוע" : "לא ידוע"} />
        <FunnelStage label="OBSERVED EFFECT" value={mission.values.some((v) => v.observed_effect.status !== "unknown") ? "ידוע" : "לא ידוע"} />
        <FunnelStage label="VALUE REALIZED" value={mission.values.some((v) => v.value_created.status !== "unknown") ? "ידוע" : "לא ידוע"} last />
      </div>

      <div style={S.row}><span>מצב ידוע</span><span style={S.meta}>{knownDims}/{totalCore} ממדי-על ידועים</span></div>
      <div style={S.row}><span>Tension פתוח</span><span style={S.meta}>{mission.tensions.length}</span></div>
      <div style={S.row}><span>Need פתוח</span><span style={S.meta}>{mission.needs.length}</span></div>
      <div style={S.row}><span>Value מופעל (Operational)</span><span style={S.meta}>{mission.values.length === 0 ? "לא ידוע — אין Value Domain מחובר" : mission.values.length}</span></div>
      <div style={S.row}><span>קישור קולקטיבי אמיתי</span><span style={S.meta}>{mission.community_context.length}</span></div>
      <div style={S.row}><span>Capability/Gap ידוע</span><span style={S.meta}>{mission.capabilities.length === 0 ? "לא ידוע" : `${mission.capabilities.length} פרמטר`}</span></div>

      {mission.values.map((v) => (
        <div key={v.value_id} style={S.valuePath}>
          <div style={S.valueTitle}>{v.label}</div>
          <div style={S.chainRow}>
            <Chain label="למה חשוב" d={v.why_it_matters} />
            <Chain label="ביטוי נוכחי" d={v.current_expression} />
            <Chain label="מגביל" d={v.opposing_condition} />
            <Chain label="Need" d={v.need} />
            <Chain label="Capability זמין" d={v.available_capability} />
            <Chain label="Capability חסר" d={v.missing_capability} />
            <Chain label="נמען אפשרי" d={v.possible_recipient} />
            <Chain label="תרומה אפשרית" d={v.possible_contribution} />
            <Chain label="Action" d={v.action} />
            <Chain label="Effect צפוי" d={v.expected_effect} />
            <Chain label="Effect נצפה" d={v.observed_effect} />
            <Chain label="ערך שנוצר" d={v.value_created} />
            <Chain label="עדות" d={v.evidence} />
            <Chain label="הפעולה הבאה" d={v.next_action} />
          </div>
        </div>
      ))}

      <div style={S.note}>
        {mission.skills[0]?.status === "unknown" && mission.relationships[0]?.status === "unknown" ? (
          "skills / interests / motivations / relationships / boundaries / resources: לא ידוע — אין מקור אמיתי עבור ממדים אלה עבור subject זה."
        ) : null}
      </div>
    </section>
  );
}

function FunnelStage({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const known = value !== "לא ידוע";
  return (
    <div style={S.funnelStage}>
      <div style={{ ...S.funnelDot, background: known ? "#34d399" : "#5a76a3" }} />
      <div style={S.funnelLabel}>{label}</div>
      <div style={{ ...S.funnelValue, color: known ? "#dbe6f6" : "#5a76a3" }}>{value}</div>
      {!last ? <div style={S.funnelArrow}>↓</div> : null}
    </div>
  );
}

function Chain<T>({ label, d }: { label: string; d: { value: T | null; status: string } }) {
  return (
    <div style={S.chainCell}>
      <div style={S.chainLabel}>{label}</div>
      <div style={{ ...S.chainValue, color: d.status === "unknown" ? "#5a76a3" : "#dbe6f6" }}>
        {d.value === null ? "לא ידוע" : String(d.value)}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  title: { fontSize: 13.5, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  badge: { fontSize: 10, fontWeight: 800, fontFamily: "ui-monospace, monospace" },
  note: { fontSize: 10.5, color: "#8fa3c9", lineHeight: 1.7, marginTop: 6, marginBottom: 8 },

  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 11.5, marginBottom: 3 },

  funnel: { display: "flex", flexDirection: "column", alignItems: "center", gap: 0, margin: "10px 0 14px" },
  funnelStage: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 320 },
  funnelDot: { width: 8, height: 8, borderRadius: 4 },
  funnelLabel: { fontSize: 9, color: "#5a76a3", marginTop: 2, letterSpacing: 0.5 },
  funnelValue: { fontSize: 11, fontWeight: 600, marginTop: 1 },
  funnelArrow: { fontSize: 11, color: "#5a76a3", margin: "2px 0" },
  meta: { color: "#8aa0c8" },

  valuePath: { marginTop: 10, border: "1px solid rgba(251,191,36,0.25)", borderRadius: 10, padding: "8px 10px" },
  valueTitle: { fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 6 },
  chainRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chainCell: { minWidth: 100, flex: "1 1 100px" },
  chainLabel: { fontSize: 8.5, color: "#5a76a3" },
  chainValue: { fontSize: 10.5, marginTop: 1, lineHeight: 1.4 },
};
