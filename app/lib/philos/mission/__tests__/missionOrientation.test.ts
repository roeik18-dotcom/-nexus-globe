import { describe, expect, it } from "vitest";
import { buildMissionOrientation } from "../missionOrientation";
import { buildDemoOperationalValuePath, buildHypothesisHumanValueRelation } from "../demoMissionValues";
import { buildCarryForward } from "../../dayClosingFusion";
import { buildDemoMusicConfig, DEMO_MUSIC_SUBJECT } from "../../valueDomain/demoMusicDomain";
import type { OrientationCore } from "../../orientationCore";

const EMPTY_LIFECYCLE = { subject: "s", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };

describe("buildMissionOrientation — real dimensions only, unknown never fabricated", () => {
  it("a REAL subject with no attached value domain has unknown skills/interests/motivations/relationships", () => {
    const core: OrientationCore = { subject: "person_test_x" };
    const carryForward = buildCarryForward({
      subject: "person_test_x", today: "2026-08-16", core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
    });
    const mission = buildMissionOrientation({
      subject: "person_test_x", provenance: "REAL", today: "2026-08-16", core,
      needs: [], tensions: [], lifecycle: EMPTY_LIFECYCLE, bridgeRegistry: [], carryForward,
    });
    expect(mission.skills.every((s) => s.status === "unknown")).toBe(true);
    expect(mission.interests.every((s) => s.status === "unknown")).toBe(true);
    expect(mission.motivations.every((s) => s.status === "unknown")).toBe(true);
    expect(mission.relationships.every((s) => s.status === "unknown")).toBe(true);
    expect(mission.values).toEqual([]);
  });

  it("a DEMO subject with an attached Value Domain gets real capability/gap/value data, clearly DEMO", () => {
    const today = "2026-08-16";
    const config = buildDemoMusicConfig(today);
    const core: OrientationCore = { subject: DEMO_MUSIC_SUBJECT };
    const carryForward = buildCarryForward({
      subject: DEMO_MUSIC_SUBJECT, today, core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
      valueDomain: { config, subject: DEMO_MUSIC_SUBJECT },
    });
    const operationalValues = [buildDemoOperationalValuePath(today)];
    const mission = buildMissionOrientation({
      subject: DEMO_MUSIC_SUBJECT, provenance: "DEMO", today, core,
      needs: [], tensions: [], lifecycle: EMPTY_LIFECYCLE, bridgeRegistry: [], carryForward,
      valueDomain: { config, subject: DEMO_MUSIC_SUBJECT, operationalValues },
    });
    expect(mission.values).toHaveLength(1);
    expect(mission.values[0].value_created.status).toBe("demo");
    expect(mission.capabilities.length).toBeGreaterThan(0);
    expect(mission.constraints.some((c) => c.status === "demo")).toBe(true);
  });
});

describe("buildDemoOperationalValuePath — the full WHY->NEXT chain, demo-labeled throughout", () => {
  it("every field is present and demo-status", () => {
    const path = buildDemoOperationalValuePath("2026-08-16");
    expect(path.why_it_matters.status).toBe("demo");
    expect(path.value_created.status).toBe("demo"); // real accepted result -> real chain
    expect(path.next_action.status).toBe("demo");
  });
});

describe("buildHypothesisHumanValueRelation — never asserted as fact/observed", () => {
  it("is DEMO provenance and explicitly labeled HYPOTHESIS in its own statement", () => {
    const rel = buildHypothesisHumanValueRelation();
    expect(rel.provenance).toBe("DEMO");
    expect(rel.statement).toContain("HYPOTHESIS");
  });
});
