/**
 * THE CAUSAL CHAIN — one drawing, used by Dynamics and Marketplace.
 *
 * Both surfaces held the same shape of information and rendered it as rows:
 * Dynamics as a 15-row table of `from → to · linkage · status · ids · basis`,
 * Marketplace as seven equal-width cards in a line. In both cases the thing a
 * reader needs — WHERE THE CHAIN BREAKS — was the hardest thing to find,
 * because a complete link and a missing one occupied the same amount of space
 * and differed only by a word.
 *
 * Here the break is the loudest thing on the drawing.
 *
 * ── THE LINK GRAMMAR IS THE EPISTEMOLOGY ───────────────────────────────
 * The line between two stages states what is known about the relation, and it
 * is the same grammar the community cell and the system gate already use:
 *
 *   VERIFIED_REFERENCE_LINK  solid, with an arrowhead. A field on one record
 *                            names the other. This is the ONLY case that gets
 *                            an arrow, because an arrow claims direction.
 *   CHRONOLOGICAL_ONLY       dashed, NO arrowhead. One happened after the
 *                            other and nothing more. CHRONOLOGY != CAUSALITY,
 *                            and an arrowhead here would assert exactly the
 *                            thing the data does not support.
 *   UNLINKED                 a drawn BREAK. The two records exist and no
 *                            reference joins them — visible as a gap, not as
 *                            a word in a cell.
 *   NO_LINK_POSSIBLE         a terminator. The schema cannot express this
 *                            relation; it is not missing data and will not
 *                            arrive later.
 *
 * ── RTL ────────────────────────────────────────────────────────────────
 * The chain flows RIGHT TO LEFT, like the product it lives in and like its
 * own zoom row. The first stage is rightmost and arrowheads point left. The
 * coordinate system stays LTR — geometry is not prose — and the mirroring is
 * done by index, so the arrow marker never has to be flipped.
 */
import { COLOR, FS, RADIUS, STATUS, TYPE } from "./designTokens";

export type ChainLinkage =
  | "VERIFIED_REFERENCE_LINK" | "CHRONOLOGICAL_ONLY" | "UNLINKED" | "NO_LINK_POSSIBLE";

export type ChainStatus =
  | "IMPLEMENTED" | "PARTIAL" | "MISSING_DATA" | "MISSING_SCHEMA"
  | "OPEN_BOUNDARY" | "NOT_APPLICABLE";

export interface ChainStage {
  key: string;
  /** What a reader calls it. */
  label: string;
  /** The canonical English term, kept because PHILOS's vocabulary is part of
   *  the product — shown small, never instead of the label. */
  term: string;
  /** How many real records stand behind this stage. `null` = UNKNOWN, and it
   *  is drawn as an empty dashed node rather than as a zero. */
  count: number | null;
  /** Provenance of those records, when they have one. */
  provenance?: "REAL" | "DERIVED" | "DEMO";
  /** Something is wrong AT this stage, not on a link into it. */
  flag?: string;
}

export interface ChainLink {
  /** Index of the stage this leaves. The link sits between `from` and `from+1`. */
  from: number;
  linkage: ChainLinkage;
  status: ChainStatus;
  /** Why it is classified this way. Read off the store, never asserted. */
  basis: string;
}

const LINK_TONE: Record<ChainLinkage, string> = {
  VERIFIED_REFERENCE_LINK: STATUS.real.text,
  CHRONOLOGICAL_ONLY: STATUS.claimed.text,
  UNLINKED: STATUS.claimed.text,
  NO_LINK_POSSIBLE: COLOR.textFaint,
};

const STATUS_TONE: Record<ChainStatus, string> = {
  IMPLEMENTED: STATUS.real.text,
  PARTIAL: STATUS.claimed.text,
  MISSING_DATA: STATUS.claimed.text,
  MISSING_SCHEMA: COLOR.textFaint,
  OPEN_BOUNDARY: "#a78bfa",
  NOT_APPLICABLE: COLOR.textFaint,
};

/** Radius from a count. A stage that exists but holds one record must still
 *  read as present, so the floor is well above zero. */
function radiusOf(n: number | null): number {
  if (n === null) return 13;
  if (n === 0) return 13;
  return Math.min(26, 15 + Math.sqrt(n) * 3.2);
}

export default function CausalChain({
  stages, links, title, note,
}: {
  stages: ChainStage[];
  links: ChainLink[];
  title: string;
  note?: string;
}) {
  const STEP = 132;
  const PAD = 46;
  const W = PAD * 2 + (stages.length - 1) * STEP;
  const CY = 74;
  const H = CY + 96;

  /* RIGHT TO LEFT by index. Stage 0 sits at the right edge. */
  const xOf = (i: number) => W - PAD - i * STEP;

  const linkAt = (i: number) => links.find((l) => l.from === i);
  const breaks = links.filter((l) => l.linkage === "UNLINKED" || l.status === "PARTIAL").length;

  return (
    <figure style={S.figure} dir="rtl">
      <figcaption style={S.caption}>
        <span style={S.title}>{title}</span>
        {breaks > 0 ? (
          <span style={S.breakCount}>
            {breaks} {breaks === 1 ? "נקודת קטיעה" : "נקודות קטיעה"}
          </span>
        ) : (
          <span style={S.intact}>השרשרת שלמה</span>
        )}
      </figcaption>

      <div style={S.scroll}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}
             /* LTR coordinates: geometry is not prose. The RTL reading order
                is produced by `xOf`, so no marker needs mirroring. */
             style={{ display: "block", maxWidth: W, minWidth: 560, direction: "ltr", overflow: "visible" }}>
          <defs>
            <marker id="cc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill={STATUS.real.text} />
            </marker>
          </defs>

          {stages.map((st, i) => {
            const link = linkAt(i);
            const next = stages[i + 1];
            if (!link || !next) return null;
            const x1 = xOf(i) - radiusOf(st.count) - 7;
            const x2 = xOf(i + 1) + radiusOf(next.count) + 7;
            const mid = (x1 + x2) / 2;
            const tone = LINK_TONE[link.linkage];

            if (link.linkage === "UNLINKED") {
              /* A BREAK, drawn. Two stubs and a visible gap where the
                 reference would be — the thing a reader is looking for. */
              return (
                <g key={`l${i}`}>
                  <line x1={x1} y1={CY} x2={mid + 13} y2={CY} stroke={tone} strokeWidth={1.6} />
                  <line x1={mid - 13} y1={CY} x2={x2} y2={CY} stroke={tone} strokeWidth={1.6} />
                  <line x1={mid + 5} y1={CY - 11} x2={mid - 5} y2={CY + 11} stroke={tone} strokeWidth={2.4} />
                  <line x1={mid - 5} y1={CY - 11} x2={mid + 5} y2={CY + 11} stroke={tone} strokeWidth={2.4} />
                  <text x={mid} y={CY - 20} textAnchor="middle" style={{ ...S.linkLabel, fill: tone }}>אין הפניה</text>
                </g>
              );
            }
            if (link.linkage === "NO_LINK_POSSIBLE") {
              return (
                <g key={`l${i}`}>
                  <line x1={x1} y1={CY} x2={x2} y2={CY} stroke={tone} strokeWidth={1.2} strokeDasharray="2 5" opacity={0.6} />
                  <line x1={mid} y1={CY - 9} x2={mid} y2={CY + 9} stroke={tone} strokeWidth={2} />
                  <text x={mid} y={CY - 20} textAnchor="middle" style={{ ...S.linkLabel, fill: tone }}>לא ניתן לקשר</text>
                </g>
              );
            }
            const verified = link.linkage === "VERIFIED_REFERENCE_LINK";
            return (
              <g key={`l${i}`}>
                <line
                  x1={x1} y1={CY} x2={x2} y2={CY}
                  stroke={tone} strokeWidth={verified ? 1.8 : 1.4}
                  strokeDasharray={verified ? undefined : "5 4"}
                  /* Arrowhead ONLY on a recorded reference. */
                  markerEnd={verified ? "url(#cc-arrow)" : undefined}
                />
                {!verified ? (
                  <text x={mid} y={CY - 20} textAnchor="middle" style={{ ...S.linkLabel, fill: tone }}>כרונולוגיה בלבד</text>
                ) : null}
              </g>
            );
          })}

          {stages.map((st, i) => {
            const x = xOf(i);
            const r = radiusOf(st.count);
            const empty = st.count === null || st.count === 0;
            const tone = st.provenance === "DEMO" ? STATUS.demo.text
                       : st.provenance === "DERIVED" ? "#8fa3c9"
                       : empty ? COLOR.textFaint : STATUS.real.text;
            return (
              <g key={st.key}>
                {st.flag ? <circle cx={x} cy={CY} r={r + 6} fill="none" stroke={STATUS.claimed.text} strokeWidth={1} strokeDasharray="3 3" /> : null}
                <circle
                  cx={x} cy={CY} r={r}
                  fill={empty ? "none" : "rgba(120,150,220,0.14)"}
                  stroke={tone} strokeWidth={1.8}
                  strokeDasharray={st.count === null ? "4 3" : undefined}
                />
                <text x={x} y={CY + 6} textAnchor="middle"
                      style={{ ...S.count, fill: empty ? COLOR.textFaint : COLOR.text }}>
                  {st.count === null ? "—" : st.count}
                </text>
                <text x={x} y={CY + r + 21} textAnchor="middle" style={S.stageLabel}>{st.label}</text>
                <text x={x} y={CY + r + 38} textAnchor="middle" style={S.stageTerm}>{st.term}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* The basis for every link that is NOT a clean reference. Complete
          links need no sentence; the gaps are what a reader came for. */}
      {links.some((l) => l.linkage !== "VERIFIED_REFERENCE_LINK") ? (
        <ul style={S.basisList}>
          {links.filter((l) => l.linkage !== "VERIFIED_REFERENCE_LINK").map((l, i) => (
            <li key={i} style={S.basisRow}>
              <span style={{ ...S.basisEdge, color: LINK_TONE[l.linkage] }}>
                {stages[l.from]?.label} ⟵ {stages[l.from + 1]?.label}
              </span>
              <span style={{ ...S.basisStatus, color: STATUS_TONE[l.status] }}>{l.status}</span>
              <span style={S.basisText}>{l.basis}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {note ? <p style={S.note}>{note}</p> : null}
    </figure>
  );
}

const S: Record<string, React.CSSProperties> = {
  figure: { margin: 0, display: "flex", flexDirection: "column", gap: 10 },
  caption: { display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" },
  title: { ...TYPE.title, fontSize: FS.head, color: COLOR.text },
  breakCount: {
    ...TYPE.micro, fontSize: FS.tag, color: STATUS.claimed.text,
    background: STATUS.claimed.bg, padding: "3px 9px", borderRadius: RADIUS.pill,
  },
  intact: {
    ...TYPE.micro, fontSize: FS.tag, color: STATUS.real.text,
    background: STATUS.real.bg, padding: "3px 9px", borderRadius: RADIUS.pill,
  },
  /* The one place a horizontal scrollbar is allowed: the drawing, not the
     page. A chain narrower than its stages would be unreadable. */
  scroll: { overflowX: "auto", paddingBottom: 4 },

  count: { fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  stageLabel: { fontSize: 13, fill: COLOR.textDim, fontWeight: 600 },
  stageTerm: { fontSize: 12, fill: COLOR.textFaint, letterSpacing: 0.6 },
  linkLabel: { fontSize: 12, fontWeight: 600 },

  basisList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 },
  basisRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", fontSize: FS.meta },
  basisEdge: { fontWeight: 700, minWidth: 200 },
  basisStatus: { ...TYPE.micro, fontSize: FS.tag },
  basisText: { color: COLOR.textDim, flex: 1, minWidth: 240, lineHeight: 1.55 },
  note: { margin: 0, fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6 },
};
