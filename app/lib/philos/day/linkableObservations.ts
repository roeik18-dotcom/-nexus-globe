/**
 * THE OBSERVATIONS A PERSON MAY LINK TO A DAY OPENING.
 *
 * ONE SELECTOR, PURE. Given the stored canon records and a subject it returns
 * the same list every time; it reads no clock, no store and no request. The
 * form renders this list, and the writer re-derives it from the store before
 * appending — the same predicate on both sides, so what a person can pick and
 * what the server will accept cannot drift apart.
 *
 * WHY A LIST AND NOT A FREE-TEXT ID. The previous contract had the person
 * type raw `event_ref` and `observation_ref` strings. Two problems, both
 * fatal: nobody knows a canon_event_id by heart, and an Observation has no id
 * of its own — it exists only as the payload of a CanonEvent, so the two
 * fields were always required to be the SAME string. Asking for it twice
 * invited a mismatch that could only ever be an error. The person picks one
 * observation; the server derives both refs from it.
 *
 * ELIGIBILITY IS THE SELECTOR'S, NOT THE UI'S. A record qualifies only if it
 * is an Observation, its `record_origin` is explicitly REAL, its subject is
 * this viewer, and it validates. DEMO, DERIVED, IMPORTED, an explicit
 * UNKNOWN, and a legacy record with no origin field are all absent from the
 * list — excluded by ORIGIN, not by subject, so a demo fixture naming this
 * very viewer never appears.
 *
 * WHAT THIS DOES NOT DO. It does not rank, score or recommend. Newest-first
 * is a display order, not a judgement about which observation matters.
 */
import { recordOriginOf, validateCanonEvent, type CanonEvent } from "../canon/canonEvent";
import type { Observation } from "../canon/observation";

export interface LinkableObservationsInput {
  /** Every stored canon record. Filtered here; callers pass the store as-is. */
  events: readonly CanonEvent[];
  /** The viewer's own subject, resolved server-side. Never from the client. */
  subject_id: string;
}

/** What the option needs to be readable by a human and auditable afterwards. */
export interface LinkableObservation {
  /** The one id. Both `event_ref` and `observation_ref` are derived from it. */
  canon_event_id: string;
  /** When the record was written. The sort key. */
  recorded_at: string;
  /** When the measurement happened (`Observation.time`, canon §6). */
  observed_at: string;
  /** The person's own words. Shown so the option is recognisable. */
  context: string;
  /** How many of the ten units the person explicitly ticked. Never a score. */
  classifiedUnitCount: number;
}

/** The one predicate. The form and the writer both use exactly this. */
export function isLinkableObservation(e: CanonEvent, subject_id: string): boolean {
  if (e?.canon_type !== "observation") return false;
  /* Explicitly REAL. Missing and UNKNOWN both read as UNKNOWN and fail here. */
  if (recordOriginOf(e) !== "REAL") return false;
  if ((e.payload as Observation | undefined)?.subject !== subject_id) return false;
  /* A record that does not validate cannot be offered: the day opening would
     cite something the projection will refuse to resolve. */
  return validateCanonEvent(e).valid;
}

/**
 * The linkable observations for one subject, newest first.
 *
 * Ties on `recorded_at` break on `canon_event_id` so two records written in
 * the same millisecond still order deterministically — a list that reshuffles
 * between renders would make the person's selection a moving target.
 */
export function selectLinkableObservations(
  input: LinkableObservationsInput,
): LinkableObservation[] {
  return input.events
    .filter((e) => isLinkableObservation(e, input.subject_id))
    .map((e) => {
      const o = e.payload as Observation;
      return {
        canon_event_id: e.canon_event_id,
        recorded_at: e.recorded_at,
        observed_at: o.time,
        context: o.context,
        classifiedUnitCount: o.analysis_unit_ids?.length ?? 0,
      };
    })
    .sort((a, b) =>
      b.recorded_at.localeCompare(a.recorded_at) ||
      b.canon_event_id.localeCompare(a.canon_event_id));
}

/** Why a submitted `observation_ref` was refused. A closed set. */
export type ObservationLinkRefusal =
  | "observation_not_found"
  | "observation_not_real"
  | "observation_subject_mismatch"
  | "observation_invalid";

export type ObservationLinkResult =
  | { ok: true; canon_event_id: string }
  | { ok: false; reason: ObservationLinkRefusal; message: string };

const REFUSAL_TEXT: Record<ObservationLinkRefusal, string> = {
  observation_not_found: "התצפית שנבחרה אינה קיימת במאגר",
  observation_not_real: "לתצפית שנבחרה אין מקור REAL ברמת הרשומה",
  observation_subject_mismatch: "התצפית שנבחרה שייכת לנושא אחר",
  observation_invalid: "רשומת התצפית שנבחרה אינה תקינה",
};

/**
 * RESOLVE A SUBMITTED SELECTION AGAINST THE STORE. The submitted value is
 * untrusted: it arrives from a form and may be anything at all.
 *
 * The order of the checks is the order of the reasons a person deserves. A
 * forged id is NOT FOUND; a real id belonging to someone else is a SUBJECT
 * MISMATCH, not "not found" — because pretending a record does not exist when
 * it does would be a different (and less honest) answer than refusing it.
 *
 * Returns the id to write. Both refs are derived from that ONE value by the
 * caller, which is why a client-supplied `event_ref` can be ignored outright.
 */
export function resolveSubmittedObservationRef(
  submitted: string,
  events: readonly CanonEvent[],
  subject_id: string,
): ObservationLinkResult {
  const found = events.find((e) => e.canon_event_id === submitted);
  if (!found || found.canon_type !== "observation") {
    return { ok: false, reason: "observation_not_found", message: REFUSAL_TEXT.observation_not_found };
  }
  if ((found.payload as Observation | undefined)?.subject !== subject_id) {
    return {
      ok: false, reason: "observation_subject_mismatch",
      message: REFUSAL_TEXT.observation_subject_mismatch,
    };
  }
  if (recordOriginOf(found) !== "REAL") {
    return { ok: false, reason: "observation_not_real", message: REFUSAL_TEXT.observation_not_real };
  }
  if (!validateCanonEvent(found).valid) {
    return { ok: false, reason: "observation_invalid", message: REFUSAL_TEXT.observation_invalid };
  }
  return { ok: true, canon_event_id: found.canon_event_id };
}
