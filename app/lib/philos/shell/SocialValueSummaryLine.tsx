/**
 * SOCIAL-VALUE SUMMARY — Hub's one-line answer to "what is relevant now".
 *
 * Hub is not the place for the spine or the registry. Community owns the
 * chain, Brain owns the provenance. Hub answers only: of that system, what
 * currently touches THIS person, and what does not.
 *
 * The distinction it exists to make visible: the contradiction/value layer
 * is almost entirely SOURCE material — 110 identities, 4 value relations —
 * while what this person actually has is a handful of real records. Showing
 * the big numbers on Hub would imply the system knows a great deal about
 * them. It does not, and the line says so.
 *
 * One line, no counts that overstate, and a link out rather than a copy.
 */
import { CONTRADICTION_MASTER } from "../valueSystem/contradictionMaster";
import { DIRECT_CONTRADICTION_VALUE_RELATIONS } from "../valueSystem/socialValueSpine";
import { COLOR, FS, RADIUS, SPACE, TYPE } from "./designTokens";

export default function SocialValueSummaryLine({
  verifiedGroupRelations = 0, namedBaseOppositions = 0,
}: {
  /** Real verified Value Group memberships for this subject. */
  verifiedGroupRelations?: number;
  /** How many source oppositions this subject's own observation NAMES. */
  namedBaseOppositions?: number;
}) {
  const touches = verifiedGroupRelations > 0 || namedBaseOppositions > 0;
  return (
    <div dir="rtl" style={S.line}>
      <span style={S.eyebrow}>מערכת ערכית-חברתית · SOCIAL-VALUE</span>

      <span style={S.seg}>
        <b style={S.src}>{CONTRADICTION_MASTER.length}</b> ניגודי מקור
        <span style={S.tag}>SOURCE</span>
      </span>
      <span style={S.seg}>
        <b style={S.src}>{DIRECT_CONTRADICTION_VALUE_RELATIONS.length}</b> יחסי צמיחת-ערך
        <span style={S.tag}>SOURCE</span>
      </span>

      <span style={S.divider} />

      <span style={S.seg}>
        <b style={verifiedGroupRelations > 0 ? S.real : S.none}>{verifiedGroupRelations}</b> חברות מאומתת
        <span style={S.tagReal}>REAL</span>
      </span>
      <span style={S.seg}>
        <b style={namedBaseOppositions > 0 ? S.real : S.none}>{namedBaseOppositions}</b> ניגוד מקור שהתצפית מזכירה
        <span style={S.tagReal}>REAL</span>
      </span>

      <span style={S.note}>
        {touches
          ? "מספרי המקור הם מה שידוע בתיאוריה — לא מה שנמדד עליך."
          : "המערכת מחזיקה חומר מקור נרחב, ואפס ממנו נמדד עליך עדיין."}
      </span>
      <a href="/hub/community" style={S.link}>השרשרת המלאה ב-Community →</a>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  line: {
    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
    background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.18)",
    borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md,
  },
  eyebrow: { ...TYPE.micro, fontSize: FS.tag, color: "#a78bfa" },
  seg: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: COLOR.textDim },
  src: { fontSize: 15, fontWeight: 800, color: "#a78bfa", fontFamily: "ui-monospace, monospace" },
  real: { fontSize: 15, fontWeight: 800, color: "#34d399", fontFamily: "ui-monospace, monospace" },
  none: { fontSize: 15, fontWeight: 800, color: "#8798b8", fontFamily: "ui-monospace, monospace" },
  tag: { ...TYPE.micro, fontSize: FS.tag, color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)", borderRadius: RADIUS.pill, padding: "0 5px" },
  tagReal: { ...TYPE.micro, fontSize: FS.tag, color: "#34d399", border: "1px solid rgba(52,211,153,0.35)", borderRadius: RADIUS.pill, padding: "0 5px" },
  divider: { width: 1, alignSelf: "stretch", background: COLOR.border },
  note: { fontSize: FS.tag, color: COLOR.textFaint, flex: 1, minWidth: 200 },
  link: { fontSize: FS.tag, color: COLOR.accent, textDecoration: "none" },
};
