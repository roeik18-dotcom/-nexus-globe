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
import { terminalMeaning, type MeaningTerminal } from "./terminalMeaning";
import Link from "next/link";
import type { OrientationFrameResult } from "./realOrientationFrame";
import { COLOR, COLOR_ROLE, RADIUS, SPACE } from "../shell/designTokens";

/** What this terminal reads the same anchored frame as meaning. */
export type OrientationTerminal = MeaningTerminal;


/** The day's real chain, plus the ids for the audit block. */
export interface PanelChain {
  hasObservation: boolean; hasStateT0: boolean;
  hasAction: boolean; hasEffect: boolean;
  hasVerifiedEvidence: boolean; hasLearning: boolean;
  action_id?: string; effect_id?: string;
}

export default function RealOrientationPanel({
  terminal, frame, chain,
}: { terminal: OrientationTerminal; frame: OrientationFrameResult; chain: PanelChain }) {

  if (!frame.resolved) {
    return (
      <section dir="rtl" data-real-orientation={terminal} data-frame="unresolved" style={S.card}>
        {/* AN UNRESOLVED FRAME STILL OWES THE PERSON A SENTENCE.
            It used to lead with the raw token — `UNRESOLVED — no_opening` —
            which is the resolver talking to itself. The reason is real and is
            kept, in the drawer at the bottom with everything else technical;
            what leads now is the plain fact and the one thing to do about it. */}
        <h2 style={S.title}>עדיין אין על מה להתבסס כאן</h2>
        <p style={S.body}>{frame.message}</p>

        <div style={S.nextBox}>
          <span style={S.blockLabel}>מה אפשר לעשות עכשיו</span>
          <Link href="/hub" style={S.nextLink}>פתח/י את היום במרכז ←</Link>
        </div>

        <details style={S.audit} data-system-details="orientation-unresolved">
          <summary style={S.auditSummary}>פרטי מערכת</summary>
          <div dir="ltr" style={S.auditBody}>
            <div><b>state</b> UNRESOLVED</div>
            <div><b>reason</b> {frame.reason}</div>
            <div><b>terminal</b> {terminal}</div>
          </div>
        </details>
      </section>
    );
  }

  const o = frame.observation as unknown as Record<string, unknown>;
  const marked = frame.readings.filter((r) => r.status !== "unknown").length;
  const m = terminalMeaning(terminal, {
    ...chain, markedCount: marked, unmarkedCount: frame.readings.length - marked,
  });

  return (
    <section dir="rtl" data-real-orientation={terminal} data-frame="resolved"
             data-canon-event-id={frame.canon_event_id} data-state-t0-id={frame.state_t0_id}
             style={S.card}>

      {/* 1 — one human heading. */}
      <h2 style={S.title}>{m.title}</h2>

      {/* 2 — what this terminal examines. Different on every page. */}
      <p style={S.body}>{m.examines}</p>

      {/* The person's own sentence: the only text PHILOS did not write. */}
      {typeof o.context === "string" && o.context ? (
        <blockquote style={S.quote}>{o.context}</blockquote>
      ) : null}

      {m.full ? <p style={S.body}>{MODEL_EXPLANATION}</p> : null}

      {/* 3 — the real material, in sentences. */}
      <div style={S.block}>
        <span style={S.blockLabel}>מה קיים כאן</span>
        <ul style={S.list}>{m.material.map((x) => <li key={x} style={S.li}>{x}</li>)}</ul>
      </div>

      {/* 4 — where this sits in the chain, both directions. */}
      <div style={S.chain}>
        <div><span style={S.chainLabel}>לפני</span> {m.chain.before}</div>
        <div><span style={S.chainLabel}>אחרי</span> {m.chain.after}</div>
      </div>

      {/* THE TEN, in words — the same component the demo header draws. */}
      <div style={S.groups}>
        <UnitRow group="FOUNDATION" title="משתני יסוד" note="הבסיס: זמן, חומר, מרווח, אנרגיה"
                 units={FOUNDATION_4} readings={byId(frame.readings)}
                 variant="plain" full={m.full} />
        <UnitRow group="DEPARTMENTS" title="מחלקות ניגוד" note="ההקשר: רגש, שכל, גוף, אישי, חברתי, מערכתי"
                 units={DEPARTMENTS_6} readings={byId(frame.readings)}
                 variant="plain" full={m.full} />
      </div>

      {/* 5 — known and not known, kept apart. */}
      <div style={S.knownBox}>
        <span style={S.blockLabel}>מה ידוע</span>
        <ul style={S.list}>{m.known.map((x) => <li key={x} style={S.li}>{x}</li>)}</ul>
      </div>

      {/* 6 — exactly one action, or an honest none. */}
      <div style={S.nextBox}>
        <span style={S.blockLabel}>מה אפשר לעשות עכשיו</span>
        {m.nextAction
          ? <Link href={m.nextAction.href} style={S.nextLink}>{m.nextAction.label} ←</Link>
          : <span style={S.body}>במסוף הזה אין כרגע פעולה זמינה. זה לא חוסר — פשוט אין מה לעשות כאן עד שיירשם מידע נוסף.</span>}
      </div>

      {/* 7 — ONE closed drawer at the bottom, holding everything that is not
             the material or the action: what is still unknown, and the
             technical ids. "What is not known" is real and stays complete,
             but it is not what a person came to read, and printed open on all
             nine terminals it drowned the two sentences that were. */}
      <details style={S.audit} data-system-details="orientation">
        <summary style={S.auditSummary}>מה עדיין לא ידוע · ופרטי מערכת</summary>
        <div style={S.unknownBox}>
          <span style={S.blockLabel}>מה עדיין לא ידוע</span>
          <ul style={S.list}>{m.unknown.map((x) => <li key={x} style={S.li}>{x}</li>)}</ul>
        </div>
        <div dir="ltr" style={S.auditBody}>
          <div><b>canon_event_id</b> {frame.canon_event_id}</div>
          <div><b>state_t0_id</b> {frame.state_t0_id}</div>
          <div><b>day_id</b> {frame.day_id}</div>
          {chain.action_id ? <div><b>action_id</b> {chain.action_id}</div> : null}
          {chain.effect_id ? <div><b>effect_id</b> {chain.effect_id}</div> : null}
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
  block: { display: "grid", gap: 3, gridTemplateColumns: "minmax(0, 1fr)" },
  blockLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: COLOR.textFaint },
  list: { margin: 0, paddingInlineStart: 18, display: "grid", gap: 3 },
  li: { fontSize: 14.5, lineHeight: 1.6, color: COLOR.textDim },
  chain: { display: "grid", gap: 4, padding: 10, borderRadius: 8,
    border: `1px solid ${COLOR.border}`, fontSize: 14, lineHeight: 1.6,
    color: COLOR.textDim, gridTemplateColumns: "minmax(0, 1fr)" },
  chainLabel: { fontSize: 11, fontWeight: 800, color: COLOR.textFaint,
    marginInlineEnd: 6, letterSpacing: 0.6 },
  knownBox: { display: "grid", gap: 3, padding: 10, borderRadius: 8,
    border: "1px solid rgba(52,211,153,0.22)", gridTemplateColumns: "minmax(0, 1fr)" },
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
