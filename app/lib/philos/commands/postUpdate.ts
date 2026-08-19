/**
 * Command: a member posts an update to a Value Group.
 *
 * The second command, and the first that is pure *activity* — §4's ④ ACTIVITY
 * terminal asks "what is actually being done now", and until now the only thing
 * anyone could do was arrive. `update.posted` is already in the `EventType`
 * union and already rendered by the daily feed (`projectValueGroup` maps it to
 * the `post` kind); what was missing was any way to produce one.
 *
 * ── Causality, declared honestly ───────────────────────────────────────────
 * Most updates have no single direct cause, and saying otherwise would be the
 * cheap kind of lie this layer exists to refuse: if every update declared the
 * group's opening as its parent, the Dynamics graph would fill with edges that
 * mean "these happened in the same group", dressed as causation. So `caused_by`
 * is `[]` by default — *explicitly no known direct cause* — and carries parents
 * only when the caller names what the update is about (a request it answers, an
 * allocation it reports on). Those are checked before anything is written.
 */

import type { PhilosEvent } from "../events";
import type { Clock, IdGenerator } from "../eventStore";
import {
  requireGroup,
  requireMember,
  requireUsableTime,
  resolveCausalParents,
  type Refusal,
  type SharedRejectionCode,
} from "./preconditions";

/** Refusals specific to posting, beyond the shared ones. */
export const POST_UPDATE_REJECTION_CODES = ["empty_text", "empty_person_id"] as const;

export type PostUpdateRejectionCode =
  | (typeof POST_UPDATE_REJECTION_CODES)[number]
  | SharedRejectionCode;

export interface PostUpdateInput {
  group_id: string;
  person_id: string;
  /** What the member is reporting. Rendered verbatim in the daily feed. */
  text: string;
  /**
   * Event ids this update directly reports on, if any. Each must already be in
   * the log and must not be dated after the update. Omit when the update stands
   * on its own — the command then declares no known cause rather than guessing.
   */
  about_event_ids?: string[];
}

export interface PostUpdateDeps {
  clock: Clock;
  ids: IdGenerator;
}

export type PostUpdateResult =
  | { ok: true; events: PhilosEvent[] }
  | Refusal<PostUpdateRejectionCode>;

/** The longest text the feed will carry. Beyond this it is a document, not an update. */
export const MAX_UPDATE_TEXT = 2000;

export function postUpdate(
  stored: readonly PhilosEvent[],
  input: PostUpdateInput,
  deps: PostUpdateDeps,
): PostUpdateResult {
  const person_id = input.person_id.trim();
  const group_id = input.group_id.trim();
  const text = input.text.trim();

  if (!person_id) {
    return { ok: false, code: "empty_person_id", message: "person_id is required" };
  }
  if (!text) {
    // An update with no text renders as a blank row in the feed carrying a
    // timestamp and an author — a mark that asserts something happened while
    // saying nothing about what.
    return { ok: false, code: "empty_text", message: "an update must carry text" };
  }

  const group = requireGroup(stored, group_id);
  if (!group.ok) return group;

  const time = requireUsableTime(deps.clock.now(), group.opened);
  if (!time.ok) return time;

  const member = requireMember(stored, group_id, person_id);
  if (!member.ok) return member;

  const causes = resolveCausalParents(stored, input.about_event_ids, time.timestamp);
  if (!causes.ok) return causes;

  return {
    ok: true,
    events: [
      {
        event_id: deps.ids.next("ev"),
        actor_id: person_id,
        entity_type: "value_group",
        entity_id: group_id,
        event_type: "update.posted",
        // The group's own tags, read off the opening event — not hardcoded, so
        // the command stays correct for a second group.
        value_tags: [...group.opened.value_tags],
        timestamp: time.timestamp,
        visibility: "public",
        payload: { text: text.slice(0, MAX_UPDATE_TEXT) },
        caused_by: causes.caused_by,
      },
    ],
  };
}
