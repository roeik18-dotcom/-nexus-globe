/**
 * SYSTEM GATE — why the wider system reads 0.
 *
 * A table can state that Need EXISTS 1 and is SYSTEM-ELIGIBLE 0. It cannot
 * show that the two columns are the same records meeting a barrier, which is
 * the only thing a reader actually needs to understand here. "0 observed at
 * system scale" is not an absence of data — the records exist, they are real,
 * and they stop at a gate. Drawn, that is one glance: a populated left side,
 * a barrier, an empty right side.
 *
 * Every line that reaches the gate and stops is a record that exists and is
 * not eligible. A line that passed would continue through and land on the
 * right. Today none do, and the drawing says so by being empty on that side
 * rather than by printing a zero.
 *
 * TRUTH RULES. A stage with no system verdict at all is UNKNOWN, not blocked:
 * it is drawn with a dashed lead that stops SHORT of the gate, because
 * claiming it was tested and rejected would be inventing a verdict. Counts
 * are passed in from the shared flow; nothing is derived here.
 */
import { COLOR, COLOR_ROLE, FS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

export interface GateRow {
  label: string;
  /** EXISTS_IN_SOCIAL_MODEL */
  exists: number | null;
  /** ELIGIBLE_AT_SYSTEM. `undefined` or `null` = no gate defined for this
   *  stage, which is UNKNOWN — not a verdict of 0. */
  eligible: number | null | undefined;
}

const W = 720;
const ROW_H = 26;
const TOP = 54;
const X_LABEL = 150;
const X_START = 162;
const X_GATE = 392;
const X_OUT = 560;

export default function SystemGateVisual({ rows, observed, because }: {
  rows: GateRow[];
  /** The authoritative count of records present at SYSTEM scale. */
  observed: number;
  /** The gate's own reason, from the flow builder. Never written here. */
  because: string;
}) {
  const H = TOP + rows.length * ROW_H + 46;
  const gateTop = TOP - 18;
  const gateBottom = TOP + rows.length * ROW_H - 4;
  const midY = (gateTop + gateBottom) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label={`קיים במודל החברתי מול זכאות מערכתית — ${observed} רשומות עוברות`}
         /* `direction: ltr` is load-bearing. These drawings render inside a
            dir="rtl" page, where SVG resolves text-anchor LOGICALLY: "end"
            became the right edge and every label mirrored on top of the node
            it was labelling. The coordinate system is geometry, not prose —
            it is pinned LTR, and the Hebrew strings inside still shape
            correctly because bidi resolves per text run. */
         style={{ display: "block", maxWidth: W, margin: "0 auto", overflow: "visible", direction: "ltr" }}>
      {/* column headings */}
      <text x={X_LABEL} y={26} textAnchor="end" style={{ ...TYPE.micro, fontSize: FS.tag, fill: COLOR.textFaint, letterSpacing: 1.3 }}>
        SOCIAL EXISTS
      </text>
      <text x={X_OUT} y={26} textAnchor="start" style={{ ...TYPE.micro, fontSize: FS.tag, fill: COLOR.textFaint, letterSpacing: 1.3 }}>
        SYSTEM ELIGIBLE
      </text>

      {rows.map((r, i) => {
        const y = TOP + i * ROW_H;
        const blocked = r.eligible === 0;
        // (`passed`/`blocked` are evaluated against a real verdict only.)
        const passed = (r.eligible ?? 0) > 0;
        const unknown = r.eligible === undefined || r.eligible === null;
        // UNKNOWN stops short of the gate: it was never tested, so drawing it
        // arriving at the barrier would claim a verdict that does not exist.
        // The UNKNOWN word needs room: at 1440 it was touching the gate line.
        const x2 = unknown ? X_GATE - 86 : X_GATE - 8;
        return (
          <g key={r.label}>
            <text x={X_LABEL} y={y + 4} textAnchor="end" style={{ fontSize: FS.meta, fill: COLOR.textDim }}>
              {r.label}
            </text>
            <circle cx={X_START + 10} cy={y} r={9}
                    fill={r.exists ? "rgba(52,211,153,0.18)" : "none"}
                    stroke={r.exists ? COLOR_ROLE.green : COLOR.textFaint} strokeWidth={1.4} />
            <text x={X_START + 10} y={y + 4} textAnchor="middle"
                  style={{ fontSize: FS.meta, fontWeight: 700, fill: r.exists ? COLOR.text : COLOR.textFaint }}>
              {r.exists ?? "—"}
            </text>

            <line x1={X_START + 22} y1={y} x2={x2} y2={y}
                  stroke={unknown ? COLOR.textFaint : passed ? COLOR_ROLE.green : COLOR_ROLE.green}
                  strokeWidth={1.2}
                  strokeDasharray={unknown ? "3 4" : undefined}
                  opacity={unknown ? 0.5 : 0.75} />

            {blocked ? (
              // a stop, not an arrowhead: the record arrived and did not pass
              <line x1={X_GATE - 8} y1={y - 5} x2={X_GATE - 8} y2={y + 5}
                    stroke={COLOR_ROLE.red} strokeWidth={2} />
            ) : null}

            {passed ? (
              <line x1={X_GATE + 8} y1={y} x2={X_OUT - 6} y2={y} stroke={COLOR_ROLE.green} strokeWidth={1.4} />
            ) : null}

            {unknown ? (
              <text x={x2 + 8} y={y + 4} style={{ ...TYPE.micro, fontSize: FS.tag, fill: COLOR.textFaint }}>
                UNKNOWN
              </text>
            ) : null}
          </g>
        );
      })}

      {/* THE GATE */}
      <line x1={X_GATE} y1={gateTop} x2={X_GATE} y2={gateBottom} stroke={COLOR_ROLE.white} strokeWidth={2} opacity={0.55} />
      <text x={X_GATE} y={gateTop - 8} textAnchor="middle"
            style={{ ...TYPE.micro, fontSize: FS.tag, fill: COLOR.textDim, letterSpacing: 1.4 }}>
        GATE
      </text>
      <text x={X_GATE + 8} y={gateBottom + 18} textAnchor="middle"
            style={{ fontSize: FS.tag, fill: COLOR.textFaint }}>
        {because}
      </text>

      {/* THE RESULT — an empty right side, with the figure the whole terminal
          exists to report. */}
      <text x={X_OUT + 46} y={midY + 4} textAnchor="middle"
            /* 26px, not 44. This figure is the answer to SYSTEM's question and
               should dominate its own drawing — but it was the largest text on
               the entire page, so the screen's primary anchor was a bare zero
               rather than the terminal's name. It yields to the title. */
            style={{ fontSize: 26, fontWeight: 700, fill: observed > 0 ? STATUS.real.text : COLOR.textFaint }}>
        {observed}
      </text>
      <text x={X_OUT + 46} y={midY + 24} textAnchor="middle"
            style={{ ...TYPE.micro, fontSize: FS.tag, fill: COLOR.textFaint, letterSpacing: 1.2 }}>
        OBSERVED SYSTEM
      </text>
    </svg>
  );
}
