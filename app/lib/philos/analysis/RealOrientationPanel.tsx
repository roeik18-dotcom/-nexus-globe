/**
 * THE PHILOS MATERIAL, ON REAL DATA, AT THE TOP OF EVERY TERMINAL.
 *
 * The four fundamentals and the six opposition classes were drawn only by
 * `PersonEventOrientationHeader`, which is bound to an acceptance fixture and
 * is correctly quarantined behind the DEMO boundary. The consequence was that
 * a REAL screen opened with gate counts and UNKNOWN diagnostics and no
 * philosophical content at all.
 *
 * This renders the SAME ten cards — `UnitRow` is imported, not reimplemented —
 * from the day's anchored Observation. When the frame cannot be resolved it
 * says which of the eleven conditions failed, in words, and shows nothing
 * else: an unresolved frame is a real state, not an empty decoration.
 */

import { UnitRow } from "./analysisUnitSections";
import { FOUNDATION_4, DEPARTMENTS_6, type AnalysisUnitReading } from "./analysisUnit";
import { MODEL_EXPLANATION } from "./unitMeaning";
import { terminalMeaning } from "./terminalMeaning";
import Link from "next/link";
import type { OrientationFrameResult } from "./realOrientationFrame";
import { COLOR, COLOR_ROLE, RADIUS, SPACE } from "../shell/designTokens";

/** What this terminal reads the same anchored frame as meaning. */
export type OrientationTerminal =
  | "hub" | "brain" | "dynamics" | "marketplace" | "community" | "planet" | "world";

const PERSPECTIVE: Record<OrientationTerminal, { title: string; note: string }> = {
  hub:         { title: "ההתמצאות של היום",
                 note: "התצפית שהיום נפתח איתה, והמצב שצוטט לצידה." },
  brain:       { title: "קריאה קוגניטיבית",
                 note: "מה סווג במפורש כידוע ומה נותר חסר. אין כאן הסקה." },
  dynamics:    { title: "מתחים ושינוי",
                 note: "יחידות שסומנו מול יחידות שלא — הפרש, לא סיבתיות." },
  marketplace: { title: "רלוונטיות לצורך ולפעולה",
                 note: "מה מהתצפית המעוגנת נוגע לצורך או להצעה. אין התאמה מאושרת." },
  community:   { title: "הגבול האישי–חברתי",
                 note: "קריאה אישית. אינה משויכת לקבוצה ללא קישור בר-ביצוע." },
  planet:      { title: "מיקום ברשת",
                 note: "הרשומות ניתנות לבדיקה. לא נרשמה התפשטות ברשת." },
  world:       { title: "רמה מערכתית",
                 note: "תצפית אישית אחת. אינה מסקנה מערכתית." },
};

export default function RealOrientationPanel({
  terminal, frame,
}: { terminal: OrientationTerminal; frame: OrientationFrameResult }) {
  const p = PERSPECTIVE[terminal];

  if (!frame.resolved) {
    return (
      <section dir="rtl" data-real-orientation={terminal} data-frame="unresolved" style={S.card}>
        <div style={S.head}>
          <span style={S.eyebrow}>התמצאות · ORIENTATION</span>
          <span style={S.unresolved}>UNRESOLVED — {frame.reason}</span>
        </div>
        <h2 style={S.title}>{p.title}</h2>
        {/* An unresolved frame states WHY and stops. It does not fall back to
            another record, and it does not draw ten empty cards as though the
            question had been asked and answered. */}
        <div style={S.note}>{frame.message}</div>
      </section>
    );
  }

  const o = frame.observation as unknown as Record<string, unknown>;
  const label = (r: AnalysisUnitReading) =>
    [...FOUNDATION_4, ...DEPARTMENTS_6].find((u) => u.id === r.unitId)!.label;
  const marked = frame.readings.filter((r) => r.status !== "unknown");
  const unmarked = frame.readings.filter((r) => r.status === "unknown");
  const m = terminalMeaning(terminal, marked.map(label), unmarked.map(label));

  return (
    <section dir="rtl" data-real-orientation={terminal} data-frame="resolved"
             data-canon-event-id={frame.canon_event_id} data-state-t0-id={frame.state_t0_id}
             style={S.card}>

      {/* 1. מה קרה — the sentence the person wrote, first, unaltered. */}
      <h2 style={S.title}>{m.title}</h2>
      {typeof o.context === "string" && o.context ? (
        <blockquote style={S.quote}>{o.context}</blockquote>
      ) : null}

      {/* 2. איך PHILOS מסדרת את זה — only Hub carries the full explanation;
          repeating it on all seven was what made six terminals redundant. */}
      {m.full ? <p style={S.body}>{MODEL_EXPLANATION}</p> : null}

      {/* 3. מה זה אומר במסוף הזה — the materially distinct part. */}
      <p style={S.body}>{m.hereMeans}</p>

      {/* THE TEN, in words. `סומן` / `לא סווג`, never OBSERVED / UNKNOWN. */}
      <div style={S.groups}>
        {/* THE SAME COMPONENT the demo header draws, in its plain variant —
            one implementation, so the ten units cannot be drawn two ways. */}
        <UnitRow group="FOUNDATION" title="משתני יסוד" note="הבסיס: זמן, חומר, מרווח, אנרגיה"
                 units={FOUNDATION_4} readings={byId(frame.readings)}
                 variant="plain" full={m.full} />
        <UnitRow group="DEPARTMENTS" title="מחלקות ניגוד" note="ההקשר: רגש, שכל, גוף, אישי, חברתי, מערכתי"
                 units={DEPARTMENTS_6} readings={byId(frame.readings)}
                 variant="plain" full={m.full} />
      </div>

      {/* 4. מה עדיין לא ידוע */}
      <div style={S.unknownBox}>
        <span style={S.boxLabel}>מה עדיין לא ידוע</span>
        <span style={S.body}>{m.stillUnknown}</span>
      </div>

      {/* 5. מה אפשר לעשות עכשיו — exactly one, or an honest none. */}
      <div style={S.nextBox}>
        <span style={S.boxLabel}>מה אפשר לעשות עכשיו</span>
        {m.nextAction
          ? <Link href={m.nextAction.href} style={S.nextLink}>{m.nextAction.label} ←</Link>
          : <span style={S.body}>במסוף הזה אין כרגע פעולה זמינה. זה לא חוסר — פשוט אין מה לעשות כאן עד שיירשם מידע נוסף.</span>}
      </div>

      {/* G. TECHNICAL AUDIT LAST — closed, and named for what it is. */}
      <details style={S.audit}>
        <summary style={S.auditSummary}>פרטי ביקורת טכניים</summary>
        <div dir="ltr" style={S.auditBody}>
          <div><b>canon_event_id</b> {frame.canon_event_id}</div>
          <div><b>state_t0_id</b> {frame.state_t0_id}</div>
          <div><b>day_id</b> {frame.day_id}</div>
          <div><b>observation</b> {String(o.domain)}/{String(o.frame)} · level {String(o.level)} · confidence {String(o.confidence)}</div>
          <div><b>state</b> {frame.state.domain_id}/{frame.state.parameter_id} · level {frame.state.level}</div>
          <div><b>units</b> {frame.observedCount} OBSERVED · {frame.unknownCount} UNKNOWN</div>
        </div>
      </details>
    </section>
  );
}

/** `UnitRow` indexes by unit id; the frame carries an ordered array. */
function byId(readings: AnalysisUnitReading[]) {
  return Object.fromEntries(readings.map((r) => [r.unitId, r])) as never;
}

const S: Record<string, React.CSSProperties> = {
  card: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg,
    background: COLOR.bgRaised, padding: SPACE.md, display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)", gap: 12, overflowWrap: "anywhere" },
  title: { fontSize: 24, color: COLOR.text, fontWeight: 800, margin: 0, lineHeight: 1.3 },
  /* The person's own sentence, set as a quotation — it is the only text on
     the screen that PHILOS did not write. */
  quote: { margin: 0, paddingInlineStart: 12, borderInlineStart: `3px solid ${COLOR_ROLE.purple}`,
    fontSize: 16, lineHeight: 1.6, color: COLOR.text },
  body: { fontSize: 15, lineHeight: 1.65, color: COLOR.textDim, margin: 0 },
  groups: { display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)" },
  group: { display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 1fr)" },
  groupHead: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" },
  groupTitle: { fontSize: 17, color: COLOR.text, fontWeight: 800 },
  groupNote: { fontSize: 13, color: COLOR.textFaint },
  unit: { display: "grid", gap: 2, paddingBlock: 7,
    borderTop: `1px solid ${COLOR.border}`, gridTemplateColumns: "minmax(0, 1fr)" },
  unitHead: { display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" },
  unitName: { fontSize: 15, fontWeight: 700 },
  unitStatus: { fontSize: 13, fontWeight: 600 },
  unitMeans: { fontSize: 14, lineHeight: 1.55, color: COLOR.textDim },
  unitNote: { fontSize: 13, lineHeight: 1.55, color: COLOR.textFaint },
  unknownBox: { display: "grid", gap: 3, padding: 10, borderRadius: 8,
    border: `1px solid rgba(251,191,36,0.28)`, gridTemplateColumns: "minmax(0, 1fr)" },
  nextBox: { display: "grid", gap: 3, padding: 10, borderRadius: 8,
    border: `1px solid rgba(52,211,153,0.28)`, gridTemplateColumns: "minmax(0, 1fr)" },
  boxLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: COLOR.textFaint },
  nextLink: { fontSize: 15, fontWeight: 700, color: "#34d399", textDecoration: "none" },
  audit: { marginTop: 4, borderTop: `1px solid ${COLOR.border}`, paddingTop: 8 },
  auditSummary: { cursor: "pointer", listStyle: "none", display: "block",
    fontSize: 12, fontWeight: 700, color: COLOR.textFaint },
  auditBody: { marginTop: 6, fontSize: 11.5, color: "#9fd0ff", textAlign: "left",
    wordBreak: "break-all", display: "grid", gap: 2 },
  unresolved: { fontSize: 11, fontWeight: 800, color: "#f2635c", letterSpacing: 0.4 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, letterSpacing: 1, color: COLOR.textFaint, fontWeight: 700 },
  note: { fontSize: 15, lineHeight: 1.6, color: COLOR.textDim },
};
