/**
 * The post-update command.
 *
 * Two things are under test that the join command could not exercise: an act
 * that requires the actor to already belong somewhere, and a `caused_by` the
 * CALLER supplies rather than the command derives. The second is where a write
 * path usually starts lying — accepting a named cause without checking it exists,
 * or manufacturing one so the graph looks connected.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { postUpdate, MAX_UPDATE_TEXT } from "../commands/postUpdate";
import { joinGroup } from "../commands/joinGroup";
import { checkAppend, fixedClock, fixedIdGenerator } from "../eventStore";
import { projectValueGroup } from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const AT = `${SEED_TODAY}T20:00:00+03:00`;

const deps = (at = AT) => ({ clock: fixedClock(at), ids: fixedIdGenerator() });

const post = (
  input: Partial<Parameters<typeof postUpdate>[1]> = {},
  stored: readonly PhilosEvent[] = VALUE_GROUP_EVENTS,
  at = AT,
) =>
  postUpdate(
    stored,
    { group_id: GROUP_ID, person_id: "p_maya", text: "עדכון מהשטח", ...input },
    deps(at),
  );

const ok = (r: ReturnType<typeof post>): PhilosEvent[] => {
  if (!r.ok) throw new Error(`expected success, got ${r.code}: ${r.message}`);
  return r.events;
};

// ── the happy path ───────────────────────────────────────────────────────────

describe("a member posts an update", () => {
  it("records exactly one update.posted event", () => {
    const events = ok(post());
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("update.posted");
  });

  it("carries the required envelope fields", () => {
    const [e] = ok(post());
    expect(e.actor_id).toBe("p_maya");
    expect(e.entity_type).toBe("value_group");
    expect(e.entity_id).toBe(GROUP_ID);
    expect(e.timestamp).toBe(AT);
    expect(e.visibility).toBe("public");
    expect(e.payload?.text).toBe("עדכון מהשטח");
  });

  it("reads the group's value tags off the opening event", () => {
    const opened = VALUE_GROUP_EVENTS.find((e) => e.event_type === "group.opened");
    expect(ok(post())[0].value_tags).toEqual(opened?.value_tags);
  });

  it("declares no known cause when the update is about nothing in particular", () => {
    // `[]` not `undefined`: the command knows there is no direct cause, which is
    // a different statement from not having recorded whether there was one.
    expect(ok(post())[0].caused_by).toEqual([]);
  });

  it("trims surrounding whitespace rather than storing it", () => {
    expect(ok(post({ text: "  יש חדש  " }))[0].payload?.text).toBe("יש חדש");
  });

  it("caps text length instead of accepting an unbounded document", () => {
    const long = "א".repeat(MAX_UPDATE_TEXT + 500);
    expect(String(ok(post({ text: long }))[0].payload?.text)).toHaveLength(MAX_UPDATE_TEXT);
  });

  it("produces an event the store will accept", () => {
    expect(checkAppend(VALUE_GROUP_EVENTS, ok(post()))).toEqual({ ok: true });
  });

  it("lets the founder post, though they never emitted a member.joined", () => {
    expect(post({ person_id: "p_dana" }).ok).toBe(true);
  });

  it("lets an appointed leader post, for the same reason", () => {
    expect(post({ person_id: "p_omer" }).ok).toBe(true);
  });
});

// ── declared causality ───────────────────────────────────────────────────────

describe("an update that reports on something", () => {
  it("carries the declared parents verbatim", () => {
    const [e] = ok(post({ about_event_ids: ["e060"] }));
    expect(e.caused_by).toEqual(["e060"]);
  });

  it("accepts several parents at once", () => {
    const [e] = ok(post({ about_event_ids: ["e060", "e061"] }));
    expect(e.caused_by).toEqual(["e060", "e061"]);
  });

  it("still produces an event the store accepts", () => {
    expect(checkAppend(VALUE_GROUP_EVENTS, ok(post({ about_event_ids: ["e060"] })))).toEqual({
      ok: true,
    });
  });

  it("refuses a cause that is not in the log, and writes nothing", () => {
    const r = post({ about_event_ids: ["e_ghost"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_causal_parent");
  });

  it("refuses a cause dated after the update", () => {
    // e070 is 2026-08-01T08:00+03:00 in the seed; posting before it would make
    // the effect precede its declared cause.
    const r = post({ about_event_ids: ["e070"] }, VALUE_GROUP_EVENTS, "2026-07-25T10:00:00+03:00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("causal_parent_after_event");
  });

  it("refuses the same cause declared twice", () => {
    const r = post({ about_event_ids: ["e060", "e060"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("duplicate_causal_parent");
  });
});

// ── refusals ─────────────────────────────────────────────────────────────────

describe("an update that must not be recorded", () => {
  it("refuses a non-member", () => {
    const r = post({ person_id: "p_stranger" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_a_member");
  });

  it("refuses an unknown group", () => {
    const r = post({ group_id: "vg_nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_group");
  });

  it("refuses empty text, which would be a blank row asserting an event", () => {
    for (const text of ["", "   ", "\n"]) {
      const r = post({ text });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("empty_text");
    }
  });

  it("refuses an empty person", () => {
    const r = post({ person_id: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("empty_person_id");
  });

  it("refuses a clock with no timezone offset", () => {
    const r = post({}, VALUE_GROUP_EVENTS, "2026-08-01T20:00:00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ambiguous_timestamp");
  });

  it("refuses a post dated before the group existed", () => {
    const r = post({}, VALUE_GROUP_EVENTS, "2026-07-01T10:00:00+03:00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("before_group_opened");
  });

  it("returns refusals as values and mutates nothing", () => {
    const length = VALUE_GROUP_EVENTS.length;
    expect(() => post({ person_id: "p_stranger" })).not.toThrow();
    expect(VALUE_GROUP_EVENTS).toHaveLength(length);
  });
});

// ── what the screen reads back ───────────────────────────────────────────────

describe("the projection reads the update back", () => {
  const extended = [...VALUE_GROUP_EVENTS, ...ok(post())];

  it("the update appears in that day's activity, as a post", () => {
    const view = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    const row = view?.today.find((t) => t.text === "עדכון מהשטח");
    expect(row).toBeDefined();
    expect(row?.kind).toBe("post");
    expect(row?.actor_name).toBe("מאיה רון");
  });

  it("the event count grows by one and nothing else moves", () => {
    const before = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.event_count).toBe((before?.event_count ?? 0) + 1);
    expect(after?.budget).toEqual(before?.budget);
    expect(after?.members).toEqual(before?.members);
    expect(after?.impact).toEqual(before?.impact);
  });
});

// ── a member who just joined can immediately post ────────────────────────────

describe("a newly joined member", () => {
  it("may post, because membership is read from the same log the join wrote", () => {
    const join = joinGroup(
      VALUE_GROUP_EVENTS,
      { group_id: GROUP_ID, person_id: "p_new", display_name: "חדש/ה" },
      deps(),
    );
    if (!join.ok) throw new Error(join.message);
    const log = [...VALUE_GROUP_EVENTS, ...join.events];

    const posted = postUpdate(
      log,
      { group_id: GROUP_ID, person_id: "p_new", text: "שלום" },
      { clock: fixedClock(AT), ids: fixedIdGenerator(50) },
    );
    expect(posted.ok).toBe(true);
    if (posted.ok) expect(checkAppend(log, posted.events)).toEqual({ ok: true });
  });
});
