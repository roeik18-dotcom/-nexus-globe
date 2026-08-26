/**
 * מה חסר עכשיו — one compact panel, driven by data that already exists.
 *
 * NOT A NEW PROJECTION. Every row comes from something already computed:
 * `DaySession.gates` (already in dependency order), and counts/statuses the
 * terminal itself already loaded and passes in explicitly. This module runs
 * no selector, reads no store, and derives no second answer — if it disagreed
 * with the terminal it would be a bug in one of them, and there would be two
 * places to look.
 *
 * ORDERED BY DEPENDENCY, NOT BY SEVERITY. `DAY_GATES` is already the order in
 * which the day can actually progress: you cannot link an Observation to a day
 * nobody opened, and you cannot record a Learning with no Effect. The first
 * unmet gate is therefore the only honest "next action" — everything after it
 * is blocked by it, and listing all of them as equally actionable would be a
 * wall of diagnostics rather than a next step.
 *
 * A MISSING WRITER IS SAID OUT LOUD. Where a real, authority-safe write path
 * exists, the row names it. Where none exists, the row says
 * "אין עדיין write path" and offers no control. A button that cannot write is
 * worse than an absence: it implies the gap is the user's to close.
 *
 * THE TEN ANALYSIS UNITS NOW READ FROM REAL OBSERVATIONS. A unit is OBSERVED
 * when the viewer explicitly ticked it on one of their own Observations, and
 * UNKNOWN otherwise — with the reason stated, not left blank. The readings
 * come from `selectRealUnitReadings`, one pure selector shared by every
 * terminal, so no page derives its own.
 *
 * WHAT AN OBSERVED UNIT STILL DOES NOT CARRY: direction, intensity or
 * confidence. A tick says "this observation bears on this unit" and stops
 * there. DEMO readings remain the acceptance scenario's own and never appear
 * here — the selector filters on the viewer's subject, so a fixture cannot
 * satisfy a real person.
 */
import {
  DEPARTMENTS_6, FOUNDATION_4, type AnalysisUnitMeta, type AnalysisUnitReading,
} from "../analysis/analysisUnit";
import type { RealUnitReadings } from "../analysis/realUnitReadings";
import { COLOR, COLOR_ROLE, FS, RADIUS, SPACE, TYPE } from "../shell/designTokens";
import { DAY_GATES, type DayGate, type DaySession } from "./daySession";

/**
 * What a terminal already knows, handed in rather than re-derived.
 *
 * THREE STATES, NOT TWO. A count of zero from a selector that answered is a
 * fact ("asked, and there are none"). A selector that cannot answer the
 * question at all is not zero and not empty — it is UNRESOLVED, and saying
 * "0" there would invent a measurement nobody took. The distinction is the
 * whole reason `status` exists rather than just a nullable number.
 */
export type TerminalFactStatus = "PRESENT" | "EMPTY" | "UNRESOLVED";

export type TerminalFactProvenance = "REAL" | "DERIVED" | "UNKNOWN";

export interface TerminalRealFacts {
  label: string;
  /** The selector actually read, named so the row can be checked. */
  source: string;
  /** Whose data this is. A live count alone never earns REAL. */
  provenance: TerminalFactProvenance;
  status: TerminalFactStatus;
  /** Per-provenance tally, when the records declare one. */
  breakdown?: Record<string, number>;
  /** Real value when the source exposes one. Never fabricated, never 0-for-unknown. */
  value?: number | string;
  /** Why the source came back empty. Required when EMPTY. */
  reason?: string;
  /** Why the source cannot answer at all. Required when UNRESOLVED. */
  unsupported_reason?: string;
}

/**
 * A COUNT IS NOT A PROVENANCE.
 *
 * `factFromCount` reports what a live selector returned. It deliberately does
 * NOT claim the records are the user's own: a collection built from
 * `loadPhilosEvents()` includes the 42-event hand-authored bootstrap seed
 * (`philos-event-store.ts`: "the log a caller sees is bootstrap ++ appended"),
 * and a collection can also mix DEMO groups in. So this helper's provenance is
 * always UNKNOWN, and its `value` is labelled as a selector count rather than
 * as REAL user data.
 *
 * Use `factFromRecords` wherever the records themselves carry provenance.
 */
export function factFromCount(
  label: string, source: string, count: number | null | undefined, reason: string,
): TerminalRealFacts {
  if (count === null || count === undefined) {
    return { label, source, provenance: "UNKNOWN", status: "UNRESOLVED", unsupported_reason: reason };
  }
  return count > 0
    ? { label, source, provenance: "UNKNOWN", status: "PRESENT", value: count,
        unsupported_reason: "מקור לא מסומן — הרשומות אינן נושאות provenance; ייתכן ומכיל bootstrap/DEMO" }
    : { label, source, provenance: "UNKNOWN", status: "EMPTY", reason };
}

/** Provenance vocabularies used by the records this panel is handed. */
type RecordProvenance = "REAL" | "DERIVED_REAL" | "DEMO" | "REFERENCE" | "UNKNOWN";

/**
 * COUNT BY PROVENANCE, from records that actually declare it.
 *
 * DEMO and REFERENCE records never raise the REAL count — they are counted
 * separately and shown separately, so a demo group can never inflate a figure
 * a person reads as their own. A record with no provenance at all makes the
 * whole fact UNRESOLVED rather than being quietly treated as REAL.
 */
export function factFromRecords<T>(
  label: string,
  source: string,
  records: readonly T[],
  provenanceOf: (r: T) => RecordProvenance | undefined,
  emptyReason: string,
): TerminalRealFacts {
  const tally: Record<string, number> = {};
  let missing = 0;
  for (const r of records) {
    const pv = provenanceOf(r);
    if (!pv) { missing++; continue; }
    tally[pv] = (tally[pv] ?? 0) + 1;
  }

  if (missing > 0) {
    return {
      label, source, provenance: "UNKNOWN", status: "UNRESOLVED",
      unsupported_reason: `${missing} מתוך ${records.length} רשומות ללא provenance — לא ניתן לקבוע REAL`,
      breakdown: tally,
    };
  }

  const real = tally.REAL ?? 0;
  const derived = tally.DERIVED_REAL ?? 0;
  const nonReal = (tally.DEMO ?? 0) + (tally.REFERENCE ?? 0) + (tally.UNKNOWN ?? 0);

  if (real > 0) {
    return { label, source, provenance: "REAL", status: "PRESENT", value: real, breakdown: tally };
  }
  if (derived > 0) {
    return { label, source, provenance: "DERIVED", status: "PRESENT", value: derived, breakdown: tally };
  }
  return {
    label, source, provenance: "UNKNOWN", status: "EMPTY",
    reason: nonReal > 0
      ? `${emptyReason} — ${nonReal} רשומות אינן REAL (DEMO/REFERENCE) ואינן נספרות`
      : emptyReason,
    breakdown: tally,
  };
}

/**
 * The one legitimate write path per gate, or null when none exists.
 * Every entry names a server action that is already shipped and already
 * carries its own authority check — nothing here creates a second door.
 */
const GATE_WRITER: Readonly<Record<DayGate, { action: string; where: string } | null>> = {
  DayOpened: { action: "openDay", where: "פתיחת יום · Hub" },
  IdentityLinked: { action: "declareSamePersonAction → confirmSamePersonAction", where: "/hub/community" },
  StateT0Available: { action: "createDomainStateForCurrentUser", where: "רישום State · Hub" },
  EventObservationLinked: { action: "createObservationForCurrentUser", where: "רישום תצפית · Hub" },
  ActionAuthorized: { action: "evaluateMatchForCurrentUser", where: "/marketplace" },
  ActionRecorded: { action: "createActionForCurrentUser", where: "/marketplace" },
  EffectLinked: { action: "createEffectForCurrentUser", where: "תוצאות פעולות · Hub" },
  EvidencePresent: { action: "createEffectForCurrentUser (verified_outcome)", where: "תוצאות פעולות · Hub" },
  LearningSupported: { action: "createLearningForCurrentUser", where: "תוצאות פעולות · Hub" },
  StateT1Available: { action: "createDomainStateForCurrentUser (caused_by_ref)", where: "רישום State · Hub" },
  ClosingRecorded: { action: "recordDayClosing", where: "סגירת יום · Hub" },
};

/** The source each gate needs before it can be met. */
const GATE_SOURCE: Readonly<Record<DayGate, string>> = {
  DayOpened: "day.opened event",
  IdentityLinked: "PersonCommunityLink · VERIFIED_SAME_PERSON",
  StateT0Available: "DomainStateRecord",
  EventObservationLinked: "CanonEvent (Observation)",
  ActionAuthorized: "MatchPermit + consent",
  ActionRecorded: "ActionRecord (day_ref)",
  EffectLinked: "EffectRecord (action_ref)",
  EvidencePresent: "Effect.verified_outcome",
  LearningSupported: "LearningRecord (effect_ref)",
  StateT1Available: "DomainStateRecord (caused_by_ref)",
  ClosingRecorded: "day.closing_recorded event",
};

const NO_WRITER = "אין עדיין write path";

/**
 * TERMINAL_GATE_FOCUS — UI ROUTING JUDGEMENT.
 *
 * MODEL_STATUS: SYNTHESIS. This is NOT canon and is not derived from any
 * canon source document. It is a display decision authored here.
 *
 * PURPOSE: routes an unresolved gate to the terminal that contains its
 * existing writer, so a screen is asked for something it can actually do.
 * Without it every terminal showed the same first-unmet gate — honest about
 * the DAY, useless on a surface that cannot act on it (Community cannot
 * record a State(t1)).
 *
 * WHAT IT MUST NEVER AFFECT — and does not, because it is applied only when
 * choosing which already-computed row to feature:
 *   • gate truth (`met`)          — read, never written
 *   • DaySession status           — computed in `daySession.ts`, not here
 *   • record counts               — passed in as `facts`, untouched
 *   • authority                   — every writer keeps its own gate
 *   • provenance                  — no record is reclassified
 *
 * ROUTE OWNERSHIP IS DERIVED, NOT RE-STATED. Where `GATE_WRITER` already
 * names the destination of a gate's writer, the terminal that owns it is read
 * from that table by `terminalOwnsGate()` below rather than duplicated here —
 * so the two cannot drift. The explicit lists remain only for gates whose
 * writer lives on Hub but whose UNRESOLVED STATE is what a given terminal
 * exists to display (Brain shows observations and evidence; Planet and World
 * rest on the identity link and the observation), which is a reading
 * responsibility that no writer destination can express.
 */
export const TERMINAL_GATE_FOCUS_MODEL_STATUS = "SYNTHESIS" as const;

/** Terminals whose route appears in `GATE_WRITER[...].where`. */
const ROUTE_OF_TERMINAL: Readonly<Record<string, string>> = {
  community: "/hub/community",
  marketplace: "/marketplace",
};

/** True when this gate's existing writer lives on this terminal's route. */
function terminalOwnsGate(terminal: string, gate: DayGate): boolean {
  const route = ROUTE_OF_TERMINAL[terminal];
  if (!route) return false;
  return GATE_WRITER[gate]?.where === route;
}

/** Reading responsibilities that a writer destination cannot express. */
const TERMINAL_READ_FOCUS: Readonly<Record<string, readonly DayGate[]>> = {
  hub: DAY_GATES,
  brain: ["EventObservationLinked", "StateT0Available", "EvidencePresent"],
  community: [],
  dynamics: ["ActionRecorded", "EffectLinked", "EvidencePresent", "LearningSupported"],
  marketplace: [],
  planet: ["IdentityLinked", "EventObservationLinked"],
  world: ["EventObservationLinked", "StateT0Available"],
};

/** The gates a terminal may be asked about: its writers, plus what it reads. */
export function gateFocusFor(terminal: string): readonly DayGate[] {
  const owned = DAY_GATES.filter((g) => terminalOwnsGate(terminal, g));
  const read = TERMINAL_READ_FOCUS[terminal] ?? DAY_GATES;
  return [...new Set([...owned, ...read])];
}

export default function RealDataGapPanel({
  session,
  terminal,
  facts = [],
  realUnits,
}: {
  session: DaySession;
  /** Which terminal is asking — labels the panel, changes no logic. */
  terminal: string;
  /** REAL counts/statuses the terminal already loaded. */
  facts?: readonly TerminalRealFacts[];
  /** REAL unit readings from `selectRealUnitReadings`. One selector, shared. */
  realUnits?: RealUnitReadings;
}) {
  const unmet = session.gates.filter((g) => !g.met);

  /* THIS terminal's own unresolved dependency, in dependency order. Falls
     back to nothing rather than borrowing another terminal's blocker. */
  const focus = gateFocusFor(terminal);
  const first = unmet.find((g) => focus.includes(g.gate)) ?? null;
  /* The day may still be blocked elsewhere. That is context for this screen,
     never its instruction. */
  const dayBlocker = unmet[0] ?? null;
  const blockedElsewhere = first === null && dayBlocker !== null;

  return (
    <section dir="rtl" style={S.wrap} aria-label="מה חסר עכשיו">
      <div style={S.head}>
        <span style={S.eyebrow}>מה חסר עכשיו · {terminal}</span>
        <span style={S.count}>{unmet.length}/{session.gates.length}</span>
      </div>

      {/* ONE recommended next action — the first unmet gate, because
          everything after it is blocked by it. */}
      {first ? (
        <div data-gate={first.gate} data-gate-met="false" style={S.next}>
          <span style={S.nextLabel}>הפעולה המומלצת</span>
          <b style={S.gateName}>{first.gate}</b>
          <span style={S.reason}>{first.reason}</span>
          {GATE_WRITER[first.gate] ? (
            <span style={S.writer}>
              {GATE_WRITER[first.gate]!.action} · {GATE_WRITER[first.gate]!.where}
            </span>
          ) : (
            <span style={S.noWriter}>{NO_WRITER}</span>
          )}
        </div>
      ) : blockedElsewhere ? (
        <p style={S.ok}>
          אין פער פתוח במסוף הזה. היום עדיין חסום על ידי{" "}
          <b style={S.gateName}>{dayBlocker!.gate}</b> — טיפול ב-Hub.
        </p>
      ) : (
        <p style={S.ok}>כל השערים מולאו — אין פער פתוח ביום הזה.</p>
      )}

      {unmet.length > (first ? 1 : 0) && (
        <details style={S.details}>
          <summary style={S.summary}>שאר הפערים ביום · {unmet.length - (first ? 1 : 0)}</summary>
          <ul style={S.list}>
            {unmet.filter((g) => g.gate !== first?.gate).map((g) => (
              <li key={g.gate} data-gate={g.gate} data-gate-met="false" style={S.row}>
                <b style={S.gateName}>{g.gate}</b>
                <span style={S.state}>UNKNOWN</span>
                <span style={S.reason}>{g.reason}</span>
                <span style={S.source}>{GATE_SOURCE[g.gate]}</span>
                {GATE_WRITER[g.gate]
                  ? <span style={S.writer}>{GATE_WRITER[g.gate]!.action}</span>
                  : <span style={S.noWriter}>{NO_WRITER}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Terminal-owned REAL facts that came back unknown. Passed in, not
          re-derived — this panel never queries a store. */}
      {facts.length > 0 && (
        <ul style={S.list}>
          {facts.map((f) => (
            <li key={f.label} style={S.row}>
              <b style={S.gateName}>{f.label}</b>
              {/* PROVENANCE IS ALWAYS VISIBLE. A count with UNKNOWN provenance
                  is never allowed to read as the person's own data. */}
              <span style={
                f.provenance === "REAL" ? S.present
                : f.provenance === "DERIVED" ? S.derived
                : S.state
              }>
                {f.provenance}
              </span>
              <span style={f.status === "PRESENT" ? S.present : S.state}>
                {f.status === "PRESENT" ? `${f.status} · ${f.value}` : f.status}
              </span>
              <span style={S.source}>{f.source}</span>
              {f.breakdown && Object.keys(f.breakdown).length > 0 && (
                <span style={S.source}>
                  {Object.entries(f.breakdown).map(([k, v]) => `${k}:${v}`).join(" · ")}
                </span>
              )}
              {(f.reason || f.unsupported_reason) && (
                <span style={S.reason}>{f.reason ?? f.unsupported_reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <UnitsStrip real={realUnits} />
    </section>
  );
}

/**
 * The ten units, compact: four foundation variables then six contradiction
 * departments, two labelled groups — never a flat list of ten, which
 * `analysisUnit.ts` calls out as itself the error.
 */
function UnitsStrip({ real }: { real?: RealUnitReadings }) {
  const byId = new Map<string, AnalysisUnitReading>(
    (real?.readings ?? []).map((r) => [r.unitId, r]));
  const n = real?.classifiedCount ?? 0;

  return (
    /* `data-record-origin` is the SELECTOR'S answer, rendered — never this
       component's guess. It appears only when records actually contributed,
       and every contributor passed the record-level REAL gate. When nothing
       contributed the attribute is absent entirely rather than empty or
       "UNKNOWN": there is no origin to claim, and a marker that is always
       present is a marker that proves nothing. */
    <details data-real-units data-record-origin={real?.recordOrigin ?? undefined}
      style={S.details}>
      <summary style={S.summary}>
        10 יחידות ניתוח · 4+6 — <b>{n}/10</b> סווגו במפורש
      </summary>
      {/* Provenance said once, at the top, so no chip has to repeat it. */}
      <p style={S.note}>
        {real
          ? real.recordOrigin === "REAL"
            ? <>מקור: תצפיות אמיתיות של המשתמש · record origin <b>REAL</b>
                {` · ${real.sourceEventIds.length} תצפיות תורמות.`}</>
            : <>טרם סווגה אף תצפית עם מקור <b>REAL</b> מאומת ברמת הרשומה.</>
          : "לא הועברו קריאות אמיתיות למסוף זה."}
      </p>
      <UnitRow title="4 משתני יסוד · FOUNDATION" units={FOUNDATION_4} byId={byId} />
      <UnitRow title="6 מחלקות ניגוד · DEPARTMENTS" units={DEPARTMENTS_6} byId={byId} />
    </details>
  );
}

function UnitRow({ title, units, byId }: {
  title: string; units: readonly AnalysisUnitMeta[];
  byId: Map<string, AnalysisUnitReading>;
}) {
  return (
    <div style={S.unitGroup}>
      <span style={S.eyebrow}>{title}</span>
      <div style={S.chips}>
        {units.map((u) => {
          const r = byId.get(u.id);
          const observed = r?.status === "observed";
          return (
            /* `data-real-ref` carries the contributing canon_event_id in
               full. The visible chip truncates it to stay readable, so
               without this an audit could only scrape a shortened string
               out of the label — which is not the same claim as "these
               seven terminals cite the SAME record". */
            <span key={u.id} data-real-unit={u.id} data-real-status={r?.status ?? "unknown"}
              data-real-ref={observed ? r?.sourceRefs.join(" ") : undefined}
              style={{ ...S.chip, borderColor: COLOR_ROLE[u.colorRole] }}>
              <b style={S.chipLabel}>{u.label}</b>
              <span style={observed ? S.chipObserved : S.chipUnknown}>
                {observed ? "OBSERVED" : "UNKNOWN"}
              </span>
              {/* The source ref for an observed unit; the reason for a gap. */}
              {observed && r ? (
                <span dir="ltr" style={S.chipRef}>{r.sourceRefs[0]?.slice(0, 10)}…</span>
              ) : null}
            </span>
          );
        })}
      </div>
      {/* Per-unit gap reasons, so UNKNOWN is never a bare word. */}
      {units.some((u) => byId.get(u.id)?.status !== "observed") ? (
        <span style={S.note}>
          יחידה ללא סיווג: אף תצפית של המשתמש לא סומנה כנוגעת לה. הסיווג נעשה בטופס התצפית.
        </span>
      ) : null}
    </div>
  );
}

const S = {
  wrap: {
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    background: COLOR.bgRaised,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: SPACE.sm,
  },
  head: { display: "flex", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" as const },
  eyebrow: { ...TYPE.micro, color: COLOR.textFaint },
  count: { fontSize: FS.meta, color: "#fbbf24", fontWeight: 800 },
  next: { display: "flex", gap: SPACE.sm, flexWrap: "wrap" as const, alignItems: "baseline", minWidth: 0 },
  nextLabel: { ...TYPE.micro, color: COLOR.textFaint },
  ok: { fontSize: FS.meta, color: "#34d399", margin: 0 },
  details: { marginTop: 2 },
  summary: { ...TYPE.micro, color: COLOR.textDim, cursor: "pointer" },
  list: { listStyle: "none", margin: `${SPACE.xs}px 0 0`, padding: 0, display: "flex", flexDirection: "column" as const, gap: 2 },
  row: { display: "flex", gap: SPACE.sm, flexWrap: "wrap" as const, minWidth: 0, alignItems: "baseline" },
  gateName: {
    fontSize: FS.meta,
    color: COLOR.text,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  state: { ...TYPE.micro, color: "#fbbf24" },
  present: { ...TYPE.micro, color: "#34d399" },
  derived: { ...TYPE.micro, color: "#5b9cf6" },
  reason: { fontSize: FS.meta, color: COLOR.textFaint, overflowWrap: "anywhere" as const, minWidth: 0 },
  source: { fontSize: FS.meta, color: COLOR.textDim, overflowWrap: "anywhere" as const },
  writer: { fontSize: FS.meta, color: COLOR.accent, overflowWrap: "anywhere" as const },
  noWriter: { fontSize: FS.meta, color: "#f2635c", fontWeight: 700 },
  note: { fontSize: FS.meta, color: COLOR.textFaint, margin: `${SPACE.xs}px 0 0` },
  code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  unitGroup: { display: "flex", flexDirection: "column" as const, gap: SPACE.xs, marginTop: SPACE.sm },
  chips: { display: "flex", flexWrap: "wrap" as const, gap: SPACE.xs, minWidth: 0 },
  chip: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: SPACE.xs,
    border: "1px solid",
    borderRadius: RADIUS.pill,
    padding: `1px ${SPACE.sm}px`,
  },
  chipLabel: { fontSize: FS.meta, color: COLOR.text },
  chipObserved: {
    fontSize: FS.tag, color: "#8fd7ff", letterSpacing: 0.4,
  },
  chipRef: {
    fontSize: FS.tag, color: COLOR.textFaint,
  },
  chipUnknown: { ...TYPE.micro, color: "#fbbf24" },
} as const;
