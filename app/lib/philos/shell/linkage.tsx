/**
 * LINKAGE — the one shared vocabulary for "how strongly is THIS stage
 * connected to the previous one", and the visual treatment that goes with
 * it.
 *
 * CHRONOLOGY != CAUSALITY is already enforced in the DATA layer
 * (`actionLifecycle.ts` joins records only through explicit id references,
 * never through `recorded_at` order). This module enforces the same thing
 * in the VISUAL layer, which is where it was still being lost: a row of
 * identical arrows between eight cards reads as "each one caused the next"
 * no matter what the underlying records say. One arrow treatment per real
 * linkage kind means the picture can no longer claim more than the store
 * does.
 *
 *   VERIFIED_CAUSAL_LINK     a record states that A CAUSED B.
 *   VERIFIED_REFERENCE_LINK  a record explicitly REFERENCES the other by id
 *                            (`effect.action_ref`, `learning.effect_ref`,
 *                            `action.inputs[]`), or the two values live on
 *                            the SAME record. Real and checked — but a
 *                            reference, not a causal claim.
 *   CHRONOLOGICAL_ONLY       both records are real and ordered in time, and
 *                            that is ALL that is known. Explicitly not a
 *                            link.
 *   UNLINKED                 records that COULD have been linked exist, and
 *                            none of them references the other. A real,
 *                            negative finding — not missing data.
 *   UNKNOWN                  one side has no record at all, so no link can
 *                            exist to classify.
 *
 * **`VERIFIED_CAUSAL_LINK` is currently unreachable, and that is the
 * honest state of the system, not an oversight.** No canon primitive
 * carries a causal field: there is no `caused_by`, no cause/effect edge
 * type, no join-key allow-list anywhere in `app/lib/philos/canon`
 * (`projectCanonDynamics.ts`'s own header states the same finding for
 * Observations: "Canon has no cross-Observation causal link today"). The
 * strongest thing any two real records say about each other is "this one
 * names that one's id" — which is exactly `VERIFIED_REFERENCE_LINK`. The
 * causal kind is defined here so that the day a real causal field is
 * designed it has one treatment instead of seven; until then nothing may
 * return it, and no surface may style a reference link as a causal one.
 */
import { COLOR, FS, RADIUS, TYPE } from "./designTokens";

export type Linkage =
  | "VERIFIED_CAUSAL_LINK"
  | "VERIFIED_REFERENCE_LINK"
  | "CHRONOLOGICAL_ONLY"
  | "UNLINKED"
  | "UNKNOWN";

export interface LinkageStyle {
  /** The connector glyph. Solid arrow = a real reference; the weaker kinds
   *  never get one, so a filled arrowhead always means a checked link. */
  glyph: string;
  color: string;
  /** Short label rendered under the connector — the classification is
   *  stated in words, never left to be read out of a line weight. */
  label: string;
  /** Hover text: what the classification means for THIS pair. */
  title: string;
  /** `solid` only for a real, checked link. */
  stroke: "solid" | "dashed" | "dotted" | "none";
}

export const LINKAGE_STYLE: Record<Linkage, LinkageStyle> = {
  VERIFIED_CAUSAL_LINK: {
    glyph: "⇒", color: "#34d399", label: "CAUSAL", stroke: "solid",
    title: "רשומה קובעת סיבתיות מפורשת בין השלבים. (אין היום שדה כזה בקנון — ראה linkage.tsx)",
  },
  VERIFIED_REFERENCE_LINK: {
    glyph: "→", color: "#5b9cf6", label: "REFERENCE", stroke: "solid",
    title: "קישור אמיתי ובדוק: רשומה אחת מפנה מפורשות ל-id של השנייה (או שתיהן על אותה רשומה). הפניה — לא טענת סיבתיות.",
  },
  CHRONOLOGICAL_ONLY: {
    glyph: "⋯", color: "#8798b8", label: "CHRONOLOGY ONLY", stroke: "dotted",
    title: "שתי רשומות אמיתיות המסודרות בזמן — וזה כל מה שידוע. קרונולוגיה אינה סיבתיות.",
  },
  UNLINKED: {
    glyph: "⊣", color: "#fbbf24", label: "UNLINKED", stroke: "dashed",
    title: "קיימות רשומות שיכלו להיות מקושרות, ואף אחת אינה מפנה לשנייה. ממצא אמיתי — לא נתון חסר.",
  },
  UNKNOWN: {
    glyph: "·", color: "#6c86b5", label: "NO LINK POSSIBLE", stroke: "none",
    title: "לצד אחד אין רשומה כלל, ולכן אין קישור לסווג.",
  },
};

/**
 * The connector itself. Deliberately narrow and quiet: it is a
 * classification, not decoration, so the strongest thing it can do is
 * render a solid blue arrow — reserved for a checked id reference.
 */
export function LinkageConnector({ kind }: { kind: Linkage }) {
  const s = LINKAGE_STYLE[kind];
  return (
    <div
      title={s.title}
      style={{
        width: 54, flexShrink: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 2,
      }}
    >
      <span style={{ fontSize: 15, color: s.color, lineHeight: 1 }}>{s.glyph}</span>
      <span
        style={{
          height: 0, width: 30,
          borderTop: s.stroke === "none" ? "none" : `1px ${s.stroke} ${s.color}`,
          opacity: s.stroke === "solid" ? 0.9 : 0.55,
        }}
      />
      <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 0.3, color: s.color, textAlign: "center", lineHeight: 1.1 }}>
        {s.label}
      </span>
    </div>
  );
}

/**
 * One legend per chain, so the connector vocabulary is readable without
 * hovering. Renders only the kinds actually present — a legend entry for a
 * kind that does not occur would itself be a small false claim about what
 * the screen contains.
 */
export function LinkageLegend({ kinds }: { kinds: readonly Linkage[] }) {
  const present = [...new Set(kinds)];
  if (present.length === 0) return null;
  return (
    <div dir="ltr" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 6 }}>
      {present.map((k) => {
        const s = LINKAGE_STYLE[k];
        return (
          <span key={k} title={s.title} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: s.color, fontSize: 13 }}>{s.glyph}</span>
            <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, letterSpacing: 0.4 }}>{s.label}</span>
          </span>
        );
      })}
      <span style={{ fontSize: FS.tag, color: COLOR.textFaint, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "1px 7px" }}>
        קרונולוגיה אינה סיבתיות
      </span>
    </div>
  );
}
