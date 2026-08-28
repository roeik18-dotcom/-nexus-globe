/**
 * ONE DRAWER, USED EVERYWHERE SYSTEM DETAIL APPEARS.
 *
 * Nine terminals each opened with the machine's account of itself — gate
 * names, resolver functions, bare UNKNOWN and UNRESOLVED tokens — above the
 * material a person came to read. None of it is wrong and none of it is
 * removed; it simply is not the headline, and printing it open made every
 * page look like a stack trace.
 *
 * Wrapping happens at each COMPONENT's own root rather than per page, so a
 * panel used on five terminals is folded once and stays folded on all five.
 *
 * `open` is uncontrolled on purpose: a person who opens a drawer keeps it
 * open across re-render, and nothing here re-closes it behind them.
 */
import type React from "react";

export function SystemDrawer({
  title, note, children, id,
}: {
  /** What is inside, in the words a person would use to look for it. */
  title: string;
  note?: string;
  children: React.ReactNode;
  /** Stable marker so a test can assert this region is closed by default. */
  id: string;
}) {
  return (
    <details data-system-details={id} style={S.wrap}>
      <summary style={S.summary}>
        <span style={S.title}>{title}</span>
        {note ? <span style={S.note}>{note}</span> : null}
      </summary>
      <div style={S.body}>{children}</div>
    </details>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    margin: 0, borderTop: "1px solid rgba(120,150,220,0.14)", paddingTop: 8,
    marginBlockStart: 8,
  },
  summary: {
    cursor: "pointer", listStyle: "none", display: "flex", flexWrap: "wrap",
    alignItems: "baseline", gap: 8, paddingBlock: 4,
  },
  title: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "#7d90b4" },
  note: { fontSize: 11, color: "#6c86b5" },
  body: { marginBlockStart: 10 },
};
