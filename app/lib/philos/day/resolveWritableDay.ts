/**
 * WHICH DAY MAY AN ACTION BE WRITTEN TO? THE SERVER DECIDES, NOT THE FORM.
 *
 * `actionFormAction` read `day_ref` straight out of FormData and validated it
 * only for non-emptiness. The value the live form sends is correct — the
 * server rendered it — but the field was client-controllable, so a submitted
 * Action could name a day that was never opened, or one already closed, and
 * close its gates anyway. `owner` is server-derived and the projection
 * requires `day_ref === day_id && owner === subject`, so another person's day
 * was never reachable; the exposure was a person's own days, which is still
 * a gate closing on a day that did not earn it.
 *
 * THREE RULES, ALL FROM THE EXISTING MODEL — nothing invented here:
 *
 *   1. ELIGIBLE = a `day.opened` exists for THIS subject.
 *   2. NOT ELIGIBLE once a `day.closing_recorded` exists for that same day.
 *      A closed day is finished; appending to it would rewrite a settled
 *      record.
 *   3. EXACTLY ONE, OR REFUSE. Two open days is a real state the model
 *      permits, and picking the latest would be the writer inventing an
 *      answer the person never gave. It fails closed and says so.
 *
 * DELIBERATELY NOT "TODAY". The day a person is working in is the one they
 * opened, not the one the clock is on — and the clock is UTC, so "today"
 * changes under them mid-evening. An Action recorded at 00:50 local belongs
 * to the day that is still open, not to a day nobody has opened yet.
 */
import { DAY_CLOSING_RECORDED, DAY_OPENED } from "./dayEvent";
import type { PhilosEvent } from "../events";

/** Why no single writable day could be resolved. A closed set. */
export type WritableDayRefusal =
  | "no_open_day"
  | "day_already_closed"
  | "ambiguous_open_days";

export type WritableDayResult =
  | { ok: true; day_ref: string }
  | { ok: false; reason: WritableDayRefusal; message: string; candidates: string[] };

const TEXT: Record<WritableDayRefusal, string> = {
  no_open_day:
    "לא נפתח יום עבור הצופה הזה — אין יום לשייך אליו פעולה",
  day_already_closed:
    "היום היחיד שנפתח כבר נסגר — אי אפשר להוסיף לו פעולה",
  ambiguous_open_days:
    "יותר מיום פתוח אחד — הכותב מסרב לבחור עבורך; יש לסגור את העודפים",
};

/** The `day_id` an opening/closing event names, if it names one at all. */
function dayIdOf(e: PhilosEvent): string | undefined {
  const p = e.payload as { day_id?: unknown } | undefined;
  return typeof p?.day_id === "string" && p.day_id.trim() !== "" ? p.day_id : undefined;
}

/** The subject an opening claims. Checked — never taken on trust. */
function subjectOf(e: PhilosEvent): string | undefined {
  const p = e.payload as { subject_id?: unknown } | undefined;
  return typeof p?.subject_id === "string" ? p.subject_id : undefined;
}

/**
 * PURE. The caller loads the log; this decides. Same events in, same answer
 * out, with no clock read — so the result cannot change at midnight.
 */
export function resolveWritableDay(
  events: readonly PhilosEvent[],
  subject_id: string,
): WritableDayResult {
  const opened = new Set<string>();
  for (const e of events) {
    if (e.event_type !== DAY_OPENED) continue;
    if (subjectOf(e) !== subject_id) continue;
    const id = dayIdOf(e);
    if (id) opened.add(id);
  }

  if (opened.size === 0) {
    return { ok: false, reason: "no_open_day", message: TEXT.no_open_day, candidates: [] };
  }

  /* A closing removes its day from the candidates. The closing is matched by
     `day_id`, so a closing for someone else's day cannot retire this one. */
  const closed = new Set<string>();
  for (const e of events) {
    if (e.event_type !== DAY_CLOSING_RECORDED) continue;
    const id = dayIdOf(e);
    if (id && opened.has(id)) closed.add(id);
  }

  const live = [...opened].filter((d) => !closed.has(d)).sort();

  if (live.length === 0) {
    return { ok: false, reason: "day_already_closed", message: TEXT.day_already_closed,
      candidates: [...opened].sort() };
  }
  if (live.length > 1) {
    /* Sorted for a stable message, NOT to pick one. */
    return { ok: false, reason: "ambiguous_open_days", message: TEXT.ambiguous_open_days,
      candidates: live };
  }
  return { ok: true, day_ref: live[0] };
}
