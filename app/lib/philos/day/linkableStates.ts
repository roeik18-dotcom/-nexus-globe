/**
 * THE STATE(t0) RECORDS A PERSON MAY CITE WHEN OPENING A DAY.
 *
 * The exact counterpart of `linkableObservations.ts`, for the other half of
 * the opening. Same shape, same discipline, and the same reason for existing:
 * the day-opening form asked for `state_t0_refs` as FREE TEXT, with a
 * placeholder reading `obs_…` — which is not even the right prefix, since the
 * resolver wants a `dstate_…` `state_id`. A person following that hint typed
 * a ref that could never resolve, and the gate stayed shut with no
 * explanation.
 *
 * ONE SELECTOR, PURE. The form renders this list and the writer re-derives it
 * from the store before appending, so what a person can pick and what the
 * server will accept cannot drift apart.
 *
 * WHAT "ELIGIBLE FOR t0" MEANS HERE, AND WHAT IT DOES NOT.
 * Read off the executable contract, not invented: `daySession.ts` resolves
 * State(t0) with `resolveStateRefs(opening.payload.state_t0_refs, world,
 * subject_id)` and NO `causedBy` option, while State(t1) passes `causedBy` and
 * therefore additionally demands a `caused_by_ref`. So the code imposes
 * exactly two requirements on a t0 ref — the record exists, and its
 * `state.subject` is this day's subject — plus this module's own provenance
 * admissibility. There is no "a t0 may not declare a cause" rule anywhere in
 * the code, so none is invented here; a state carrying `caused_by_ref` is
 * still offered, and the fact is stated rather than silently filtered.
 *
 * PROVENANCE IS ADMISSIBILITY, exactly as for observations: a DEMO state
 * cannot open a real person's day, and it is excluded by what the record
 * CARRIES, never by which directory it was found in.
 */
import type { DomainStateRecord } from "../canon/domainStateStore";

export interface LinkableStatesInput {
  /** Every stored domain-state record. Filtered here; callers pass the store. */
  records: readonly DomainStateRecord[];
  /** The viewer's own subject, resolved server-side. Never from the client. */
  subject_id: string;
}

/** What the option needs to be recognisable and afterwards auditable. */
export interface LinkableState {
  /** The one id. This is what `state_t0_refs` will carry. */
  state_id: string;
  /** When the record was written. The sort key. */
  recorded_at: string;
  /** When the reading was taken. */
  observed_at: string;
  domain_id: string;
  parameter_id: string;
  level: number;
  /** True when this state already declares a cause. Shown, never filtered on. */
  declaresCause: boolean;
}

/**
 * A DomainState record is structurally usable only if the fields the resolver
 * and the display actually read are present and of the right kind. There is no
 * shared `validateDomainState` in the codebase — the store validates ids and
 * duplicates, not payload shape — so the checks are spelled out here rather
 * than assumed.
 */
function isWellFormed(r: DomainStateRecord): boolean {
  const s = r?.state;
  return typeof r?.state_id === "string" && r.state_id.trim() !== ""
    && typeof r?.recorded_at === "string" && r.recorded_at.trim() !== ""
    && !!s
    && typeof s.domain_id === "string" && s.domain_id.trim() !== ""
    && typeof s.parameter_id === "string" && s.parameter_id.trim() !== ""
    && typeof s.observed_at === "string" && s.observed_at.trim() !== ""
    && Number.isFinite(s.level)
    && Number.isFinite(s.confidence);
}

/** The one predicate. The form and the writer both use exactly this. */
export function isLinkableState(r: DomainStateRecord, subject_id: string): boolean {
  if (!isWellFormed(r)) return false;
  /* Explicitly REAL. A demonstration state cannot open a person's real day. */
  if (r.state.provenance !== "REAL") return false;
  return r.state.subject === subject_id;
}

/**
 * This subject's citable states, newest first.
 *
 * Ties on `recorded_at` break on `state_id`, so two states written in the same
 * millisecond still order deterministically — a list that reshuffles between
 * renders would make the person's selection a moving target.
 */
export function selectLinkableStates(input: LinkableStatesInput): LinkableState[] {
  return input.records
    .filter((r) => isLinkableState(r, input.subject_id))
    .map((r) => ({
      state_id: r.state_id,
      recorded_at: r.recorded_at,
      observed_at: r.state.observed_at,
      domain_id: r.state.domain_id,
      parameter_id: r.state.parameter_id,
      level: r.state.level,
      declaresCause: typeof r.caused_by_ref === "string" && r.caused_by_ref.trim() !== "",
    }))
    .sort((a, b) =>
      b.recorded_at.localeCompare(a.recorded_at) || b.state_id.localeCompare(a.state_id));
}

/** Why a submitted `state_t0_refs` value was refused. A closed set. */
export type StateLinkRefusal =
  | "state_not_found"
  | "state_not_real"
  | "state_subject_mismatch"
  | "state_invalid";

export type StateLinkResult =
  | { ok: true; state_id: string }
  | { ok: false; reason: StateLinkRefusal; message: string };

const REFUSAL_TEXT: Record<StateLinkRefusal, string> = {
  state_not_found: "מצב הפתיחה שנבחר אינו קיים במאגר",
  state_not_real: "למצב הפתיחה שנבחר אין provenance REAL",
  state_subject_mismatch: "מצב הפתיחה שנבחר שייך לנושא אחר",
  state_invalid: "רשומת מצב הפתיחה שנבחרה אינה תקינה",
};

/**
 * RESOLVE A SUBMITTED SELECTION AGAINST THE STORE. The submitted value comes
 * from a form and is untrusted until this has re-read the store and proven it.
 *
 * The order of checks is the order of the answers a person deserves: a forged
 * id is NOT FOUND; a real id belonging to someone else is a SUBJECT MISMATCH,
 * because pretending a record does not exist when it does is a different, and
 * less honest, answer than refusing it.
 */
export function resolveSubmittedStateRef(
  submitted: string,
  records: readonly DomainStateRecord[],
  subject_id: string,
): StateLinkResult {
  const found = records.find((r) => r?.state_id === submitted);
  if (!found) {
    return { ok: false, reason: "state_not_found", message: REFUSAL_TEXT.state_not_found };
  }
  if (found.state?.subject !== subject_id) {
    return { ok: false, reason: "state_subject_mismatch", message: REFUSAL_TEXT.state_subject_mismatch };
  }
  if (found.state?.provenance !== "REAL") {
    return { ok: false, reason: "state_not_real", message: REFUSAL_TEXT.state_not_real };
  }
  if (!isWellFormed(found)) {
    return { ok: false, reason: "state_invalid", message: REFUSAL_TEXT.state_invalid };
  }
  return { ok: true, state_id: found.state_id };
}
