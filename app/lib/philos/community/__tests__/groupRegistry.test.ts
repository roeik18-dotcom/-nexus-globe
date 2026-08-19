import { describe, expect, it } from "vitest";
import { buildGroupRegistry, buildPossibleGroups } from "../groupRegistry";
import type { ValueGroupView } from "../../projectValueGroup";

function baseView(overrides: Partial<ValueGroupView> = {}): ValueGroupView {
  return {
    group_id: "g1", name: "Test Group", central_value: "אחריות", goal: "", region: "תל אביב",
    visibility: "public", status: "active", opened_at: "2026-01-01T00:00:00Z",
    founder: { person_id: "p1", display_name: "Founder" }, creation_reason: "",
    leaders: [], members: [{ person_id: "p1", display_name: "Founder" }, { person_id: "p2", display_name: "Second" }], today: [],
    budget: { received: 100, spent: 0, committed: 0, available: 100, currency: "ILS", provenance: { source_events: [], sample_size: 0, verification_status: "self_report" } },
    allocations: [], transfers: [], impact: [{
      impact_id: "i1", impact_event_id: "e1", statement: "s", people_affected: 1, resources_invested: 1,
      reported_status: "self_report", verification_status: "community_verified", verified: true, verification_level: "verified",
      rejected: false, verification: null, review_request: null, review_request_count: 0, verification_count: 1, verified_by_count: 1,
      evidence: [], provenance: { source_events: [], sample_size: 0, verification_status: "self_report" },
    }],
    impact_totals: {} as ValueGroupView["impact_totals"],
    event_count: 12,
    ...overrides,
  };
}

describe("buildGroupRegistry", () => {
  it("tags REAL and DEMO status from the given provenance when status is plain 'active'", () => {
    const real = baseView({ group_id: "r1" });
    const demo = baseView({ group_id: "d1" });
    const registry = buildGroupRegistry([{ view: real, provenance: "REAL" }, { view: demo, provenance: "DEMO" }]);
    expect(registry.find((g) => g.group_id === "r1")?.status).toBe("REAL");
    expect(registry.find((g) => g.group_id === "d1")?.status).toBe("DEMO");
  });

  it("a real 'archived'/'forming' status field overrides the provenance tag", () => {
    const archived = baseView({ group_id: "a1", status: "archived" });
    const forming = baseView({ group_id: "f1", status: "forming" });
    const registry = buildGroupRegistry([{ view: archived, provenance: "REAL" }, { view: forming, provenance: "DEMO" }]);
    expect(registry.find((g) => g.group_id === "a1")?.status).toBe("ARCHIVED");
    expect(registry.find((g) => g.group_id === "f1")?.status).toBe("FORMING");
  });

  it("counts members, verified effects, and available budget correctly", () => {
    const registry = buildGroupRegistry([{ view: baseView(), provenance: "REAL" }]);
    expect(registry[0].member_count).toBe(2);
    expect(registry[0].verified_effects).toBe(1);
    expect(registry[0].available).toBe(100);
  });
});

describe("buildPossibleGroups — real 'VALUE EXISTS — NO GROUP' signal only, never a fabricated community", () => {
  it("returns a possibility entry only for a value with 0 real groups", () => {
    const result = buildPossibleGroups([
      { value_id: "v1", name: "Has A Group", groups: ["g1"] },
      { value_id: "v2", name: "No Group", groups: [] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].value_id).toBe("v2");
    expect(result[0].basis).toBe("VALUE_EXISTS_NO_GROUP");
  });

  it("returns [] when every value already has a real group", () => {
    expect(buildPossibleGroups([{ value_id: "v1", name: "x", groups: ["g1"] }])).toEqual([]);
  });
});
