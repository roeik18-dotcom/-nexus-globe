/**
 * The propose-allocation command.
 *
 * This is the first command that touches money, so the tests are weighted toward
 * what must NOT reach the RESOURCES terminal: a fractional or negative amount, a
 * people-estimate that is not a count, and above all a `votes_required` nobody
 * decided — the projection silently falls back to 5, so an omitted quorum would
 * render an invented threshold as the group's rule.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { proposeAllocation, standingQuorum } from "../commands/proposeAllocation";
import { checkAppend, fixedClock, fixedIdGenerator } from "../eventStore";
import { projectValueGroup } from "../projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const AT = `${SEED_TODAY}T20:00:00+03:00`;

const deps = (at = AT, idStart = 0) => ({
  clock: fixedClock(at),
  ids: fixedIdGenerator(idStart),
});

const propose = (
  input: Partial<Parameters<typeof proposeAllocation>[1]> = {},
  stored: readonly PhilosEvent[] = VALUE_GROUP_EVENTS,
  at = AT,
) =>
  proposeAllocation(
    stored,
    {
      group_id: GROUP_ID,
      person_id: "p_omer",
      title: "ליווי חורף לקשישים",
      amount: 4000,
      people_affected_estimate: 8,
      ...input,
    },
    deps(at),
  );

const ok = (r: ReturnType<typeof propose>) => {
  if (!r.ok) throw new Error(`expected success, got ${r.code}: ${r.message}`);
  return r;
};

// ── the happy path ───────────────────────────────────────────────────────────

describe("a member proposes an allocation", () => {
  it("records exactly one allocation.proposed event", () => {
    const { events } = ok(propose());
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("allocation.proposed");
  });

  it("makes the allocation the entity, not the group", () => {
    const { events, allocation_id } = ok(propose());
    expect(events[0].entity_type).toBe("allocation");
    expect(events[0].entity_id).toBe(allocation_id);
  });

  it("carries the required envelope fields", () => {
    const [e] = ok(propose()).events;
    expect(e.actor_id).toBe("p_omer");
    expect(e.timestamp).toBe(AT);
    expect(e.visibility).toBe("public");
    expect(e.payload?.title).toBe("ליווי חורף לקשישים");
    expect(e.payload?.amount).toBe(4000);
    expect(e.payload?.people_affected_estimate).toBe(8);
    expect(e.payload?.group_id).toBe(GROUP_ID);
  });

  it("mints an allocation id that is new to the log", () => {
    const existing = new Set(VALUE_GROUP_EVENTS.map((e) => e.entity_id));
    expect(existing.has(ok(propose()).allocation_id)).toBe(false);
  });

  it("produces an event the store will accept", () => {
    expect(checkAppend(VALUE_GROUP_EVENTS, ok(propose()).events)).toEqual({ ok: true });
  });

  it("declares no cause when the proposal arises from nothing named", () => {
    expect(ok(propose()).events[0].caused_by).toEqual([]);
  });

  it("carries a declared cause when the proposal reports one", () => {
    // The seed's own flagship: the founding goal drove the elder-support proposal.
    expect(ok(propose({ about_event_ids: ["e010"] })).events[0].caused_by).toEqual(["e010"]);
  });

  it("takes the group's value tags by default", () => {
    expect(ok(propose()).events[0].value_tags).toEqual(["אחריות"]);
  });

  it("lets a proposal serve a different value than the group's", () => {
    // The seed does exactly this: a ביטחון allocation inside an אחריות group.
    expect(ok(propose({ value_tag: "ביטחון" })).events[0].value_tags).toEqual(["ביטחון"]);
  });
});

// ── the quorum ───────────────────────────────────────────────────────────────

describe("votes_required", () => {
  it("inherits the group's most recent proposal when not stated", () => {
    expect(standingQuorum(VALUE_GROUP_EVENTS, GROUP_ID)).toBe(5);
    expect(ok(propose()).events[0].payload?.votes_required).toBe(5);
  });

  it("takes an explicit quorum over the inherited one", () => {
    expect(ok(propose({ votes_required: 3 })).events[0].payload?.votes_required).toBe(3);
  });

  it("refuses when the group has no earlier proposal and none was stated", () => {
    // Otherwise the projection's fallback of 5 would appear on screen as this
    // group's rule, decided by nobody.
    const fresh: PhilosEvent[] = [
      {
        event_id: "e_new_group",
        actor_id: "p_dana",
        entity_type: "value_group",
        entity_id: "vg_fresh",
        event_type: "group.opened",
        value_tags: ["חינוך"],
        timestamp: "2026-07-19T09:00:00+03:00",
        visibility: "public",
        payload: { name: "חדשה" },
      },
    ];
    const r = proposeAllocation(
      fresh,
      {
        group_id: "vg_fresh",
        person_id: "p_dana",
        title: "ראשונה",
        amount: 100,
        people_affected_estimate: 1,
      },
      deps(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("quorum_unspecified");
  });

  it("accepts an explicit quorum for that same first proposal", () => {
    const fresh: PhilosEvent[] = [
      {
        event_id: "e_new_group",
        actor_id: "p_dana",
        entity_type: "value_group",
        entity_id: "vg_fresh",
        event_type: "group.opened",
        value_tags: ["חינוך"],
        timestamp: "2026-07-19T09:00:00+03:00",
        visibility: "public",
        payload: { name: "חדשה" },
      },
    ];
    const r = proposeAllocation(
      fresh,
      {
        group_id: "vg_fresh",
        person_id: "p_dana",
        title: "ראשונה",
        amount: 100,
        people_affected_estimate: 1,
        votes_required: 2,
      },
      deps(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events[0].payload?.votes_required).toBe(2);
  });

  it("refuses a quorum that is not a positive whole number", () => {
    for (const votes_required of [0, -1, 2.5, Number.NaN]) {
      const r = propose({ votes_required });
      expect(r.ok, String(votes_required)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_quorum");
    }
  });
});

// ── money must not be malformed ──────────────────────────────────────────────

describe("an allocation that must not be recorded", () => {
  it("refuses an amount that is not a positive whole number", () => {
    for (const amount of [0, -500, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = propose({ amount });
      expect(r.ok, String(amount)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_amount");
    }
  });

  it("refuses a people estimate that is not a count", () => {
    for (const people_affected_estimate of [-1, 3.5, Number.NaN]) {
      const r = propose({ people_affected_estimate });
      expect(r.ok, String(people_affected_estimate)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_people_estimate");
    }
  });

  it("accepts zero people affected, which is a real estimate", () => {
    expect(propose({ people_affected_estimate: 0 }).ok).toBe(true);
  });

  it("refuses an empty title", () => {
    const r = propose({ title: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("empty_title");
  });

  it("refuses a non-member", () => {
    const r = propose({ person_id: "p_stranger" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_a_member");
  });

  it("refuses an unknown group", () => {
    const r = propose({ group_id: "vg_nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_group");
  });

  it("refuses a declared cause that is not in the log", () => {
    const r = propose({ about_event_ids: ["e_ghost"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_causal_parent");
  });

  it("refuses a proposal dated before the group existed", () => {
    const r = propose({}, VALUE_GROUP_EVENTS, "2026-07-01T10:00:00+03:00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("before_group_opened");
  });

  it("mutates nothing when it refuses", () => {
    const length = VALUE_GROUP_EVENTS.length;
    propose({ person_id: "p_stranger" });
    propose({ amount: -1 });
    expect(VALUE_GROUP_EVENTS).toHaveLength(length);
  });
});

// ── what the screen reads back ───────────────────────────────────────────────

describe("the projection reads the proposal back", () => {
  const proposed = ok(propose({ about_event_ids: ["e010"] }));
  const extended = [...VALUE_GROUP_EVENTS, ...proposed.events];

  it("the allocation appears, in the voting state, with no votes yet", () => {
    const view = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    const a = view?.allocations.find((x) => x.allocation_id === proposed.allocation_id);
    expect(a).toBeDefined();
    expect(a?.state).toBe("voting");
    expect(a?.votes_for).toBe(0);
    expect(a?.votes_required).toBe(5);
    expect(a?.amount).toBe(4000);
    expect(a?.proposed_by_name).toBe("עומר כהן");
  });

  it("a proposal alone commits nothing — the budget does not move", () => {
    // §9: committed counts APPROVED allocations. Asking is not taking, and this
    // is what makes the absence of a budget ceiling on proposals safe.
    const before = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);
    const after = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    expect(after?.budget).toEqual(before?.budget);
  });

  it("the allocation cites the events it was derived from", () => {
    const view = projectValueGroup(extended, GROUP_ID, SEED_TODAY);
    const a = view?.allocations.find((x) => x.allocation_id === proposed.allocation_id);
    expect(a?.provenance.source_events).toContain(proposed.events[0].event_id);
  });
});
