/**
 * WHAT A NEW USER SEES.
 *
 * Both surfaces rendered their full structure for a viewer who owns nothing —
 * a chain of empty nodes, four empty record lists, a trace of edges that
 * cannot exist. Technically honest, and useless: it looks like the product is
 * broken rather than like the person is new.
 *
 * An empty state has to answer four things, and the fourth is the one most
 * products skip:
 *
 *   1. where am I          the surface's name and what it reads
 *   2. what does it do     one sentence, in the reader's terms
 *   3. why is it empty     the actual reason, not "no data"
 *   4. what would fill it  the specific kind of record, so the emptiness is
 *                          actionable rather than a dead end
 *
 * It is deliberately NOT a call to action with a button: on these two
 * surfaces the populating event is recorded elsewhere, and a button that
 * cannot do the thing it names is worse than a sentence that explains it.
 */
import { COLOR, FS, RADIUS, SPACE, TYPE } from "./designTokens";

export default function SurfaceEmptyState({
  surface, does, why, fills,
}: {
  /** The terminal's own name, as the band shows it. */
  surface: string;
  does: string;
  why: string;
  /** The record kinds that would populate this surface, in the reader's terms. */
  fills: string[];
}) {
  return (
    <section dir="rtl" style={S.box} aria-label={`${surface} — אין נתונים`}>
      <h2 style={S.head}>{surface} · אין עדיין נתונים</h2>
      <p style={S.does}>{does}</p>

      <div style={S.row}>
        <span style={S.label}>למה ריק</span>
        <p style={S.text}>{why}</p>
      </div>

      <div style={S.row}>
        <span style={S.label}>מה ימלא אותו</span>
        <ul style={S.ul}>
          {fills.map((f) => <li key={f} style={S.li}>{f}</li>)}
        </ul>
      </div>

      <p style={S.rule}>
        המסך הזה ריק כי אין רשומות — לא כי משהו נכשל. PHILOS לא ממציא תוכן
        להדגמה כדי למלא מסך, ותוכן DEMO לעולם אינו מוצג כאילו הוא שלך.
      </p>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  box: {
    display: "flex", flexDirection: "column", gap: SPACE.md,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
    background: COLOR.bgRaised, padding: `${SPACE.lg}px ${SPACE.lg}px`,
    maxWidth: 640,
  },
  head: { ...TYPE.title, fontSize: FS.head, color: COLOR.text, margin: 0 },
  does: { margin: 0, fontSize: FS.read, color: COLOR.textDim, lineHeight: 1.7 },
  row: { display: "flex", gap: SPACE.md, alignItems: "flex-start" },
  label: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, width: 108, flexShrink: 0, paddingTop: 3 },
  text: { margin: 0, fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.7 },
  ul: { margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 },
  li: { fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.6 },
  rule: { margin: 0, fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.7, borderTop: `1px solid ${COLOR.border}`, paddingTop: SPACE.sm },
};
