/**
 * What the log knows about the person looking at it.
 *
 * PHILOS-SYSTEM-BLUEPRINT §14 — every journey begins with *why me*, and §4's
 * personal beat is "what do I do now", not "what happened in the system". Until
 * now no screen could answer either, because the viewer was a string a component
 * passed to itself: `p_you` existed in the UI whether or not the log had ever
 * heard of them.
 *
 * This is a projection like any other — a pure fold over `PhilosEvent[]` — and it
 * obeys the same rule the rest of them do: it reports what the events say and
 * states absence rather than filling it. A viewer the log has never recorded is
 * `registered: false` with an empty everything, which is a true answer. It is not
 * a Person entity (§6 remains **missing**); it is the identity the event log can
 * actually account for.
 *
 * The one subtlety worth its own field: a display name can come from two places —
 * a `person.registered` event, or the local viewer configuration that has not yet
 * been written to the log. Those are different epistemic states, so
 * `display_name_source` keeps them apart. Showing an unrecorded name as though an
 * event carried it is the small version of exactly what this codebase refuses.
 */

import type { PhilosEvent, Provenance } from "./events";
import { inOrder } from "./events";

export interface ViewerMembership {
  group_id: string;
  /** From the group's `group.opened` payload; falls back to the id if unnamed. */
  group_name: string;
  /** The `member.joined` event that recorded it — or the `group.opened` event, when the viewer founded it. */
  event_id: string;
  /** How the membership arose. The founder and appointed leaders never emit a join. */
  basis: "joined" | "founded" | "appointed";
  /** Date part of the event that established it. */
  since: string;
}

export interface ViewerIdentity {
  person_id: string;
  display_name: string;
  /**
   * `event` — the name came from a `person.registered` event in the log.
   * `local` — the log has no registration; this is the configured name, shown as
   * unrecorded rather than presented as recorded fact.
   */
  display_name_source: "event" | "local";
  registered: boolean;
  registration_event_id?: string;
  memberships: ViewerMembership[];
  /** Every event this viewer is the actor of, in canonical order. */
  recorded_event_ids: string[];
  provenance: Provenance;
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const datePart = (ts: string): string => ts.slice(0, 10);

/**
 * Fold the log into what it knows about `person_id`.
 *
 * `fallbackName` is the locally configured display name, used only when the log
 * carries no registration — and flagged as such through `display_name_source`.
 */
export function projectViewerIdentity(
  events: readonly PhilosEvent[],
  person_id: string,
  fallbackName: string,
): ViewerIdentity {
  const log = inOrder(events);

  const registration = log.find(
    (e) => e.event_type === "person.registered" && e.entity_id === person_id,
  );

  const groupNames = new Map<string, string>();
  for (const e of log) {
    if (e.event_type === "group.opened") {
      groupNames.set(e.entity_id, str(e.payload?.name, e.entity_id));
    }
  }
  const nameOfGroup = (id: string) => groupNames.get(id) ?? id;

  // Membership mirrors `projectValueGroup`'s definition, which counts the founder
  // and appointed leaders as members without either emitting a `member.joined`.
  // A personal view that only looked for joins would tell a founder they belong
  // to nothing, while the group screen listed them as a member.
  const memberships: ViewerMembership[] = [];
  const seenGroups = new Set<string>();
  const addMembership = (m: ViewerMembership) => {
    if (seenGroups.has(m.group_id)) return;
    seenGroups.add(m.group_id);
    memberships.push(m);
  };

  for (const e of log) {
    if (e.event_type === "group.opened" && e.actor_id === person_id) {
      addMembership({
        group_id: e.entity_id,
        group_name: nameOfGroup(e.entity_id),
        event_id: e.event_id,
        basis: "founded",
        since: datePart(e.timestamp),
      });
    }
  }
  for (const e of log) {
    if (e.event_type === "leader.appointed" && str(e.payload?.person_id) === person_id) {
      addMembership({
        group_id: e.entity_id,
        group_name: nameOfGroup(e.entity_id),
        event_id: e.event_id,
        basis: "appointed",
        since: datePart(e.timestamp),
      });
    }
  }
  for (const e of log) {
    if (e.event_type === "member.joined" && str(e.payload?.person_id, e.actor_id) === person_id) {
      addMembership({
        group_id: e.entity_id,
        group_name: nameOfGroup(e.entity_id),
        event_id: e.event_id,
        basis: "joined",
        since: datePart(e.timestamp),
      });
    }
  }

  const recorded = log.filter((e) => e.actor_id === person_id);

  // Every event this identity was read from, so the screen can cite it. Ordered
  // and de-duplicated, because a membership event is often also a recorded one.
  const sourceIds: string[] = [];
  const seenSource = new Set<string>();
  for (const id of [
    ...(registration ? [registration.event_id] : []),
    ...memberships.map((m) => m.event_id),
    ...recorded.map((e) => e.event_id),
  ]) {
    if (seenSource.has(id)) continue;
    seenSource.add(id);
    sourceIds.push(id);
  }

  const times = recorded.map((e) => e.timestamp).sort();
  const provenance: Provenance = {
    source_events: sourceIds,
    sample_size: sourceIds.length,
    // A registration is a person stating who they are, and a join is a person
    // stating that they joined. Nobody checked either, so the ladder rung is
    // self_report — never "verified", which §10 reserves for a second party.
    verification_status: "self_report",
    ...(times.length > 0
      ? { time_range: [datePart(times[0]), datePart(times[times.length - 1])] as [string, string] }
      : {}),
  };

  return {
    person_id,
    display_name: registration
      ? str(registration.payload?.display_name, fallbackName)
      : fallbackName,
    display_name_source: registration ? "event" : "local",
    registered: registration !== undefined,
    ...(registration ? { registration_event_id: registration.event_id } : {}),
    memberships,
    recorded_event_ids: recorded.map((e) => e.event_id),
    provenance,
  };
}

/** Is this viewer a member of that group, by the same rule the group screen uses? */
export function isMemberOf(identity: ViewerIdentity, group_id: string): boolean {
  return identity.memberships.some((m) => m.group_id === group_id);
}
