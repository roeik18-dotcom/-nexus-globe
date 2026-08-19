/**
 * Synthetic fixtures only — never real source content (the real workbook
 * is read live from Dropbox by `masterUnitsSource.ts`, never copied into
 * this repo, including tests).
 */
import { describe, expect, it } from "vitest";
import type { MasterUnitRecord, ReviewQueueRecord } from "../masterUnitsSource";
import {
  classifyUnits,
  humanDomainUnits,
  buildHumanConfigHierarchy,
  buildCanonicalConcepts,
  buildHumanConfigSummary,
  buildParameterDetail,
  filterConceptsByStatus,
  buildDimensionCoverage,
  PARAMETER_FILTER_KEYS,
  classifySemanticType,
  buildSemanticTypeCounts,
  MEASURABLE_PARAMETER_HEADING,
} from "../humanConfigHierarchy";

function unit(overrides: Partial<MasterUnitRecord>): MasterUnitRecord {
  return {
    Source_ID: "SRC-000001", Document_ID: "DOC-1", Section: "test section", Heading: "test heading",
    Atomic_ID: "SRC-000001", Canonical_ID: "C-1", Original_Text: "[synthetic test text]",
    Canonical_Text: "test concept", Type: "אקסיומה/אפוריזם", Domain: "אדם", Tags: "", Keywords: "",
    Parent: "", Children: "", Supports: "", Contradicts: "", Expands: "", Prerequisite: "", Related: "",
    Duplicate_Group: "", Duplicate_Role: "", Canonical_Source: "", Confidence: "high", Mapping_State: "Mapped",
    Status: "PRODUCTION — VALIDATED", Version: "2.1", Source_Line_Start: "1", Source_Line_End: "1",
    Editor_Note: "", Validation_Note: "", Semantic_State: "", Resolution_Basis: "", Original_Text_SHA256: "abc",
    ...overrides,
  };
}

describe("humanDomainUnits — filters to Domain === אדם only", () => {
  it("excludes music/structure/shared domain rows", () => {
    const units = [unit({ Domain: "אדם" }), unit({ Domain: "מוזיקה", Source_ID: "s2" }), unit({ Domain: "מבנה", Source_ID: "s3" })];
    expect(humanDomainUnits(units)).toHaveLength(1);
  });

  it("HARD ACCEPTANCE TEST (ledger §27): also excludes Domain=אדם rows filed under a Value-Domain Section — Human Config must never contain Music Theory content, even when the source itself mistags it as Human", () => {
    const units = [
      unit({ Domain: "אדם", Section: "תאוריה מוזיקלית", Heading: "אישי — לחן", Source_ID: "s_music_leak" }),
      unit({ Domain: "אדם", Section: "מבנה נפשי ופסיכודינמיקה", Source_ID: "s_real_human" }),
    ];
    const result = humanDomainUnits(units);
    expect(result).toHaveLength(1);
    expect(result[0].Source_ID).toBe("s_real_human");
    expect(result.some((u) => u.Section === "תאוריה מוזיקלית")).toBe(false);
  });

  it("HARD ACCEPTANCE TEST (ledger §30): also excludes a Music-Theory-labeled Heading under an otherwise-legitimate Section — the label alone must never surface, even when the row's own content is genuine human material", () => {
    const units = [
      unit({ Domain: "אדם", Section: "התפתחות פסיכוסקסואלית", Heading: "תאוריה מוזיקלית", Canonical_Text: "Id — real psychoanalytic content", Source_ID: "s_mislabeled_heading" }),
      unit({ Domain: "אדם", Section: "התפתחות פסיכוסקסואלית", Heading: "השלב האוראלי — הפה", Source_ID: "s_real_human_2" }),
    ];
    const result = humanDomainUnits(units);
    expect(result).toHaveLength(1);
    expect(result[0].Source_ID).toBe("s_real_human_2");
    expect(result.some((u) => u.Heading === "תאוריה מוזיקלית")).toBe(false);
  });

  it("HARD ACCEPTANCE TEST (ledger §31): excludes non-human Sections found by audit — פטנטים (unrelated business notes) and מיוצגים (real third-party names), never surfaced as Human Config content", () => {
    const units = [
      unit({ Domain: "אדם", Section: "פטנטים", Canonical_Text: "internet page-sorting software idea", Source_ID: "s_patents" }),
      unit({ Domain: "אדם", Section: "מיוצגים", Canonical_Text: "Some Real Person Name", Source_ID: "s_represented" }),
      unit({ Domain: "אדם", Section: "קוגניציה", Source_ID: "s_real_human_3" }),
    ];
    const result = humanDomainUnits(units);
    expect(result).toHaveLength(1);
    expect(result[0].Source_ID).toBe("s_real_human_3");
    expect(result.some((u) => u.Section === "פטנטים" || u.Section === "מיוצגים")).toBe(false);
  });
});

describe("classifyUnits — real classification, no invented statuses", () => {
  it("a unit in the review queue is review_required, with its real reason", () => {
    const units = [unit({ Atomic_ID: "A1" })];
    const queue: ReviewQueueRecord[] = [{ Atomic_ID: "A1", Source_ID: "A1", Original_Text: "x", Heading: "h", Reason_Open: "test reason" }];
    const classified = classifyUnits(units, queue);
    expect(classified[0].status).toBe("review_required");
    expect(classified[0].reviewReason).toBe("test reason");
  });

  it("Heading === 'Explicitly Unmapped' classifies as unmapped", () => {
    const classified = classifyUnits([unit({ Heading: "Explicitly Unmapped" })], []);
    expect(classified[0].status).toBe("unmapped");
  });

  it("a missing Canonical_ID classifies as unmapped", () => {
    const classified = classifyUnits([unit({ Canonical_ID: "" })], []);
    expect(classified[0].status).toBe("unmapped");
  });

  it("everything else classifies as mapped", () => {
    const classified = classifyUnits([unit({})], []);
    expect(classified[0].status).toBe("mapped");
  });
});

describe("buildHumanConfigHierarchy — Section -> Heading, real grouping only", () => {
  it("groups by real Section and Heading, sorted by count descending", () => {
    const units = [
      unit({ Section: "S1", Heading: "H1", Canonical_ID: "C1" }),
      unit({ Section: "S1", Heading: "H1", Canonical_ID: "C2", Source_ID: "s2" }),
      unit({ Section: "S2", Heading: "H2", Canonical_ID: "C3", Source_ID: "s3" }),
    ];
    const classified = classifyUnits(units, []);
    const hierarchy = buildHumanConfigHierarchy(classified);
    expect(hierarchy[0].section).toBe("S1");
    expect(hierarchy[0].unitCount).toBe(2);
    expect(hierarchy[0].dimensions[0].heading).toBe("H1");
    expect(hierarchy[0].dimensions[0].canonicalConceptCount).toBe(2);
  });
});

describe("buildCanonicalConcepts — one PARAMETER per real Canonical_ID", () => {
  it("groups multiple source items under the same canonical concept", () => {
    const units = [
      unit({ Canonical_ID: "C1", Canonical_Text: "concept one", Source_ID: "s1" }),
      unit({ Canonical_ID: "C1", Canonical_Text: "concept one", Source_ID: "s2" }),
    ];
    const classified = classifyUnits(units, []);
    const concepts = buildCanonicalConcepts(classified);
    expect(concepts).toHaveLength(1);
    expect(concepts[0].sourceItems).toHaveLength(2);
  });

  it("units with no Canonical_ID never appear as a fabricated parameter", () => {
    const classified = classifyUnits([unit({ Canonical_ID: "" })], []);
    expect(buildCanonicalConcepts(classified)).toEqual([]);
  });
});

describe("buildHumanConfigSummary — real counts, source coverage passed through verbatim", () => {
  it("counts match the classified input exactly", () => {
    const units = [unit({ Canonical_ID: "C1" }), unit({ Heading: "Explicitly Unmapped", Source_ID: "s2" })];
    const classified = classifyUnits(units, []);
    const summary = buildHumanConfigSummary({ allUnits: units, classifiedHuman: classified, collisionAudit: [], coverage: [{ Check: "TOTAL", Value: "2" }] });
    expect(summary.mapped).toBe(1);
    expect(summary.unmapped).toBe(1);
    expect(summary.sourceCoverage).toEqual([{ Check: "TOTAL", Value: "2" }]);
  });

  it("HARD ACCEPTANCE TEST (ledger §32): uniqueHeadingTextCount and navigableDimensionCount are real, DIFFERENT numbers when a Heading name repeats under >1 Section — never collapsed into one unexplained figure", () => {
    const units = [
      unit({ Section: "S1", Heading: "H_shared", Canonical_ID: "C1", Source_ID: "s1" }),
      unit({ Section: "S2", Heading: "H_shared", Canonical_ID: "C2", Source_ID: "s2" }),
    ];
    const classified = classifyUnits(units, []);
    const summary = buildHumanConfigSummary({ allUnits: units, classifiedHuman: classified, collisionAudit: [], coverage: [] });
    expect(summary.uniqueHeadingTextCount).toBe(1);
    expect(summary.navigableDimensionCount).toBe(2);
  });
});

describe("classifySemanticType — real Type-column mapping, MEASURABLE_PARAMETER reserved for the 7 curated real temperament Canonical_IDs", () => {
  it("a concept with one of the 7 curated real Canonical_IDs is MEASURABLE_PARAMETER regardless of its own Type", () => {
    const units = [unit({ Heading: MEASURABLE_PARAMETER_HEADING, Type: "אקסיומה/אפוריזם", Canonical_ID: "CAN-SRC-000376" })];
    const classified = classifyUnits(units, []);
    const concept = buildCanonicalConcepts(classified)[0];
    expect(classifySemanticType(concept)).toBe("MEASURABLE_PARAMETER");
  });

  it("a decorative/label row under the SAME Heading but with a non-curated Canonical_ID is NOT MEASURABLE_PARAMETER", () => {
    const units = [unit({ Heading: MEASURABLE_PARAMETER_HEADING, Type: "מבנה/מפריד", Canonical_ID: "CAN-XDUP-0038" })];
    const classified = classifyUnits(units, []);
    const concept = buildCanonicalConcepts(classified)[0];
    expect(classifySemanticType(concept)).toBe("OTHER");
  });

  it("real Type values map to their documented semantic category outside that Heading", () => {
    const cases: [string, string][] = [
      ["מנגנון", "MECHANISM"], ["שלב/תהליך", "PROCESS"], ["אקסיומה/אפוריזם", "THEORY"],
      ["טענה/עיקרון", "THEORY"], ["מודל", "THEORY"], ["תובנה אישית", "SUBJECT_DECLARATION"],
      ["ציטוט", "REFERENCE"], ["הגדרה", "REFERENCE"], ["הערת עבודה", "OTHER"], ["מבנה/מפריד", "OTHER"],
    ];
    for (const [type, expected] of cases) {
      const units = [unit({ Heading: "some other heading", Type: type, Canonical_ID: `C-${type}` })];
      const classified = classifyUnits(units, []);
      const concept = buildCanonicalConcepts(classified)[0];
      expect(classifySemanticType(concept)).toBe(expected);
    }
  });

  it("an unrecognized Type value falls back to OTHER, never silently dropped", () => {
    const units = [unit({ Heading: "x", Type: "some future unrecognized type", Canonical_ID: "C1" })];
    const classified = classifyUnits(units, []);
    const concept = buildCanonicalConcepts(classified)[0];
    expect(classifySemanticType(concept)).toBe("OTHER");
  });
});

describe("buildSemanticTypeCounts — real aggregate, sums to the total concept count", () => {
  it("counts every concept exactly once across categories", () => {
    const units = [
      unit({ Type: "מנגנון", Canonical_ID: "C1" }),
      unit({ Type: "מנגנון", Canonical_ID: "C2" }),
      unit({ Heading: MEASURABLE_PARAMETER_HEADING, Canonical_ID: "CAN-SRC-000376" }),
    ];
    const classified = classifyUnits(units, []);
    const concepts = buildCanonicalConcepts(classified);
    const counts = buildSemanticTypeCounts(concepts);
    const total = counts.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(3);
    expect(counts.find((c) => c.type === "MECHANISM")?.count).toBe(2);
    expect(counts.find((c) => c.type === "MEASURABLE_PARAMETER")?.count).toBe(1);
  });
});

describe("buildParameterDetail — every state-like field is honestly unknown, never fabricated", () => {
  it("wraps a real CanonicalConcept with all state fields unknown and real source statements attached", () => {
    const units = [unit({ Canonical_ID: "C1", Canonical_Text: "Concept One", Section: "S1", Heading: "H1" })];
    const classified = classifyUnits(units, []);
    const concept = buildCanonicalConcepts(classified)[0];
    const detail = buildParameterDetail(concept, "test-source.xlsx");
    expect(detail.parameterId).toBe("C1");
    expect(detail.name).toBe("Concept One");
    expect(detail.domain).toBe("S1");
    expect(detail.dimension).toBe("H1");
    expect(detail.sourceStatements).toHaveLength(1);
    for (const dim of [detail.currentState, detail.baseline, detail.delta, detail.direction, detail.stability, detail.contradiction, detail.lastUpdate]) {
      expect(dim.status).toBe("unknown");
      expect(dim.value).toBeNull();
    }
    expect(detail.evidenceCount).toBe(0);
    expect(detail.observationCount).toBe(0);
    expect(detail.history.status).toBe("INSUFFICIENT_HISTORY");
    expect(detail.operationalMeaning.value).toBe("Concept One");
  });

  it("openReviewCount reflects real review_required source items", () => {
    const units = [unit({ Canonical_ID: "C1", Source_ID: "A1", Atomic_ID: "A1" })];
    const classified = classifyUnits(units, [{ Atomic_ID: "A1", Source_ID: "A1", Original_Text: "x", Heading: "h", Reason_Open: "test" }]);
    const concept = buildCanonicalConcepts(classified)[0];
    const detail = buildParameterDetail(concept, "test-source.xlsx");
    expect(detail.openReviewCount).toBe(1);
  });
});

describe("filterConceptsByStatus — honest emptiness where no real data exists", () => {
  const units = [unit({ Canonical_ID: "C1", Source_ID: "A1", Atomic_ID: "A1" }), unit({ Canonical_ID: "C2", Source_ID: "A2", Atomic_ID: "A2" })];
  const classified = classifyUnits(units, [{ Atomic_ID: "A1", Source_ID: "A1", Original_Text: "x", Heading: "h", Reason_Open: "test" }]);
  const concepts = buildCanonicalConcepts(classified);

  it("known/conflict/has_evidence/changed/stable are always empty — no live-state data exists for any real parameter", () => {
    for (const key of ["known", "conflict", "has_evidence", "changed", "stable"] as const) {
      expect(filterConceptsByStatus(concepts, key)).toEqual([]);
    }
  });

  it("unknown and no_evidence include every concept — honestly, not a fabricated subset", () => {
    expect(filterConceptsByStatus(concepts, "unknown")).toHaveLength(2);
    expect(filterConceptsByStatus(concepts, "no_evidence")).toHaveLength(2);
  });

  it("review_required returns only the concept with a real review-queue item", () => {
    const result = filterConceptsByStatus(concepts, "review_required");
    expect(result).toHaveLength(1);
    expect(result[0].canonicalId).toBe("C1");
  });

  it("every declared filter key is handled (no silent fallthrough)", () => {
    for (const key of PARAMETER_FILTER_KEYS) {
      expect(() => filterConceptsByStatus(concepts, key)).not.toThrow();
    }
  });
});

describe("buildDimensionCoverage — real counts per Heading, from the SAME hierarchy", () => {
  it("aggregates unit/mapped/unmapped/review counts per real Heading", () => {
    const units = [
      unit({ Section: "S1", Heading: "H1", Canonical_ID: "C1", Source_ID: "s1" }),
      unit({ Section: "S1", Heading: "H1", Canonical_ID: "", Source_ID: "s2" }),
    ];
    const classified = classifyUnits(units, []);
    const hierarchy = buildHumanConfigHierarchy(classified);
    const coverage = buildDimensionCoverage(hierarchy);
    expect(coverage).toHaveLength(1);
    expect(coverage[0].section).toBe("S1");
    expect(coverage[0].heading).toBe("H1");
    expect(coverage[0].unitCount).toBe(2);
    expect(coverage[0].mapped).toBe(1);
    expect(coverage[0].unmapped).toBe(1);
  });
});
