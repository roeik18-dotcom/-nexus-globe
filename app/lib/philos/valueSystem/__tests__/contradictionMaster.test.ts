import { describe, expect, it } from "vitest";
import { CONTRADICTION_MASTER, TAXONOMY_CONFLICTS, contradictionsInTaxonomy } from "../contradictionMaster";
import { DIRECT_CONTRADICTION_VALUE_RELATIONS, VALUE_SCALE, buildSocialValueSpine, multiLayerContradictions } from "../socialValueSpine";

describe("contradiction master — identity is not classification", () => {
  it("holds 110 identities, each appearing exactly once", () => {
    expect(CONTRADICTION_MASTER).toHaveLength(110);
    const ids = CONTRADICTION_MASTER.map((c) => c.contradiction_id);
    expect(new Set(ids).size).toBe(110);
    const pairs = CONTRADICTION_MASTER.map((c) => [c.pole_a, c.pole_b].sort().join("|"));
    expect(new Set(pairs).size).toBe(110);
  });

  it("carries NO score, magnitude, weight or 3x3 coordinate", () => {
    for (const c of CONTRADICTION_MASTER) {
      for (const forbidden of ["score", "weight", "magnitude", "level", "stability", "domain", "frame", "cell"]) {
        expect(c).not.toHaveProperty(forbidden);
      }
      expect(Object.keys(c).sort()).toEqual(
        ["contradiction_id", "layer_tags", "pole_a", "pole_b", "source_files", "taxonomy_memberships"],
      );
    }
  });

  it("lets one contradiction belong to several taxonomies at once", () => {
    const multi = CONTRADICTION_MASTER.filter((c) => c.taxonomy_memberships.length > 1);
    expect(multi.length).toBeGreaterThan(0);
  });

  it("keeps the source's multi-LAYER annotations, which forbid a single-cell mapping", () => {
    const tagged = multiLayerContradictions();
    expect(tagged.length).toBe(18);
    // the source explicitly tags this one as both cognitive and bodily
    const both = tagged.find((c) => c.pole_a.includes("רוצה") || c.pole_b.includes("נמנע"));
    expect(both?.layer_tags.length).toBeGreaterThanOrEqual(1);
  });

  it("neither closed set is treated as superseding the other", () => {
    expect(contradictionsInTaxonomy("core_10").length).toBe(10);
    expect(contradictionsInTaxonomy("extended_30").length).toBe(30);
    const c = TAXONOMY_CONFLICTS.find((x) => x.conflict_id === "CLOSED_SET_CARDINALITY");
    expect(c?.status).toBe("UNRESOLVED");
  });

  it("records the FALSE repo-24 provenance as a SOURCE_CONFLICT, keeping both claims", () => {
    const c = TAXONOMY_CONFLICTS.find((x) => x.conflict_id === "REPO_24_PROVENANCE_FALSE")!;
    expect(c.status).toBe("SOURCE_CONFLICT");
    expect(c.previously_claimed).toContain("להלן 30 ניגודי־בסיס");
    expect(c.measured).toContain("11");
    expect(c.measured).toContain("19");
  });
});

describe("social-value spine — the four boundaries", () => {
  it("attaches exactly the 4 direct source examples, and does not generalize", () => {
    expect(DIRECT_CONTRADICTION_VALUE_RELATIONS).toHaveLength(4);
    for (const r of DIRECT_CONTRADICTION_VALUE_RELATIONS) {
      expect(r.status).toBe("SOURCE_SUPPORTED_CONCEPTUAL");
      expect(r.cardinality).toBe("UNDEFINED");
      // the source names the relation but never the resulting value
      expect(r.emergent_value).toBeNull();
      expect(r.source_rule).toContain("מתעורר דווקא מתוך הניגוד");
    }
    expect(DIRECT_CONTRADICTION_VALUE_RELATIONS.length).toBeLessThan(CONTRADICTION_MASTER.length);
  });

  it("keeps value aggregation conceptual — no mechanics may be invented", () => {
    expect(VALUE_SCALE.aggregation_operation).toBe("UNDEFINED");
    expect(VALUE_SCALE.status).toBe("SOURCE_SUPPORTED_CONCEPTUAL_AGGREGATION");
    for (const m of ["sum", "average", "vote", "weight", "threshold", "majority", "score"]) {
      expect(VALUE_SCALE.refused).toContain(m);
    }
  });

  it("gives conceptual links NO count — counting them implies mechanics", () => {
    const { links } = buildSocialValueSpine({});
    expect(links.find((l) => l.key === "personal_value")!.count).toBeNull();
    expect(links.find((l) => l.key === "group_value")!.count).toBeNull();
  });

  it("keeps Group Value distinct from Value Group, and refuses the shortcut", () => {
    const { links } = buildSocialValueSpine({ valueGroups: 1, verifiedGroupRelations: 1 });
    expect(links.find((l) => l.key === "group_value")!.not_implied).toContain("אינו קבוצת-ערך");
    expect(links.find((l) => l.key === "membership")!.not_implied).toContain("אין קפיצה ישירה");
  });

  it("reports UNRESOLVED membership when nothing is verified", () => {
    const { links } = buildSocialValueSpine({});
    expect(links.find((l) => l.key === "membership")!.status).toBe("UNRESOLVED");
  });
});
