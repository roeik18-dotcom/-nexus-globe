"use client";
/**
 * GROUP TRAJECTORY — real time series, drawn as time series.
 *
 * These two sequences existed as text before: `MEMBERS 1:2026-07-20 → 2:…→ 6`
 * and `RESOURCES 12000→+6400→18400→−5000→13400`. That is a chart typed out as
 * a sentence. The reader has to hold six dates and five amounts in their head
 * to see the one thing the data says — the group grew steadily and then spent
 * a third of its balance.
 *
 * NEVER A DUAL AXIS. Members are people and resources are shekels; sharing one
 * y-axis would put an arbitrary ratio on screen and invite reading a crossing
 * as an event. Two stacked panels share ONE x axis instead, aligned to the
 * pixel, which is the comparison the reader actually wants: what happened to
 * money at the moment membership changed.
 *
 * Direction and magnitude are separate channels: slope carries direction, the
 * delta glyph on the last point carries the size of the most recent change.
 * Nothing here animates — the underlying state is historical and settled, and
 * ambient motion would imply live change.
 */
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import { TEMPORAL } from "@/app/lib/philos/shell/visualGrammar";

export interface TrajectoryPoint { date: string; value: number; label?: string }
export interface TrajectorySeries {
  key: string;
  title: string;
  unit: string;
  points: TrajectoryPoint[];
  /** Drawn as steps when the value only changes at recorded events. */
  step?: boolean;
}

/* TIME FLOWS RIGHT-TO-LEFT, matching `CausalChain` — PHILOS is an RTL product
   and two time directions in one product is a grammar violation, not a
   preference. Coordinates stay LTR (SVG `text-anchor` mirrors under RTL and
   drops labels on the wrong side); only the mapping from date to x is
   reversed. `PAD_LEAD` is the reading-start edge, on the right. */
const W = 640, PANEL_H = 96, PAD_LEAD = 96, PAD_TAIL = 58, AXIS_H = 22;

export default function GroupTrajectory({ series, title }: { series: TrajectorySeries[]; title: string }) {
  const live = series.filter((s) => s.points.length > 0);
  if (live.length === 0) {
    return (
      <div style={{ padding: SPACE.md, background: COLOR.bgCard, border: `1px dashed ${COLOR.border}`,
        borderRadius: RADIUS.md, fontSize: FS.base, color: COLOR.textDim }}>
        אין סדרת זמן — לא נרשם אף אירוע עם חותמת זמן לקבוצה הזאת.
      </div>
    );
  }

  // ONE shared time domain across every panel — that is what makes the
  // panels comparable at all.
  const times = live.flatMap((s) => s.points.map((p) => Date.parse(p.date))).filter((t) => !Number.isNaN(t));
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const span = t1 - t0 || 1;
  const x = (d: string) => W - PAD_LEAD - ((Date.parse(d) - t0) / span) * (W - PAD_LEAD - PAD_TAIL);

  const H = live.length * PANEL_H + AXIS_H;
  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate()}.${dt.getMonth() + 1}`;
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "baseline", marginBottom: SPACE.sm }}>
        <span style={{ fontSize: FS.section, color: COLOR.text }}>{title}</span>
        <span style={{ fontSize: FS.meta, color: COLOR.textFaint }}>
          {live.length} סדרות · ציר זמן משותף · {TEMPORAL.never.startsWith("dual") ? "ללא ציר כפול" : ""}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group"
          aria-label={`${title} — ${live.map((s) => `${s.title} ב${s.unit}`).join(", ")} על ציר זמן משותף`}
          style={{ direction: "ltr", display: "block", minWidth: 460,
            background: COLOR.bg, borderRadius: RADIUS.md, border: `0.5px solid ${COLOR.border}` }}>
          {live.map((s, i) => {
            const top = i * PANEL_H;
            const vals = s.points.map((p) => p.value);
            // Each series keeps its OWN y scale, inside its own panel. No
            // shared magnitude claim between people and shekels.
            const lo = Math.min(0, ...vals), hi = Math.max(...vals, lo + 1);
            const y = (v: number) => top + PANEL_H - 26 - ((v - lo) / (hi - lo || 1)) * (PANEL_H - 44);
            const pts = s.points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
            const d = s.step
              ? pts.map((p, j) => (j === 0 ? `M ${p.cx} ${p.cy}` : `L ${p.cx} ${pts[j - 1].cy} L ${p.cx} ${p.cy}`)).join(" ")
              : pts.map((p, j) => `${j === 0 ? "M" : "L"} ${p.cx} ${p.cy}`).join(" ");
            const last = pts[pts.length - 1];
            const prev = pts.length > 1 ? pts[pts.length - 2] : null;
            const delta = prev ? last.value - prev.value : 0;

            return (
              <g key={s.key}>
                {/* Panel separator: a hairline, not a card border. */}
                {i > 0 ? <line x1={0} y1={top} x2={W} y2={top} stroke={COLOR.border} strokeWidth={0.5} /> : null}
                {/* Series identity sits at the reading start — the right. */}
                <text x={W - 6} y={top + 16} textAnchor="end" fontSize={12} fill={COLOR.textDim}>{s.title}</text>
                <text x={W - 6} y={top + 30} textAnchor="end" fontSize={12} fill={COLOR.textFaint}>{s.unit}</text>
                {/* Baseline only. No vertical gridlines on a time axis. */}
                <line x1={PAD_TAIL} y1={y(lo)} x2={W - PAD_LEAD} y2={y(lo)} stroke="rgba(120,150,220,0.18)" strokeWidth={0.5} />
                <path d={d} fill="none" stroke="#3183d4" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {/* Area fill at ~10%, the corpus's single-series treatment. */}
                <path d={`${d} L ${last.cx} ${y(lo)} L ${pts[0].cx} ${y(lo)} Z`} fill="rgba(49,131,212,0.10)" stroke="none" />
                {pts.map((p) => (
                  <circle key={p.date + p.value} cx={p.cx} cy={p.cy} r={3} fill="#3183d4" />
                ))}
                {/* Emphasised endpoint: ≥8px, 2px surface ring. */}
                <circle cx={last.cx} cy={last.cy} r={4.5} fill="#3183d4" stroke={COLOR.bg} strokeWidth={2} />
                {/* The latest value sits beside the most recent point, which
                    under RTL time is at the LEFT end. `text-anchor="end"` there
                    would extend the label past x=0 and clip it — the corpus
                    names this exact failure. So the anchor flips to whichever
                    side has room, computed from the point's own x. */}
                {(() => {
                  const wide = String(last.value.toLocaleString()).length * 7 + 12;
                  const toLeft = last.cx - wide > 4;
                  const lx = toLeft ? last.cx - 8 : last.cx + 8;
                  const anchor = toLeft ? "end" : "start";
                  return (
                    <>
                      <text x={lx} y={last.cy - 7} textAnchor={anchor} fontSize={12} fill={COLOR.text}
                        style={{ fontVariantNumeric: "tabular-nums" }}>{last.value.toLocaleString()}</text>
                      {delta !== 0 ? (
                        <text x={lx} y={last.cy + 9} textAnchor={anchor} fontSize={12}
                          fill={delta > 0 ? "#4ade80" : "#f0b45c"} style={{ fontVariantNumeric: "tabular-nums" }}>
                          {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString()}
                        </text>
                      ) : null}
                    </>
                  );
                })()}
              </g>
            );
          })}
          {/* THE SHARED AXIS — drawn once, under every panel. */}
          <line x1={PAD_TAIL} y1={H - AXIS_H} x2={W - PAD_LEAD} y2={H - AXIS_H} stroke="rgba(120,150,220,0.28)" strokeWidth={0.5} />
          {[t0, t0 + span / 2, t1].map((t, i) => (
            <text key={i} x={W - PAD_LEAD - ((t - t0) / span) * (W - PAD_LEAD - PAD_TAIL)} y={H - 6}
              textAnchor={i === 0 ? "end" : i === 2 ? "start" : "middle"} fontSize={12} fill={COLOR.textFaint}>
              {fmt(new Date(t).toISOString())}
            </text>
          ))}
          {/* Say which way time runs. An unlabelled reversed axis is a trap. */}
          <text x={W - 6} y={H - 6} textAnchor="end" fontSize={12} fill={COLOR.textFaint}>מוקדם ←</text>
        </svg>
      </div>
    </div>
  );
}
