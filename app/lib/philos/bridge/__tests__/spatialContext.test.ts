import { describe, expect, it } from "vitest";
import { linksByRelation, linksForEntity } from "../entityLink";
import { buildCommunityRegionLink, buildDemoMarketplaceSpatialLinks, spatialContextForCommunity, DEMO_COUNTRY } from "../spatialContext";
import { buildDefaultLinkRegistry } from "../linkRegistry";
import { projectValueGroup } from "../../projectValueGroup";
import { VALUE_GROUP_EVENTS, SEED_TODAY, SEED_GROUP_ID } from "../../valueGroupLog";
import { DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY, DEMO_NEIGHBORHOOD_SMALL_ID } from "../../demoCommunities";
import { DEMO_NEED } from "../../canon/demoMarketplaceScenario";

describe("spatialContextForCommunity — derived from the real group.region field, not invented", () => {
  it("the REAL seeded community's region is real (תל אביב, from group.opened's own payload)", () => {
    const group = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY)!;
    const ctx = spatialContextForCommunity(group, "REAL");
    expect(ctx?.label).toBe("תל אביב");
    expect(ctx?.provenance).toBe("REAL");
    expect(ctx?.parent_id).toBeUndefined();
  });

  it("a DEMO community's region nests under the DEMO country context", () => {
    const group = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const ctx = spatialContextForCommunity(group, "DEMO");
    expect(ctx?.label).toBe(group.region);
    expect(ctx?.parent_id).toBe(DEMO_COUNTRY.id);
  });
});

describe("buildCommunityRegionLink — REAL and DEMO communities land in different regions", () => {
  it("the real community and a DEMO community resolve to different region ids", () => {
    const real = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY)!;
    const demo = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const realLink = buildCommunityRegionLink(real, "REAL")!;
    const demoLink = buildCommunityRegionLink(demo, "DEMO")!;
    expect(realLink.provenance).toBe("REAL");
    expect(demoLink.provenance).toBe("DEMO");
    expect(realLink.target.canonical_id).not.toBe(demoLink.target.canonical_id);
  });
});

describe("buildDemoMarketplaceSpatialLinks — placed in the scenario's own community's region", () => {
  it("the DEMO need's region matches demo_vg_green_innovation's own region", () => {
    const greenInnovation = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
    const links = buildDemoMarketplaceSpatialLinks(greenInnovation);
    const needLink = linksForEntity(links, "need", DEMO_NEED.need_id)[0];
    const regionCtx = spatialContextForCommunity(greenInnovation, "DEMO")!;
    expect(needLink.relation).toBe("NEED_EXISTS_IN");
    expect(needLink.target.canonical_id).toBe(regionCtx.id);
  });
});

describe("real entities never receive a fabricated spatial link", () => {
  it("no real Person/Need/Offer/Action/Effect ever carries a spatial link — only Community (via its own real region field)", () => {
    const registry = buildDefaultLinkRegistry(VALUE_GROUP_EVENTS, SEED_TODAY);
    const spatialRelations = [
      "COMMUNITY_LOCATED_IN_REGION", "ENTITY_LOCATED_IN", "ENTITY_ACTIVE_IN", "ENTITY_AFFECTS_REGION",
      "ACTION_OCCURRED_IN", "EFFECT_OBSERVED_IN", "RESOURCE_AVAILABLE_IN", "NEED_EXISTS_IN", "COMMUNITY_ACTIVE_IN",
    ] as const;
    for (const relation of spatialRelations) {
      const links = linksByRelation(registry, relation);
      for (const l of links) {
        if (l.provenance === "REAL") {
          expect(l.source.type === "community" || l.target.type === "community").toBe(true);
        }
      }
    }
  });

  it("the two DEMO communities resolve to two different regions", () => {
    const real = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY)!;
    void real;
    const registry = buildDefaultLinkRegistry(VALUE_GROUP_EVENTS, SEED_TODAY);
    const communityRegions = linksByRelation(registry, "COMMUNITY_LOCATED_IN_REGION");
    const green = communityRegions.find((l) => l.source.canonical_id === DEMO_GREEN_INNOVATION_ID);
    const neighborhood = communityRegions.find((l) => l.source.canonical_id === DEMO_NEIGHBORHOOD_SMALL_ID);
    expect(green?.target.canonical_id).not.toBe(neighborhood?.target.canonical_id);
  });
});
