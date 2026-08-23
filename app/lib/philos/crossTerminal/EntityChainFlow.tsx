/**
 * THE SHARED SPINE — one path, three lenses.
 *
 * Community, Globe and World render THIS component over THE SAME projection
 * object. What changes between them is spatial emphasis; the object is
 * byte-identical, and that is verified live rather than promised.
 *
 * IT IS A PATH, NOT FOURTEEN CARDS. Fourteen equal boxes in a row is a KPI
 * rail: it says "here are fourteen numbers" and leaves the reader to work out
 * that they are one story. A spine says the story. Cells that carry truth are
 * joined by a lit rail; a cell whose truth is absent BREAKS the rail, visibly,
 * at its own position — so "where does this stop" is answered by the drawing
 * before any label is read.
 *
 * WHITE IS SIX STATES, NOT ONE. NO_EVENTS, NO_RECORD, NO_COORDINATE,
 * UNCONNECTED, NOT_QUALIFIED and NOT_OBSERVED are different facts about the
 * world and they stay legible on the face of the cell. "Missing" as a single
 * word was the ambiguity the truth pass removed; this drawing must not put it
 * back for the sake of a tidier row.
 *
 * COLOUR IS TRUTH AT A SCALE, NOT DECORATION.
 *   🟢 REAL       recorded and verified at its own scale
 *   🟣 PROJECTED  derived, a PHILOS relation, an administrative resolution
 *   ⚪ absent     with its specific state named
 *   🔴 TENSION    a recorded unresolved tension. Only that. Its absence is
 *                 correct and is not an incompleteness to be filled.
 */
"use client";
import { useState } from "react";
import { ABSENCE_WORD, type CellStatus, type ChainCell, type SelectedEntityWorldProjection } from "./selectedEntityWorldProjection";

const TONE: Record<CellStatus, { dot: string; text: string; edge: string; fill: string; word: string; rail: string }> = {
  REAL:      { dot: "#34d399", text: "#c9f2df", edge: "rgba(52,211,153,0.5)",  fill: "rgba(52,211,153,0.08)", word: "אמיתי",       rail: "#34d399" },
  PROJECTED: { dot: "#a78bfa", text: "#ded5fb", edge: "rgba(167,139,250,0.5)", fill: "rgba(167,139,250,0.08)", word: "יחס PHILOS", rail: "#a78bfa" },
  MISSING:   { dot: "#5a6d92", text: "#9fb0d0", edge: "rgba(120,150,220,0.18)", fill: "transparent",          word: "לא קיים",     rail: "transparent" },
  TENSION:   { dot: "#f87171", text: "#fbc9c9", edge: "rgba(248,113,113,0.5)", fill: "rgba(248,113,113,0.08)", word: "מתח מתועד",  rail: "#f87171" },
};

/** Which positions each lens exists to answer, in the order that lens reads
 *  them. The CHAIN's own order never changes — only which cells are brought
 *  forward, so a reader who learns the spine on one terminal keeps it. */
export const EMPHASIS: Record<"community" | "globe" | "world" | "dynamics" | "marketplace", readonly string[]> = {
  community: ["value", "group", "members", "money", "need", "effect", "evidence"],
  globe: ["location", "group", "members", "money", "action", "effect"],
  world: ["external", "system", "relevance", "location", "tension"],
  dynamics: ["action", "effect", "evidence", "tension"],
  marketplace: ["need", "match", "action", "effect"],
};

const carries = (c: ChainCell): boolean => c.status !== "MISSING";

export default function EntityChainFlow({
  projection, emphasis, title, compact,
}: {
  projection: SelectedEntityWorldProjection;
  emphasis: keyof typeof EMPHASIS;
  title: string;
  /** ORIENTATION STRIP, NOT THE PRODUCT.
   *
   *  The spine is context BETWEEN terminals — selection persistence, a quick
   *  truth summary, click-through provenance. It is not Community, not Globe,
   *  not World. Rendered full-size it took the first viewport on all five
   *  routes and the terminal's own subject appeared below the fold, which
   *  made audit the visible product. `compact` renders it as one thin band:
   *  same fourteen cells, same colours, same click-through, a third of the
   *  height and visibly subordinate to whatever follows it. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const lit = new Set(EMPHASIS[emphasis]);
  const breaks = projection.chain.filter((c) => !carries(c)).length;

  return (
    <section dir="rtl" data-spine={emphasis} style={{
      background: "rgba(13,18,33,0.82)", border: "1px solid rgba(120,150,220,0.16)",
      borderRadius: 14, padding: compact ? "7px 10px 6px" : "12px 14px 10px",
      containerType: "inline-size",
    }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
        marginBlockEnd: compact ? 6 : 10 }}>
        <h3 style={{ margin: 0, fontSize: compact ? 12.5 : 15, fontWeight: compact ? 600 : 700,
          color: compact ? "#9fb0d0" : "#f2f6fc", textWrap: "balance" }}>{title}</h3>
        <span style={{ fontSize: 11.5, color: "#6c86b5", fontFamily: "ui-monospace, monospace" }}>
          {projection.groupId}
        </span>
        <span style={{ fontSize: 11.5, color: "#8fa3c9", marginInlineStart: "auto" }}>
          {breaks === 0
            ? "השרשרת רציפה"
            : `${breaks} נקודות שבירה — שם המסלול נעצר`}
        </span>
      </header>

      {/* THE PATH. Grid, not flex-wrap: every cell keeps its column so the
          rail between two cells is always horizontal and always means the
          same thing. It reflows to fewer columns rather than scrolling — a
          spine you must scroll to finish reads as two spines. */}
      {/* COMPACT IS ONE SURFACE.
          Merging adjacent same-status cells still produced a segmented strip,
          because every cell kept its own border, its own fill and its own
          radius — the merge only removed the seams inside a run, leaving the
          runs themselves as separate tiles. The orientation strip is not
          fourteen things; it is one bar that happens to be readable in
          fourteen places. So in compact the CONTAINER owns the border, the
          fill and the single radius, and the cells inside own nothing but
          their dot, their term and their value. Status stays fully legible —
          the dot carries it, exactly as it does in the full variant — and
          every cell remains its own button with its own click target. */}
      <ol style={{
        listStyle: "none", margin: 0, padding: 0,
        display: compact ? "flex" : "grid",
        ...(compact
          ? {
              flexWrap: "wrap", gap: 0, overflow: "hidden",
              borderRadius: 10,
              border: "1px solid rgba(52,211,153,0.45)",
              background: "rgba(52,211,153,0.10)",
            }
          : {
              gap: "10px 0",
              gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))",
            }),
      }}>
        {projection.chain.map((c, i) => {
          const prev = projection.chain[i - 1];
          const next = projection.chain[i + 1];
          /* A RUN IS ONE THING, SO IT IS DRAWN AS ONE THING.
             Fourteen separately-outlined boxes in a row read as fourteen
             facts even when nine of them are the same fact continuing. Two
             adjacent cells JOIN — no gap, no rounded corners between them, no
             seam — when they share a status AND both carry truth. The run of
             greens then reads as a single continuous bar that stops where the
             truth stops, which is the whole claim the drawing exists to make.
             Purple runs join the same way; absences never join to anything. */
          const joinsPrev = !!prev && carries(c) && carries(prev) && prev.status === c.status;
          const joinsNext = !!next && carries(c) && carries(next) && next.status === c.status;
          /* Different-status neighbours that BOTH carry truth are still a
             flow — they get the connector, because the path continues even
             though the kind of truth changed. */
          const flows = !!next && carries(c) && carries(next) && !joinsNext;
          return (
            <li key={c.key} style={{ display: "flex", alignItems: "stretch",
              minInlineSize: 0, ...(compact ? { flex: "1 1 68px" } : {}) }}>
              <Cell cell={c} dim={!lit.has(c.key)} open={open === c.key} compact={compact}
                joinsPrev={joinsPrev} joinsNext={joinsNext}
                onToggle={() => setOpen(open === c.key ? null : c.key)} />
              {next && !joinsNext && !compact ? (
                <span aria-hidden style={{
                  alignSelf: "center", inlineSize: 10, flex: "0 0 10px", borderRadius: 2,
                  ...(flows
                    ? { blockSize: 3, background: TONE[c.status].rail }
                    /* A BREAK IS DRAWN AS A BREAK: a dotted stub, not a paler
                       solid line. Paler solid reads as "weaker flow"; there is
                       no weaker flow here, there is none. */
                    : { blockSize: 0, borderTop: "2px dotted rgba(120,150,220,0.35)" }),
                }} />
              ) : null}
            </li>
          );
        })}
      </ol>

      {open ? <Drawer projection={projection} cellKey={open} /> : null}

      {compact ? null : (
      <div style={{ marginBlockStart: 8, fontSize: 11, color: "#6c86b5", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(["REAL", "PROJECTED", "MISSING", "TENSION"] as CellStatus[]).map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%", background: TONE[s].dot, display: "inline-block" }} />
            {TONE[s].word}
          </span>
        ))}
        <span style={{ marginInlineStart: "auto" }}>לחיצה על שלב פותחת את המקור והרשומות שלו</span>
      </div>
      )}
    </section>
  );
}

function Cell({ cell, dim, open, compact, joinsPrev, joinsNext, onToggle }: {
  cell: ChainCell; dim: boolean; open: boolean; compact?: boolean;
  joinsPrev: boolean; joinsNext: boolean; onToggle: () => void;
}) {
  const t = TONE[cell.status];
  const absent = !carries(cell);
  /* In RTL the inline START edge is the RIGHT one, so "previous" is start and
     "next" is end. Using logical properties keeps the joins correct without a
     direction check — the same code draws the run correctly either way. */
  const R = 9;
  return (
    <button type="button" onClick={onToggle} aria-expanded={open}
      data-cell={cell.key} data-status={cell.status} data-absence={cell.absence ?? ""}
      data-join={`${joinsPrev ? "p" : ""}${joinsNext ? "n" : ""}`}
      style={{
        appearance: "none", cursor: "pointer", textAlign: "start", font: "inherit",
        flex: 1, minInlineSize: 0, padding: compact ? "5px 7px 6px" : "6px 8px 7px",
        ...(compact
          ? {
              /* No border, no fill, no radius. One surface. */
              border: "none", borderRadius: 0, background: "transparent",
              /* The only mark of an open cell inside the single bar — it must
                 not reintroduce an outline. */
              boxShadow: open ? `inset 0 -2px 0 0 ${t.dot}` : "none",
            }
          : {
              borderStartStartRadius: joinsPrev ? 0 : R, borderEndStartRadius: joinsPrev ? 0 : R,
              borderStartEndRadius: joinsNext ? 0 : R, borderEndEndRadius: joinsNext ? 0 : R,
              background: t.fill,
              border: `1px solid ${open ? t.dot : t.edge}`,
            }),
        /* BOTH SIDES OF THE SEAM, not one.
           Clearing only the FOLLOWING cell's start border left the PRECEDING
           cell's end border still painted — one hairline between every pair,
           which is exactly the separation that survived the first attempt.
           Two adjacent cells each own one edge of the seam, so both must be
           cleared for the fills to meet. `background-clip` is `border-box` by
           default, so a transparent border still shows the cell's own fill:
           the two backgrounds become one continuous surface rather than two
           surfaces with a gap between them. */
        ...(compact ? {} : {
          ...(joinsPrev ? { borderInlineStartColor: "transparent" } : {}),
          ...(joinsNext ? { borderInlineEndColor: "transparent" } : {}),
        }),
        /* An absent cell is drawn LOWER as well as paler: the path visibly
           dips where it breaks, so the shape carries the reading even before
           a word of Hebrew or a colour is resolved. */
        alignSelf: compact ? "stretch" : absent ? "flex-end" : "stretch",
        marginBlockStart: compact ? 0 : absent ? 8 : 0,
        opacity: dim ? 0.45 : 1,
        display: "flex", flexDirection: "column", gap: 1,
      }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, minInlineSize: 0 }}>
        <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%", background: t.dot, flex: "0 0 auto" }} />
        <span style={{ fontSize: 9, letterSpacing: 0.5, color: "#6c86b5",
          fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cell.term}
        </span>
      </span>
      {compact ? null : (
        <span style={{ fontSize: 11, color: "#a9bbd6", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cell.label_he}
        </span>
      )}
      {/* THE SPECIFIC STATE, always. Six different absences never collapse
          into one word here. */}
      <span style={{
        fontSize: cell.value ? (compact ? 11.5 : 13) : (compact ? 9.5 : 10.5),
        fontWeight: cell.value ? 700 : 500,
        color: cell.value ? t.text : "#7c8fb4", lineHeight: 1.25,
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {cell.value ?? (cell.absence ? ABSENCE_WORD[cell.absence] : t.word)}
      </span>
      {cell.value && cell.absence ? (
        <span style={{ fontSize: 9.5, color: "#7c8fb4" }}>{ABSENCE_WORD[cell.absence]}</span>
      ) : null}
    </button>
  );
}

function Drawer({ projection, cellKey }: { projection: SelectedEntityWorldProjection; cellKey: string }) {
  const c = projection.chain.find((x) => x.key === cellKey);
  if (!c) return null;
  const contra = projection.contradictions.find((x) => x.key === cellKey);
  return (
    <div style={{
      marginBlockStart: 10, padding: "9px 11px", borderRadius: 10,
      background: "rgba(8,11,20,0.75)", border: `1px solid ${TONE[c.status].edge}`,
      fontSize: 12.5, lineHeight: 1.65,
    }}>
      <div style={{ color: TONE[c.status].text, fontWeight: 700 }}>
        {c.label_he} · {c.term} — {c.absence ? ABSENCE_WORD[c.absence] : TONE[c.status].word}
        <span style={{ color: "#6c86b5", fontWeight: 400 }}>{"  "}· קנה-מידה {c.scale}</span>
      </div>
      <div style={{ color: "#c2d1e8" }}>{c.because}</div>
      <div style={{ color: "#6c86b5", fontSize: 11.5, marginBlockStart: 4,
        fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
        מקור: {c.store} · provenance={c.provenance}
        {c.absence ? ` · state=${c.absence}` : ""}
        {c.gate_reason ? ` · gate=${c.gate_reason}` : ""}
      </div>
      {c.record_ids.length > 0 ? (
        <div style={{ color: "#6c86b5", fontSize: 11, marginBlockStart: 2,
          fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
          רשומות: {c.record_ids.join(" · ")}
        </div>
      ) : null}
      {c.readings ? (
        <div style={{ marginBlockStart: 8, paddingBlockStart: 8, borderTop: "1px solid rgba(120,150,220,0.18)" }}>
          <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 11.5 }}>קריאות נפרדות לפי חוזק הצירוף</div>
          {c.readings.map((r) => (
            <div key={r.label} style={{ color: "#c2d1e8", fontSize: 11.5, marginBlockStart: 3 }}>
              <b style={{ color: "#e6edf7" }}>{r.count}</b> {r.label}
              <span style={{ color: r.join === "CANONICAL_GROUP_ID" ? "#34d399" : "#8fa3c9" }}> [{r.join}]</span>
              <span style={{ color: "#9fb0d0" }}> — {r.because}</span>
            </div>
          ))}
        </div>
      ) : null}
      {contra ? (
        <div style={{ marginBlockStart: 8, paddingBlockStart: 8, borderTop: "1px solid rgba(120,150,220,0.18)" }}>
          {/* Four colours, no fifth. A store disagreement is an unresolved
              operational risk, which is what red already means here. */}
          <div style={{ color: "#f87171", fontWeight: 700, fontSize: 11.5 }}>שני מאגרים ענו אחרת — שניהם כאן</div>
          {contra.readings.map((r) => (
            <div key={r.store} style={{ color: "#c2d1e8", fontSize: 11.5, marginBlockStart: 3 }}>
              <b style={{ color: "#e6edf7" }}>{r.value}</b> — {r.because}
            </div>
          ))}
          <div style={{ color: "#9fb0d0", fontSize: 11.5, marginBlockStart: 4 }}>
            <b style={{ color: "#e6edf7" }}>פורסם: {contra.canonical}</b> — {contra.rule}
          </div>
        </div>
      ) : null}
    </div>
  );
}
