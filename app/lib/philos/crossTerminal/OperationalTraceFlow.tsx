/**
 * THE OPERATIONAL TRACE, DRAWN — Marketplace and Dynamics' shared surface.
 *
 * Same grammar as `EntityChainFlow`: a path whose rail lights only where a
 * real reference carries it, and whose breaks are drawn as breaks. What this
 * one adds is the ARROW: each hop states the mechanism that joins it to the
 * next — which field on which record carries which id — because "these two
 * things are related" is exactly the claim that must never be decorative.
 *
 * `STRUCTURAL_GAP` is drawn differently from every other absence and that is
 * deliberate. The others say "nothing was recorded"; this one says "nothing
 * COULD be recorded — the schema has no place to put it". One is a data gap
 * and one is a design gap, and a product that draws them the same way will
 * keep trying to fix the second by entering data.
 */
"use client";
import { useState } from "react";
import { HOP_WORD, type HopState, type OperationalTrace, type TraceHop } from "./operationalTraceModel";

const TONE: Record<HopState, { dot: string; text: string; edge: string; fill: string; rail: string }> = {
  CONNECTED:          { dot: "#34d399", text: "#c9f2df", edge: "rgba(52,211,153,0.5)",  fill: "rgba(52,211,153,0.08)",  rail: "#34d399" },
  AVAILABLE_UPSTREAM: { dot: "#a78bfa", text: "#ded5fb", edge: "rgba(167,139,250,0.5)", fill: "rgba(167,139,250,0.08)", rail: "#a78bfa" },
  NO_CANONICAL_LINK:  { dot: "#5a6d92", text: "#9fb0d0", edge: "rgba(120,150,220,0.20)", fill: "transparent", rail: "transparent" },
  NO_EVENT:           { dot: "#5a6d92", text: "#9fb0d0", edge: "rgba(120,150,220,0.20)", fill: "transparent", rail: "transparent" },
  NO_RECORD:          { dot: "#5a6d92", text: "#9fb0d0", edge: "rgba(120,150,220,0.20)", fill: "transparent", rail: "transparent" },
  /* RED. A relationship the system cannot represent is an unresolved
     operational risk, which is what red already means. Amber was a fifth
     colour invented for one case, and a vocabulary with an exception is a
     vocabulary the reader stops trusting. The red is on the JOIN, never on
     the record: the offer itself is REAL and says so in the drawer. */
  STRUCTURAL_GAP:     { dot: "#f87171", text: "#fbc9c9", edge: "rgba(248,113,113,0.5)", fill: "rgba(248,113,113,0.08)", rail: "transparent" },
};

const carries = (h: TraceHop): boolean => h.state === "CONNECTED" || h.state === "AVAILABLE_UPSTREAM";

/** Which hops each lens exists to answer. The trace is drawn whole either
 *  way; emphasis is opacity, never removal. */
export const TRACE_EMPHASIS: Record<"marketplace" | "dynamics", readonly string[]> = {
  marketplace: ["need", "need_group_link", "offer", "match", "action"],
  dynamics: ["action", "effect", "evidence", "learning"],
};

export default function OperationalTraceFlow({
  trace, emphasis, title, subtitle,
}: {
  trace: OperationalTrace;
  emphasis: keyof typeof TRACE_EMPHASIS;
  title: string;
  subtitle: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const lit = new Set(TRACE_EMPHASIS[emphasis]);
  const breaks = trace.hops.filter((h) => !carries(h)).length;

  return (
    <section dir="rtl" data-trace={emphasis} style={{
      background: "rgba(13,18,33,0.82)", border: "1px solid rgba(120,150,220,0.16)",
      borderRadius: 14, padding: "12px 14px 10px",
    }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBlockEnd: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f2f6fc", textWrap: "balance" }}>{title}</h3>
        <span style={{ fontSize: 11.5, color: "#6c86b5", fontFamily: "ui-monospace, monospace" }}>{trace.group_id}</span>
        <span style={{ fontSize: 11.5, color: "#8fa3c9", marginInlineStart: "auto" }}>
          {breaks === 0 ? "כל החוליות מחוברות" : `${breaks} חוליות לא מחוברות`}
        </span>
      </header>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#8fa3c9", maxInlineSize: "72ch" }}>{subtitle}</p>

      <ol style={{
        listStyle: "none", margin: 0, padding: 0,
        display: "grid", gap: "10px 0",
        gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))",
      }}>
        {trace.hops.map((h, i) => {
          const next = trace.hops[i + 1];
          const flows = next ? carries(h) && carries(next) : false;
          return (
            <li key={h.key} style={{ display: "flex", alignItems: "stretch", minInlineSize: 0 }}>
              <Hop hop={h} dim={!lit.has(h.key)} open={open === h.key}
                onToggle={() => setOpen(open === h.key ? null : h.key)} />
              {next ? (
                <span aria-hidden style={{
                  alignSelf: "center", inlineSize: 12, flex: "0 0 12px", borderRadius: 2,
                  ...(flows
                    ? { blockSize: 2, background: TONE[h.state].rail }
                    : { blockSize: 0, borderTop: "2px dotted rgba(120,150,220,0.35)" }),
                }} />
              ) : null}
            </li>
          );
        })}
      </ol>

      {open ? (() => {
        const h = trace.hops.find((x) => x.key === open)!;
        return (
          <div style={{
            marginBlockStart: 10, padding: "9px 11px", borderRadius: 10,
            background: "rgba(8,11,20,0.75)", border: `1px solid ${TONE[h.state].edge}`,
            fontSize: 12.5, lineHeight: 1.65,
          }}>
            <div style={{ color: TONE[h.state].text, fontWeight: 700 }}>
              {h.label_he} — {HOP_WORD[h.state]}
            </div>
            <div style={{ color: "#c2d1e8" }}>{h.because}</div>
            <div style={{ color: "#6c86b5", fontSize: 11.5, marginBlockStart: 4,
              fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
              מנגנון הצירוף: {h.mechanism}
            </div>
            {h.derivation ? (
              <div style={{ marginBlockStart: 6, paddingBlockStart: 6,
                borderTop: "1px solid rgba(167,139,250,0.25)" }}>
                <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 11.5 }}>
                  נגזרת — לא רשומה קנונית
                </div>
                <div style={{ color: "#c2d1e8", fontSize: 11.5 }}>{h.derivation.rule}</div>
                <div style={{ color: "#6c86b5", fontSize: 11, marginBlockStart: 2,
                  fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
                  {Object.entries(h.derivation.from).map(([k, v]) => `${k}=${v}`).join(" · ")}
                  <br />מקור: {h.derivation.store}
                </div>
              </div>
            ) : null}
            {h.gap_reason ? (
              <div style={{ color: "#f87171", fontSize: 11.5, marginBlockStart: 4,
                fontFamily: "ui-monospace, monospace" }}>
                reason = {h.gap_reason}
              </div>
            ) : null}
            {h.ids.length > 0 ? (
              <div style={{ color: "#6c86b5", fontSize: 11, marginBlockStart: 2,
                fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
                רשומות: {h.ids.join(" · ")}
              </div>
            ) : null}
          </div>
        );
      })() : null}

      {trace.missing_join_models.length > 0 ? (
        <div style={{
          marginBlockStart: 10, padding: "9px 11px", borderRadius: 10,
          background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.32)",
          fontSize: 12, lineHeight: 1.65, color: "#c2d1e8",
        }}>
          <div style={{ color: "#f87171", fontWeight: 700, fontSize: 12 }}>
            פער מבני · STRUCTURAL_GAP — היחס אינו ניתן לייצוג, הרשומות עצמן אמיתיות
          </div>
          {trace.missing_join_models.map((m) => (
            <div key={m.join} style={{ marginBlockStart: 4 }}>
              <b style={{ color: "#e6edf7", fontFamily: "ui-monospace, monospace" }}>{m.join}</b> — {m.because}
              <div style={{ color: "#9fb0d0", marginBlockStart: 2 }}>נדרש: {m.would_need}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ marginBlockStart: 8, fontSize: 11, color: "#6c86b5", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(["CONNECTED", "AVAILABLE_UPSTREAM", "STRUCTURAL_GAP", "NO_CANONICAL_LINK"] as HopState[]).map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%", background: TONE[s].dot, display: "inline-block" }} />
            {HOP_WORD[s]}
          </span>
        ))}
        <span style={{ marginInlineStart: "auto" }}>לחיצה על חוליה פותחת את מנגנון הצירוף שלה</span>
      </div>
    </section>
  );
}

function Hop({ hop, dim, open, onToggle }: {
  hop: TraceHop; dim: boolean; open: boolean; onToggle: () => void;
}) {
  const t = TONE[hop.state];
  const absent = !carries(hop);
  return (
    <button type="button" onClick={onToggle} aria-expanded={open}
      data-hop={hop.key} data-state={hop.state}
      style={{
        appearance: "none", cursor: "pointer", textAlign: "start", font: "inherit",
        flex: 1, minInlineSize: 0, padding: "6px 8px 7px", borderRadius: 9,
        background: t.fill, border: `1px solid ${open ? t.dot : t.edge}`,
        alignSelf: absent ? "flex-end" : "stretch",
        marginBlockStart: absent ? 8 : 0,
        opacity: dim ? 0.45 : 1,
        display: "flex", flexDirection: "column", gap: 1,
      }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <i style={{ inlineSize: 6, blockSize: 6, borderRadius: "50%", background: t.dot, flex: "0 0 auto" }} />
        <span style={{ fontSize: 9, letterSpacing: 0.5, color: "#6c86b5",
          fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
          {hop.state}
        </span>
      </span>
      <span style={{ fontSize: 11.5, color: "#a9bbd6", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {hop.label_he}
      </span>
      <span style={{
        fontSize: hop.ids.length > 0 ? 13 : 10.5, fontWeight: hop.ids.length > 0 ? 700 : 500,
        color: hop.ids.length > 0 ? t.text : "#7c8fb4", lineHeight: 1.25,
      }}>
        {hop.ids.length > 0 ? hop.ids.length : HOP_WORD[hop.state]}
      </span>
    </button>
  );
}
