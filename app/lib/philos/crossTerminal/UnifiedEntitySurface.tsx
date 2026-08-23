/**
 * ONE BOX. ONE NAME. EVERYTHING INSIDE.
 *
 * The product had become a stack of bordered cards — one per concern, one per
 * store, one per terminal — and the reader had to assemble the entity from
 * fifteen separate rectangles. This is the opposite: a single surface with a
 * single name, holding every fact PHILOS knows about the selected entity,
 * from every terminal, with no internal box anywhere.
 *
 * Nothing here re-derives anything. Every figure is read from the shared
 * projection and the operational trace — the same two objects all five lenses
 * already consume — so this cannot disagree with any terminal.
 *
 * Separation is done with SPACE and TYPOGRAPHY, never with borders. A rule is
 * a hairline, not a frame; a group is a gap, not a card. That is the whole
 * difference between "one thing with parts" and "many things stacked".
 */
"use client";
import { useState } from "react";
import { ABSENCE_WORD, type CellStatus, type SelectedEntityWorldProjection } from "./selectedEntityWorldProjection";
import { HOP_WORD, type HopState, type OperationalTrace } from "./operationalTraceModel";

const DOT: Record<CellStatus, string> = {
  REAL: "#34d399", PROJECTED: "#a78bfa", MISSING: "#5a6d92", TENSION: "#f87171",
};
const HOP_DOT: Record<HopState, string> = {
  CONNECTED: "#34d399", AVAILABLE_UPSTREAM: "#a78bfa", STRUCTURAL_GAP: "#f87171",
  NO_CANONICAL_LINK: "#5a6d92", NO_EVENT: "#5a6d92", NO_RECORD: "#5a6d92",
};

/** The lens each fact belongs to — so one surface still says where a number
 *  lives, without splitting into five surfaces to say it. */
const LENS: Record<string, string> = {
  value: "COMMUNITY", group: "COMMUNITY", members: "COMMUNITY", money: "COMMUNITY",
  need: "MARKETPLACE", match: "MARKETPLACE", action: "DYNAMICS", effect: "DYNAMICS",
  evidence: "DYNAMICS", tension: "DYNAMICS", location: "GLOBE",
  relevance: "WORLD", system: "WORLD", external: "WORLD",
};

export default function UnifiedEntitySurface({
  projection, trace, compact = false,
}: {
  projection: SelectedEntityWorldProjection;
  trace: OperationalTrace;
  /**
   * ORIENTATION STRIP MODE.
   *
   * The shared spine is the same on Globe, World and Community — which is
   * correct (it is one entity) but became the problem: rendered full-size on
   * all three, ~60% of every terminal was identical and no terminal visibly
   * answered its own question. Compact keeps the identity and every fact
   * REACHABLE — nothing is removed, the full surface is one click away — but
   * yields the viewport to the terminal's own visual.
   */
  compact?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const cell = open ? projection.chain.find((c) => c.key === open) : null;
  const hop = open ? trace.hops.find((h) => h.key === open) : null;

  if (compact && !expanded) {
    return (
      <section dir="rtl" data-unified data-compact style={{
        border: "1px solid rgba(52,211,153,0.30)", borderRadius: 14,
        background: "rgba(13,22,33,0.75)", padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f2f6fc" }}>{projection.groupName}</span>
        <span style={{ fontSize: 11, color: "#6c86b5", fontFamily: "ui-monospace, monospace" }}>
          {projection.groupId}
        </span>

        {/* Every chain cell, one dot each — the whole spine as a single line. */}
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          marginInlineStart: "auto" }}>
          {projection.chain.map((c) => (
            <span key={c.key} title={`${c.label_he} · ${c.value ?? (c.absence ? ABSENCE_WORD[c.absence] : "—")}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%", background: DOT[c.status] }} />
              <span style={{ fontSize: 11, color: c.value ? "#c2d1e8" : "#5a6d92" }}>
                {c.value ?? "—"}
              </span>
            </span>
          ))}
        </span>

        {/* A TEXT CONTROL, NOT A PILL. This was a bordered 999px capsule —
            the last bordered rectangle left inside the surface, and the one
            thing the whole "no internal box" rule exists to forbid, sitting
            inside the box that rule describes. Clickability is carried by the
            underline, the chevron and the cursor: all three are unmistakable
            and none of them can bound a region. Same treatment as the field
            buttons below, which have been borderless from the start. */}
        <button type="button" onClick={() => setExpanded(true)}
          style={{
            appearance: "none", font: "inherit", cursor: "pointer", fontSize: 11.5,
            color: "#9fb0d0", background: "transparent",
            border: "none", borderRadius: 0, padding: "3px 0",
            textDecoration: "underline", textUnderlineOffset: 3,
          }}>
          כל השדות ▾
        </button>
      </section>
    );
  }

  return (
    <section dir="rtl" data-unified style={{
      /* THE ONE BORDER AND THE ONE RADIUS IN THE WHOLE SURFACE. */
      border: "1px solid rgba(52,211,153,0.30)",
      borderRadius: 14,
      background: "rgba(13,22,33,0.75)",
      padding: "16px 18px 14px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* ── THE ONE NAME ──────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f2f6fc", textWrap: "balance" }}>
          {projection.groupName}
        </h2>
        <span style={{ fontSize: 12, color: "#6c86b5", fontFamily: "ui-monospace, monospace" }}>
          {projection.groupId}
        </span>
        <span style={{ fontSize: 12.5, color: "#9fb0d0" }}>
          {projection.valueFamily ?? "ללא משפחת ערך"} · {projection.memberCount} חברים ·{" "}
          {projection.budget
            ? `${projection.budget.available.toLocaleString()} ${projection.budget.currency}`
            : "ללא תקציב"}{" "}
          · {projection.location.country_code ?? "ללא מיקום"}
        </span>
      </header>

      {/* ── EVERY FACT, EVERY LENS, ONE GRID ──────────────────────────── */}
      {/* SEPARATION BY SPACE, NOT BY RULES.
          The first attempt painted the container behind 1px gaps so the gaps
          read as hairlines. It works only while the grid is exactly full: any
          remainder track paints as a large empty rectangle in the middle of
          the surface, which is what it did. Space cannot do that — an empty
          track is simply empty — and it is also the honest device here,
          because these fields are peers, not table cells. */}
      <div style={{ display: "grid", gap: "14px 18px", alignItems: "start",
        gridTemplateColumns: "repeat(auto-fit, minmax(126px, 1fr))" }}>
        {projection.chain.map((c) => (
          <button key={c.key} type="button" data-cell={c.key} data-status={c.status}
            onClick={() => setOpen(open === c.key ? null : c.key)}
            aria-expanded={open === c.key}
            style={{
              appearance: "none", font: "inherit", textAlign: "start", cursor: "pointer",
              border: "none", borderRadius: 0, background: "transparent",
              padding: 0, minInlineSize: 0,
              display: "flex", flexDirection: "column", gap: 2,
              /* Selection is a left rule on the text, never a filled area. */
              borderInlineStart: open === c.key
                ? `2px solid ${DOT[c.status]}` : "2px solid transparent",
              paddingInlineStart: 8,
            }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%",
                background: DOT[c.status], flex: "0 0 auto" }} />

              <span style={{ fontSize: 9, letterSpacing: 0.5, color: "#5a6d92",
                fontFamily: "ui-monospace, monospace" }}>{LENS[c.key]}</span>
            </span>
            <span style={{ fontSize: 11, color: "#9fb0d0", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label_he}</span>
            <span style={{ fontSize: c.value ? 15 : 11, fontWeight: c.value ? 700 : 500,
              color: c.value ? "#e6edf7" : "#7c8fb4", lineHeight: 1.25 }}>
              {c.value ?? (c.absence ? ABSENCE_WORD[c.absence] : "—")}
            </span>
          </button>
        ))}
      </div>

      {/* ── THE OPERATIONAL CHAIN, SAME SURFACE ────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: 1, color: "#5a6d92", marginBlockEnd: 6,
          fontFamily: "ui-monospace, monospace" }}>
          שרשרת תפעולית · צורך → קבוצה → משאב → התאמה → פעולה → אפקט → ראיה → למידה
        </div>
        <div style={{ display: "grid", gap: "12px 18px", alignItems: "start",
          gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))" }}>
          {trace.hops.map((h) => (
            <button key={h.key} type="button" data-hop={h.key} data-state={h.state}
              onClick={() => setOpen(open === h.key ? null : h.key)}
              aria-expanded={open === h.key}
              style={{
                appearance: "none", font: "inherit", textAlign: "start", cursor: "pointer",
                border: "none", borderRadius: 0, background: "transparent",
                padding: 0, minInlineSize: 0,
                display: "flex", flexDirection: "column", gap: 2,
                borderInlineStart: open === h.key
                  ? `2px solid ${HOP_DOT[h.state]}` : "2px solid transparent",
                paddingInlineStart: 8,
              }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%",
                  background: HOP_DOT[h.state], flex: "0 0 auto" }} />
                <span style={{ fontSize: 9, letterSpacing: 0.4, color: "#5a6d92",
                  fontFamily: "ui-monospace, monospace", overflow: "hidden",
                  textOverflow: "ellipsis" }}>{h.state}</span>
              </span>
              <span style={{ fontSize: 11.5, color: "#9fb0d0", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.label_he}</span>
              <span style={{ fontSize: h.ids.length ? 15 : 11, fontWeight: h.ids.length ? 700 : 500,
                color: h.ids.length ? "#e6edf7" : "#7c8fb4" }}>
                {h.ids.length || HOP_WORD[h.state]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── DETAIL, IN PLACE. No second card, no drawer, no new border. ── */}
      {cell || hop ? (
        <div style={{ borderTop: "1px solid rgba(120,150,220,0.2)", paddingBlockStart: 10,
          fontSize: 12.5, lineHeight: 1.7, color: "#c2d1e8" }}>
          <div style={{ color: "#e6edf7", fontWeight: 700 }}>
            {cell ? `${cell.label_he} · ${cell.term}` : `${hop!.label_he}`}
            <span style={{ color: "#6c86b5", fontWeight: 400 }}>
              {"  "}· {cell ? (cell.absence ? ABSENCE_WORD[cell.absence] : "אמיתי") : HOP_WORD[hop!.state]}
            </span>
          </div>
          <div>{cell ? cell.because : hop!.because}</div>
          <div style={{ color: "#6c86b5", fontSize: 11.5, marginBlockStart: 3,
            fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
            {cell ? `מקור: ${cell.store} · provenance=${cell.provenance}${cell.gate_reason ? ` · gate=${cell.gate_reason}` : ""}`
                  : `מנגנון: ${hop!.mechanism}`}
          </div>
          {(cell?.record_ids.length || hop?.ids.length) ? (
            <div style={{ color: "#6c86b5", fontSize: 11, marginBlockStart: 2,
              fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
              רשומות: {(cell?.record_ids ?? hop!.ids).join(" · ")}
            </div>
          ) : null}
          {cell?.readings ? cell.readings.map((r) => (
            <div key={r.label} style={{ fontSize: 11.5, marginBlockStart: 3 }}>
              <b style={{ color: "#e6edf7" }}>{r.count}</b> {r.label}
              <span style={{ color: r.join === "CANONICAL_GROUP_ID" ? "#34d399" : "#8fa3c9" }}>
                {" "}[{r.join}]
              </span> — {r.because}
            </div>
          )) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#5a6d92" }}>
          לחיצה על כל שדה פותחת את המקור, הרשומות ומנגנון הצירוף שלו — באותו משטח, בלי לפתוח חלון.
        </span>
        {compact ? (
          /* Borderless, for the reason given on its twin in the compact
             strip: a capsule here is an internal rectangle inside the one
             box. `marginInlineStart: auto` is alignment and stays. */
          <button type="button" onClick={() => { setExpanded(false); setOpen(null); }}
            style={{
              appearance: "none", font: "inherit", cursor: "pointer", fontSize: 11.5,
              color: "#9fb0d0", background: "transparent", marginInlineStart: "auto",
              border: "none", borderRadius: 0, padding: "3px 0",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}>
            כווץ ▴
          </button>
        ) : null}
      </div>
    </section>
  );
}
