/**
 * SOCIAL FLOW RAIL — one continuous flow, not ten independent chips.
 *
 * The spine used to render as a row of identical bordered chips separated by
 * identical arrows. That shape asserted two false things at once: that all
 * ten stages are the same KIND of thing, and that each produces the next.
 * Neither is true, and the second is the exact error the whole epistemic
 * vocabulary exists to prevent.
 *
 * The rail draws the joints differently because the joints ARE different:
 *
 *   dashed, no arrowhead   CONCEPTUAL — reading order inside the value model.
 *                          An arrowhead would claim direction of production.
 *   a visible seam         MODEL_BOUNDARY — where the value model meets the
 *                          canon pipeline. Drawn as a break in the rail, not
 *                          a connector, because a Need is not produced by a
 *                          membership.
 *   solid, with arrowhead  RECORDED_REFERENCE — the only joint where a real
 *                          field on a real record points at the previous
 *                          stage.
 *
 * Status is carried by the node itself and never averaged along the rail:
 * SOURCE inventory is outlined and hollow because it is not instantiated;
 * REAL is filled; DERIVED is dashed-outlined because it is composed rather
 * than recorded; UNKNOWN shows the word, never a zero.
 *
 * Selecting a record lights the stage it instantiates — the same
 * `spineTouch` rule the frame already uses, so the rail and the lanes cannot
 * disagree.
 */
import {
  CONNECTOR_META, STATUS_META,
  type ConnectorKind, type FlowStage, type StageStatus,
} from "../social/socialFlowStages";
import { COLOR, COLOR_ROLE, FS, RADIUS, SPACE } from "./designTokens";

const STATUS_STYLE: Record<StageStatus, { dot: string; fg: string; dashed?: boolean }> = {
  SOURCE:       { dot: "rgba(120,150,220,0.7)", fg: COLOR.textDim },
  REAL:         { dot: COLOR_ROLE.green,        fg: COLOR.text },
  DERIVED_REAL: { dot: "rgba(52,211,153,0.55)", fg: COLOR.text, dashed: true },
  DEMO:         { dot: "rgba(251,191,36,0.8)",  fg: COLOR.textDim },
  UNKNOWN:      { dot: "transparent",           fg: COLOR.textFaint },
};

export default function SocialFlowRail({
  stages, litKey,
}: { stages: FlowStage[]; litKey?: string }) {
  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.rail}>
        {stages.map((st) => (
          <div key={st.key} style={S.unit}>
            {st.connector ? <Connector kind={st.connector} /> : null}
            <Node stage={st} lit={litKey === st.key} />
          </div>
        ))}
      </div>

      <div style={S.legend}>
        <LegendItem swatch={<span style={{ ...S.lineSample, borderTop: `1px dashed ${COLOR.textFaint}` }} />}
                    text={CONNECTOR_META.CONCEPTUAL.note} />
        <LegendItem swatch={<span style={S.seamSample} />} text={CONNECTOR_META.MODEL_BOUNDARY.note} />
        <LegendItem swatch={<span style={{ ...S.lineSample, borderTop: `1.5px solid ${COLOR_ROLE.blue}` }} />}
                    text={CONNECTOR_META.RECORDED_REFERENCE.note} />
      </div>
    </div>
  );
}

function Node({ stage, lit }: { stage: FlowStage; lit: boolean }) {
  const st = STATUS_STYLE[stage.status];
  const empty = stage.count === null;
  const notHere = stage.eligible !== undefined && stage.eligible !== stage.count;
  return (
    <div
      title={`${stage.label_he} — ${stage.basis}\n${STATUS_META[stage.status].note}`}
      style={{ ...S.node, opacity: notHere ? 0.7 : 1 }}
    >
      {/* COUNT above the track */}
      <b style={{
        ...S.count,
        color: empty ? COLOR.textFaint : lit ? COLOR_ROLE.green : st.fg,
        fontSize: empty ? FS.tag : 17,
      }}>
        {empty ? "—" : stage.count}
      </b>

      {/* The MARKER sits ON the track. Fill carries status; a ring marks the
          stage the selected record instantiates. Chips-in-a-row read as a
          list of things; a marker on a line reads as a position in a flow. */}
      <span style={{
        ...S.marker,
        background: empty ? "transparent" : lit ? COLOR_ROLE.green : st.dot,
        border: `${empty ? 1 : 0}px dashed ${COLOR.border}`,
        boxShadow: lit ? `0 0 0 3px rgba(52,211,153,0.28)` : undefined,
      }} />

      <span style={{ ...S.label, color: empty ? COLOR.textFaint : COLOR.textDim }}>{stage.label}</span>
      <span style={{ ...S.status, color: st.fg === COLOR.text ? COLOR_ROLE.green : COLOR.textFaint }}>
        {notHere ? `0 ${STATUS_META[stage.status].label}` : STATUS_META[stage.status].label}
      </span>
    </div>
  );
}

function Connector({ kind }: { kind: ConnectorKind }) {
  if (kind === "MODEL_BOUNDARY") {
    // A BREAK in the track, not a link across it. The gap is the message: a
    // Need is not produced by a membership, and no line should suggest it is.
    return (
      <span style={S.seam} title={CONNECTOR_META.MODEL_BOUNDARY.note} aria-label="model boundary">
        <span style={S.seamBar} />
        <span style={S.seamBar} />
      </span>
    );
  }
  const recorded = kind === "RECORDED_REFERENCE";
  return (
    <span style={S.conn} title={CONNECTOR_META[kind].note}>
      <span style={{
        ...S.track,
        // Solid where a real field points backwards; dashed where the order is
        // only a reading order. The arrowhead is withheld from CONCEPTUAL on
        // purpose — it would claim a direction of production that nothing has.
        borderTop: recorded ? `2px solid ${COLOR_ROLE.blue}` : `1px dashed rgba(120,150,220,0.4)`,
      }} />
      {recorded ? <span style={S.head}>◄</span> : null}
    </span>
  );
}

function LegendItem({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return (
    <span style={S.legendItem}>
      {swatch}
      <span>{text}</span>
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 },
  /* One row, baseline-aligned, so every marker sits on the same invisible
     line and the connectors between them read as one continuous track. */
  rail: { display: "flex", alignItems: "flex-start", flexWrap: "wrap", rowGap: 14 },
  unit: { display: "flex", alignItems: "flex-start" },

  node: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    minWidth: 74, padding: "0 4px",
  },
  count: { fontFamily: "ui-monospace, monospace", fontWeight: 700, lineHeight: 1, letterSpacing: 0.2 },
  marker: { width: 11, height: 11, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box" },
  label: { fontSize: FS.tag, fontWeight: 700, letterSpacing: 0.2, textAlign: "center", lineHeight: 1.25, whiteSpace: "nowrap" },
  status: { fontSize: FS.tag, fontWeight: 600, letterSpacing: 0.3, transform: "scale(0.9)" },

  /* Connectors align to the marker's vertical centre: count line (~17px) plus
     the gap, so the track meets the markers rather than floating above them. */
  conn: { display: "inline-flex", alignItems: "center", width: 22, position: "relative", justifyContent: "center", height: 11, marginTop: 20 },
  track: { display: "block", width: "100%" },
  head: { position: "absolute", insetInlineStart: -2, fontSize: 9, color: COLOR_ROLE.blue, lineHeight: 1 },

  seam: { display: "inline-flex", alignItems: "center", gap: 3, width: 22, justifyContent: "center", height: 11, marginTop: 20 },
  seamBar: { display: "block", width: 2, height: 16, background: "rgba(251,191,36,0.65)", borderRadius: 1 },

  notEligible: { fontSize: FS.tag, color: "#fbbf24", letterSpacing: 0.2, lineHeight: 1.3 },
  legend: { display: "flex", gap: SPACE.md, flexWrap: "wrap", fontSize: FS.base, color: COLOR.textFaint, lineHeight: 1.5 },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  lineSample: { display: "inline-block", width: 20 },
  seamSample: { display: "inline-block", width: 6, height: 12, borderInline: "2px solid rgba(251,191,36,0.65)" },
};
