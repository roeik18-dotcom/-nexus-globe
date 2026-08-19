/**
 * What the log knows about the viewer.
 *
 * The screens carried a `p_you` string long before any event mentioned it, so
 * "you" was an assumption the UI made about itself. These tests hold the
 * replacement to the same standard as every other projection: it reports what
 * events say, it agrees with the group screen about who is a member, and when
 * the log knows nothing it says nothing rather than inventing a person.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { joinGroup } from "../commands/joinGroup";
import { fixedClock, fixedIdGenerator } from "../eventStore";
import { projectValueGroup } from "../projectValueGroup";
import { isMemberOf, projectViewerIdentity } from "../viewerIdentity";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const identity = (person: string, name = "מקומי", events = VALUE_GROUP_EVENTS) =>
  projectViewerIdentity(events, person, name);

const joinedLog = (): PhilosEvent[] => {
  const result = joinGroup(
    VALUE_GROUP_EVENTS,
    { group_id: GROUP_ID, person_id: "p_you", display_name: "את/ה" },
    { clock: fixedClock(`${SEED_TODAY}T20:00:00+03:00`), ids: fixedIdGenerator() },
  );
  if (!result.ok) throw new Error(result.message);
  return [...VALUE_GROUP_EVENTS, ...result.events];
};

// ── a viewer the log has never heard of ──────────────────────────────────────

describe("an unrecorded viewer", () => {
  const you = identity("p_you", "את/ה");

  it("is reported as not registered, rather than invented", () => {
    expect(you.registered).toBe(false);
    expect(you.registration_event_id).toBeUndefined();
  });

  it("marks the display name as local, not as something an event carried", () => {
    // The distinction the whole module exists for: a configured name and a
    // recorded name are different claims about the world.
    expect(you.display_name).toBe("את/ה");
    expect(you.display_name_source).toBe("local");
  });

  it("belongs to nothing and has recorded nothing", () => {
    expect(you.memberships).toEqual([]);
    expect(you.recorded_event_ids).toEqual([]);
  });

  it("carries an empty provenance instead of a borrowed one", () => {
    expect(you.provenance.source_events).toEqual([]);
    expect(you.provenance.sample_size).toBe(0);
    expect(you.provenance.time_range).toBeUndefined();
  });
});

// ── a viewer the log does know ───────────────────────────────────────────────

describe("a registered viewer", () => {
  const maya = identity("p_maya");

  it("takes the display name from the registration event, not the local config", () => {
    expect(maya.registered).toBe(true);
    expect(maya.display_name).toBe("מאיה רון");
    expect(maya.display_name_source).toBe("event");
  });

  it("names the event that registered them", () => {
    const registration = VALUE_GROUP_EVENTS.find(
      (e) => e.event_type === "person.registered" && e.entity_id === "p_maya",
    );
    expect(maya.registration_event_id).toBe(registration?.event_id);
  });

  it("reports the membership and the event that established it", () => {
    expect(maya.memberships).toHaveLength(1);
    expect(maya.memberships[0].group_id).toBe(GROUP_ID);
    expect(maya.memberships[0].group_name).toBe("אחריות קהילתית");
    expect(maya.memberships[0].basis).toBe("joined");
    expect(maya.memberships[0].since).toBe("2026-07-20");
  });

  it("lists every event they are the actor of", () => {
    const expected = VALUE_GROUP_EVENTS.filter((e) => e.actor_id === "p_maya").map(
      (e) => e.event_id,
    );
    expect(maya.recorded_event_ids).toEqual(expected);
  });

  it("cites its sources, deduplicated, and rates them self_report", () => {
    // A registration and a join are both the person's own statement. Nobody
    // checked either, so §10's ladder puts them on self_report — never verified.
    expect(maya.provenance.verification_status).toBe("self_report");
    expect(maya.provenance.sample_size).toBe(maya.provenance.source_events.length);
    expect(new Set(maya.provenance.source_events).size).toBe(
      maya.provenance.source_events.length,
    );
  });
});

// ── membership must mean the same thing it means on the group screen ─────────

describe("membership agrees with the group projection", () => {
  it("counts the founder, who never emits a member.joined", () => {
    const dana = identity("p_dana");
    expect(dana.memberships).toHaveLength(1);
    expect(dana.memberships[0].basis).toBe("founded");
    expect(isMemberOf(dana, GROUP_ID)).toBe(true);
  });

  it("counts an appointed leader, who also never emits one", () => {
    const omer = identity("p_omer");
    expect(omer.memberships[0].basis).toBe("appointed");
    expect(isMemberOf(omer, GROUP_ID)).toBe(true);
  });

  it("agrees with projectValueGroup for every member it lists", () => {
    // The failure this prevents: a personal screen telling the founder they
    // belong to nothing while the group screen lists them as a member.
    const view = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);
    for (const member of view!.members) {
      expect(isMemberOf(identity(member.person_id), GROUP_ID), member.person_id).toBe(true);
    }
  });

  it("agrees in the other direction too — a non-member is not claimed", () => {
    expect(isMemberOf(identity("p_nobody"), GROUP_ID)).toBe(false);
  });

  it("records a group only once, even if joined and later appointed", () => {
    const twice: PhilosEvent[] = [
      ...VALUE_GROUP_EVENTS,
      {
        event_id: "e_lead_maya",
        actor_id: "p_dana",
        entity_type: "value_group",
        entity_id: GROUP_ID,
        event_type: "leader.appointed",
        value_tags: ["אחריות"],
        timestamp: "2026-07-25T09:00:00+03:00",
        visibility: "public",
        payload: { person_id: "p_maya", role: "community", role_label: "קהילה", area: "שכונה" },
      },
    ];
    expect(identity("p_maya", "מקומי", twice).memberships).toHaveLength(1);
  });
});

// ── the write path feeds it ──────────────────────────────────────────────────

describe("after the viewer actually joins", () => {
  const log = joinedLog();
  const you = projectViewerIdentity(log, "p_you", "את/ה");

  it("the viewer becomes registered, from their own event", () => {
    expect(you.registered).toBe(true);
    expect(you.display_name_source).toBe("event");
    expect(you.display_name).toBe("את/ה");
  });

  it("the membership appears with the event that recorded it", () => {
    expect(isMemberOf(you, GROUP_ID)).toBe(true);
    expect(you.memberships[0].basis).toBe("joined");
    expect(log.map((e) => e.event_id)).toContain(you.memberships[0].event_id);
  });

  it("both events are attributed to the viewer and cited as sources", () => {
    expect(you.recorded_event_ids).toHaveLength(2);
    for (const id of you.recorded_event_ids) {
      expect(you.provenance.source_events).toContain(id);
    }
  });

  it("is deterministic and order-independent, like every other projection", () => {
    const shuffled = [...log].reverse();
    expect(projectViewerIdentity(shuffled, "p_you", "את/ה")).toEqual(you);
  });
});
