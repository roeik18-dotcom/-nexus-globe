/**
 * WHAT A TERMINAL SHOWS BEFORE YOU ASK IT FOR MORE.
 *
 * Every page had grown into a stack: a gate strip, an orientation card, an
 * action/effect list, a gap panel, a chain summary, forms, and a dozen
 * drawers whose SUMMARY lines were themselves machine vocabulary —
 * FULL GATE AUDIT, CARRY-FORWARD, ACTION → EFFECT, BRAIN DERIVATION. Folding
 * the bodies did nothing for that: a closed <details> still shows its
 * summary, so the page still read as a console.
 *
 * A terminal now leads with four things and nothing else:
 *   1. a human title
 *   2. what is known right now
 *   3. what is missing
 *   4. exactly one action
 * Everything else — every panel, id, provenance mark, form and audit — goes
 * into ONE drawer at the foot, whose own label is a human phrase.
 *
 * NOTHING IS DELETED. The whole previous page is the drawer's contents.
 *
 * AN EMPTY ACCOUNT GETS ONE SENTENCE. A person with no records was shown the
 * identical scaffolding as a person with a full day, every panel reporting
 * its own emptiness — a dozen ways of saying "nothing here yet". They get one
 * way, and the same drawer if they want to look.
 */
import Link from "next/link";
import type React from "react";

import { terminalMeaning, type MeaningTerminal, type DayChain } from "../analysis/terminalMeaning";

export const TECHNICAL_DRAWER_LABEL = "פרטים טכניים";

export function TerminalView({
  terminal, chain, frame, emptyLine, children,
}: {
  terminal: MeaningTerminal;
  chain: Omit<DayChain, "markedCount" | "unmarkedCount">;
  /** The day's orientation reading. Unresolved means nothing anchors this
   *  terminal yet — which is the empty state, not an error to report. */
  frame: { resolved: boolean; readings?: ReadonlyArray<{ status: string }> };
  emptyLine?: string;
  /** The entire previous page. Kept whole, behind one disclosure. */
  children: React.ReactNode;
}) {
  const readings = frame.readings ?? [];
  const markedCount = readings.filter((r) => r.status !== "unknown").length;
  const unmarkedCount = readings.length - markedCount;
  /* Empty means: no observation anchors the day AND nothing was acted on.
     One test, one sentence — not every panel announcing its own zero. */
  const isEmpty = !frame.resolved && !chain.hasAction && !chain.hasEffect;
  const m = terminalMeaning(terminal, { ...chain, markedCount, unmarkedCount });

  return (
    <section dir="rtl" style={S.page} data-terminal-view={terminal}>
      <h1 style={S.title}>{m.title}</h1>

      {isEmpty ? (
        /* ONE empty state. Not a chain of panels each reporting its own zero. */
        <p style={S.empty} data-terminal-empty>
          {emptyLine ?? "עדיין אין כאן חומר. ברגע שיירשם משהו, הוא יופיע כאן."}
        </p>
      ) : (
        <>
          <p style={S.lede}>{m.examines}</p>

          <div style={S.block} data-block="known">
            <span style={S.label}>מה ידוע כרגע</span>
            <ul style={S.list}>
              {[...m.material, ...m.known].map((x) => <li key={x} style={S.li}>{x}</li>)}
            </ul>
          </div>

          <div style={S.block} data-block="missing">
            <span style={S.label}>מה חסר</span>
            <ul style={S.list}>
              {m.unknown.map((x) => <li key={x} style={S.li}>{x}</li>)}
            </ul>
          </div>
        </>
      )}

      {/* EXACTLY ONE. */}
      <div style={S.actionBox} data-block="action">
        {m.nextAction
          ? <Link href={m.nextAction.href} style={S.action}>{m.nextAction.label} ←</Link>
          : <span style={S.noAction}>אין כרגע פעולה זמינה כאן.</span>}
      </div>

      <details style={S.drawer} data-technical-drawer={terminal}>
        <summary style={S.summary}>{TECHNICAL_DRAWER_LABEL}</summary>
        <div style={S.drawerBody}>{children}</div>
      </details>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)",
    maxWidth: 760, margin: "0 auto", padding: "8px 0 24px", minWidth: 0,
  },
  title: { fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 800, color: "#f2f6fc", margin: 0, lineHeight: 1.25 },
  lede: { margin: 0, fontSize: 16, lineHeight: 1.65, color: "#9fb0d0" },
  empty: { margin: 0, fontSize: 16, lineHeight: 1.7, color: "#9fb0d0" },
  block: {
    display: "grid", gap: 4, padding: "12px 14px", borderRadius: 10,
    border: "1px solid rgba(120,150,220,0.18)", gridTemplateColumns: "minmax(0, 1fr)",
  },
  label: { fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#6c86b5" },
  list: { margin: 0, paddingInlineStart: 18, display: "grid", gap: 4 },
  li: { fontSize: 15, lineHeight: 1.6, color: "#c8d4e8", overflowWrap: "anywhere" },
  actionBox: { paddingBlock: 2 },
  action: {
    display: "inline-block", fontSize: 16, fontWeight: 700, color: "#02101f",
    background: "#34d399", borderRadius: 999, padding: "10px 20px", textDecoration: "none",
  },
  noAction: { fontSize: 15, color: "#8fa3c9" },
  drawer: { marginBlockStart: 6, borderTop: "1px solid rgba(120,150,220,0.16)", paddingTop: 10 },
  summary: { cursor: "pointer", listStyle: "none", fontSize: 13, fontWeight: 700, color: "#7d90b4", paddingBlock: 4 },
  drawerBody: { marginBlockStart: 12, display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)" },
};
