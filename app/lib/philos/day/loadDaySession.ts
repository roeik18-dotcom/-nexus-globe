/**
 * LOAD DAY SESSION — the ONE server-side read every terminal calls.
 *
 * Seven terminals must show the same day, the same `day_id`, the same
 * identity pair and the same gate results. If each assembled its own inputs
 * they would drift the first time one of them loaded a different subject or
 * a different date, and the "shared day" would be shared only by convention.
 * So the assembly happens exactly once, here.
 *
 * CARRY-FORWARD IS REAL, NOT INVENTED. What the next day inherits is read
 * from the PREVIOUS day's own projection — the same pure function, run for
 * yesterday. Nothing is fabricated for a day that was never opened: a person
 * with no yesterday inherits an empty list, not a placeholder.
 *
 * `buildCarryForward` / `buildNextDayOpening` (`../dayClosingFusion.ts`) are
 * REUSED rather than reimplemented, through `enrichCarryForward` below, for
 * callers that already hold the orientation/needs/tensions those functions
 * require. The Hub holds them; the other terminals do not, and this module
 * does not manufacture them just to satisfy a signature.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { loadCanonEvents } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import type { CarryForwardState } from "@/app/lib/philos/dayClosingFusion";
import {
  projectDaySession,
  type DayIdentity,
  type DayOpenLoop,
  type DaySession,
} from "./daySession";

/** The calendar day before `date`, as `YYYY-MM-DD`. */
export function previousDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The calendar day after `date`, as `YYYY-MM-DD`. */
export function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * STRICT date parsing for `?date=`.
 *
 * Anything that is not an exact `YYYY-MM-DD` naming a real calendar day falls
 * back to today. The round-trip check is what rejects `2026-02-31` and
 * `2026-13-01`, which the regex alone would accept — `new Date` would silently
 * roll them over into March and next January, and the screen would then claim
 * to show a day the user never asked for.
 *
 * Falling back rather than throwing is deliberate: a bad URL should show today,
 * not an error page. Nothing is written on any read, so a wrong date is inert.
 */
export function parseDateParam(raw: unknown, today: string): string {
  if (typeof raw !== "string") return today;
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return today;
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return today;
  return d.toISOString().slice(0, 10) === t ? t : today;
}

export interface LoadDaySessionOptions {
  /** Defaults to today, read from the same clock that stamps events. */
  date?: string;
  /** Claim ids still under review — passed through, never resolved. */
  claimsUnderReview?: readonly string[];
}

/**
 * Resolve the identity PAIR and whether the bridge actually verified them as
 * one human. `NOT_LINKED`, `UNVERIFIED`, `DECLARED_SAME_PERSON` and
 * `CONFLICT` all read UNRESOLVED here: only a real verification closes a day.
 */
export async function resolveDayIdentity(): Promise<DayIdentity> {
  const viewer = await resolveViewerContext();
  const link = await resolveShellIdentityLink();
  return {
    subject_id: viewer.subject_id,
    person_id: viewer.person_id,
    link_status: link.status === "VERIFIED_SAME_PERSON" ? "VERIFIED_SAME_PERSON" : "UNRESOLVED",
  };
}

export async function loadDaySession(opts: LoadDaySessionOptions = {}): Promise<DaySession> {
  const date = opts.date ?? todayIn(systemClock);
  const identity = await resolveDayIdentity();
  const events = await loadPhilosEvents();
  const lifecycle = await buildActionLifecycleSummary(identity.subject_id);

  /* The stored records every payload ref is checked against. Loaded once and
     shared by both projections below, so "yesterday" is resolved against the
     same world as today. */
  const refWorld = {
    domainStates: await findDomainStatesForSubject(identity.subject_id),
    canonEvents: await loadCanonEvents(),
  };

  // Yesterday, projected by the same pure function. Its still-open loops are
  // exactly what today inherits — no second definition of "carried forward".
  const yesterday = projectDaySession({
    date: previousDate(date),
    identity,
    events,
    lifecycle,
    refWorld,
  });

  return projectDaySession({
    date,
    identity,
    events,
    lifecycle,
    refWorld,
    claimsUnderReview: opts.claimsUnderReview,
    carriedForward: yesterday.closing_status === "OPEN" && yesterday.opened_at.value === null
      ? [] // yesterday was never opened — nothing to inherit, and nothing invented
      : yesterday.carry_forward,
  });
}

/**
 * Adapt the Hub's existing `CarryForwardState` into day open-loops.
 *
 * This is the reuse point for `buildCarryForward`: the Hub already computes
 * that richer structure from orientation, needs and tensions, and this turns
 * it into the same `DayOpenLoop` vocabulary the shared strip renders, instead
 * of computing a second, competing answer.
 */
export function enrichCarryForward(state: CarryForwardState): DayOpenLoop[] {
  const loops: DayOpenLoop[] = [];
  for (const n of state.open_needs) {
    const id = (n as unknown as { need?: { need_id?: string } }).need?.need_id;
    if (typeof id === "string") {
      loops.push({ ref: id, kind: "carried_forward", detail: `Need ${id} still open` });
    }
  }
  for (const entry of state.open_loop_actions) {
    loops.push({
      ref: entry.action.action.action_id,
      kind: "carried_forward",
      detail: `Action ${entry.action.action.action_id}: ${entry.verification_state}`,
    });
  }
  for (const t of state.unresolved_tensions) {
    const id = (t as unknown as { id?: string }).id;
    loops.push({
      ref: typeof id === "string" ? id : `tension:${t.severity}`,
      kind: "carried_forward",
      detail: `Tension (${t.severity}) unresolved`,
    });
  }
  return loops;
}
