/**
 * Human × Value Matrix (Visual Depth pass, item 13) — rows = the 7 real
 * temperament parameters (§24), columns = the DEMO Music Value-Domain
 * parameters (§22). Every cell is UNKNOWN except the one real relation
 * this product actually has, which is explicitly `hypothesis`-status
 * (`buildHypothesisHumanValueRelation`, §24) — never presented as fact.
 * No fabricated edges anywhere else in the grid.
 */
import { TEMPERAMENT_DIMENSIONS } from "@/app/lib/philos/humanConfig/temperamentDimensions";
import { DEMO_MUSIC_PARAMETERS } from "@/app/lib/philos/valueDomain/demoMusicDomain";
import { buildHypothesisHumanValueRelation } from "@/app/lib/philos/mission/demoMissionValues";

export default function HumanValueMatrix() {
  const relation = buildHypothesisHumanValueRelation();

  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.head}>Human × Value Matrix — {TEMPERAMENT_DIMENSIONS.length} Human parameter × {DEMO_MUSIC_PARAMETERS.length} Value-Domain parameter (DEMO Music)</div>
      <div style={S.scroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.thCorner} />
              {DEMO_MUSIC_PARAMETERS.map((p) => <th key={p.parameter_id} style={S.th}>{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {TEMPERAMENT_DIMENSIONS.map((h) => (
              <tr key={h.parameter_id}>
                <td style={S.tdLabel}>{h.label}</td>
                {DEMO_MUSIC_PARAMETERS.map((p) => {
                  const isRelated = relation.human_parameter_label === h.label && relation.parameter_id === p.parameter_id;
                  return (
                    <td key={p.parameter_id} style={S.td}>
                      {isRelated ? (
                        <span style={S.cellRelated} title={relation.statement}>{relation.type.toUpperCase()} (hypothesis)</span>
                      ) : (
                        <span style={S.cellUnknown}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {relation ? (
        <div style={S.detail}>
          <b>{relation.human_parameter_label}</b> ↔ <b>{DEMO_MUSIC_PARAMETERS.find((p) => p.parameter_id === relation.parameter_id)?.label}</b>: {relation.statement}
          <div style={S.evidence}>{relation.evidence}</div>
        </div>
      ) : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 12 },
  head: { fontSize: 11.5, fontWeight: 700, color: "#5aa6ff", marginBottom: 8 },
  scroll: { overflowX: "auto", border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8 },
  table: { borderCollapse: "collapse", width: "100%", fontSize: 10.5 },
  thCorner: { minWidth: 160, borderBottom: "1px solid rgba(90,120,180,0.2)" },
  th: { padding: "6px 8px", color: "#8fa3c9", fontWeight: 700, textAlign: "center", borderBottom: "1px solid rgba(90,120,180,0.2)", minWidth: 140 },
  tdLabel: { padding: "5px 8px", textAlign: "right", borderBottom: "1px solid rgba(90,120,180,0.08)", color: "#dbe6f6", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "5px 8px", textAlign: "center", borderBottom: "1px solid rgba(90,120,180,0.08)" },
  cellUnknown: { color: "#5a76a3" },
  cellRelated: { color: "#fbbf24", fontSize: 9.5, fontWeight: 700, cursor: "help" },
  detail: { fontSize: 10.5, color: "#8fa3c9", marginTop: 8, lineHeight: 1.7 },
  evidence: { fontSize: 9.5, color: "#5a76a3", marginTop: 2 },
};
