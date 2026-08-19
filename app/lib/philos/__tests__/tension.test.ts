import { describe, expect, it } from "vitest";
import { buildCommunityTensions, buildHumanTensions, sortTensions, type TensionItem } from "../tension";
import type { OrientationCore } from "../orientationCore";
import { projectValueGroup } from "../projectValueGroup";
import { DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY } from "../demoCommunities";
import { GROUP_ID, VALUE_GROUP_EVENTS, SEED_TODAY } from "../valueGroupLog";

function mark(overrides: Partial<{ canon_event_id: string; subject: string; domain: "G" | "E" | "C"; level: number; stability: number; observed_at: string }>) {
  return {
    id: overrides.canon_event_id ?? "x",
    canon_event_id: overrides.canon_event_id ?? "x",
    subject: overrides.subject ?? "person_a",
    domain: overrides.domain ?? "E",
    frame: "I" as const,
    level: overrides.level ?? 0,
    stability: overrides.stability ?? 0.5,
    deficitType: "RELATIVE" as const,
    context: "test",
    reference: "self_goal:test",
    observed_at: overrides.observed_at ?? "2026-08-15T10:00:00.000Z",
    recorded_at: "2026-08-15T10:00:01.000Z",
    provenance: "self_reported" as const,
    persisted_or_derived: "persisted" as const,
    label: "test",
    tooltip: "test",
  };
}

describe("buildHumanTensions — real deficit domains only, stable id across surfaces", () => {
  it("no tensions when every domain is at or above equilibrium", () => {
    const core: OrientationCore = { subject: "person_a", G: mark({ level: 0 }), E: mark({ level: 2 }) };
    expect(buildHumanTensions(core)).toEqual([]);
  });

  it("a real deficit domain becomes a real tension with a deterministic id", () => {
    const core: OrientationCore = { subject: "person_a", E: mark({ level: -2, canon_event_id: "c1" }) };
    const items = buildHumanTensions(core);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("human:person_a:E");
    expect(items[0].provenance).toBe("REAL");
    expect(items[0].severity).toBe("medium");
    expect(items[0].evidence_source).toContain("c1");
  });

  it("direction is unknown without a real prior, not fabricated as stable", () => {
    const core: OrientationCore = { subject: "person_a", E: mark({ level: -1 }) };
    expect(buildHumanTensions(core)[0].change_direction).toBe("unknown");
  });

  it("direction reads real prior->current comparison when both exist", () => {
    const core: OrientationCore = {
      subject: "person_a",
      E: mark({ level: -1, observed_at: "2026-08-15T12:00:00.000Z" }),
      priorE: mark({ level: -3, observed_at: "2026-08-14T12:00:00.000Z" }),
    };
    expect(buildHumanTensions(core)[0].change_direction).toBe("improving");
  });

  it("severity scales with real deficit magnitude", () => {
    const core: OrientationCore = { subject: "person_a", G: mark({ level: -5 }) };
    expect(buildHumanTensions(core)[0].severity).toBe("high");
  });
});

describe("buildCommunityTensions — real budget/impact signals, provenance from the caller", () => {
  it("the real seeded group (positive budget, no rejected impact) has no tensions", () => {
    const group = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY)!;
    expect(buildCommunityTensions(group, "REAL")).toEqual([]);
  });

  it("[DEMO] green innovation has a real tension for its rejected impact verification", () => {
    const group = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const items = buildCommunityTensions(group, "DEMO");
    const rejected = items.find((i) => i.id.includes("impact_rejected"));
    expect(rejected).toBeDefined();
    expect(rejected?.provenance).toBe("DEMO");
    expect(rejected?.status).toBe("open");
  });

  it("negative available budget produces a real, checked treasury tension", () => {
    const group = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const overspent = { ...group, budget: { ...group.budget, available: -500 } };
    const items = buildCommunityTensions(overspent, "DEMO");
    expect(items.some((i) => i.id.endsWith("budget_available"))).toBe(true);
  });
});

describe("sortTensions — severity-ordered, one shared ordering", () => {
  it("orders high before medium before low before unknown", () => {
    const items: TensionItem[] = [
      { id: "a", subject: "s", config_family: "human", label: "a", current_state: "", change_direction: "unknown", severity: "low", evidence_source: "", provenance: "REAL", status: "unknown" },
      { id: "b", subject: "s", config_family: "human", label: "b", current_state: "", change_direction: "unknown", severity: "high", evidence_source: "", provenance: "REAL", status: "unknown" },
      { id: "c", subject: "s", config_family: "human", label: "c", current_state: "", change_direction: "unknown", severity: "unknown", evidence_source: "", provenance: "REAL", status: "unknown" },
    ];
    expect(sortTensions(items).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});
