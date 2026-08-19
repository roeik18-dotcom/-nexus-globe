import { describe, expect, it } from "vitest";
import { linksForEntity, linksByRelation } from "../entityLink";
import { buildEntityLinkRegistry, buildDemoMarketplaceLinks, buildMembershipLinks, buildEffectCommunityLinks, buildRealNeedCommunityLinks, buildRealActionCommunityLinks } from "../linkRegistry";
import { projectValueGroup } from "../../projectValueGroup";
import { GROUP_ID, VALUE_GROUP_EVENTS, SEED_TODAY } from "../../valueGroupLog";
import { DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY } from "../../demoCommunities";
import { DEMO_NEED, DEMO_SCENARIO_COMMUNITY_ID } from "../../canon/demoMarketplaceScenario";

describe("buildMembershipLinks — real membership, no fabricated ids", () => {
  it("one REAL PERSON_MEMBER_OF_COMMUNITY link per real member, using the SAME ids projectValueGroup already computed", () => {
    const group = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY)!;
    const links = buildMembershipLinks(group, "REAL");
    expect(links.length).toBe(group.members.length);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l.provenance).toBe("REAL");
      expect(l.relation).toBe("PERSON_MEMBER_OF_COMMUNITY");
      expect(l.target.canonical_id).toBe(GROUP_ID);
      expect(group.members.some((m) => m.person_id === l.source.canonical_id)).toBe(true);
    }
  });

  it("DEMO community members produce DEMO-provenance links, never REAL", () => {
    const demo = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const links = buildMembershipLinks(demo, "DEMO");
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.provenance === "DEMO")).toBe(true);
  });
});

describe("buildDemoMarketplaceLinks — derived from the real DEMO object graph, not asserted", () => {
  it("includes COMMUNITY_HAS_NEED pointing at the same community the demo fixture uses", () => {
    const links = buildDemoMarketplaceLinks();
    const needLink = linksByRelation(links, "COMMUNITY_HAS_NEED")[0];
    expect(needLink).toBeDefined();
    expect(needLink.source.canonical_id).toBe(DEMO_SCENARIO_COMMUNITY_ID);
    expect(needLink.target.canonical_id).toBe(DEMO_NEED.need_id);
    expect(needLink.provenance).toBe("DEMO");
  });

  it("includes NEED_MATCHED_TO_OFFER only because the real evaluateMatch() call actually permitted it", () => {
    const links = buildDemoMarketplaceLinks();
    const matchLink = linksByRelation(links, "NEED_MATCHED_TO_OFFER")[0];
    expect(matchLink).toBeDefined();
    expect(matchLink.note).toContain("permitted");
  });

  it("ACTION_AFFECTS_COMMUNITY references the real still-open allocation, not a fabricated one", () => {
    const links = buildDemoMarketplaceLinks();
    const actionLink = linksByRelation(links, "ACTION_AFFECTS_COMMUNITY")[0];
    expect(actionLink.target.canonical_id).toBe(DEMO_SCENARIO_COMMUNITY_ID);
  });
});

describe("buildEntityLinkRegistry — combined, queryable registry", () => {
  it("linksForEntity finds a real person's community membership", () => {
    const group = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY)!;
    const registry = buildEntityLinkRegistry([{ group, provenance: "REAL" }]);
    const somePerson = group.members[0].person_id;
    const links = linksForEntity(registry, "person", somePerson);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].relation).toBe("PERSON_MEMBER_OF_COMMUNITY");
  });

  it("an entity with no real or DEMO link returns [], never a fabricated placeholder", () => {
    const registry = buildEntityLinkRegistry([]);
    expect(linksForEntity(registry, "person", "person_e2e")).toEqual([]);
  });

  it("the REAL community's COMMUNITY_LOCATED_IN_REGION link, when present, comes from its own real group.region field — never VALUE_GROUP_PRESENT_IN_REGION/PERSON_ASSOCIATED_WITH_VALUE_GROUP/PROJECT_BELONGS_TO_COMMUNITY, which have no real or DEMO data to derive from at all", () => {
    const group = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY)!;
    const registry = buildEntityLinkRegistry([{ group, provenance: "REAL" }]);
    const realRegionLinks = linksByRelation(registry, "COMMUNITY_LOCATED_IN_REGION").filter((l) => l.provenance === "REAL");
    expect(realRegionLinks.every((l) => l.note?.includes("group.region"))).toBe(true);
    expect(linksByRelation(registry, "VALUE_GROUP_PRESENT_IN_REGION")).toEqual([]);
    expect(linksByRelation(registry, "PERSON_ASSOCIATED_WITH_VALUE_GROUP")).toEqual([]);
    expect(linksByRelation(registry, "PROJECT_BELONGS_TO_COMMUNITY")).toEqual([]);
  });
});


describe("EFFECT_AFFECTS_COMMUNITY — derived, never inferred", () => {
  const actionLink = {
    link_id: "link_a_c",
    relation: "ACTION_AFFECTS_COMMUNITY" as const,
    source: { type: "action" as const, canonical_id: "act_1", source_system: "s", source_local_id: "act_1" },
    target: { type: "community" as const, canonical_id: "vg_1", source_system: "s", source_local_id: "vg_1" },
    provenance: "DEMO" as const,
    confidence: 1,
  };

  it("composes Effect->Community when Effect.action_ref matches a linked Action", () => {
    const out = buildEffectCommunityLinks([actionLink], [{ effect_id: "eff_1", action_ref: "act_1" }]);
    expect(out).toHaveLength(1);
    expect(out[0].relation).toBe("EFFECT_AFFECTS_COMMUNITY");
    expect(out[0].source.canonical_id).toBe("eff_1");
    expect(out[0].target.canonical_id).toBe("vg_1");
  });

  it("INHERITS the action link's provenance — a derived link is never upgraded to REAL", () => {
    const out = buildEffectCommunityLinks([actionLink], [{ effect_id: "eff_1", action_ref: "act_1" }]);
    expect(out[0].provenance).toBe("DEMO");

    const realAction = { ...actionLink, link_id: "link_real", provenance: "REAL" as const };
    const fromReal = buildEffectCommunityLinks([realAction], [{ effect_id: "eff_1", action_ref: "act_1" }]);
    expect(fromReal[0].provenance).toBe("REAL");
  });

  it("produces NOTHING when the Effect references an unlinked Action — absence, not placeholder", () => {
    expect(buildEffectCommunityLinks([actionLink], [{ effect_id: "eff_2", action_ref: "act_other" }])).toEqual([]);
  });

  it("produces NOTHING when there is no ACTION_AFFECTS_COMMUNITY link at all", () => {
    expect(buildEffectCommunityLinks([], [{ effect_id: "eff_1", action_ref: "act_1" }])).toEqual([]);
  });

  it("never links an Effect that carries no action_ref", () => {
    expect(buildEffectCommunityLinks([actionLink], [{ effect_id: "eff_3", action_ref: "" }])).toEqual([]);
  });

  it("does not consult subject, membership, value or text — only action_ref", () => {
    // Same effect id, same community present, but the ref points elsewhere.
    // No amount of other shared context may produce a link.
    const out = buildEffectCommunityLinks([actionLink], [{ effect_id: "eff_1", action_ref: "act_unrelated" }]);
    expect(out).toEqual([]);
  });
});


describe("REAL chain — Community -> Need -> Action -> Effect, explicit only", () => {
  const known = new Set(["vg_real"]);

  it("creates a REAL COMMUNITY_HAS_NEED only when origin_group_id was written", () => {
    const out = buildRealNeedCommunityLinks(
      [{ need_id: "need_1", origin_group_id: "vg_real", recorded_at: "2026-08-20T00:00:00+03:00" }],
      known,
    );
    expect(out).toHaveLength(1);
    expect(out[0].provenance).toBe("REAL");
    expect(out[0].relation).toBe("COMMUNITY_HAS_NEED");
    expect(out[0].valid_from).toBe("2026-08-20T00:00:00+03:00");
  });

  it("creates NOTHING for a Need with no origin_group_id", () => {
    expect(buildRealNeedCommunityLinks([{ need_id: "need_2" }], known)).toEqual([]);
    expect(buildRealNeedCommunityLinks([{ need_id: "need_3", origin_group_id: "  " }], known)).toEqual([]);
  });

  it("drops a reference to a group this registry does not know — no phantom community", () => {
    expect(buildRealNeedCommunityLinks([{ need_id: "need_4", origin_group_id: "vg_ghost" }], known)).toEqual([]);
  });

  it("composes ACTION_AFFECTS_COMMUNITY from Action.inputs naming that Need", () => {
    const needGroup = new Map([["need_1", "vg_real"]]);
    const out = buildRealActionCommunityLinks([{ action_id: "act_1", inputs: ["need_1", "obs_9"] }], needGroup);
    expect(out).toHaveLength(1);
    expect(out[0].provenance).toBe("REAL");
    expect(out[0].source.canonical_id).toBe("act_1");
    expect(out[0].target.canonical_id).toBe("vg_real");
  });

  it("creates NOTHING when the Action's inputs name no group-bearing Need", () => {
    const needGroup = new Map([["need_1", "vg_real"]]);
    expect(buildRealActionCommunityLinks([{ action_id: "act_2", inputs: ["obs_1", "offer_1"] }], needGroup)).toEqual([]);
    expect(buildRealActionCommunityLinks([{ action_id: "act_3", inputs: [] }], needGroup)).toEqual([]);
  });

  it("does not duplicate when several inputs point at the same group", () => {
    const needGroup = new Map([["need_1", "vg_real"], ["need_2", "vg_real"]]);
    const out = buildRealActionCommunityLinks([{ action_id: "act_4", inputs: ["need_1", "need_2"] }], needGroup);
    expect(out).toHaveLength(1);
  });

  it("END TO END: the whole chain reaches Effect as REAL, and stops if any link is missing", () => {
    const needLinks = buildRealNeedCommunityLinks([{ need_id: "need_1", origin_group_id: "vg_real" }], known);
    const actionLinks = buildRealActionCommunityLinks([{ action_id: "act_1", inputs: ["need_1"] }], new Map([["need_1", "vg_real"]]));
    const effectLinks = buildEffectCommunityLinks([...needLinks, ...actionLinks], [{ effect_id: "eff_1", action_ref: "act_1" }]);
    expect(effectLinks).toHaveLength(1);
    expect(effectLinks[0].provenance).toBe("REAL");
    expect(effectLinks[0].target.canonical_id).toBe("vg_real");

    // Break the middle link: the Action no longer names the Need.
    const brokenActions = buildRealActionCommunityLinks([{ action_id: "act_1", inputs: ["obs_only"] }], new Map([["need_1", "vg_real"]]));
    expect(buildEffectCommunityLinks([...needLinks, ...brokenActions], [{ effect_id: "eff_1", action_ref: "act_1" }])).toEqual([]);
  });
});
