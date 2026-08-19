import { describe, expect, it } from "vitest";
import { buildValueRegistry, buildValueRelations, type PudmValueSource } from "../valueRegistry";
import type { ValueGroupView } from "../../projectValueGroup";

function baseView(overrides: Partial<ValueGroupView> = {}): ValueGroupView {
  return {
    group_id: "g1", name: "Test Group", central_value: "אחריות", goal: "", region: "תל אביב",
    visibility: "public", status: "active", opened_at: "2026-01-01T00:00:00Z",
    founder: { person_id: "p1", display_name: "Founder" }, creation_reason: "",
    leaders: [], members: [{ person_id: "p1", display_name: "Founder" }], today: [],
    budget: { received: 0, spent: 0, committed: 0, available: 0, currency: "ILS", provenance: { source_events: [], sample_size: 0, verification_status: "self_report" } },
    allocations: [], transfers: [], impact: [],
    impact_totals: {} as ValueGroupView["impact_totals"],
    event_count: 0,
    ...overrides,
  };
}

describe("buildValueRegistry — does not reduce the system to one value", () => {
  it("includes the real group's central_value, DEMO groups' values, and PUDM candidate values, tagged correctly", () => {
    const real = baseView({ group_id: "real1", central_value: "אחריות" });
    const demo = baseView({ group_id: "demo1", central_value: "קיימות" });
    const pudm: PudmValueSource[] = [{ id: "trust", context: { label: "Trust", domain: "Social" } }];

    const registry = buildValueRegistry(
      [{ view: real, provenance: "REAL" }, { view: demo, provenance: "DEMO" }],
      pudm,
    );

    expect(registry.some((v) => v.name === "אחריות" && v.provenance === "REAL")).toBe(true);
    expect(registry.some((v) => v.name === "קיימות" && v.provenance === "DEMO")).toBe(true);
    expect(registry.some((v) => v.name === "Trust" && v.provenance === "LEGACY")).toBe(true);
    expect(registry).toHaveLength(3);
  });

  it("two groups sharing the same central_value collapse into one Value entry, listing both groups", () => {
    const a = baseView({ group_id: "a", central_value: "אחריות" });
    const b = baseView({ group_id: "b", central_value: "אחריות" });
    const registry = buildValueRegistry([{ view: a, provenance: "REAL" }, { view: b, provenance: "DEMO" }], []);
    expect(registry).toHaveLength(1);
    expect(registry[0].groups.sort()).toEqual(["a", "b"]);
  });

  it("a PUDM value never carries a group — real, checked absence, not fabricated", () => {
    const registry = buildValueRegistry([], [{ id: "capital", context: { label: "Capital", domain: "Finance" } }]);
    expect(registry[0].groups).toEqual([]);
  });
});

describe("buildValueRelations — honestly empty, no invented linguistic-opposite matching", () => {
  it("returns 0 relations", () => {
    expect(buildValueRelations()).toEqual([]);
  });
});
