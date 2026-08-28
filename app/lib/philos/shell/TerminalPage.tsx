/**
 * TERMINAL PAGE — the page hierarchy, declared once, for every SOCIAL terminal.
 *
 * WHY THIS EXISTS. `SystemShell` is a HEADER. It takes no children and renders
 * no body, so each terminal hand-wrote its own vertical order in JSX from the
 * same fourteen shared imports. Tier therefore became an accident of the order
 * a file happened to be written in, and the audit could measure the result: the
 * CONTEXT/SCALE strip sat second on Community (y=88) and twelfth on World
 * (y=1564); World told the 34→0 story four separate times across 57% of its
 * page; Community rendered an 825px ontology map, a 680px inspector and a 471px
 * workspace at the same visual weight. Nothing was wrong with any individual
 * component. What was missing was anywhere to say WHICH TIER a component is.
 *
 * That is all this file does. It encodes hierarchy — never business logic, never
 * a projection, never a count. Every section handed to it renders the markup it
 * already rendered; it only declares where in the reading order that markup
 * belongs, and the shell draws the order the same way on all three terminals.
 *
 * THE TIERS, top to bottom:
 *
 *   GLOBAL NAV        the shell. Frozen contract — passed straight through.
 *   ENTITY CONTEXT    UnifiedEntitySurface, compact. Frozen contract.
 *   ROUTE PRIMARY     EXACTLY ONE workspace. The terminal's own question, and
 *                     the answer to it. Owns the first viewport under context.
 *   ACTIONS           the controls that act on the primary, adjacent to it and
 *                     above the fold — not stranded a screen below.
 *   SECONDARY         real, route-owned material that is not the question the
 *                     terminal exists to answer. Collapsed, one click, and
 *                     LABELLED WITH ITS OWN SUMMARY so the closed state still
 *                     reports what is inside it.
 *   AUDIT             provenance, source and diagnostics. Same mechanism as
 *                     SECONDARY, visibly one tier quieter.
 *
 * A CLOSED SECTION IS NOT A HIDDEN SECTION. Every collapsed region prints its
 * title and a summary of what it holds — a count, a state, a figure — so the
 * reader can decide without opening, and reaches it in exactly one click. This
 * is the one rule that makes demotion honest rather than removal.
 */
import type { ReactNode } from "react";

import { COLOR, FS, RADIUS, SPACE, TYPE } from "./designTokens";

/** One collapsible region. `summary` is what the CLOSED state reports. */
export interface TerminalSection {
  /** Stable id — also the DOM `data-section`, which the acceptance run reads. */
  id: string;
  /** The closed-state name. A noun phrase, never a sentence. */
  title: string;
  /**
   * The closed-state finding: a count, a figure, a state. This is what makes a
   * collapsed section legible without opening it, and it is required for
   * SECONDARY tier — a drawer labelled only "details" hides its contents in
   * every way that matters.
   */
  summary?: string;
  /** Open on load. Reserve for a section the terminal cannot be read without. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function TerminalPage({
  nav, entity, primary, actions, secondary = [], audit = [], background,
}: {
  /** GLOBAL — the shared shell. Rendered first, unmodified. */
  nav: ReactNode;
  /** ENTITY CONTEXT — the frozen compact surface. Absent when nothing selected. */
  entity?: ReactNode;
  /** ROUTE PRIMARY — the one workspace. Not optional: a terminal without a
   *  primary question is the defect this contract exists to prevent. */
  primary: ReactNode;
  /** ACTIONS — controls on the primary. Sits directly under it, above the fold. */
  actions?: ReactNode;
  secondary?: readonly TerminalSection[];
  audit?: readonly TerminalSection[];
  /** Page ground. Terminals with their own field (World's starfield) pass it. */
  background?: string;
}) {
  return (
    <div data-terminal-page style={{ background: background ?? "#0a0e17", minBlockSize: "100vh" }}>
      {/* ── GLOBAL ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "10px 16px 0", position: "relative", zIndex: 1 }}>{nav}</div>

      {/* ── ENTITY CONTEXT ─────────────────────────────────────────────── */}
      {entity ? (
        <div data-tier="entity" style={{ margin: "10px 16px 12px", position: "relative", zIndex: 1 }}>
          {entity}
        </div>
      ) : null}

      {/* ── ROUTE PRIMARY ──────────────────────────────────────────────────
          No frame, no eyebrow, no restated title. The primary does not need a
          container to say it is primary; it is primary because everything else
          on the page is collapsed. Adding chrome here would spend the fold on
          announcing the workspace instead of showing it. */}
      <main data-tier="primary" style={{ position: "relative", zIndex: 1, padding: "0 16px" }}>
        {primary}
      </main>

      {/* ── ACTIONS ────────────────────────────────────────────────────── */}
      {actions ? (
        <div data-tier="actions" style={{ padding: "10px 16px 0", position: "relative", zIndex: 1 }}>
          {actions}
        </div>
      ) : null}

      {/* ── SECONDARY ──────────────────────────────────────────────────── */}
      {secondary.length > 0 ? (
        <div data-tier="secondary" style={S.stack}>
          {secondary.map((s) => <Section key={s.id} section={s} tier="SECONDARY" />)}
        </div>
      ) : null}

      {/* ── AUDIT ──────────────────────────────────────────────────────── */}
      {audit.length > 0 ? (
        <div data-tier="audit" style={S.stack}>
          {audit.map((s) => <Section key={s.id} section={s} tier="AUDIT" />)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One collapsible tier member.
 *
 * `<details>` rather than a state toggle: it is one click, it is keyboard and
 * screen-reader native, and the open/closed state survives a re-render without
 * this component owning any state. The children stay in the tree — reachability
 * is the contract, and a section that unmounts loses scroll, selection and any
 * work in progress inside it.
 */
function Section({ section, tier }: { section: TerminalSection; tier: "SECONDARY" | "AUDIT" }) {
  const quiet = tier === "AUDIT";
  return (
    <details
      data-section={section.id}
      data-tier-member={tier}
      open={section.defaultOpen}
      dir="rtl"
      style={{ ...S.details, ...(quiet ? S.detailsQuiet : null) }}
    >
      <summary style={S.summary}>
        <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.2,
          color: quiet ? COLOR.textFaint : COLOR.textDim }}>
          {/* The tier is a LAYOUT rank, and printing its English name on every
              section header was the single most repeated piece of machine
              vocabulary in the product. The rank still shows — in words. */}
          {tier === "AUDIT" ? "לבדיקה" : "משני"}
        </span>
        <span style={{ fontSize: FS.read, color: quiet ? COLOR.textDim : COLOR.text, fontWeight: 600 }}>
          {section.title}
        </span>
        {/* THE CLOSED STATE STILL REPORTS. Without this a demoted section is
            indistinguishable from a deleted one. */}
        {section.summary ? (
          <span style={{ fontSize: FS.meta, color: COLOR.textFaint, fontWeight: 400 }}>
            {section.summary}
          </span>
        ) : null}
        <span aria-hidden style={S.chev}>▾</span>
      </summary>
      <div style={{ paddingBlock: SPACE.sm }}>{section.children}</div>
    </details>
  );
}

const S: Record<string, React.CSSProperties> = {
  stack: {
    display: "flex", flexDirection: "column", gap: 8,
    padding: "12px 16px 16px", position: "relative", zIndex: 1,
  },
  details: {
    background: "rgba(17,23,42,0.5)",
    border: `1px solid rgba(120,150,220,0.14)`,
    borderRadius: RADIUS.md,
    padding: "0 12px 2px",
  },
  /* AUDIT is the same mechanism one step quieter — recessed ground, no border
     strength. The tier is legible before a word is read. */
  detailsQuiet: { background: "rgba(0,0,0,0.24)", border: `1px solid rgba(120,150,220,0.08)` },
  summary: {
    cursor: "pointer", listStyle: "none", display: "flex", alignItems: "baseline",
    gap: SPACE.sm, flexWrap: "wrap", padding: "10px 0", minBlockSize: 32,
  },
  chev: { marginInlineStart: "auto", color: COLOR.textFaint, fontSize: FS.meta },
};
