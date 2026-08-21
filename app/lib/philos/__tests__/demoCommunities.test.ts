import { describe, expect, it } from "vitest";
import { buildCapitalTimeline, buildContributorRanking, projectValueGroup } from "../projectValueGroup";
import {
  DEMO_COMMUNITIES,
  DEMO_GREEN_INNOVATION_EVENTS,
  DEMO_GREEN_INNOVATION_ID,
  DEMO_GREEN_INNOVATION_TODAY,
  DEMO_NEIGHBORHOOD_SMALL_EVENTS,
  DEMO_NEIGHBORHOOD_SMALL_ID,
  DEMO_NEIGHBORHOOD_SMALL_TODAY,
} from "../demoCommunities";
import { SEED_GROUP_ID as REAL_GROUP_ID } from "../valueGroupLog";

describe("DEMO communities — real projectValueGroup mechanics, never a parallel schema", () => {
  it("every demo group_id is prefixed demo_ and distinct from the real seeded group", () => {
    for (const c of DEMO_COMMUNITIES) {
      expect(c.group_id.startsWith("demo_")).toBe(true);
      expect(c.group_id).not.toBe(REAL_GROUP_ID);
    }
  });

  it("[DEMO] green innovation projects through the real, unmodified projectValueGroup — large treasury, mixed outcomes", () => {
    const g = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY);
    expect(g).not.toBeNull();
    if (!g) throw new Error("unreachable");

    expect(g.name.startsWith("[DEMO]")).toBe(true);
    expect(g.members.length).toBe(10);
    expect(g.leaders.length).toBe(2);

    // Treasury: 180000 + 42000 in, 60000 + 25000 out (both completed transfers).
    expect(g.budget.received).toBe(222000);
    expect(g.budget.spent).toBe(85000);
    // demo_alloc_compost is proposed but never approved -> not committed.
    expect(g.budget.committed).toBe(0);
    expect(g.budget.available).toBe(222000 - 85000);

    // 3 allocations proposed: solar (transferred), compost (voting), bikes (transferred).
    expect(g.allocations).toHaveLength(3);
    const solar = g.allocations.find((a) => a.allocation_id === "demo_alloc_solar");
    const compost = g.allocations.find((a) => a.allocation_id === "demo_alloc_compost");
    const bikes = g.allocations.find((a) => a.allocation_id === "demo_alloc_bikes");
    expect(solar?.state).toBe("transferred");
    expect(compost?.state).toBe("voting");
    expect(bikes?.state).toBe("transferred");

    // Mixed impact outcomes: one verified, one rejected — investment risk is real.
    const solarImpact = g.impact.find((i) => i.impact_id === "demo_imp_solar");
    const bikesImpact = g.impact.find((i) => i.impact_id === "demo_imp_bikes");
    expect(solarImpact?.verified).toBe(true);
    expect(bikesImpact?.rejected).toBe(true);
    expect(bikesImpact?.verified).toBe(false);

    // Allocation -> Effect is a real, explicit link via allocation_id, never
    // inferred from title/proximity (Dynamics <-> Community capital wiring).
    expect(solarImpact?.allocation_id).toBe("demo_alloc_solar");
    expect(bikesImpact?.allocation_id).toBe("demo_alloc_bikes");
    // The still-voting compost allocation has no recorded impact at all.
    expect(g.impact.some((i) => i.allocation_id === "demo_alloc_compost")).toBe(false);
  });

  it("[DEMO] small neighborhood network projects correctly — small treasury, single verified impact", () => {
    const g = projectValueGroup(DEMO_NEIGHBORHOOD_SMALL_EVENTS, DEMO_NEIGHBORHOOD_SMALL_ID, DEMO_NEIGHBORHOOD_SMALL_TODAY);
    expect(g).not.toBeNull();
    if (!g) throw new Error("unreachable");

    expect(g.name.startsWith("[DEMO]")).toBe(true);
    expect(g.members.length).toBe(4);
    expect(g.budget.received).toBe(1200);
    expect(g.budget.spent).toBe(800);
    expect(g.allocations).toHaveLength(1);
    expect(g.allocations[0].state).toBe("transferred");
    expect(g.impact).toHaveLength(1);
    expect(g.impact[0].verified).toBe(true);
  });

  it("buildCapitalTimeline folds the real money events into a real chronological running balance", () => {
    const points = buildCapitalTimeline(DEMO_NEIGHBORHOOD_SMALL_EVENTS);
    // 1 inflow (+1200) + 1 outflow (-800), chronological.
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ delta: 1200, balance: 1200 });
    expect(points[1]).toMatchObject({ delta: -800, balance: 400 });
  });

  it("buildContributorRanking counts real events per actor — dg_shira leads (resources leader: proposes/votes/approves/transfers across two allocations)", () => {
    const ranking = buildContributorRanking(DEMO_GREEN_INNOVATION_EVENTS);
    expect(ranking[0].person_id).toBe("dg_shira");
    expect(ranking.every((r) => r.event_count > 0)).toBe(true);
    // person.registered itself never counts as a contribution.
    const total = ranking.reduce((s, r) => s + r.event_count, 0);
    expect(total).toBe(DEMO_GREEN_INNOVATION_EVENTS.filter((e) => e.event_type !== "person.registered").length);
  });

  it("the two demo communities differ meaningfully in scale (treasury, members) — not copies of each other", () => {
    const gi = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const nb = projectValueGroup(DEMO_NEIGHBORHOOD_SMALL_EVENTS, DEMO_NEIGHBORHOOD_SMALL_ID, DEMO_NEIGHBORHOOD_SMALL_TODAY)!;
    expect(gi.budget.received).toBeGreaterThan(nb.budget.received * 50);
    expect(gi.members.length).toBeGreaterThan(nb.members.length);
  });
});
