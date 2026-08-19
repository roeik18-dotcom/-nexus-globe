/**
 * The join command — the first real action in Philos.
 *
 * What matters here is not that events come out, but that the events the command
 * produces are exactly what the projection will read back. The old `joinEvent`
 * helper produced plausible events that nothing checked: fixed ids that a second
 * call duplicated, the seed group's value tag hardcoded, and no membership check
 * at all. Each of those is a test below.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { joinGroup } from "../commands/joinGroup";
import { checkAppend, fixedClock, fixedIdGenerator } from "../eventStore";
import { projectValueGroup } from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const AT = `${SEED_TODAY}T20:00:00+03:00`;

const deps = (at = AT) => ({ clock: fixedClock(at), ids: fixedIdGenerator() });

const join = (
  input: Partial<{ group_id: string; person_id: string; display_name: string }> = {},
  stored: readonly PhilosEvent[] = VALUE_GROUP_EVENTS,
  at = AT,
) =>
  joinGroup(
    stored,
    {
      group_id: GROUP_ID,
      person_id: "p_guest",
      display_name: "אורח/ת",
      ...input,
    },
    deps(at),
  );

const ok = (result: ReturnType<typeof join>): PhilosEvent[] => {
  if (!result.ok) throw new Error(`expected success, got ${result.code}: ${result.message}`);
  return result.events;
};

// ── the happy path ───────────────────────────────────────────────────────────

describe("a new person joins", () => {
  it("records the person and the membership, in that order", () => {
    const events = ok(join());
    expect(events.map((e) => e.event_type)).toEqual(["person.registered", "member.joined"]);
  });

  it("names the person, so the People terminal shows a name and not an id", () => {
    const [registered, member] = ok(join());
    expect(registered.payload?.display_name).toBe("אורח/ת");
    expect(member.payload?.person_id).toBe("p_guest");
  });

  it("stamps both events with the injected clock", () => {
    for (const e of ok(join())) expect(e.timestamp).toBe(AT);
  });

  it("reads the group's value tags off the opening event", () => {
    // Not hardcoded: the same command has to be right for the second group.
    const [, member] = ok(join());
    const opened = VALUE_GROUP_EVENTS.find((e) => e.event_type === "group.opened");
    expect(member.value_tags).toEqual(opened?.value_tags);
    expect(member.value_tags).not.toBe(opened?.value_tags); // copied, not aliased
  });

  it("declares the membership's causes: the opening and the registration", () => {
    const [registered, member] = ok(join());
    expect(member.caused_by).toEqual(["e010", registered.event_id]);
  });

  it("declares a registration to have no known cause, rather than leaving it unrecorded", () => {
    // `[]` and `undefined` are different states in the envelope: "no cause" vs
    // "we did not record whether there was one".
    expect(ok(join())[0].caused_by).toEqual([]);
  });

  it("produces events the store will accept", () => {
    // The command and the append boundary have to agree, or the product records
    // nothing while every unit test passes.
    expect(checkAppend(VALUE_GROUP_EVENTS, ok(join()))).toEqual({ ok: true });
  });

  it("mints ids that are new to the log", () => {
    const existing = new Set(VALUE_GROUP_EVENTS.map((e) => e.event_id));
    for (const e of ok(join())) expect(existing.has(e.event_id)).toBe(false);
  });
});

// ── what the screen reads back ───────────────────────────────────────────────

describe("the projection reads the join back", () => {
  const extended = [...VALUE_GROUP_EVENTS, ...ok(join())];

  it("membership grows by exactly one", () => {
    const before = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.members).toHaveLength((before?.members.length ?? 0) + 1);
  });

  it("the new member appears with their name", () => {
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.members.find((m) => m.person_id === "p_guest")?.display_name).toBe("אורח/ת");
  });

  it("the join shows up in that day's activity", () => {
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.today.some((t) => t.kind === "join" && t.actor_name === "אורח/ת")).toBe(true);
  });

  it("nothing else on the screen moves — no money, no impact", () => {
    const before = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.budget).toEqual(before?.budget);
    expect(after?.impact).toEqual(before?.impact);
  });
});

// ── refusals ─────────────────────────────────────────────────────────────────

describe("a join that must not be recorded", () => {
  it("refuses a group with no group.opened event", () => {
    const r = join({ group_id: "vg_nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_group");
  });

  it("refuses a second join by the same person", () => {
    const first = [...VALUE_GROUP_EVENTS, ...ok(join())];
    const r = join({}, first);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("already_member");
  });

  it("refuses the founder joining their own group", () => {
    // The founder is a member by definition of the projection and emits no
    // member.joined. A writer checking only for member.joined would record a
    // join the screen could never show — log and screen disagreeing, which is
    // the failure this codebase exists to prevent.
    const r = join({ person_id: "p_dana", display_name: "דנה לוי" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("already_member");
  });

  it("refuses an appointed leader joining, for the same reason", () => {
    const r = join({ person_id: "p_omer", display_name: "עומר" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("already_member");
  });

  it("refuses a join dated before the group existed", () => {
    const r = join({}, VALUE_GROUP_EVENTS, "2026-07-01T10:00:00+03:00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("before_group_opened");
  });

  it("refuses a clock with no timezone offset", () => {
    const r = join({}, VALUE_GROUP_EVENTS, "2026-08-01T20:00:00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ambiguous_timestamp");
  });

  it("refuses an empty person or an empty name", () => {
    const noPerson = join({ person_id: "  " });
    const noName = join({ display_name: "  " });
    expect(noPerson.ok).toBe(false);
    expect(noName.ok).toBe(false);
    if (!noPerson.ok) expect(noPerson.code).toBe("empty_person_id");
    if (!noName.ok) expect(noName.code).toBe("empty_display_name");
  });

  it("returns refusals as values — a rejected join throws nothing", () => {
    expect(() => join({ group_id: "vg_nope" })).not.toThrow();
  });

  it("is pure — a refused join leaves the log untouched", () => {
    const length = VALUE_GROUP_EVENTS.length;
    join({ group_id: "vg_nope" });
    join({ person_id: "p_dana", display_name: "דנה לוי" });
    expect(VALUE_GROUP_EVENTS).toHaveLength(length);
  });
});

// ── identity is recorded once ────────────────────────────────────────────────

describe("a person the log already knows", () => {
  it("is not registered a second time", () => {
    // p_maya joined the seeded group, so she is registered but is a member of
    // that group only. Joining another group must reuse her identity.
    const otherGroup: PhilosEvent = {
      event_id: "e_other",
      actor_id: "p_dana",
      entity_type: "value_group",
      entity_id: "vg_other",
      event_type: "group.opened",
      value_tags: ["חינוך"],
      timestamp: "2026-07-19T09:00:00+03:00",
      visibility: "public",
      payload: { name: "אחר", central_value: "חינוך" },
    };
    const stored = [...VALUE_GROUP_EVENTS, otherGroup];
    const events = ok(
      joinGroup(
        stored,
        { group_id: "vg_other", person_id: "p_maya", display_name: "מאיה" },
        deps(),
      ),
    );
    expect(events.map((e) => e.event_type)).toEqual(["member.joined"]);
  });

  it("points the membership's cause at the registration already in the log", () => {
    const registered = VALUE_GROUP_EVENTS.find(
      (e) => e.event_type === "person.registered" && e.entity_id === "p_maya",
    );
    const otherGroup: PhilosEvent = {
      event_id: "e_other",
      actor_id: "p_dana",
      entity_type: "value_group",
      entity_id: "vg_other",
      event_type: "group.opened",
      value_tags: ["חינוך"],
      timestamp: "2026-07-19T09:00:00+03:00",
      visibility: "public",
      payload: { name: "אחר", central_value: "חינוך" },
    };
    const stored = [...VALUE_GROUP_EVENTS, otherGroup];
    const [member] = ok(
      joinGroup(
        stored,
        { group_id: "vg_other", person_id: "p_maya", display_name: "מאיה" },
        deps(),
      ),
    );
    expect(member.caused_by).toEqual(["e_other", registered?.event_id]);
    expect(checkAppend(stored, [member])).toEqual({ ok: true });
  });
});
