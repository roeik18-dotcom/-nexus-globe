/**
 * DAY REFS — a string in a day payload is a CLAIM. This module checks it.
 *
 * The day events carry ref arrays: `state_t0_refs`, `state_t1_refs`,
 * `event_ref`, `observation_ref`. Until now a gate counted them by LENGTH,
 * which meant a person (or a forged payload) could satisfy StateT1Available
 * by typing `obs_anything` into a form. The record it named never had to
 * exist. That is the difference between a day that happened and a day that
 * was asserted, and the gates are supposed to tell them apart.
 *
 * WHAT COUNTS AS RESOLVED:
 *   • a STATE ref must name a stored `DomainStateRecord` whose
 *     `state.subject` is this day's canon subject. Another person's state is
 *     not this person's state, and an id that names nothing is not evidence.
 *   • an OBSERVATION ref must name a stored `CanonEvent` whose payload
 *     `Observation.subject` is this day's canon subject.
 *   • State(t1) additionally must DECLARE its cause: a `caused_by_ref` naming
 *     an Action or Effect of this day, and a `recorded_at` not earlier than
 *     that record. Declared causality rather than ordering — a state written
 *     in the same millisecond as its Effect is normal, and the timestamp can
 *     only honestly rule out a state that predates what it claims to follow.
 *
 * WHY `event_ref` AND `observation_ref` BOTH POINT AT A CANON EVENT.
 * `Observation` (`canon/observation.ts`) has no id field of its own — the
 * only identifier is the `canon_event_id` of the `CanonEvent` that carries
 * it (`canon/canonEvent.ts`, where `payload` IS the Observation verbatim).
 * So the pair is checked as a RELATIONSHIP rather than as two lookups: the
 * observation must be the one that event actually carries. A payload naming
 * event A and observation B is a forgery this refuses, which is the whole
 * reason the two are recorded separately instead of as one field.
 *
 * Everything here is pure. The records are loaded by the caller and passed
 * in, so the projection stays testable without a disk.
 */
import type { CanonEvent } from "../canon/canonEvent";
import type { DomainStateRecord } from "../canon/domainStateStore";

/** The stored records a day's refs are checked against. */
export interface DayRefWorld {
  domainStates: readonly DomainStateRecord[];
  canonEvents: readonly CanonEvent[];
}

export const EMPTY_REF_WORLD: DayRefWorld = { domainStates: [], canonEvents: [] };

export interface RefCheck {
  ref: string;
  resolved: boolean;
  /** Why it did not resolve. Null when it did. */
  reason: string | null;
}

export interface RefSetCheck {
  /** True only when there is at least one ref AND every one of them resolved. */
  ok: boolean;
  checks: RefCheck[];
  resolvedRefs: string[];
  /** One sentence naming the first real problem. Null when ok. */
  reason: string | null;
}

function fail(reason: string): RefSetCheck {
  return { ok: false, checks: [], resolvedRefs: [], reason };
}

function summarise(checks: RefCheck[]): RefSetCheck {
  const bad = checks.filter((c) => !c.resolved);
  return {
    ok: bad.length === 0 && checks.length > 0,
    checks,
    resolvedRefs: checks.filter((c) => c.resolved).map((c) => c.ref),
    reason: bad.length === 0
      ? (checks.length === 0 ? "no refs recorded" : null)
      : `${bad.length} of ${checks.length} refs do not resolve: ${bad.map((b) => `${b.ref} (${b.reason})`).join("; ")}`,
  };
}

/** One link in the day's own Action/Effect chain, with the instant it was recorded. */
export interface DayChainLink {
  ref: string;
  recorded_at: string;
}

/**
 * Resolve state refs against the real DomainState store.
 *
 * `causedBy`, when given, is the day-scoped Action/Effect chain a State(t1)
 * must attach to. CAUSALITY IS DECLARED, NOT INFERRED FROM ORDERING:
 *
 *   • the state must carry `caused_by_ref` naming one of those records
 *   • its `recorded_at` must be NOT EARLIER than the record it names
 *
 * Ordering alone was the wrong test. Requiring "strictly after" made a state
 * written in the same millisecond as its Effect invalid — which is the normal
 * case on a fast machine, not an edge case, and it pushed callers toward
 * inserting artificial delays to satisfy a clock. Requiring a declared
 * reference instead asks the record to say what it followed, and leaves the
 * timestamp with the one job it can actually do: rule out a state that
 * genuinely predates its cause.
 */
export function resolveStateRefs(
  refs: readonly string[],
  world: DayRefWorld,
  subject_id: string,
  opts: { causedBy?: readonly DayChainLink[] } = {},
): RefSetCheck {
  if (refs.length === 0) return fail("no state refs recorded");

  const checks = refs.map<RefCheck>((ref) => {
    const rec = world.domainStates.find((r) => r.state_id === ref);
    if (!rec) return { ref, resolved: false, reason: "no stored state record with this id" };
    if (rec.state.subject !== subject_id) {
      return { ref, resolved: false, reason: `state belongs to ${rec.state.subject}, not ${subject_id}` };
    }

    if (opts.causedBy) {
      const declared = rec.caused_by_ref;
      if (!declared || declared.trim() === "") {
        return {
          ref,
          resolved: false,
          reason: "state declares no caused_by_ref — State(t1) must name the Action or Effect it followed",
        };
      }
      const cause = opts.causedBy.find((c) => c.ref === declared);
      if (!cause) {
        return {
          ref,
          resolved: false,
          reason: `caused_by_ref ${declared} is not an Action or Effect of this day for this subject`,
        };
      }
      // Not-earlier, so an equal millisecond is legitimate; a state that
      // genuinely predates the record it claims to follow is not.
      if (rec.recorded_at < cause.recorded_at) {
        return {
          ref,
          resolved: false,
          reason: `recorded ${rec.recorded_at}, earlier than ${declared} (${cause.recorded_at}) — a state cannot precede its declared cause`,
        };
      }
    }

    return { ref, resolved: true, reason: null };
  });

  return summarise(checks);
}

/**
 * Resolve the Event/Observation pair.
 *
 * Both must be present, both must name a stored canon event, that event must
 * carry an Observation whose subject is this day's subject, and — the actual
 * relationship check — the observation ref must name the SAME record as the
 * event ref, because the observation only exists as that event's payload.
 */
export function resolveEventObservation(
  event_ref: string | undefined,
  observation_ref: string | undefined,
  world: DayRefWorld,
  subject_id: string,
): RefSetCheck {
  if (!event_ref || event_ref.trim() === "") return fail("no event_ref recorded on the day opening");
  if (!observation_ref || observation_ref.trim() === "") return fail("no observation_ref recorded on the day opening");

  const ev = world.canonEvents.find((e) => e.canon_event_id === event_ref);
  if (!ev) return fail(`event_ref ${event_ref} names no stored canon event`);

  const obs = world.canonEvents.find((e) => e.canon_event_id === observation_ref);
  if (!obs) return fail(`observation_ref ${observation_ref} names no stored canon event`);

  if (obs.canon_event_id !== ev.canon_event_id) {
    return fail(
      `observation_ref ${observation_ref} is not the observation carried by event ${event_ref} — an Observation has no id of its own, so the two must name the same canon event`,
    );
  }

  const subject = ev.payload?.subject;
  if (subject !== subject_id) {
    return fail(`observation belongs to ${subject ?? "an unrecorded subject"}, not ${subject_id}`);
  }

  return {
    ok: true,
    checks: [{ ref: event_ref, resolved: true, reason: null }],
    resolvedRefs: [event_ref],
    reason: null,
  };
}
