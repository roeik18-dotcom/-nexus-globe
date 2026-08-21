/**
 * The record-impact command.
 *
 * The centre of gravity here is §10's ladder. Everything else this command does
 * is ordinary validation; the thing that would actually break Philos is a write
 * path that lets a reporter mark their own claim verified, so that gets the most
 * tests — including the check that a refused claim is refused rather than
 * silently rewritten into something the reporter did not say.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent, VerificationStatus } from "../events";
import { VERIFICATION_LEVELS } from "../events";
import { recordImpact, REPORTABLE_STATUSES } from "../commands/recordImpact";
import { checkAppend, fixedClock, fixedIdGenerator } from "../eventStore";
import { projectValueGroup } from "../projectValueGroup";
import { SEED_GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const AT = `${SEED_TODAY}T20:00:00+03:00`;

const deps = (at = AT, idStart = 0) => ({
  clock: fixedClock(at),
  ids: fixedIdGenerator(idStart),
});

const record = (
  input: Partial<Parameters<typeof recordImpact>[1]> = {},
  stored: readonly PhilosEvent[] = VALUE_GROUP_EVENTS,
  at = AT,
) =>
  recordImpact(
    stored,
    {
      group_id: SEED_GROUP_ID,
      person_id: "p_maya",
      statement: "ארבע משפחות קיבלו ציוד חורף",
      people_affected: 4,
      resources_invested: 1200,
      ...input,
    },
    deps(at),
  );

const ok = (r: ReturnType<typeof record>) => {
  if (!r.ok) throw new Error(`expected success, got ${r.code}: ${r.message}`);
  return r;
};

// ── the happy path ───────────────────────────────────────────────────────────

describe("a member records an impact", () => {
  it("records exactly one impact.recorded event, with the impact as its entity", () => {
    const { events, impact_id } = ok(record());
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("impact.recorded");
    expect(events[0].entity_type).toBe("impact");
    expect(events[0].entity_id).toBe(impact_id);
  });

  it("carries the claim in the envelope's impact_claim, not loose in the payload", () => {
    const [e] = ok(record()).events;
    expect(e.impact_claim).toEqual({
      people_affected: 4,
      statement: "ארבע משפחות קיבלו ציוד חורף",
      resources_invested: 1200,
    });
  });

  it("carries the required envelope fields", () => {
    const [e] = ok(record()).events;
    expect(e.actor_id).toBe("p_maya");
    expect(e.timestamp).toBe(AT);
    expect(e.visibility).toBe("public");
    expect(e.payload?.group_id).toBe(SEED_GROUP_ID);
  });

  it("produces an event the store will accept", () => {
    expect(checkAppend(VALUE_GROUP_EVENTS, ok(record()).events)).toEqual({ ok: true });
  });

  it("carries evidence and confidence when given, and omits them when not", () => {
    const withEv = ok(record({ evidence: ["visit_log:vl_0801"], confidence: 0.6 })).events[0];
    expect(withEv.evidence).toEqual(["visit_log:vl_0801"]);
    expect(withEv.confidence).toBe(0.6);

    const without = ok(record()).events[0];
    expect(without.evidence).toBeUndefined();
    expect(without.confidence).toBeUndefined();
  });

  it("accepts zero people affected — a real, reportable outcome", () => {
    expect(record({ people_affected: 0 }).ok).toBe(true);
  });
});

// ── §10: a claim cannot verify itself ────────────────────────────────────────

describe("the verification ladder", () => {
  it("defaults to claim when nothing backs the report", () => {
    expect(ok(record()).events[0].verification_status).toBe("claim");
  });

  it("defaults to self_report when the reporter attaches evidence", () => {
    // The rung the seed's own impact report sits on.
    expect(ok(record({ evidence: ["visit_log:x"] })).events[0].verification_status).toBe(
      "self_report",
    );
  });

  it("lets the reporter state any reportable rung", () => {
    for (const status of REPORTABLE_STATUSES) {
      const r = record({ reported_status: status });
      expect(r.ok, status).toBe(true);
      if (r.ok) expect(r.events[0].verification_status).toBe(status);
    }
  });

  it("REFUSES a verified rung rather than silently downgrading it", () => {
    // The projection would downgrade it on read. Doing that here would store one
    // thing, show another, and never tell the reporter their claim was not taken
    // as written.
    for (const status of ["community_verified", "external_verified"] as VerificationStatus[]) {
      const r = record({ reported_status: status });
      expect(r.ok, status).toBe(false);
      if (!r.ok) expect(r.code).toBe("self_verification");
    }
  });

  it("refuses system_inference too — a person is not the system inferring", () => {
    const r = record({ reported_status: "system_inference" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("self_verification");
  });

  it("covers every level in the vocabulary: reportable or refused, never a third thing", () => {
    for (const status of VERIFICATION_LEVELS) {
      const r = record({ reported_status: status });
      expect(r.ok, status).toBe(REPORTABLE_STATUSES.includes(status));
    }
  });

  it("writes nothing that reads as verified on the screen", () => {
    const extended = [...VALUE_GROUP_EVENTS, ...ok(record({ evidence: ["x"] })).events];
    const view = projectValueGroup(extended, SEED_GROUP_ID, SEED_TODAY);
    const mine = view?.impact.find((i) => i.statement === "ארבע משפחות קיבלו ציוד חורף");
    expect(mine?.verified).toBe(false);
    expect(mine?.verification_level).toBe("unverified");
    expect(mine?.verification).toBeNull();
  });
});

// ── the allocation join key ──────────────────────────────────────────────────

describe("linking an impact to the money that produced it", () => {
  it("carries a real allocation_id into the payload", () => {
    const [e] = ok(record({ allocation_id: "alloc_elder_support" })).events;
    expect(e.payload?.allocation_id).toBe("alloc_elder_support");
  });

  it("refuses an allocation that is not in the log", () => {
    // `payload.allocation_id` is an inference join key for the causal graph; a
    // dangling one becomes an unresolved claim every reader has to render.
    const r = record({ allocation_id: "alloc_ghost" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_allocation");
  });
});

// ── refusals ─────────────────────────────────────────────────────────────────

describe("an impact that must not be recorded", () => {
  it("refuses an empty statement", () => {
    const r = record({ statement: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("empty_statement");
  });

  it("refuses a people count that is not a count", () => {
    for (const people_affected of [-1, 2.5, Number.NaN]) {
      const r = record({ people_affected });
      expect(r.ok, String(people_affected)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_people_affected");
    }
  });

  it("refuses negative or fractional resources", () => {
    for (const resources_invested of [-100, 10.5, Number.NaN]) {
      const r = record({ resources_invested });
      expect(r.ok, String(resources_invested)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_resources_invested");
    }
  });

  it("refuses a confidence outside 0..1", () => {
    for (const confidence of [-0.1, 1.5, Number.NaN]) {
      const r = record({ confidence });
      expect(r.ok, String(confidence)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_confidence");
    }
  });

  it("accepts the endpoints of the confidence range", () => {
    expect(record({ confidence: 0 }).ok).toBe(true);
    expect(record({ confidence: 1 }).ok).toBe(true);
  });

  it("refuses a malformed or reversed period", () => {
    for (const period of [
      ["2026-08-02", "2026-08-01"],
      ["not-a-date", "2026-08-01"],
      ["2026-08-01", "01/08/2026"],
    ] as [string, string][]) {
      const r = record({ period });
      expect(r.ok, JSON.stringify(period)).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_period");
    }
  });

  it("accepts a period that starts and ends on the same day", () => {
    expect(record({ period: ["2026-08-01", "2026-08-01"] }).ok).toBe(true);
  });

  it("refuses a non-member", () => {
    const r = record({ person_id: "p_stranger" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_a_member");
  });

  it("refuses an unknown group and an unresolvable cause", () => {
    const noGroup = record({ group_id: "vg_nope" });
    const noCause = record({ about_event_ids: ["e_ghost"] });
    expect(noGroup.ok).toBe(false);
    expect(noCause.ok).toBe(false);
    if (!noGroup.ok) expect(noGroup.code).toBe("unknown_group");
    if (!noCause.ok) expect(noCause.code).toBe("unknown_causal_parent");
  });

  it("mutates nothing when it refuses", () => {
    const length = VALUE_GROUP_EVENTS.length;
    record({ statement: "" });
    record({ reported_status: "external_verified" });
    expect(VALUE_GROUP_EVENTS).toHaveLength(length);
  });
});

// ── what the screen reads back ───────────────────────────────────────────────

describe("the projection reads the impact back", () => {
  const recorded = ok(
    record({
      allocation_id: "alloc_elder_support",
      evidence: ["visit_log:vl_0801"],
      confidence: 0.5,
      about_event_ids: ["e051"],
    }),
  );
  const extended = [...VALUE_GROUP_EVENTS, ...recorded.events];

  it("the impact appears with its statement and figures", () => {
    const view = projectValueGroup(extended, SEED_GROUP_ID, SEED_TODAY);
    const mine = view?.impact.find((i) => i.impact_id === recorded.impact_id);
    expect(mine).toBeDefined();
    expect(mine?.people_affected).toBe(4);
    expect(mine?.resources_invested).toBe(1200);
    expect(mine?.evidence).toEqual(["visit_log:vl_0801"]);
    expect(mine?.confidence).toBe(0.5);
  });

  it("it sits on the reported rung, unverified, with no verification attached", () => {
    const view = projectValueGroup(extended, SEED_GROUP_ID, SEED_TODAY);
    const mine = view?.impact.find((i) => i.impact_id === recorded.impact_id);
    expect(mine?.reported_status).toBe("self_report");
    expect(mine?.verified).toBe(false);
    expect(mine?.verification_count).toBe(0);
  });

  it("it does not raise the group's verified totals", () => {
    // The number that would be the real damage: an unverified report inflating
    // the figure the entry screen labels "אנשים — אומת".
    const before = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY);
    const after = projectValueGroup(extended, SEED_GROUP_ID, SEED_TODAY);
    const verifiedPeople = (v: typeof before) =>
      v!.impact.filter((i) => i.verified).reduce((s, i) => s + i.people_affected, 0);
    expect(verifiedPeople(after)).toBe(verifiedPeople(before));
  });

  it("it appears in that day's activity as an impact row", () => {
    const view = projectValueGroup(extended, SEED_GROUP_ID, SEED_TODAY);
    expect(
      view?.today.some(
        (t) => t.kind === "impact" && t.text === "ארבע משפחות קיבלו ציוד חורף",
      ),
    ).toBe(true);
  });

  it("the budget is untouched — recording an outcome moves no money", () => {
    const before = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY);
    const after = projectValueGroup(extended, SEED_GROUP_ID, SEED_TODAY);
    expect(after?.budget).toEqual(before?.budget);
  });
});
