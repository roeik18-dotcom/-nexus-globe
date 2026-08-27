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
import { UnitRow, T } from "./analysisUnitSections";
import { FOUNDATION_4, DEPARTMENTS_6 } from "./analysisUnit";
import type { OrientationFrameResult } from "./realOrientationFrame";
import { COLOR, RADIUS, SPACE } from "../shell/designTokens";

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
  return (
    <section dir="rtl" data-real-orientation={terminal} data-frame="resolved"
             data-canon-event-id={frame.canon_event_id} data-state-t0-id={frame.state_t0_id}
             style={S.card}>
      <div style={S.head}>
        <span style={S.eyebrow}>התמצאות · ORIENTATION</span>
        <span style={S.counts}>
          <b style={{ color: "#8fd7ff" }}>{frame.observedCount} OBSERVED</b>
          {" · "}
          <span style={{ color: COLOR.textDim }}>{frame.unknownCount} UNKNOWN</span>
        </span>
      </div>

      <h2 style={S.title}>{p.title}</h2>
      <div style={S.note}>{p.note}</div>

      {/* THE ANCHORED OBSERVATION, as stored. Not re-interpreted. */}
      <div style={S.reading}>
        <span style={S.k}>תצפית מעוגנת</span>
        <span style={S.v}>
          {String(o.domain)}/{String(o.frame)} · level {String(o.level)} · confidence {String(o.confidence)}
        </span>
      </div>
      {typeof o.context === "string" && o.context ? (
        <div style={S.context}>{o.context}</div>
      ) : null}
      <div style={S.reading}>
        <span style={S.k}>מצב פתיחה</span>
        <span style={S.v}>
          {frame.state.domain_id}/{frame.state.parameter_id} · level {frame.state.level}
        </span>
      </div>

      {/* THE TEN — the same component the demo header draws. */}
      <UnitRow group="FOUNDATION" title="משתני יסוד" note="4"
               units={FOUNDATION_4} readings={byId(frame.readings)} />
      <UnitRow group="DEPARTMENTS" title="מחלקות ניגוד" note="6"
               units={DEPARTMENTS_6} readings={byId(frame.readings)} />

      {/* AUDIT — the two ids every terminal must be checkable against. */}
      <div style={S.audit} dir="ltr">
        <div><b>canon_event_id</b> {frame.canon_event_id}</div>
        <div><b>state_t0_id</b> {frame.state_t0_id}</div>
        <div><b>day_id</b> {frame.day_id}</div>
      </div>
    </section>
  );
}

/** `UnitRow` indexes by unit id; the frame carries an ordered array. */
function byId(readings: { unitId: string }[]) {
  return Object.fromEntries(readings.map((r) => [r.unitId, r])) as never;
}

const S: Record<string, React.CSSProperties> = {
  /* `minmax(0, 1fr)` is load-bearing: a grid item defaults to `min-width:
     auto`, so long Hebrew sentences and the wide unit cards refused to shrink
     and pushed 64px outside the card on a 390px screen — clipping "OBSERVED"
     to "ED" while the PAGE still reported no horizontal overflow. */
  card: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg,
    background: COLOR.bgRaised, padding: SPACE.md, display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)", gap: 6, overflowWrap: "anywhere" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline",
    gap: 8, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, letterSpacing: 1, color: COLOR.textFaint, fontWeight: 700 },
  counts: { fontSize: T.meta, fontWeight: 800, whiteSpace: "nowrap" },
  title: { fontSize: T.section, color: COLOR.text, fontWeight: 800, margin: 0 },
  note: { fontSize: T.body, color: COLOR.textDim, lineHeight: T.lh },
  reading: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginTop: 4 },
  k: { fontSize: T.micro, color: COLOR.textFaint, fontWeight: 700 },
  v: { fontSize: T.body, color: COLOR.text, fontWeight: 600 },
  context: { fontSize: T.body, color: COLOR.textDim, lineHeight: T.lh,
    borderInlineStart: `3px solid ${COLOR.border}`, paddingInlineStart: 10 },
  unresolved: { fontSize: 11, fontWeight: 800, color: "#f2635c", letterSpacing: 0.4 },
  audit: { marginTop: 12, paddingTop: 8, borderTop: `1px solid ${COLOR.border}`,
    fontSize: T.micro, color: "#9fd0ff", textAlign: "left", wordBreak: "break-all" },
};
