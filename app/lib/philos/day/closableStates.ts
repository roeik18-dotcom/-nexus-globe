/**
 * THE STATE(t1) RECORDS A PERSON MAY CITE WHEN CLOSING A DAY.
 *
 * The closing form asked for `state_t1_refs` as FREE TEXT, with the
 * placeholder `obs_…` — the wrong prefix, since the resolver wants a
 * `dstate_…` id. This is the same defect the day-OPENING carried until it was
 * given a selector: a person following the hint typed a ref that could never
 * resolve, and the gate stayed shut with no explanation.
 *
 * ELIGIBILITY IS STRICTER HERE THAN AT t0, AND THE MODEL SAYS WHY. `daySession`
 * resolves State(t1) with `resolveStateRefs(..., { causedBy: dayChain })`,
 * where t0 passes no such option. A closing state must therefore ALSO declare
 * a cause, and that cause must be one of this day's own Actions or Effects —
 * otherwise the day would close on a state that nothing in it produced.
 *
 * Four conditions, all required, none inferred:
 *   1. provenance REAL — a demonstration state cannot close a real day.
 *   2. the state's subject is this viewer.
 *   3. it declares `caused_by_ref` at all.
 *   4. that cause is an Action or Effect belonging to THIS day.
 */
import type { DomainStateRecord } from "../canon/domainStateStore";

export interface ClosableStatesInput {
  records: readonly DomainStateRecord[];
  subject_id: string;
  /** This day's own Action and Effect ids. A cause outside them is not this day's. */
  dayChainRefs: readonly string[];
}

export interface ClosableState {
  state_id: string;
  recorded_at: string;
  domain_id: string;
  parameter_id: string;
  level: number;
  /** The Action or Effect this state says produced it. Always present here. */
  caused_by_ref: string;
}

function isWellFormed(r: DomainStateRecord): boolean {
  const s = r?.state;
  return typeof r?.state_id === "string" && r.state_id.trim() !== ""
    && typeof r?.recorded_at === "string" && r.recorded_at.trim() !== ""
    && !!s
    && typeof s.domain_id === "string" && s.domain_id.trim() !== ""
    && typeof s.parameter_id === "string" && s.parameter_id.trim() !== ""
    && Number.isFinite(s.level) && Number.isFinite(s.confidence);
}

/** The one predicate. The form and the writer both use exactly this. */
export function isClosableState(
  r: DomainStateRecord, subject_id: string, dayChainRefs: readonly string[],
): boolean {
  if (!isWellFormed(r)) return false;
  if (r.state.provenance !== "REAL") return false;
  if (r.state.subject !== subject_id) return false;
  const cause = r.caused_by_ref;
  if (typeof cause !== "string" || cause.trim() === "") return false;
  return dayChainRefs.includes(cause);
}

/** This subject's citable closing states, newest first. */
export function selectClosableStates(input: ClosableStatesInput): ClosableState[] {
  return input.records
    .filter((r) => isClosableState(r, input.subject_id, input.dayChainRefs))
    .map((r) => ({
      state_id: r.state_id, recorded_at: r.recorded_at,
      domain_id: r.state.domain_id, parameter_id: r.state.parameter_id,
      level: r.state.level, caused_by_ref: r.caused_by_ref as string,
    }))
    .sort((a, b) =>
      b.recorded_at.localeCompare(a.recorded_at) || b.state_id.localeCompare(a.state_id));
}

export type ClosingStateRefusal =
  | "state_not_found"
  | "state_not_real"
  | "state_subject_mismatch"
  | "state_no_cause"
  | "state_cause_outside_day"
  | "state_invalid";

export type ClosingStateResult =
  | { ok: true; state_id: string }
  | { ok: false; reason: ClosingStateRefusal; message: string };

const TEXT: Record<ClosingStateRefusal, string> = {
  state_not_found: "מצב הסיום שנבחר אינו קיים במאגר",
  state_not_real: "למצב הסיום שנבחר אין provenance REAL",
  state_subject_mismatch: "מצב הסיום שנבחר שייך לנושא אחר",
  state_no_cause: "מצב הסיום שנבחר אינו מצהיר על סיבה — אי אפשר לסגור יום על מצב שדבר לא הוליד",
  state_cause_outside_day: "מצב הסיום שנבחר נגרם על ידי פעולה או תוצאה שאינן של היום הזה",
  state_invalid: "רשומת מצב הסיום שנבחרה אינה תקינה",
};

/**
 * RESOLVE A SUBMITTED SELECTION AGAINST THE STORE.
 *
 * The order of checks is the order of the answers a person deserves: a forged
 * id is NOT FOUND; a real id belonging to someone else is a SUBJECT MISMATCH,
 * because pretending a record does not exist when it does is a different, and
 * less honest, answer than refusing it.
 */
export function resolveSubmittedClosingState(
  submitted: string,
  records: readonly DomainStateRecord[],
  subject_id: string,
  dayChainRefs: readonly string[],
): ClosingStateResult {
  const found = records.find((r) => r?.state_id === submitted);
  if (!found) return { ok: false, reason: "state_not_found", message: TEXT.state_not_found };
  if (found.state?.subject !== subject_id) {
    return { ok: false, reason: "state_subject_mismatch", message: TEXT.state_subject_mismatch };
  }
  if (found.state?.provenance !== "REAL") {
    return { ok: false, reason: "state_not_real", message: TEXT.state_not_real };
  }
  const cause = found.caused_by_ref;
  if (typeof cause !== "string" || cause.trim() === "") {
    return { ok: false, reason: "state_no_cause", message: TEXT.state_no_cause };
  }
  if (!dayChainRefs.includes(cause)) {
    return { ok: false, reason: "state_cause_outside_day", message: TEXT.state_cause_outside_day };
  }
  if (!isWellFormed(found)) {
    return { ok: false, reason: "state_invalid", message: TEXT.state_invalid };
  }
  return { ok: true, state_id: found.state_id };
}
