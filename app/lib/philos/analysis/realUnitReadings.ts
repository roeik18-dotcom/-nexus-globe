/**
 * REAL ANALYSIS UNIT READINGS — from stored Observations, and only from them.
 *
 * ONE SELECTOR, PURE. Every terminal calls this; none derives readings of its
 * own. Given the same records it returns the same ten readings, and it reads
 * no clock, no store and no request.
 *
 * A READING EXISTS BECAUSE A PERSON TICKED A BOX. There is no keyword match,
 * no `context` parsing, and no Domain/Frame → unit mapping: a unit is
 * `observed` iff its id appears in some Observation's `analysis_unit_ids` for
 * this subject, and `unknown` otherwise. An automatic mapping would put a
 * classification in the record that nobody made.
 *
 * WHAT "OBSERVED" MEANS HERE, AND WHAT IT DOES NOT. It means a human said
 * this observation bears on this unit. `direction`, `intensity` and
 * `confidence` stay `null` in every case — the selection carries no magnitude
 * and no sign, and inventing one from a tick would be fabricating the very
 * numbers this model refuses to fabricate. The Observation's own
 * `confidence` is measurement metadata about the observation, not a
 * confidence about the unit, so it is deliberately not copied across.
 *
 * NO AGGREGATE. There is no score, no total and no "x is high": the only
 * count produced is how many of the ten were explicitly classified, which is
 * a count of human acts, not a measurement of a person.
 */
import { recordOriginOf, type CanonEvent } from "../canon/canonEvent";
import type { Observation } from "../canon/observation";
import {
  ANALYSIS_UNITS, type AnalysisUnitId, type AnalysisUnitReading,
} from "./analysisUnit";

export interface RealReadingsInput {
  /** Every stored canon record. Filtered here; callers pass the store as-is. */
  events: readonly CanonEvent[];
  /** The viewer's own subject. Records for anyone else are excluded. */
  subject_id: string;
}

export interface RealUnitReadings {
  subject_id: string;
  readings: AnalysisUnitReading[];
  /** How many of the ten a human explicitly classified. Never a score. */
  classifiedCount: number;
  /** Every canon_event_id that contributed, oldest first. */
  sourceEventIds: string[];
  /** True when no Observation for this subject carries any classification. */
  empty: boolean;
  /**
   * `"REAL"` exactly when at least one record contributed, and therefore
   * every contributor was record-level REAL — the filter admits nothing else.
   * `null` when nothing contributed, so a surface has no origin to claim.
   *
   * Exists so a terminal RENDERS this rather than deciding it. A surface that
   * printed `REAL` because it happened to read the real store would be making
   * the exact inference this whole field was added to stop.
   */
  recordOrigin: "REAL" | null;
}

const MISSING =
  "אף תצפית של המשתמש לא סווגה במפורש ליחידה זו. סיווג נעשה בטופס התצפית בלבד.";

function isObservationEvent(e: CanonEvent): boolean {
  return e.canon_type === "observation";
}

/**
 * The readings for one subject.
 *
 * FOUR CONDITIONS, ALL REQUIRED. A record contributes only if it is an
 * Observation, its `record_origin` is explicitly `REAL`, its payload subject
 * is this viewer, and a human selected at least one valid unit on it.
 *
 * ORIGIN IS READ, NEVER INFERRED. The REAL test is `recordOriginOf(e)`, a
 * field on the record — not which store was read, which directory was
 * configured, which route ran, or which subject it names. Before this field
 * existed the "REAL" in this module's name was enforced by nothing at all:
 * any Observation carrying the viewer's subject contributed, whatever it was
 * and wherever it came from.
 *
 * EVERYTHING ELSE CONTRIBUTES ZERO — DEMO, DERIVED, IMPORTED, an explicit
 * UNKNOWN, and a record with no origin field at all, which reads as UNKNOWN.
 * These are excluded by ORIGIN, not by carrying a different subject: a demo
 * fixture naming this very viewer still contributes nothing, which is the
 * case a subject test could never catch.
 *
 * SILENTLY, AND THAT IS DELIBERATE. An excluded record is not an error and
 * not a warning — it is simply not evidence about this person. The ten
 * readings show what a human classified, so a record nobody vouched for
 * leaves them exactly as they were.
 *
 * REPLAY IS HARMLESS. Sources are collected into a Set keyed by
 * `canon_event_id`, so the same record appearing twice contributes one ref
 * and cannot double a reading.
 */
export function selectRealUnitReadings(input: RealReadingsInput): RealUnitReadings {
  const mine = input.events
    .filter(isObservationEvent)
    /* THE ORIGIN GATE. Missing and explicit UNKNOWN both land here as
       UNKNOWN — `recordOriginOf` makes them the same answer — so neither
       passes, and neither had to be tested for separately. */
    .filter((e) => recordOriginOf(e) === "REAL")
    .filter((e) => (e.payload as Observation).subject === input.subject_id);

  /* unit → the canon_event_ids that classified it. A Set per unit, so a
     replayed record does not appear twice in `sourceRefs`. */
  const byUnit = new Map<AnalysisUnitId, Set<string>>();
  /* Ordered, de-duplicated record of every event that contributed anything. */
  const contributing: string[] = [];
  const seenEvent = new Set<string>();

  for (const e of mine) {
    const ids = (e.payload as Observation).analysis_unit_ids;
    if (!ids || ids.length === 0) continue;
    if (!seenEvent.has(e.canon_event_id)) {
      seenEvent.add(e.canon_event_id);
      contributing.push(e.canon_event_id);
    }
    for (const id of ids) {
      const set = byUnit.get(id) ?? new Set<string>();
      set.add(e.canon_event_id);
      byUnit.set(id, set);
    }
  }

  const readings: AnalysisUnitReading[] = ANALYSIS_UNITS.map((u) => {
    const refs = byUnit.get(u.id);
    if (!refs || refs.size === 0) {
      return {
        unitId: u.id, status: "unknown",
        direction: null, intensity: null, confidence: null,
        sourceRefs: [], explanation: MISSING,
      };
    }
    /* ALL contributing refs are preserved, not just the newest — the display
       may lead with the latest, but the evidence trail must stay whole. */
    const sourceRefs = contributing.filter((id) => refs.has(id));
    return {
      unitId: u.id, status: "observed",
      /* Three nulls, always. A tick is not a magnitude. */
      direction: null, intensity: null, confidence: null,
      sourceRefs,
      explanation: `סווג במפורש על ידי המשתמש ב-${sourceRefs.length} תצפיות.`,
    };
  });

  return {
    subject_id: input.subject_id,
    readings,
    classifiedCount: readings.filter((r) => r.status === "observed").length,
    sourceEventIds: contributing,
    empty: contributing.length === 0,
    /* Every contributor passed the origin gate above, so "at least one" and
       "all of them are REAL" are the same statement here. */
    recordOrigin: contributing.length > 0 ? "REAL" : null,
  };
}
