/**
 * The checks every Value Group command has to make before it may record anything.
 *
 * Three commands need the same four answers — does the group exist, is the clock
 * usable, is the actor a member, do the declared causes resolve — and the answers
 * must be identical in each. Written once, they are; written three times, the
 * third copy is where a command starts admitting something the others refuse.
 *
 * PURE. Reads the log, returns values, writes nothing and throws nothing. Each
 * check returns either the fact the command needs or a refusal it can return
 * verbatim, because a refusal here is an ordinary answer about the world ("you
 * are not a member") that the screen has to render — never an exception.
 *
 * The division of labour from `eventStore.ts` holds: this module decides whether
 * an ACT is admissible; the store decides whether the LOG stays sound. A command
 * that passes every check here can still be refused at the append boundary, and
 * that is correct — they are checking different things.
 */

import type { PhilosEvent } from "../events";
import { hasUnambiguousTimestamp } from "../eventCausality";
import { isMemberOf, projectViewerIdentity } from "../viewerIdentity";

/** Refusal codes shared by every command. Command-specific codes live with the command. */
export const SHARED_REJECTION_CODES = [
  "unknown_group",
  "not_a_member",
  "ambiguous_timestamp",
  "before_group_opened",
  "unknown_causal_parent",
  "causal_parent_after_event",
  "duplicate_causal_parent",
] as const;

export type SharedRejectionCode = (typeof SHARED_REJECTION_CODES)[number];

export interface Refusal<Code extends string = SharedRejectionCode> {
  ok: false;
  code: Code;
  message: string;
}

export type Check<T, Code extends string = SharedRejectionCode> =
  | ({ ok: true } & T)
  | Refusal<Code>;

/** A check that carries no fact back — it either holds or refuses. */
export type Verdict<Code extends string = SharedRejectionCode> =
  | { ok: true }
  | Refusal<Code>;

/** The `group.opened` event, which every group figure is anchored to. */
export function requireGroup(
  stored: readonly PhilosEvent[],
  group_id: string,
): Check<{ opened: PhilosEvent }> {
  const opened = stored.find(
    (e) => e.event_type === "group.opened" && e.entity_id === group_id,
  );
  if (!opened) {
    return {
      ok: false,
      code: "unknown_group",
      message: `no group.opened event for ${group_id}`,
    };
  }
  return { ok: true, opened };
}

/**
 * A timestamp the log can order, at or after the group existed.
 *
 * An offsetless timestamp would be read in the host's local zone, making the
 * log's ordering depend on which machine wrote it; an event dated before the
 * group opened would be a history that could not have happened.
 */
export function requireUsableTime(
  timestamp: string,
  opened: PhilosEvent,
): Check<{ timestamp: string }> {
  if (!hasUnambiguousTimestamp(timestamp)) {
    return {
      ok: false,
      code: "ambiguous_timestamp",
      message: `clock returned "${String(timestamp)}", which lacks an explicit timezone offset`,
    };
  }
  if (Date.parse(timestamp) < Date.parse(opened.timestamp)) {
    return {
      ok: false,
      code: "before_group_opened",
      message: `${timestamp} precedes the group's opening at ${opened.timestamp}`,
    };
  }
  return { ok: true, timestamp };
}

/**
 * Membership, decided by the projection the screens read.
 *
 * Not by scanning for `member.joined`: the founder and appointed leaders are
 * members without ever emitting one, so a writer with its own definition would
 * refuse the founder an act their own group screen says they may take.
 */
export function requireMember(
  stored: readonly PhilosEvent[],
  group_id: string,
  person_id: string,
): Verdict {
  const identity = projectViewerIdentity(stored, person_id, person_id);
  if (!isMemberOf(identity, group_id)) {
    return {
      ok: false,
      code: "not_a_member",
      message: `${person_id} is not a member of ${group_id}`,
    };
  }
  return { ok: true };
}

/**
 * Resolve the causes a command DECLARES, and refuse the ones that do not hold up.
 *
 * The append boundary would catch a dangling or time-reversed parent too, but it
 * catches it by throwing — the right shape for a violated log invariant, the
 * wrong shape for a caller who named an event that is not there. Caught here, an
 * orphaned declaration comes back as a refusal and nothing is written.
 *
 * An empty or omitted list yields `[]`, which the envelope defines as "explicitly
 * no known direct cause" — distinct from `undefined`, "we did not record whether
 * there was one". A command always knows which it means, so it always says.
 */
export function resolveCausalParents(
  stored: readonly PhilosEvent[],
  parentIds: readonly string[] | undefined,
  timestamp: string,
): Check<{ caused_by: string[] }> {
  const ids = parentIds ?? [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      return {
        ok: false,
        code: "duplicate_causal_parent",
        message: `${id} is declared as a cause more than once`,
      };
    }
    seen.add(id);

    const parent = stored.find((e) => e.event_id === id);
    if (!parent) {
      return {
        ok: false,
        code: "unknown_causal_parent",
        message: `declared cause ${id} is not in the log`,
      };
    }
    // Cross-group causality is deliberately allowed (see eventCausality.ts) —
    // only the direction of time is checked here.
    if (Date.parse(parent.timestamp) > Date.parse(timestamp)) {
      return {
        ok: false,
        code: "causal_parent_after_event",
        message: `declared cause ${id} (${parent.timestamp}) is after the event being recorded (${timestamp})`,
      };
    }
  }

  return { ok: true, caused_by: [...ids] };
}
