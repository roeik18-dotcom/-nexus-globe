/**
 * SYSTEM TRACE — AUDIT tier, Dynamics only.
 *
 * Shows the real record chain and, more importantly, where it is NOT a
 * chain. No causal arrow is drawn between two records that do not reference
 * each other: an unlinked edge renders as a break, not an arrow.
 */
import type { TraceEdge } from "../systemTrace";
import { traceSummary } from "../systemTrace";
import { COLOR, FS, RADIUS, SPACE, TYPE } from "./designTokens";

const LINK_TONE: Record<string, string> = {
  VERIFIED_REFERENCE_LINK: "#34d399",
  CHRONOLOGICAL_ONLY: "#8798b8",
  UNLINKED: "#fbbf24",
  NO_LINK_POSSIBLE: "#6c86b5",
};
const GLYPH: Record<string, string> = {
  VERIFIED_REFERENCE_LINK: "→", CHRONOLOGICAL_ONLY: "⋯", UNLINKED: "⊣", NO_LINK_POSSIBLE: "·",
};

export default function SystemTracePanel({ edges }: { edges: TraceEdge[] }) {
  const s = traceSummary(edges);
  return (
    <div dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>מסלול מערכת · SYSTEM TRACE — מהרשומות האמיתיות</span>
        <span style={S.counts}>
          <b style={{ color: "#34d399" }}>{s.linked}</b> LINKED ·{" "}
          <b style={{ color: "#fbbf24" }}>{s.unlinked}</b> UNLINKED ·{" "}
          <b style={{ color: "#a78bfa" }}>{s.open}</b> OPEN · {s.recorded}/{s.total} RECORDED
        </span>
      </div>

      {edges.map((e, i) => (
        <div key={i} style={S.row}>
          <span style={{ ...S.glyph, color: LINK_TONE[e.linkage] }}>{GLYPH[e.linkage]}</span>
          <span style={S.edge}>{e.from} <span style={{ color: COLOR.textFaint }}>→</span> {e.to}</span>
          <span style={{ ...TYPE.micro, fontSize: FS.tag, color: LINK_TONE[e.linkage] }}>{e.linkage}</span>
          <span style={{ ...TYPE.micro, fontSize: FS.tag, color: e.status === "IMPLEMENTED" ? "#6fe3b4" : e.status === "OPEN_BOUNDARY" ? "#a78bfa" : "#fbbf24" }}>
            {e.status}
          </span>
          {/* The actual record ids. Without them this is a diagram, not a
              trace — a reader cannot check any edge against the store. */}
          <span dir="ltr" style={S.ids}>
            {e.source_record ?? "—"} <span style={{ color: COLOR.textFaint }}>→</span> {e.target_record ?? "—"}
          </span>
          <span style={S.basis}>{e.basis}</span>
        </div>
      ))}

      <div style={S.note}>
        חץ מצויר רק כשקיימת הפניה מפורשת בין הרשומות. קשת ללא הפניה מוצגת כשבר (⊣), לא כחץ —
        קרונולוגיה אינה סיבתיות.
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(90,111,150,0.04)", border: `1px dashed ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px` },
  head: { display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  eyebrow: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.accent },
  counts: { fontSize: FS.tag, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace" },
  row: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 7, padding: "3px 8px", background: "rgba(90,120,180,0.04)", borderRadius: RADIUS.sm, marginBottom: 2 },
  glyph: { fontSize: 13, width: 12, textAlign: "center" },
  edge: { fontSize: 13, color: COLOR.text, minWidth: 230 },
  ids: { fontSize: FS.tag, color: COLOR.textDim, fontFamily: "ui-monospace, monospace", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  basis: { fontSize: FS.tag, color: COLOR.textFaint, flex: 1, minWidth: 200, lineHeight: 1.45 },
  note: { marginTop: 5, fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.5 },
};
