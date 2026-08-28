"use client";
/**
 * WORLD NOW — the Living World surface.
 *
 * `/world` was a stack of reference panels with the one real thing PHILOS
 * knows about the wider system buried under five audit drawers: a verified
 * effect reading "10 קשישים קיבלו ליווי שבועי קבוע; 8 מהם דיווחו על שיפור".
 * That is a real system-scale outcome and it was invisible.
 *
 * This leads with the pipeline the terminal exists to show, and marks every
 * segment with what PHILOS actually holds:
 *
 *   EXTERNAL WORLD → EVENT → EVIDENCE → RELEVANCE →  ← nothing recorded
 *   VALUE/GROUP → NEED → ACTION → EFFECT → EVIDENCE  ← real, n=1
 *   → TENSION → LEARNING                             ← no producer
 *
 * The dark half is not an empty state; it is the finding. A world terminal
 * whose external half is unlit is telling the truth about a product that has
 * never ingested an external event, and it says why in the same breath.
 *
 * COLOUR IS OPERATIONAL HERE, not decorative:
 *   ⚪ reference / external — described, not observed
 *   🟣 PHILOS interpretation — the system's own reading
 *   🟢 verified — an outcome someone checked
 *   🔴 tension / unresolved — and when none is recorded, the slot stays dark
 *      rather than borrowing red for emphasis
 */
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";

/**
 * TWO INDEPENDENT DIMENSIONS, and conflating them was the defect this pass
 * corrects. A record's TRUTH SCOPE is what it is verified as; its CONNECTION
 * STATE is whether it reaches the external world. A verified group effect is
 * green at GROUP scope and still unconnected to any World event — green must
 * never be read as World qualification.
 */
export type TruthScope = "VERIFIED_GROUP" | "REAL_GROUP" | "INTERPRETED" | "REFERENCE" | "NONE";
export type ConnectionState = "CONNECTED" | "AVAILABLE_UPSTREAM" | "UNCONNECTED" | "MISSING";

const SCOPE_STYLE: Record<TruthScope, { stroke: string; fill: string; dash?: string }> = {
  VERIFIED_GROUP: { stroke: "#34d399", fill: "rgba(52,211,153,0.14)" },
  REAL_GROUP:     { stroke: "#34d399", fill: "rgba(52,211,153,0.06)" },
  INTERPRETED:    { stroke: "#a78bfa", fill: "rgba(167,139,250,0.10)", dash: "5 3" },
  REFERENCE:      { stroke: "#e6edf7", fill: "rgba(230,237,247,0.05)", dash: "2 3" },
  NONE:           { stroke: "#3a4a68", fill: "transparent", dash: "1 4" },
};

/** The connection tag is drawn SEPARATELY from the scope colour, so a green
 *  box can and does read "זמין במעלה — לא מחובר". */
const CONNECTION_TAG: Record<ConnectionState, { text: string; color: string }> = {
  CONNECTED:          { text: "מחובר",            color: "#34d399" },
  AVAILABLE_UPSTREAM: { text: "זמין במעלה",       color: "#a78bfa" },
  UNCONNECTED:        { text: "לא מחובר",         color: "#e6edf7" },
  MISSING:            { text: "לא קיים",          color: "#3a4a68" },
};

export interface WorldStage {
  key: string;
  label: string;
  term: string;
  /** What this stage is verified as, at ITS OWN scale. */
  scope: TruthScope;
  /** Whether it reaches the external world. Independent of `scope`. */
  connection: ConnectionState;
  value?: string;
  because?: string;
}

export interface WorldNowProps {
  /* OPTIONAL. The pipeline strip drawn from these stages is the SAME chain
     `EntityChainFlow` now renders on all three terminals, in the same order
     and the same colors. Two drawings of one chain, 200px apart on one route,
     is the duplication this pass exists to end — so `/world` no longer passes
     stages, and this SVG renders only where nothing else draws the chain. */
  stages?: WorldStage[];
  /** A REAL GROUP effect. Deliberately NOT called world evidence or system
   *  impact — it has not passed the external gate and the label must say so. */
  groupEffect: { statement: string; group: string; family: string; verified: number } | null;
  observedWorldEvents: number;
  systemQualified: number;
  upstreamReal: number;
  systemZeroReason: string | null;
  counts: { real: number; derived: number; demo: number; reference: number };
  rejections: { reason: string; n: number }[];
  externalEvidence: number;
  evidenceRecords: number;
}

/* Sized to the stage count, not to a guess. Ten stages at 118px overflowed a
   1180 viewBox by 234px and silently clipped the two that matter most — the
   external world and its source. */
const W = 1180, H = 132, GAP = 14;

export default function WorldNow(props: WorldNowProps) {
  const n = (props.stages ?? []).length;
  const BOX = Math.floor((W - 20 - (n - 1) * GAP) / n);
  const total = n * BOX + (n - 1) * GAP;
  const x0 = Math.max(10, (W - total) / 2);
  // RTL: the chain starts at the right, matching every other PHILOS chain.
  const xOf = (i: number) => x0 + (total - BOX) - i * (BOX + GAP);

  return (
    <section dir="rtl" style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
      {/* ── WORLD NOW · the question this terminal exists to answer ────
          "What verified external/system change is observed now?" The answer
          today is none, and that is the headline. A REAL group effect was
          sitting here under the words "verified system impact" — which
          visually bypassed the exact gate the pipeline enforces. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.lg, alignItems: "flex-start",
        padding: `${SPACE.md}px ${SPACE.lg}px`, background: COLOR.bgCard,
        border: `1px solid ${props.observedWorldEvents > 0 ? "rgba(52,211,153,0.35)" : "rgba(230,237,247,0.22)"}`,
        borderRadius: RADIUS.lg }}>
        <div style={{ flex: "1 1 460px", minWidth: 300 }}>
          <div style={{ fontSize: FS.tag, letterSpacing: ".08em", color: "#e6edf7", marginBottom: 4 }}>
            ⚪ WORLD NOW
          </div>
          <div style={{ fontSize: 20, lineHeight: 1.45, color: COLOR.text, textWrap: "balance" }}>
            {props.observedWorldEvents > 0
              ? `${props.observedWorldEvents} אירועי עולם מאומתים מחוברים`
              : "אין אירוע חיצוני או מערכתי מאומת מחובר."}
          </div>
          <div style={{ fontSize: FS.meta, color: COLOR.textDim, marginTop: 6 }}>
            אין ראיה חיצונית · אין ישות מקור מאומת · אין קישור WorldRelevance
          </div>
        </div>
        {/* THE FOUR STATES, kept apart. Reading any one as another is the
            misreading this block exists to prevent. */}
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 2,
          fontSize: FS.meta, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: "#34d399" }}>{props.upstreamReal} רשומות REAL במעלה (GROUP/NETWORK)</span>
          <span style={{ color: "#a78bfa" }}>{props.systemQualified} עומדות בשער SYSTEM</span>
          <span style={{ color: "#e6edf7" }}>{props.externalEvidence} באימות חיצוני</span>
          <span style={{ color: props.observedWorldEvents ? "#34d399" : COLOR.textFaint }}>
            {props.observedWorldEvents} אירועי עולם נצפים
          </span>
        </div>
      </div>

      {/* ── KNOWN INTERNAL EFFECT · real, and not World evidence ────────── */}
      {props.groupEffect ? (
        <div style={{ padding: `${SPACE.sm}px ${SPACE.lg}px`, background: COLOR.bgCard,
          border: `1px solid rgba(52,211,153,0.3)`, borderRadius: RADIUS.md }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontSize: FS.tag, letterSpacing: ".08em", color: "#34d399" }}>
              🟢 אפקט קבוצתי אמיתי · REAL GROUP EFFECT
            </span>
            <span style={{ fontSize: FS.tag, padding: "1px 8px", borderRadius: RADIUS.pill,
              border: `1px solid rgba(230,237,247,0.3)`, color: "#e6edf7" }}>
              טרם קושר לאירוע חיצוני מאומת
            </span>
          </div>
          <div style={{ fontSize: FS.read, color: COLOR.text, lineHeight: 1.5 }}>{props.groupEffect.statement}</div>
          <div style={{ fontSize: FS.meta, color: COLOR.textDim, marginTop: 4 }}>
            {props.groupEffect.group} · {props.groupEffect.family} · {props.groupEffect.verified} אפקטים מאומתים בקנה-מידה קבוצתי ·
            <span style={{ color: "#a78bfa" }}> זמין לרלוונטיות עולמית כשתיווצר</span>
          </div>
        </div>
      ) : null}

      {/* ── THE PIPELINE · every stage, lit or dark, with its reason ────── */}
      {props.stages && props.stages.length > 0 ? (
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group"
          aria-label={`צינור העולם — ${props.stages.map((s) => `${s.label}: ${CONNECTION_TAG[s.connection].text}`).join(", ")}`}
          style={{ direction: "ltr", display: "block", minWidth: 760,
            background: COLOR.bg, border: `0.5px solid ${COLOR.border}`, borderRadius: RADIUS.md }}>
          {props.stages.slice(0, -1).map((s, i) => {
            const next = props.stages![i + 1];
            /* An edge is drawn as FLOWING only when both ends are actually
               CONNECTED. An upstream chain that exists but is not linked to
               the external world gets its own dashed treatment — it must not
               look like it reaches EXTERNAL. */
            const flows = s.connection === "CONNECTED" && next.connection === "CONNECTED";
            const upstream = s.connection === "AVAILABLE_UPSTREAM" && next.connection === "AVAILABLE_UPSTREAM";
            const x1 = xOf(i), x2 = xOf(i + 1) + BOX;
            return (
              <g key={`l-${s.key}`}>
                <line x1={x1} y1={54} x2={x2} y2={54}
                  stroke={flows ? "#34d399" : upstream ? "#a78bfa" : "#2c3550"}
                  strokeWidth={flows ? 1.5 : 1}
                  strokeDasharray={flows ? undefined : upstream ? "5 3" : "2 4"} strokeLinecap="round" />
                {flows ? (
                  <path d={`M ${x2 + 7} 50 L ${x2} 54 L ${x2 + 7} 58`} fill="none"
                    stroke="#34d399" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ) : null}
              </g>
            );
          })}
          {props.stages.map((s, i) => {
            const st = SCOPE_STYLE[s.scope];
            const conn = CONNECTION_TAG[s.connection];
            const x = xOf(i);
            return (
              <g key={s.key}>
                <rect x={x} y={26} width={BOX} height={56} rx={4}
                  fill={st.fill} stroke={st.stroke} strokeWidth={1} strokeDasharray={st.dash} />
                <text x={x + BOX / 2} y={48} textAnchor="middle" fontSize={12} fill={COLOR.text}>{s.label}</text>
                <text x={x + BOX / 2} y={64} textAnchor="middle" fontSize={12} fill={COLOR.textFaint}>{s.term}</text>
                {/* CONNECTION is its own line in its own colour — the box's
                    fill says what it is verified as, this says whether it
                    reaches the world. Two dimensions, two marks. */}
                <text x={x + BOX / 2} y={97} textAnchor="middle" fontSize={12} fill={conn.color}>{conn.text}</text>
                {s.value ? (
                  <text x={x + BOX / 2} y={113} textAnchor="middle" fontSize={12} fill={COLOR.textDim}>
                    {s.value.length > 13 ? s.value.slice(0, 12) + "…" : s.value}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      ) : null}

      {/* ── WHY THE DARK HALF IS DARK ───────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md }}>
        <div style={{ flex: "1 1 380px", minWidth: 280, padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: COLOR.bgCard, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FS.tag, letterSpacing: ".08em", color: COLOR.textFaint, marginBottom: 4 }}>
            למה אף אחד לא הגיע
          </div>
          <div style={{ fontSize: FS.base, color: COLOR.text, lineHeight: 1.6 }}>
            {props.systemZeroReason ?? "יש רשומות בקנה-מידה מערכתי."}
          </div>
          <div style={{ fontSize: FS.meta, color: COLOR.textDim, marginTop: 6 }}>
            {props.evidenceRecords} רשומות ראיה נבדקו · {props.externalEvidence} באימות חיצוני
          </div>
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 240, padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: COLOR.bgCard, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md }}>
          <div style={{ fontSize: FS.tag, letterSpacing: ".08em", color: COLOR.textFaint, marginBottom: 4 }}>
            סיבות אי-הכללה
          </div>
          {props.rejections.length === 0 ? (
            <div style={{ fontSize: FS.meta, color: COLOR.textDim }}>אין מועמדים שנדחו.</div>
          ) : props.rejections.map((r) => (
            <div key={r.reason} style={{ display: "flex", gap: SPACE.sm, fontSize: FS.meta, color: COLOR.textDim }}>
              <span style={{ flex: 1 }}>{r.reason}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: COLOR.text }}>{r.n}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
