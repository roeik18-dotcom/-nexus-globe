import { describe, expect, it } from "vitest";

import { atScope, buildSocialChronology, type ChronoInput } from "../socialChronology";
import type { PhilosEvent } from "../../events";

const ev = (over: Partial<PhilosEvent>): PhilosEvent => ({
  event_id: "e1", actor_id: "p1", entity_type: "value_group", entity_id: "vg_1",
  event_type: "member.joined", value_tags: [], timestamp: "2026-07-20T15:00:00+03:00",
  visibility: "public", ...over,
} as PhilosEvent);

const base: ChronoInput = { events: [], needs: [], offers: [], actions: [], effects: [], observations: [] };

describe("socialChronology — ordering", () => {
  it("orders strictly by the records' own timestamps", () => {
    const out = buildSocialChronology({
      ...base,
      events: [ev({ event_id: "late", timestamp: "2026-08-01T00:00:00+03:00" }),
               ev({ event_id: "early", timestamp: "2026-07-01T00:00:00+03:00" })],
    });
    expect(out.map((e) => e.record_id)).toEqual(["early", "late"]);
  });

  it("is deterministic on identical timestamps", () => {
    const out = buildSocialChronology({ ...base, events: [ev({ event_id: "b" }), ev({ event_id: "a" })] });
    expect(out.map((e) => e.record_id)).toEqual(["a", "b"]);
  });
});

describe("socialChronology — scope, not subject matter", () => {
  it("an edge-forming event reaches NETWORK; a non-edge event does not", () => {
    const out = buildSocialChronology({
      ...base,
      events: [ev({ event_id: "join", event_type: "member.joined" }),
               ev({ event_id: "vote", event_type: "allocation.voted" })],
    });
    expect(atScope(out, "NETWORK").map((e) => e.record_id)).toEqual(["join"]);
    expect(atScope(out, "GROUP")).toHaveLength(2);
  });

  it("a Need reaches NETWORK only once it carries a group — never from its text", () => {
    const out = buildSocialChronology({
      ...base,
      needs: [
        { need_id: "n_bare", desired_change: "text naming a group", recorded_at: "2026-08-16T00:00:00+03:00" },
        { need_id: "n_grouped", desired_change: "x", recorded_at: "2026-08-17T00:00:00+03:00", origin_group_id: "vg_1" },
      ],
    });
    expect(atScope(out, "NETWORK").map((e) => e.record_id)).toEqual(["n_grouped"]);
  });

  it("SYSTEM is empty and that is an answer, not a gap", () => {
    const out = buildSocialChronology({
      ...base,
      events: [ev({}), ev({ event_id: "e2", event_type: "impact.recorded" })],
      effects: [{ effect_id: "eff", action_ref: "act", verified: true, recorded_at: "2026-08-16T00:00:00+03:00" }],
    });
    expect(atScope(out, "SYSTEM")).toEqual([]);
  });
});

describe("socialChronology — chronology is not causality", () => {
  it("adjacent records carry NO reference to each other", () => {
    const out = buildSocialChronology({
      ...base,
      needs: [{ need_id: "n1", desired_change: "x", recorded_at: "2026-08-16T17:00:00+03:00" }],
      actions: [{ action_id: "a1", inputs: [], recorded_at: "2026-08-16T18:00:00+03:00" }],
    });
    expect(out.map((e) => e.record_id)).toEqual(["n1", "a1"]);
    expect(out[1].references).toEqual([]);
  });

  it("only a RECORDED reference becomes a link", () => {
    const out = buildSocialChronology({
      ...base,
      actions: [{ action_id: "a1", inputs: ["n1", "o1"], recorded_at: "2026-08-16T18:00:00+03:00" }],
      effects: [{ effect_id: "eff", action_ref: "a1", verified: false, recorded_at: "2026-08-16T19:00:00+03:00" }],
    });
    expect(out.find((e) => e.record_id === "a1")?.references).toEqual(["n1", "o1"]);
    expect(out.find((e) => e.record_id === "eff")?.references).toEqual(["a1"]);
  });
});

describe("socialChronology — verification", () => {
  it("uses VERIFIED_STATUSES: 'evidence' is CLAIMED, community_verified is VERIFIED", () => {
    const out = buildSocialChronology({
      ...base,
      events: [ev({ event_id: "a", verification_status: "evidence" }),
               ev({ event_id: "b", verification_status: "community_verified" }),
               ev({ event_id: "c" })],
    });
    const by = (id: string) => out.find((e) => e.record_id === id)!.verification;
    expect(by("a")).toBe("CLAIMED");
    expect(by("b")).toBe("VERIFIED");
    expect(by("c")).toBe("UNKNOWN");
  });
});

describe("SOURCE COUNTS come from the collections, not from literals", () => {
  it("contradictions and emergent values are sourced, so a literal cannot drift", async () => {
    const { CONTRADICTION_MASTER } = await import("../../valueSystem/contradictionMaster");
    const { DIRECT_CONTRADICTION_VALUE_RELATIONS } = await import("../../valueSystem/socialValueSpine");
    const { buildSocialFlow } = await import("../socialFlowStages");

    const flow = buildSocialFlow({
      contradictions: CONTRADICTION_MASTER.length,
      emergentValues: DIRECT_CONTRADICTION_VALUE_RELATIONS.length,
      personalValues: null, groupValues: null, valueGroups: null,
      memberships: null, needs: null, actions: null, effects: null, evidence: null,
    });

    // Asserts the WIRING, not the numbers: if either collection changes, this
    // still passes and the UI follows. A literal would have silently drifted.
    expect(flow.find((s) => s.key === "contradiction")?.count).toBe(CONTRADICTION_MASTER.length);
    expect(flow.find((s) => s.key === "emergent_value")?.count).toBe(DIRECT_CONTRADICTION_VALUE_RELATIONS.length);
  });
});
