/**
 * Temperament Dimensions matrix (renamed from "Human Dimension Matrix" —
 * ledger §31: that name falsely implied this 7-row table represented the
 * whole person. It covers exactly ONE real Heading ("ממדי מזג —
 * פרמטרים לאבחון") out of 119 real Headings / 947 real canonical
 * concepts in the actual Human Config — see the full Section→Heading→
 * Parameter browser on `/hub/human-config` for the rest.) Dense table
 * over the SAME 7 real temperament parameters `ValueDomainDemoPanel.tsx`
 * and `/hub/human-config`'s temperament section already render
 * (`buildUnknownTemperamentReadings`) — no second parameter list.
 *
 * Every cell is honestly UNKNOWN (no Observation ties to any of these
 * Canonical_IDs for any subject yet) — rendered as an explicit "—" glyph
 * with its own muted color, never a blank cell and never a fabricated 0.
 */
import { buildUnknownTemperamentReadings } from "@/app/lib/philos/humanConfig/temperamentDimensions";

const COLUMNS = ["CURRENT", "BASELINE", "Δ", "DIRECTION", "STABILITY", "CONTRADICTION", "CONFIDENCE", "EVIDENCE #", "OPEN Q", "LAST UPDATE"];

export default function HumanDimensionMatrix() {
  const readings = buildUnknownTemperamentReadings();
  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.head}>Temperament Dimensions — {readings.length} פרמטרים אמיתיים × {COLUMNS.length} עמודות (Heading אחד מתוך 119 — לא כל האדם, ראה מדפדפן המלא למטה)</div>
      <div style={S.scroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.thLabel}>Parameter</th>
              {COLUMNS.map((c) => <th key={c} style={S.th}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.range.parameter_id}>
                <td style={S.tdLabel}>
                  <div>{r.range.label}</div>
                  <div style={S.tdSub}>{r.range.low} ↔ {r.range.high} · {r.range.canonical_id}</div>
                </td>
                {COLUMNS.map((c) => (
                  <td key={c} style={S.td}>
                    <span style={S.unknown}>—</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={S.note}>כל תא לא ידוע — אין Observation אמיתי הקושר אף subject לאף Canonical_ID כאן. לא 0, לא מחוק — מוצג במפורש.</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 10 },
  head: { fontSize: 11.5, fontWeight: 700, color: "#5aa6ff", marginBottom: 8 },
  scroll: { overflowX: "auto", border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8 },
  table: { borderCollapse: "collapse", width: "100%", fontSize: 10.5 },
  th: { padding: "6px 8px", color: "#8fa3c9", fontWeight: 700, textAlign: "center", borderBottom: "1px solid rgba(90,120,180,0.2)", whiteSpace: "nowrap" },
  thLabel: { padding: "6px 8px", color: "#8fa3c9", fontWeight: 700, textAlign: "right", borderBottom: "1px solid rgba(90,120,180,0.2)", minWidth: 180 },
  td: { padding: "5px 8px", textAlign: "center", borderBottom: "1px solid rgba(90,120,180,0.08)" },
  tdLabel: { padding: "5px 8px", textAlign: "right", borderBottom: "1px solid rgba(90,120,180,0.08)", color: "#dbe6f6", fontWeight: 600 },
  tdSub: { fontSize: 9, color: "#5a76a3", fontWeight: 400, marginTop: 1 },
  unknown: { color: "#5a76a3" },
  note: { fontSize: 9.5, color: "#5a76a3", marginTop: 6, lineHeight: 1.6 },
};
