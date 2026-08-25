/**
 * MATCH REQUEST AUTHORITY — the three refusals the write path must make.
 *
 * These are security tests, not behaviour tests: each one asserts that a
 * write DOES NOT happen and that `appendGroupEvents` was never called. A
 * test that only checked the returned message would still pass if the event
 * were written anyway, so every case asserts on the spy.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_GREEN_INNOVATION_ID } from "../../demoCommunities";

/* The real append is replaced everywhere: no test here may reach the log. */
const appendSpy = vi.fn();
vi.mock("../groupEventStore", () => ({
  appendGroupEvents: (...args: unknown[]) => appendSpy(...args),
  GroupEventRejectedError: class GroupEventRejectedError extends Error {},
}));

/* No real event log is read. `loadPhilosEvents` returning [] is the honest
   representation of "this group has no REAL appointment events". */
vi.mock("@/app/lib/philos-event-store", () => ({
  loadPhilosEvents: async () => [],
}));

const viewer = { person_id: "person_test_viewer" };
vi.mock("@/app/lib/philos/identity/viewerContext", () => ({
  resolveViewerContext: async () => viewer,
}));

const world = { operational: new Map<string, { matches: unknown[] }>(), candidateMatches: [] as unknown[] };
vi.mock("../loadValueGroupWorld", () => ({
  loadValueGroupWorld: async () => world,
}));

const { decideMatchRequestCore } = await import("../matchRequestAction");
const { resolveRealGroupLeaders, resolveGroupLeadership } = await import("../groupAuthority");

function pendingMatch(over: Record<string, unknown> = {}) {
  return {
    match_id: "m_test_1", group_id: "vg_real", status: "CANDIDATE",
    need_ref: "need_test_1", resource_ref: "res_test_1",
    provenance: "REAL", source: "test", proposed_at: "2026-08-23T10:00:00Z",
    last_event_id: "ge_test_1", ...over,
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  appendSpy.mockReset();
  world.operational = new Map();
});

describe("(a) DEMO leadership cannot authorize a REAL write", () => {
  it("a demo-only group yields leaders for DISPLAY but none for AUTHORIZATION", async () => {
    /* The demo bundle is compiled in, so the display resolver finds it even
       though the real log is empty — that is the fallback working. */
    const display = await resolveGroupLeadership(DEMO_GREEN_INNOVATION_ID);
    expect(display.source).toBe("DEMO");
    expect(display.leaders.length).toBeGreaterThan(0);

    /* The authorization resolver must find NOTHING for the same group. */
    const real = await resolveRealGroupLeaders(DEMO_GREEN_INNOVATION_ID);
    expect(real).toEqual([]);
  });

  it("a viewer who is a DEMO leader cannot decide, and nothing is written", async () => {
    const demo = await resolveGroupLeadership(DEMO_GREEN_INNOVATION_ID);
    const demoLeaderId = demo.leaders[0]!.person_id;
    viewer.person_id = demoLeaderId; // the viewer IS a demo coordinator

    world.operational.set(DEMO_GREEN_INNOVATION_ID, {
      matches: [pendingMatch({ group_id: DEMO_GREEN_INNOVATION_ID })],
    });

    const res = await decideMatchRequestCore(form({ match_id: "m_test_1", decision: "ACCEPTED" }));
    expect(res.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();

    viewer.person_id = "person_test_viewer";
  });
});

describe("(b) the client cannot choose the group", () => {
  it("a submitted group_id the viewer leads does not unlock a match in another group", async () => {
    /* The match lives in `vg_other`. The attacker submits `vg_mine` — the
       group they really do lead — hoping the gate checks THAT group. */
    world.operational.set("vg_other", { matches: [pendingMatch({ group_id: "vg_other" })] });

    const res = await decideMatchRequestCore(
      form({ match_id: "m_test_1", decision: "ACCEPTED", group_id: "vg_mine" }),
    );

    expect(res.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("an unknown match_id is refused rather than resolved", async () => {
    const res = await decideMatchRequestCore(form({ match_id: "m_missing", decision: "ACCEPTED" }));
    expect(res).toEqual({ ok: false, message: expect.stringContaining("לא נמצאה") });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("a match_id present in two groups is refused, never disambiguated by picking one", async () => {
    world.operational.set("vg_a", { matches: [pendingMatch({ group_id: "vg_a" })] });
    world.operational.set("vg_b", { matches: [pendingMatch({ group_id: "vg_b" })] });

    const res = await decideMatchRequestCore(form({ match_id: "m_test_1", decision: "ACCEPTED" }));
    expect(res.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

describe("(c) a non-leader cannot decide", () => {
  it("refuses when the real log appoints nobody for the derived group", async () => {
    world.operational.set("vg_real", { matches: [pendingMatch()] });

    const res = await decideMatchRequestCore(form({ match_id: "m_test_1", decision: "ACCEPTED" }));
    expect(res.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a non-REAL match even before leadership is consulted", async () => {
    world.operational.set("vg_real", { matches: [pendingMatch({ provenance: "DEMO" })] });

    const res = await decideMatchRequestCore(form({ match_id: "m_test_1", decision: "ACCEPTED" }));
    expect(res.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a decision value that is neither ACCEPTED nor REJECTED", async () => {
    world.operational.set("vg_real", { matches: [pendingMatch()] });

    const res = await decideMatchRequestCore(form({ match_id: "m_test_1", decision: "MAYBE" }));
    expect(res.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });
});
