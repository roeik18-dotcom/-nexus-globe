/**
 * THE REAL ORIENTATION FRAME — ANCHORED, NEVER LATEST.
 *
 * The frame a person sees is centred on the Observation THIS DAY WAS OPENED
 * WITH, resolved through the opening's own refs. That is a deliberate refusal
 * of the obvious shortcut: taking the newest Observation would mean the
 * meaning of a day silently changed every time the person recorded anything
 * later, and a day already opened would stop being a record of what was true
 * when it opened.
 *
 * ELEVEN CONDITIONS, ALL REQUIRED, NONE WITH A FALLBACK. Every failure
 * returns an explicit unresolved reason. There is no "next best record":
 * falling back to another Observation would put a different person's day, or
 * a different moment, behind the same frame — which is precisely the class of
 * error that made a fixture keyed `scenario_person_sim_user` the top display
 * authority on all seven terminals.
 *
 * PURE. This module derives; it loads nothing and mutates nothing. The caller
 * supplies records, so the same inputs always produce the same frame.
 */
import { recordOriginOf, type CanonEvent } from "../canon/canonEvent";
import { validateObservation, type Observation } from "../canon/observation";
import type { DomainStateRecord } from "../canon/domainStateStore";
import { selectRealUnitReadings } from "./realUnitReadings";
import {
  DEPARTMENTS_6, FOUNDATION_4, type AnalysisUnitReading,
} from "./analysisUnit";

/** Why a frame could not be built. A closed set — never free prose. */
export type FrameUnresolved =
  | "no_opening"
  | "no_event_ref"
  | "refs_disagree"
  | "event_not_found"
  | "not_an_observation"
  | "origin_not_real"
  | "subject_mismatch"
  | "invalid_observation"
  | "state_t0_not_cited"
  | "state_t0_not_found"
  | "state_t0_not_real"
  | "state_t0_subject_mismatch";

const REASON_HE: Record<FrameUnresolved, string> = {
  no_opening: "היום טרם נפתח — אין עוגן תצפית",
  no_event_ref: "לפתיחת היום אין event_ref",
  refs_disagree: "event_ref ו-observation_ref אינם זהים — העוגן אינו חד-משמעי",
  event_not_found: "רשומת התצפית שהיום נפתח איתה אינה נמצאת במאגר",
  not_an_observation: "הרשומה המעוגנת אינה תצפית",
  origin_not_real: "לרשומה המעוגנת אין record_origin REAL",
  subject_mismatch: "התצפית המעוגנת שייכת לנושא אחר",
  invalid_observation: "מטען התצפית המעוגנת אינו תקין",
  state_t0_not_cited: "פתיחת היום לא ציטטה מצב פתיחה",
  state_t0_not_found: "מצב הפתיחה המצוטט אינו נמצא במאגר",
  state_t0_not_real: "למצב הפתיחה המצוטט אין provenance REAL",
  state_t0_subject_mismatch: "מצב הפתיחה המצוטט שייך לנושא אחר",
};

export interface OrientationFrameInput {
  /** The opening payload's refs, as stored. `null` when the day is not open. */
  opening: { day_id: string; event_ref?: string; observation_ref?: string;
             state_t0_refs?: readonly string[] } | null;
  events: readonly CanonEvent[];
  domainStates: readonly DomainStateRecord[];
  subject_id: string;
}

export interface RealOrientationFrame {
  resolved: true;
  day_id: string;
  canon_event_id: string;
  state_t0_id: string;
  /** The anchored Observation, exactly as stored. Never rewritten. */
  observation: Observation;
  state: DomainStateRecord["state"];
  /** All ten, in canonical order — four fundamentals then six classes. */
  readings: AnalysisUnitReading[];
  foundation: AnalysisUnitReading[];
  departments: AnalysisUnitReading[];
  observedCount: number;
  unknownCount: number;
}

export type OrientationFrameResult =
  | RealOrientationFrame
  | { resolved: false; reason: FrameUnresolved; message: string };

const fail = (reason: FrameUnresolved): OrientationFrameResult =>
  ({ resolved: false, reason, message: REASON_HE[reason] });

export function buildRealOrientationFrame(
  input: OrientationFrameInput,
): OrientationFrameResult {
  const { opening } = input;
  if (!opening) return fail("no_opening");

  /* 3–4. BOTH refs, and they must agree. The writer sets them from one
     selection, so a disagreement means the record was not written by the
     path that guarantees the anchor — and guessing which one is right is
     exactly the inference this frame refuses to make. */
  const eventRef = opening.event_ref;
  const obsRef = opening.observation_ref;
  if (!eventRef && !obsRef) return fail("no_event_ref");
  if (!eventRef || !obsRef || eventRef !== obsRef) return fail("refs_disagree");

  const event = input.events.find((e) => e.canon_event_id === eventRef);
  if (!event) return fail("event_not_found");
  if (event.canon_type !== "observation") return fail("not_an_observation");
  if (recordOriginOf(event) !== "REAL") return fail("origin_not_real");

  const observation = event.payload as Observation;
  if (observation?.subject !== input.subject_id) return fail("subject_mismatch");
  if (!validateObservation(observation).valid) return fail("invalid_observation");

  /* 10–11. STATE(t0) FROM THE OPENING'S OWN CITATION, not from a search. */
  const citedId = opening.state_t0_refs?.[0];
  if (!citedId) return fail("state_t0_not_cited");
  const stateRecord = input.domainStates.find((r) => r.state_id === citedId);
  if (!stateRecord) return fail("state_t0_not_found");
  if (stateRecord.state?.provenance !== "REAL") return fail("state_t0_not_real");
  if (stateRecord.state.subject !== input.subject_id) return fail("state_t0_subject_mismatch");

  /* THE TEN READINGS COME FROM THE ANCHOR ALONE. `selectRealUnitReadings` is
     the product's one unit selector and is reused verbatim; handing it a
     single event is what makes the frame anchored rather than cumulative. */
  const { readings } = selectRealUnitReadings({ events: [event], subject_id: input.subject_id });
  const by = new Map(readings.map((r) => [r.unitId, r]));
  const pick = (ids: readonly { id: string }[]) => ids.map((u) => by.get(u.id as never)!);

  const observedCount = readings.filter((r) => r.status !== "unknown").length;

  return {
    resolved: true,
    day_id: opening.day_id,
    canon_event_id: event.canon_event_id,
    state_t0_id: stateRecord.state_id,
    observation,
    state: stateRecord.state,
    readings,
    foundation: pick(FOUNDATION_4),
    departments: pick(DEPARTMENTS_6),
    observedCount,
    unknownCount: readings.length - observedCount,
  };
}
