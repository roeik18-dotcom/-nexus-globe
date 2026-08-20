/**
 * GROUP CELL — the REAL value group, drawn.
 *
 * What stood here was a stat row and a pipeline strip: eight numbers, each
 * beside a word, arranged left to right. Everything a reader needed was
 * present and nothing was legible at a glance, because a row of numbers
 * encodes only ONE thing visually — reading order — and reading order is not
 * a fact about a community.
 *
 * This encodes the same numbers as position, size and connection:
 *
 *   PEOPLE    a ring of dots around the value. Nine members is nine marks;
 *             counting them is optional, seeing the density is not. The
 *             viewer's own dot is drawn open, so "am I in this group" is
 *             answered by looking rather than by reading an id.
 *   CAPACITY  a bar whose filled length is the balance, with the last
 *             movement drawn as a notch on it — direction is a direction,
 *             not a signed number in a sentence.
 *   CHAIN     NEED → OFFER → ACTION → EFFECT → EVIDENCE as five nodes.
 *             Radius carries the count; fill carries whether the stage has
 *             anything in it at all; only VERIFIED evidence gets the ring.
 *             A stage with nothing is a hollow outline at minimum radius —
 *             visibly empty rather than a "0" the eye slides over.
 *
 * TRUTH RULES THIS DRAWING KEEPS.
 * A null count is drawn as EMPTY-AND-UNKNOWN (dashed), never as a zero-sized
 * or absent node — UNKNOWN != 0, and a missing shape would read as "no such
 * stage". The connectors are the value model's own reading order, so they are
 * drawn WITHOUT arrowheads: an arrowhead would claim production, and a Need
 * does not produce an Offer. Only the Effect -> Evidence link is a recorded
 * reference, and it is the only one drawn solid.
 *
 * Nothing here is derived. Every figure is passed in, already resolved by the
 * shared loader; this component computes geometry and nothing else.
 */
import { COLOR, COLOR_ROLE, FS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

export interface GroupCellData {
  name: string;
  value: string;
  members: number;
  /** `null` when no money event exists — not zero. */
  capital: { balance: number; lastDelta: number; currency: string } | null;
  /** The viewer is a recorded member of THIS group. */
  viewerIsMember: boolean;
  chain: {
    need: number | null;
    offer: number | null;
    action: number | null;
    effect: number | null;
    evidence: number | null;
  };
  /** Of `chain.evidence`, how many carry a verified outcome. */
  verified: number;
}

const W = 780;
const H = 244;
const CX = 168;
const CY = 116;
const R_GROUP = 50;
const R_RING = 86;

/** Radius from a count: present-but-small must still read as present. */
function radiusFor(n: number | null): number {
  if (n === null || n === 0) return 11;
  return Math.min(24, 13 + Math.sqrt(n) * 4);
}

export default function GroupCellVisual({ data }: { data: GroupCellData }) {
  const people = Array.from({ length: Math.max(0, data.members) }, (_, i) => {
    // Start at the top and go clockwise, so the ring reads as a ring rather
    // than as a chart with an origin.
    const a = (-90 + (360 / Math.max(1, data.members)) * i) * (Math.PI / 180);
    return { x: CX + Math.cos(a) * R_RING, y: CY + Math.sin(a) * R_RING, first: i === 0 };
  });

  const stages = [
    { key: "need", label: "צורך", en: "NEED", n: data.chain.need },
    { key: "offer", label: "הצעה", en: "OFFER", n: data.chain.offer },
    { key: "action", label: "פעולה", en: "ACTION", n: data.chain.action },
    { key: "effect", label: "אפקט", en: "EFFECT", n: data.chain.effect },
    { key: "evidence", label: "ראיה", en: "EVIDENCE", n: data.chain.evidence },
  ] as const;

  const X0 = 352;
  const STEP = 100;
  const CHAIN_Y = 116;

  // Capacity bar. With no money event there is no bar and no zero — the
  // absence is drawn as a dashed empty track and said in words once.
  const barX = CX - 76, barY = 214, barW = 152, barH = 7;
  const cap = data.capital;
  // The bar is a MAGNITUDE, not a percentage of anything: the log records no
  // target or ceiling, so inventing a denominator would invent a fact. It
  // fills against the balance plus the size of the last movement, which is
  // the only other real quantity on the same axis.
  const denom = cap ? Math.max(cap.balance, cap.balance + Math.abs(cap.lastDelta)) : 1;
  const fillW = cap && denom > 0 ? Math.max(3, (cap.balance / denom) * barW) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label={`${data.name} — ${data.members} חברים, שרשרת צורך עד ראיה`}
         /* `direction: ltr` is load-bearing. These drawings render inside a
            dir="rtl" page, where SVG resolves text-anchor LOGICALLY: "end"
            became the right edge and every label mirrored on top of the node
            it was labelling. The coordinate system is geometry, not prose —
            it is pinned LTR, and the Hebrew strings inside still shape
            correctly because bidi resolves per text run. */
         style={{ display: "block", maxWidth: W, margin: "0 auto", overflow: "visible", direction: "ltr" }}>
      <defs>
        <radialGradient id="gcell-core">
          <stop offset="0%" stopColor="rgba(52,211,153,0.30)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0.05)" />
        </radialGradient>
      </defs>

      {/* PEOPLE — the ring, drawn first so the core sits over it. */}
      <circle cx={CX} cy={CY} r={R_RING} fill="none" stroke={COLOR.border} strokeWidth={1} />
      {people.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={5}
                fill={data.viewerIsMember && p.first ? "none" : COLOR_ROLE.green}
                stroke={data.viewerIsMember && p.first ? COLOR_ROLE.white : "none"}
                strokeWidth={2} opacity={0.92} />
      ))}

      {/* THE GROUP — value at the centre, name beneath the ring. */}
      <circle cx={CX} cy={CY} r={R_GROUP} fill="url(#gcell-core)" stroke={COLOR_ROLE.green} strokeWidth={1.5} />
      <text x={CX} y={CY - 4} textAnchor="middle" style={{ fontSize: 19, fontWeight: 700, fill: COLOR.text }}>
        {data.value}
      </text>
      <text x={CX} y={CY + 15} textAnchor="middle" style={{ fontSize: FS.tag, fill: COLOR.textFaint, letterSpacing: 1 }}>
        {data.members} חברים
      </text>

      {/* CAPACITY */}
      <rect x={barX} y={barY} width={barW} height={barH} rx={3.5}
            fill="none" stroke={COLOR.border} strokeWidth={1}
            strokeDasharray={cap ? undefined : "3 3"} />
      {cap ? (
        <>
          <rect x={barX + barW - fillW} y={barY} width={fillW} height={barH} rx={3.5} fill={COLOR_ROLE.green} opacity={0.75} />
          {/* last movement, as a notch and a direction */}
          <path
            d={`M ${barX + barW - fillW} ${barY - 4} l ${cap.lastDelta < 0 ? 7 : -7} -6 l 0 12 z`}
            fill={cap.lastDelta < 0 ? COLOR_ROLE.red : COLOR_ROLE.green}
          />
          <text x={barX + barW} y={barY - 8} textAnchor="end" style={{ fontSize: FS.meta, fontWeight: 700, fill: COLOR.text }}>
            {cap.balance.toLocaleString()} {cap.currency}
          </text>
          <text x={barX} y={barY + 20} textAnchor="start" style={{ fontSize: FS.tag, fill: COLOR.textFaint }}>
            תנועה אחרונה {cap.lastDelta > 0 ? "+" : ""}{cap.lastDelta.toLocaleString()}
          </text>
        </>
      ) : (
        <text x={barX + barW} y={barY - 8} textAnchor="end" style={{ fontSize: FS.tag, fill: COLOR.textFaint }}>
          אין אירוע הון — UNKNOWN
        </text>
      )}

      {/* Group -> chain. Dashed and headless: the chain is the value model's
          reading order, not something the group produces. */}
      <line x1={CX + R_RING + 6} y1={CY} x2={X0 - radiusFor(stages[0].n) - 8} y2={CHAIN_Y}
            stroke={COLOR.border} strokeWidth={1} strokeDasharray="4 4" />

      {/* THE CHAIN */}
      {stages.map((st, i) => {
        const x = X0 + i * STEP;
        const r = radiusFor(st.n);
        const empty = st.n === null || st.n === 0;
        const isEvidence = st.key === "evidence";
        const proven = isEvidence && data.verified > 0;
        const next = stages[i + 1];
        return (
          <g key={st.key}>
            {next ? (
              <line
                x1={x + r + 6} y1={CHAIN_Y} x2={x + STEP - radiusFor(next.n) - 6} y2={CHAIN_Y}
                stroke={st.key === "effect" ? COLOR_ROLE.white : COLOR.border}
                strokeWidth={st.key === "effect" ? 1.6 : 1}
                strokeDasharray={st.key === "effect" ? undefined : "4 4"}
                opacity={st.key === "effect" ? 0.7 : 1}
              />
            ) : null}
            {proven ? <circle cx={x} cy={CHAIN_Y} r={r + 6} fill="none" stroke={COLOR_ROLE.green} strokeWidth={1} opacity={0.5} /> : null}
            <circle
              cx={x} cy={CHAIN_Y} r={r}
              fill={empty ? "none" : proven ? "rgba(52,211,153,0.22)" : "rgba(120,150,220,0.16)"}
              stroke={empty ? COLOR.textFaint : proven ? COLOR_ROLE.green : COLOR_ROLE.blue}
              strokeWidth={1.5}
              strokeDasharray={st.n === null ? "3 3" : undefined}
            />
            <text x={x} y={CHAIN_Y + 5} textAnchor="middle"
                  style={{ fontSize: 15, fontWeight: 700, fill: empty ? COLOR.textFaint : COLOR.text }}>
              {st.n === null ? "—" : st.n}
            </text>
            <text x={x} y={CHAIN_Y + r + 18} textAnchor="middle" style={{ fontSize: FS.meta, fill: COLOR.textDim }}>
              {st.label}
            </text>
            <text x={x} y={CHAIN_Y + r + 31} textAnchor="middle"
                  style={{ ...TYPE.micro, fontSize: FS.tag, fill: COLOR.textFaint }}>
              {st.en}
            </text>
          </g>
        );
      })}

      {/* The one thing the drawing cannot show by shape: that the ring is
          verified evidence and not merely a fifth node. */}
      {data.verified > 0 ? (
        <text x={X0 + 4 * STEP} y={CHAIN_Y - radiusFor(stages[4].n) - 14} textAnchor="middle"
              style={{ ...TYPE.micro, fontSize: FS.tag, fill: STATUS.verified.text }}>
          {data.verified} מאומת
        </text>
      ) : null}
    </svg>
  );
}
