import { describe, expect, it } from "vitest";
import { linksForEntity, linksByRelation } from "../entityLink";
import { buildEntityLinkRegistry, buildDemoMarketplaceLinks, buildMembershipLinks } from "../linkRegistry";
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
