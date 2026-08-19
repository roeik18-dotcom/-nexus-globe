/**
 * Command: a person joins a Value Group.
 *
 * The first of the four commands the blueprint's event taxonomy already has
 * types for (`member.joined`, `update.posted`, `allocation.proposed`,
 * `impact.recorded`). It is the beginner journey's "join" — PHILOS-SYSTEM-
 * BLUEPRINT §14 — and until now it existed only as `joinEvent`, a helper the
 * *projection* module exported and a React component called into `useState`.
 *
 * A command is the layer the projections never had a counterpart for: it reads
 * the log, decides whether the act is admissible, and returns the events that
 * record it. Pure — it neither stores nor mutates. The caller appends what it
 * returns through the store, which applies the structural rules (§ eventStore).
 * That split is deliberate: this module owns MEANING ("may this person join?"),
 * the store owns INTEGRITY ("does the log stay sound?"), and neither is allowed
 * to answer the other's question.
 *
 * Rejections are values, not exceptions. "Already a member" is an ordinary
 * answer about the world, and the screen has to render it either way; making
 * the caller catch a throw to display a normal state would be the wrong shape.
 */

import type { PhilosEvent } from "../events";
import { hasUnambiguousTimestamp } from "../eventCausality";
import { projectValueGroup } from "../projectValueGroup";
import type { Clock, IdGenerator } from "../eventStore";

/** The closed set of reasons a join is refused. */
export const JOIN_REJECTION_CODES = [
  "empty_person_id",
  "empty_display_name",
  "unknown_group",
  "already_member",
  "ambiguous_timestamp",
  "before_group_opened",
] as const;

export type JoinRejectionCode = (typeof JOIN_REJECTION_CODES)[number];

export interface JoinGroupInput {
  group_id: string;
  person_id: string;
  display_name: string;
}

export interface JoinGroupDeps {
  clock: Clock;
  ids: IdGenerator;
}

export type JoinGroupResult =
  | { ok: true; events: PhilosEvent[] }
  | { ok: false; code: JoinRejectionCode; message: string };

/**
 * Derive the events that record `input`, or say why it cannot be recorded.
 *
 * Membership is decided by asking `projectValueGroup` rather than by re-scanning
 * for `member.joined`, and the reason is a real failure mode rather than tidiness.
 * The projection counts the founder and the appointed leaders as members "by
 * definition" — they never emit a `member.joined` of their own. A writer that
 * checked only for `member.joined` would happily record the founder joining
 * their own group: the log would gain an event asserting a join, and the member
 * count on screen would not move, because the projection already counted them.
 * The log and the screen would disagree, which is the one thing this codebase
 * exists to prevent. Asking the reader keeps the two definitions identical by
 * construction.
 */
export function joinGroup(
  stored: readonly PhilosEvent[],
  input: JoinGroupInput,
  deps: JoinGroupDeps,
): JoinGroupResult {
  const person_id = input.person_id.trim();
  const display_name = input.display_name.trim();
  const group_id = input.group_id.trim();

  if (!person_id) {
    return { ok: false, code: "empty_person_id", message: "person_id is required" };
  }
  if (!display_name) {
    // A membership whose person has no name renders as a raw id on the People
    // terminal. `nameOf` falls back to the id, so the screen would show
    // `p_you` to a human — technically traceable, and unreadable.
    return { ok: false, code: "empty_display_name", message: "display_name is required" };
  }

  const timestamp = deps.clock.now();
  if (!hasUnambiguousTimestamp(timestamp)) {
    return {
      ok: false,
      code: "ambiguous_timestamp",
      message: `clock returned "${String(timestamp)}", which lacks an explicit timezone offset`,
    };
  }

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

  if (Date.parse(timestamp) < Date.parse(opened.timestamp)) {
    // A join before the group existed would be admitted by the store — it only
    // orders events that declare a causal link, and this one's link is to the
    // opening. Caught here so the log never carries an impossible history.
    return {
      ok: false,
      code: "before_group_opened",
      message: `join at ${timestamp} precedes the group's opening at ${opened.timestamp}`,
    };
  }

  // The projection needs a "today" for its daily feed; membership does not
  // depend on it, so the join's own date is passed rather than a clock read.
  const view = projectValueGroup(stored, group_id, timestamp.slice(0, 10));
  if (view?.members.some((m) => m.person_id === person_id)) {
    return {
      ok: false,
      code: "already_member",
      message: `${person_id} is already a member of ${group_id}`,
    };
  }

  const events: PhilosEvent[] = [];

  // Register the person only if the log does not already know them. Identity is
  // recorded once; joining a second group must not mint a second registration.
  const registered = stored.find(
    (e) => e.event_type === "person.registered" && e.entity_id === person_id,
  );
  const registrationId = registered?.event_id ?? deps.ids.next("ev");
  if (!registered) {
    events.push({
      event_id: registrationId,
      actor_id: person_id,
      entity_type: "person",
      entity_id: person_id,
      event_type: "person.registered",
      value_tags: [],
      timestamp,
      visibility: "public",
      payload: { display_name },
      // Explicitly no known cause — the tri-state in `events.ts` distinguishes
      // this from `undefined` ("we did not record whether there was a cause").
      // Someone arriving at the product is where a causal chain starts.
      caused_by: [],
    });
  }

  events.push({
    event_id: deps.ids.next("ev"),
    actor_id: person_id,
    entity_type: "value_group",
    entity_id: group_id,
    event_type: "member.joined",
    // The group's own tags, read off the opening event. Hardcoding the seed's
    // "אחריות" here would make the command wrong for the second group.
    value_tags: [...opened.value_tags],
    timestamp,
    visibility: "public",
    payload: { person_id, display_name },
    // The first traced causal edge the log will carry: this membership exists
    // because the group was opened and because this person is registered. A
    // declaration, not proof — `projectDynamics` renders it `self_report`.
    caused_by: [opened.event_id, registrationId],
  });

  return { ok: true, events };
}
