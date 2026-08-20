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

const STATUS_STYLE: Record<StageStatus, { border: string; bg: string; fg: string; dashed?: boolean }> = {
  SOURCE:       { border: "rgba(120,150,220,0.45)", bg: "transparent",              fg: COLOR.textDim },
  REAL:         { border: COLOR_ROLE.green,        bg: "rgba(52,211,153,0.16)",     fg: COLOR.text },
  DERIVED_REAL: { border: COLOR_ROLE.green,        bg: "rgba(52,211,153,0.07)",     fg: COLOR.text, dashed: true },
  DEMO:         { border: "rgba(251,191,36,0.5)",  bg: "rgba(251,191,36,0.08)",     fg: COLOR.textDim },
  UNKNOWN:      { border: COLOR.border,            bg: "transparent",               fg: COLOR.textFaint },
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
  return (
    <div
      title={`${stage.label_he} — ${stage.basis}\n${STATUS_META[stage.status].note}`}
      style={{
        ...S.node,
        border: `${lit ? 2 : 1}px ${st.dashed ? "dashed" : "solid"} ${lit ? COLOR_ROLE.green : st.border}`,
        background: lit ? "rgba(52,211,153,0.2)" : st.bg,
      }}
    >
      <b style={{ ...S.count, color: stage.count === null ? COLOR.textFaint : st.fg,
                  fontSize: stage.count === null ? 9 : 15 }}>
        {stage.count === null ? "UNKNOWN" : stage.count}
      </b>
      <span style={S.label}>{stage.label}</span>
      <span style={{ ...S.status, color: stage.status === "REAL" ? COLOR_ROLE.green : COLOR.textFaint }}>
        {STATUS_META[stage.status].label}
      </span>
    </div>
  );
}

function Connector({ kind }: { kind: ConnectorKind }) {
  if (kind === "MODEL_BOUNDARY") {
    // Not a connector: a seam. The gap is the message.
    return (
      <span style={S.seam} title={CONNECTOR_META.MODEL_BOUNDARY.note} aria-label="model boundary">
        <span style={S.seamBar} />
        <span style={S.seamBar} />
      </span>
    );
  }
  if (kind === "RECORDED_REFERENCE") {
    return (
      <span style={S.conn} title={CONNECTOR_META.RECORDED_REFERENCE.note}>
        <span style={{ ...S.line, borderTop: `1.5px solid ${COLOR_ROLE.blue}` }} />
        <span style={S.head}>◄</span>
      </span>
    );
  }
  return (
    <span style={S.conn} title={CONNECTOR_META.CONCEPTUAL.note}>
      <span style={{ ...S.line, borderTop: `1px dashed ${COLOR.textFaint}` }} />
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
  wrap: { display: "flex", flexDirection: "column", gap: 6 },
  rail: { display: "flex", alignItems: "stretch", flexWrap: "wrap", rowGap: SPACE.sm },
  unit: { display: "flex", alignItems: "center" },

  node: {
    display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 1,
    padding: "5px 9px", borderRadius: RADIUS.sm, minWidth: 70,
  },
  count: { fontFamily: "ui-monospace, monospace", fontWeight: 700, lineHeight: 1.15, letterSpacing: 0.3 },
  label: { fontSize: FS.tag, fontWeight: 700, letterSpacing: 0.2, color: COLOR.textDim, whiteSpace: "nowrap" },
  status: { fontSize: FS.tag, fontWeight: 600, letterSpacing: 0.6 },

  conn: { display: "inline-flex", alignItems: "center", width: 18, position: "relative", justifyContent: "center" },
  line: { display: "block", width: "100%" },
  head: { position: "absolute", insetInlineStart: -1, fontSize: 8, color: COLOR_ROLE.blue, lineHeight: 1 },

  /* The seam reads as a break, deliberately unlike either connector. */
  seam: { display: "inline-flex", alignItems: "center", gap: 3, width: 20, justifyContent: "center" },
  seamBar: { display: "block", width: 2, height: 26, background: "rgba(251,191,36,0.55)", borderRadius: 1 },

  legend: { display: "flex", gap: SPACE.md, flexWrap: "wrap", fontSize: 10, color: COLOR.textDim, lineHeight: 1.5 },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  lineSample: { display: "inline-block", width: 20 },
  seamSample: { display: "inline-block", width: 6, height: 12, borderInline: "2px solid rgba(251,191,36,0.55)" },
};
