/**
 * IS THIS EVENT A REAL RECORD, OR PART OF THE COMPILED-IN SEED?
 *
 * `philos-event-store.load()` returns `[...bootstrap, ...appended]` — the
 * hand-authored `VALUE_GROUP_EVENTS` bundle unioned with what a person
 * actually recorded — and hands the result to every projection as one
 * undifferentiated log. `projectValueGroup` therefore counted five seeded
 * `member.joined` events and eight seeded `person.registered` events together
 * with the viewer's single real join, and the Community terminal reported
 * "9 members · ILS 13,400" on a REAL screen. Not one shekel of that budget
 * and only one of those members is real.
 *
 * The seed is legitimate and is NOT deleted: it is the reference bundle the
 * projections were designed against. It simply may not be counted as REAL.
 *
 * IDENTITY BY ID, DELIBERATELY. The bundle is compiled in, so its ids are
 * fixed at build time and a stored record can never collide with one (the
 * store already refuses an append that reuses a seed id). That makes the id
 * set an exact classifier which needs no field added to any stored record —
 * nothing on disk is rewritten, relabelled or migrated to obtain it.
 */
import { VALUE_GROUP_EVENTS } from "./valueGroupLog";
import type { PhilosEvent } from "./events";

/** The visible label a seeded aggregate must carry. Never "REAL". */
export const BOOTSTRAP_LABEL = "BOOTSTRAP / REFERENCE — לא נתון REAL" as const;

/** Short form, where a full caption does not fit. */
export const BOOTSTRAP_TAG = "BOOTSTRAP" as const;

const BOOTSTRAP_IDS: ReadonlySet<string> = new Set(VALUE_GROUP_EVENTS.map((e) => e.event_id));

/** True when this event came from the compiled seed rather than the store. */
export function isBootstrapEvent(e: Pick<PhilosEvent, "event_id">): boolean {
  return BOOTSTRAP_IDS.has(e.event_id);
}

/** True only for events a person actually recorded. */
export function isRealEvent(e: Pick<PhilosEvent, "event_id">): boolean {
  return !isBootstrapEvent(e);
}

/** Split a log into its two origins, preserving order within each. */
export function splitByOrigin<T extends Pick<PhilosEvent, "event_id">>(
  events: readonly T[],
): { real: T[]; bootstrap: T[] } {
  const real: T[] = [], bootstrap: T[] = [];
  for (const e of events) (isBootstrapEvent(e) ? bootstrap : real).push(e);
  return { real, bootstrap };
}

/** What a screen needs to state an aggregate honestly. */
export interface OriginCounts {
  real: number;
  bootstrap: number;
  /** True when nothing real backs this figure — the caption must say so. */
  bootstrapOnly: boolean;
}

export function countByOrigin<T extends Pick<PhilosEvent, "event_id">>(
  events: readonly T[],
): OriginCounts {
  const { real, bootstrap } = splitByOrigin(events);
  return { real: real.length, bootstrap: bootstrap.length,
    bootstrapOnly: real.length === 0 && bootstrap.length > 0 };
}
