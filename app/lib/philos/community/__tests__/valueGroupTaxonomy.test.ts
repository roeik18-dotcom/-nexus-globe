import { describe, expect, it } from "vitest";
import { classifyValueTaxonomy, VALUE_TAXONOMY_CANDIDATES } from "../valueGroupTaxonomy";
import type { SourceConcept } from "../sourceValueModel";

function makeConcept(overrides: Partial<SourceConcept> = {}): SourceConcept {
  return {
    canonical_id: "c1",
    source_wording: "אחריות אישית",
    normalized_label: "Personal Responsibility",
    definition: "test",
    type: "VALUE_DOMAIN",
    source_document: "test.doc",
    source_pass: "Pass 1",
    confidence: "moderate",
    review_status: "needs_review",
    ...overrides,
  };
}

describe("classifyValueTaxonomy — Board review candidate set, not automatic canon", () => {
  it("classifies all 28 candidate families, never fewer or more", () => {
    const result = classifyValueTaxonomy([], []);
    expect(result).toHaveLength(28);
    expect(result.map((r) => r.family_id)).toEqual(VALUE_TAXONOMY_CANDIDATES.map((c) => c.family_id));
  });

  it("does NOT mark a candidate CANONICAL_RUNTIME merely for appearing in the list — 0 evidence stays UNSUPPORTED", () => {
    const result = classifyValueTaxonomy([], []);
    for (const r of result) {
      expect(r.status).toBe("UNSUPPORTED");
      expect(r.matched_runtime_value_names).toEqual([]);
      expect(r.matched_source_concept_ids).toEqual([]);
    }
  });

  it("a REAL, live runtime Value name promotes its matching family to CANONICAL_RUNTIME — never the prompt text alone", () => {
    const result = classifyValueTaxonomy(["אחריות"], []);
    const family03 = result.find((r) => r.family_id === "03")!;
    expect(family03.status).toBe("CANONICAL_RUNTIME");
    expect(family03.matched_runtime_value_names).toEqual(["אחריות"]);
  });

  it("a high-confidence, reviewed source concept promotes to REVIEW_REQUIRED, never CANONICAL_RUNTIME on source alone", () => {
    const concepts = [makeConcept({ canonical_id: "c_trust", source_wording: "אמון בין אנשים", confidence: "high", review_status: "reviewed" })];
    const result = classifyValueTaxonomy([], concepts);
    const family07 = result.find((r) => r.family_id === "07")!;
    expect(family07.status).toBe("REVIEW_REQUIRED");
    expect(family07.matched_source_concept_ids).toContain("c_trust");
  });

  it("a low-confidence or needs_review source concept stays REFERENCE_ONLY", () => {
    const concepts = [makeConcept({ canonical_id: "c_weak", source_wording: "יצירתיות באמנות", confidence: "low", review_status: "needs_review" })];
    const result = classifyValueTaxonomy([], concepts);
    const family13 = result.find((r) => r.family_id === "13")!;
    expect(family13.status).toBe("REFERENCE_ONLY");
  });

  it("real runtime match takes priority over source-only match for the same family", () => {
    const concepts = [makeConcept({ canonical_id: "c_x", source_wording: "אחריות", confidence: "high", review_status: "reviewed" })];
    const result = classifyValueTaxonomy(["אחריות"], concepts);
    const family03 = result.find((r) => r.family_id === "03")!;
    expect(family03.status).toBe("CANONICAL_RUNTIME");
  });
});
