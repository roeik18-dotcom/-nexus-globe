/**
 * PROVENANCE — the one shared vocabulary for "where did this value come
 * from", used identically by every product surface (Dynamics' causal
 * timeline, Hub's Person Now, Brain's derivation, Community's value
 * groups, Marketplace's flow).
 *
 * Before this module each surface hand-rolled its own badge colours and,
 * worse, its own words — so "REAL" on one screen and "CANON" on another
 * could mean the same thing, or different things, with no way to tell.
 * One vocabulary, one visual treatment, one meaning:
 *
 *   CANON   a persisted canon record (Observation / Action / Effect /
 *           Learning / Need / DomainState store)
 *   REAL    the real durable Philos event log (`loadPhilosEvents`) —
 *           real recorded history that predates the canon primitives
 *   LEGACY  a pre-canon projection (`projectDynamics` and friends)
 *   DEMO    a DEMO_COMMUNITIES / reference instance — hypothesis only,
 *           never mixed into a REAL total
 *   STATIC  computed in-code from a rule over real records; the ORDER or
 *           the PHRASING is ours, the underlying rows are real
 *   UNKNOWN genuinely absent — no record exists. Never a placeholder,
 *           never a zero standing in for "we did not look."
 *
 * A badge is a claim about provenance, so it is deliberately cheap to
 * render and impossible to style away: every surface that shows a value
 * shows where it came from, or shows UNKNOWN.
 */
import { RADIUS } from "./designTokens";

export type Provenance = "CANON" | "REAL" | "LEGACY" | "DEMO" | "STATIC" | "UNKNOWN";

export const PROVENANCE_STYLE: Record<Provenance, { bg: string; border: string; text: string }> = {
  CANON: { bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.45)", text: "#34d399" },
  REAL: { bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.32)", text: "#6fe3b4" },
  LEGACY: { bg: "rgba(91,156,246,0.12)", border: "rgba(91,156,246,0.38)", text: "#5b9cf6" },
  DEMO: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)", text: "#fbbf24" },
  STATIC: { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.4)", text: "#a78bfa" },
  UNKNOWN: { bg: "rgba(90,111,150,0.10)", border: "rgba(90,111,150,0.32)", text: "#8798b8" },
};

export function ProvenanceBadge({ p, title }: { p: Provenance; title?: string }) {
  const s = PROVENANCE_STYLE[p];
  return (
    <span
      title={title}
      style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: 0.7,
        padding: "1px 6px", borderRadius: RADIUS.pill,
        background: s.bg, border: `1px solid ${s.border}`, color: s.text,
        fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap",
      }}
    >
      {p}
    </span>
  );
}
