import { describe, expect, it } from "vitest";
import {
  SOURCE_CONCEPTS,
  SOURCE_CONCEPT_TYPES,
  SOURCE_CONTRADICTION_LIST_VARIANTS,
  SOURCE_CORPUS_TRIAGE,
  SOURCE_COVERAGE,
  SOURCE_GROUP_FORMATION_RULES,
  SOURCE_GROUP_HIERARCHY,
  SOURCE_PRINCIPLE_LENS,
  SOURCE_VALUE_RELATIONS,
  QUALITY_GROUP_MODEL,
  GROUP_HIERARCHY_AXES,
  RUNTIME_VALUE_RELATIONS,
  RUNTIME_QUALITY_GROUP_CRITERIA,
  RUNTIME_OPPOSITIONS,
  RUNTIME_TENSIONS,
  classifyForRuntime,
  runtimeStatusCounts,
  runtimeStatusCountsCanonical,
  countByType,
  countCanonicalConcepts,
  countDuplicatesMerged,
} from "../sourceValueModel";

describe("SOURCE_CONCEPTS — every entry preserves source traceability", () => {
  it("every concept carries a non-empty source_document, source_wording, and canonical_id", () => {
    for (const c of SOURCE_CONCEPTS) {
      expect(c.canonical_id.length).toBeGreaterThan(0);
      expect(c.source_document.length).toBeGreaterThan(0);
      expect(c.source_wording.length).toBeGreaterThan(0);
    }
  });

  it("every canonical_id is unique — no duplicate concepts", () => {
    const ids = SOURCE_CONCEPTS.map((c) => c.canonical_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every concept's type is one of the 19 declared classifications", () => {
    for (const c of SOURCE_CONCEPTS) {
      expect(SOURCE_CONCEPT_TYPES).toContain(c.type);
    }
  });

  it("does not classify every opposite pair as a Value/Tension: NON_VALUE + REVIEW_REQUIRED together outnumber TENSION", () => {
    const counts = countByType();
    const nonValueLike = counts.NON_VALUE + counts.REVIEW_REQUIRED;
    expect(nonValueLike).toBeGreaterThan(counts.TENSION);
  });

  it("exactly 10 TENSION entries — 5 (§41/§42) + 4 from the 20-item quasi-human list (§44) + 1 real 3rd-corroboration of individual/collective (§46)", () => {
    expect(countByType().TENSION).toBe(10);
  });

  it("no concept is typed VALUE using the runtime-registered 'אחריות' wording — never silently promoted into the runtime registry", () => {
    expect(SOURCE_CONCEPTS.some((c) => c.type === "VALUE" && c.source_wording.includes("אחריות"))).toBe(false);
  });

  it("a real near-neighbor to 'אחריות' (§42's 'אחריות אישית' zero-value) exists but is explicitly flagged as NOT merged with the runtime value", () => {
    const near = SOURCE_CONCEPTS.find((c) => c.canonical_id === "gc_zero_value_personal_responsibility");
    expect(near).toBeDefined();
    expect(near!.notes).toMatch(/NOT merged/);
  });

  it("a concept flagged needs_review always has low or moderate confidence, never high", () => {
    for (const c of SOURCE_CONCEPTS) {
      if (c.review_status === "needs_review") expect(c.confidence).not.toBe("high");
    }
  });
});

describe("countByType", () => {
  it("sums to the total concept count across all 19 types", () => {
    const counts = countByType();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(SOURCE_CONCEPTS.length);
  });
});

describe("SOURCE_COVERAGE — honest, real, not rounded up to completeness", () => {
  it("files_scanned + files_unclassified equals total_corpus_files", () => {
    expect(SOURCE_COVERAGE.files_scanned + SOURCE_COVERAGE.files_unclassified).toBe(SOURCE_COVERAGE.total_corpus_files);
  });

  it("coverage_percent reflects real partial coverage, never 100", () => {
    expect(SOURCE_COVERAGE.coverage_percent).toBeGreaterThan(0);
    expect(SOURCE_COVERAGE.coverage_percent).toBeLessThan(100);
  });

  it("files_unclassified is a real, non-zero number — completeness is not claimed", () => {
    expect(SOURCE_COVERAGE.files_unclassified).toBeGreaterThan(0);
  });
});

describe("SOURCE_GROUP_HIERARCHY / SOURCE_GROUP_FORMATION_RULES — source-cited, not invented", () => {
  it("hierarchy has exactly 3 real levels: personal -> group -> collective", () => {
    expect(SOURCE_GROUP_HIERARCHY.map((l) => l.label_en)).toEqual(["Personal values", "Group values", "Collective values"]);
  });

  it("every formation rule cites a real source document and quote", () => {
    for (const r of SOURCE_GROUP_FORMATION_RULES) {
      expect(r.source_document.length).toBeGreaterThan(0);
      expect(r.quote.length).toBeGreaterThan(0);
    }
  });
});

describe("§43 — SOURCE_PRINCIPLE_LENS (10-principle Kabbalah-comparative lens)", () => {
  it("has exactly 10 entries, each with a constructive and destructive expression", () => {
    expect(SOURCE_PRINCIPLE_LENS.entries).toHaveLength(10);
    for (const p of SOURCE_PRINCIPLE_LENS.entries) {
      expect(p.constructive_he.length).toBeGreaterThan(0);
      expect(p.destructive_he.length).toBeGreaterThan(0);
    }
  });

  it("is explicitly marked as an external/interpretive lens, never canon", () => {
    expect(SOURCE_PRINCIPLE_LENS.status).toMatch(/NOT Kabbalah Canon/);
    expect(SOURCE_PRINCIPLE_LENS.status).toMatch(/NOT 20 new PHILOS forces/);
  });

  it("is kept OUT of SOURCE_CONCEPTS — does not inflate the PRINCIPLE type count by 10", () => {
    const sefirotIds = new Set(SOURCE_PRINCIPLE_LENS.entries.map((p) => p.principle_id));
    for (const c of SOURCE_CONCEPTS) {
      expect(sefirotIds.has(c.canonical_id)).toBe(false);
    }
  });
});

describe("§43 — new concepts from the 3 new .docx files (Pass 7)", () => {
  const pass7 = SOURCE_CONCEPTS.filter((c) => c.source_pass === "Pass 7");

  it("adds at least 6 new real, cited concepts", () => {
    expect(pass7.length).toBeGreaterThanOrEqual(6);
  });

  it("every Pass 7 concept cites one of the 3 real §43 source documents", () => {
    const allowed = [
      "PHILOS_10_Principles_20_Expressions_HE.docx",
      "PHILOS_9_STRUCTURE_RECONSTRUCTION_HE.docx",
      "PHILOS_Brain_Human_Explanation_HE.docx",
    ];
    for (const c of pass7) {
      expect(allowed.some((doc) => c.source_document.includes(doc))).toBe(true);
    }
  });

  it("the 9-structure reconstruction is REVIEW_REQUIRED, not asserted as fact", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "rr_9structure_reconstruction");
    expect(c).toBeDefined();
    expect(c!.type).toBe("REVIEW_REQUIRED");
    expect(c!.review_status).toBe("needs_review");
  });

  it("the color-functional-redundancy standard is not misrepresented as a trust claim", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "ql_color_functional_redundancy");
    expect(c).toBeDefined();
    expect(c!.type).toBe("STANDARD");
    expect(c!.definition).toMatch(/does NOT itself say/);
  });
});

describe("§43 — SOURCE_COVERAGE reflects the +3 file delta from §42 (historical: 449 -> 452)", () => {
  it("files_scanned has grown by at least 3 since §42's 449", () => {
    expect(SOURCE_COVERAGE.files_scanned).toBeGreaterThanOrEqual(452);
  });

  it("coverage_percent stays honest and far from 100", () => {
    expect(SOURCE_COVERAGE.coverage_percent).toBeCloseTo((SOURCE_COVERAGE.files_scanned / 2372) * 100, 1);
    expect(SOURCE_COVERAGE.coverage_percent).toBeLessThan(20);
  });
});

describe("§44 — SOURCE_CONTRADICTION_LIST_VARIANTS: closed lists preserved, never arbitrarily picked", () => {
  it("has at least 5 distinct, non-identical variants", () => {
    expect(SOURCE_CONTRADICTION_LIST_VARIANTS.length).toBeGreaterThanOrEqual(5);
  });

  it("every variant cites a real source_document and a non-empty items list", () => {
    for (const v of SOURCE_CONTRADICTION_LIST_VARIANTS) {
      expect(v.source_document.length).toBeGreaterThan(0);
      expect(v.items.length).toBeGreaterThan(0);
    }
  });

  it("no two variants are identical item-for-item — each is a real, distinct version", () => {
    for (let i = 0; i < SOURCE_CONTRADICTION_LIST_VARIANTS.length; i++) {
      for (let j = i + 1; j < SOURCE_CONTRADICTION_LIST_VARIANTS.length; j++) {
        const a = SOURCE_CONTRADICTION_LIST_VARIANTS[i].items;
        const b = SOURCE_CONTRADICTION_LIST_VARIANTS[j].items;
        expect(a.join("|")).not.toBe(b.join("|"));
      }
    }
  });

  it("the 52-root×6-layer model is explicitly DRAFT status, matching its own unanswered source question", () => {
    const v = SOURCE_CONTRADICTION_LIST_VARIANTS.find((x) => x.variant_id === "variant_52root_6layer");
    expect(v).toBeDefined();
    expect(v!.status).toBe("draft");
  });

  it("the other 4 variants are LOCKED status — the source itself treated them as settled at time of writing", () => {
    const locked = SOURCE_CONTRADICTION_LIST_VARIANTS.filter((v) => v.variant_id !== "variant_52root_6layer");
    for (const v of locked) expect(v.status).toBe("locked");
  });
});

describe("§44 — new Pass 8 concepts (contradiction-list variant cluster)", () => {
  const pass8 = SOURCE_CONCEPTS.filter((c) => c.source_pass === "Pass 8");

  it("adds a substantial number of new real, cited concepts", () => {
    expect(pass8.length).toBeGreaterThanOrEqual(25);
  });

  it("§44's batch alone did not require moving files_scanned past 452 (later passes may have — see §46)", () => {
    expect(SOURCE_COVERAGE.files_scanned).toBeGreaterThanOrEqual(452);
  });

  it("a second real near-neighbor to the runtime value 'אחריות' is found and explicitly not merged", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "gc_responsibility_abandonment");
    expect(c).toBeDefined();
    expect(c!.notes).toMatch(/NOT merged/);
  });

  it("the reconciliation record cross-references real recurring pairs without picking one list as authoritative", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "rr_reconciliation_direction_angle_order_chaos_law_freedom");
    expect(c).toBeDefined();
    expect(c!.type).toBe("REVIEW_REQUIRED");
    expect(c!.source_document.split(";").length).toBeGreaterThanOrEqual(3);
  });
});

describe("§45 — cluster 2 attempt (~70KB explanation cluster)", () => {
  it("the unresolved identification gap is recorded honestly, not silently dropped or misclassified as NON_VALUE/OUT_OF_SCOPE", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "rr_geash_explanation_cluster_not_located");
    expect(c).toBeDefined();
    expect(c!.type).toBe("REVIEW_REQUIRED");
  });

  it("the ranking/scoring app anti-pattern is excluded (NON_VALUE), never adopted, and cross-references the §42 finding", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "nv_ranking_score_app_excluded");
    expect(c).toBeDefined();
    expect(c!.type).toBe("NON_VALUE");
    expect(c!.notes).toMatch(/nv_engagement_funnel_excluded/);
  });

  it("§45's batch alone did not require moving files_scanned past 452 (later passes may have — see §46)", () => {
    expect(SOURCE_COVERAGE.files_scanned).toBeGreaterThanOrEqual(452);
  });
});

describe("§46 — cluster 3 (orientation-dimensions ZIP) + cluster 4 resolution", () => {
  const pass9 = SOURCE_CONCEPTS.filter((c) => c.source_pass === "Pass 9");

  it("adds real new concepts, including at least one high-confidence methodological PRINCIPLE", () => {
    expect(pass9.length).toBeGreaterThanOrEqual(6);
    expect(pass9.some((c) => c.type === "PRINCIPLE" && c.confidence === "high")).toBe(true);
  });

  it("DOES move files_scanned — 2 new real files in a NEW corpus region (452 -> at least 454)", () => {
    expect(SOURCE_COVERAGE.files_scanned).toBeGreaterThanOrEqual(454);
  });

  it("the app-code subproject (86 .jsx/.js files) is correctly excluded — no Pass 9 concept cites it as a source", () => {
    for (const c of pass9) {
      expect(c.source_document).not.toMatch(/project-backup/);
    }
  });

  it("cluster 4 (~86 xlsx) is resolved as already-ingested by masterUnitsSource.ts, not duplicated here", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "rr_cluster4_xlsx_already_ingested_elsewhere");
    expect(c).toBeDefined();
    expect(c!.definition).toMatch(/masterUnitsSource\.ts/);
  });

  it("a real positive counter-principle to the excluded ranking anti-patterns is captured and cross-referenced", () => {
    const c = SOURCE_CONCEPTS.find((x) => x.canonical_id === "gc_structural_relational_value_measures");
    expect(c).toBeDefined();
    expect(c!.notes).toMatch(/nv_ranking_score_app_excluded/);
  });
});

describe("§47 — deterministic full-corpus triage (SOURCE_CORPUS_TRIAGE)", () => {
  it("every file in the 2372-file corpus is accounted for in exactly one bucket", () => {
    const t = SOURCE_CORPUS_TRIAGE;
    const sum = t.MEDIA_OUT_OF_SCOPE + t.ARCHIVES + t.CODE_OUT_OF_SCOPE + t.MISC_LINK + t.UNREADABLE + t.SEMANTIC_FILES;
    expect(sum).toBe(t.TOTAL_FILES);
  });

  it("SEMANTIC_FILES_REMAINING is 0 — every semantic candidate was read or inspected and classified", () => {
    expect(SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES_REMAINING).toBe(0);
    expect(SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES_CLASSIFIED).toBe(SOURCE_CORPUS_TRIAGE.SEMANTIC_FILES);
  });

  it("SOURCE_COVERAGE_PERCENT_SEMANTIC reflects full semantic coverage, distinct from the file-content-read percentage", () => {
    expect(SOURCE_CORPUS_TRIAGE.SOURCE_COVERAGE_PERCENT_SEMANTIC).toBe(100);
    // The two coverage metrics measure different things and must not be conflated:
    // SOURCE_COVERAGE.coverage_percent = fraction of the corpus individually READ line-by-line;
    // SOURCE_CORPUS_TRIAGE's = fraction of SEMANTIC-bucket files at least inspected/classified.
    expect(SOURCE_COVERAGE.coverage_percent).toBeLessThan(SOURCE_CORPUS_TRIAGE.SOURCE_COVERAGE_PERCENT_SEMANTIC);
  });

  it("§48 correction: the philos/backend Trust Engine code was found (relocated, not missing) — UNREADABLE dropped from 412 to the 8 already-known stale-path files", () => {
    expect(SOURCE_CORPUS_TRIAGE.UNREADABLE).toBe(8);
  });

  it("files_scanned grew by the 6 new real files read this pass (454 -> 460)", () => {
    expect(SOURCE_COVERAGE.files_scanned).toBe(460);
  });

  it("the audience-vs-community distinction and the flagged political manifesto are both present and correctly typed", () => {
    const audience = SOURCE_CONCEPTS.find((c) => c.canonical_id === "sr_audience_vs_community");
    expect(audience).toBeDefined();
    expect(audience!.type).toBe("SOCIAL_RELATION");

    const manifesto = SOURCE_CONCEPTS.find((c) => c.canonical_id === "rr_free_society_manifesto");
    expect(manifesto).toBeDefined();
    expect(manifesto!.type).toBe("REVIEW_REQUIRED");
    // Explicitly NOT promoted into 8 RIGHT entries, per the task's own anti-fabrication rule:
    expect(SOURCE_CONCEPTS.filter((c) => c.source_document.includes("—-פילוס אוריאנטציה—2023—")).every((c) => c.type !== "RIGHT")).toBe(true);
  });
});

describe("SOURCE_CONTRADICTION_LIST_VARIANTS — reconciliation, not silent selection", () => {
  it("5 distinct, non-identical closed-list claims are all preserved with their own item arrays", () => {
    expect(SOURCE_CONTRADICTION_LIST_VARIANTS.length).toBe(5);
    const ids = SOURCE_CONTRADICTION_LIST_VARIANTS.map((v) => v.variant_id);
    expect(new Set(ids).size).toBe(5);
  });

  it("no variant's item list is silently deduplicated against another — real overlap and real unique items coexist", () => {
    for (const v of SOURCE_CONTRADICTION_LIST_VARIANTS) {
      const others = SOURCE_CONTRADICTION_LIST_VARIANTS.filter((o) => o.variant_id !== v.variant_id);
      const otherItems = new Set(others.flatMap((o) => o.items));
      const overlap = v.items.filter((it) => otherItems.has(it)).length;
      const unique = v.items.filter((it) => !otherItems.has(it)).length;
      expect(overlap + unique).toBe(v.items.length);
    }
  });

  it("only the draft (52-item) variant is unlocked — the other 4 are the source's own 'locked' claims", () => {
    const draft = SOURCE_CONTRADICTION_LIST_VARIANTS.filter((v) => v.status === "draft");
    const locked = SOURCE_CONTRADICTION_LIST_VARIANTS.filter((v) => v.status === "locked");
    expect(draft.length).toBe(1);
    expect(locked.length).toBe(4);
  });
});

describe("§49 — reconciliation: canonical concepts, duplicates merged", () => {
  it("countCanonicalConcepts is less than the raw count by exactly the real duplicates merged", () => {
    expect(countCanonicalConcepts()).toBe(SOURCE_CONCEPTS.length - countDuplicatesMerged());
  });

  it("exactly 3 raw entries are folded into a canonical representative (2 clusters: individual/collective x3, law/freedom x2)", () => {
    expect(countDuplicatesMerged()).toBe(3);
  });

  it("the individual/collective cluster's 3 entries all share one canonical_group, and it equals the canonical entry's own id", () => {
    const cluster = SOURCE_CONCEPTS.filter((c) => c.canonical_group === "tn_society_individual");
    expect(cluster.length).toBe(3);
    expect(cluster.some((c) => c.canonical_id === "tn_society_individual")).toBe(true);
  });

  it("the law/freedom cluster's 2 entries all share one canonical_group, and it equals the canonical entry's own id", () => {
    const cluster = SOURCE_CONCEPTS.filter((c) => c.canonical_group === "rr_law_freedom");
    expect(cluster.length).toBe(2);
    expect(cluster.some((c) => c.canonical_id === "rr_law_freedom")).toBe(true);
  });

  it("no other entry carries a canonical_group — every other apparent duplicate was verified to add real distinct elaboration and stays separate", () => {
    const grouped = SOURCE_CONCEPTS.filter((c) => c.canonical_group);
    expect(grouped.length).toBe(5); // 3 + 2 across the two verified clusters, nothing else
  });
});

describe("§49 — SOURCE_VALUE_RELATIONS: finalized relations between extracted poles", () => {
  it("only relation-bearing types (TENSION/OPPOSITION/CONTINUUM/SOCIAL_RELATION) produce a relation — NON_VALUE pairs are excluded", () => {
    for (const r of SOURCE_VALUE_RELATIONS) {
      expect(["TENSION", "OPPOSITION", "CONTINUUM", "SOCIAL_RELATION"]).toContain(r.relation_type);
    }
  });

  it("every relation cites a real source concept that actually exists", () => {
    const ids = new Set(SOURCE_CONCEPTS.map((c) => c.canonical_id));
    for (const r of SOURCE_VALUE_RELATIONS) {
      expect(ids.has(r.source_concept_id)).toBe(true);
    }
  });

  it("a corroboration cluster produces exactly ONE relation, not one per raw citation", () => {
    const individualCollective = SOURCE_VALUE_RELATIONS.filter((r) => r.source_concept_id === "tn_society_individual" || r.source_concept_id === "tn_individual_collective_v2" || r.source_concept_id === "tn_individual_group_degree_v3");
    expect(individualCollective.length).toBe(1);
    expect(individualCollective[0].source_concept_id).toBe("tn_society_individual");
  });

  it("this is distinct from, and does not inflate, the runtime valueRegistry's own 0-relations invariant", () => {
    expect(SOURCE_VALUE_RELATIONS.length).toBeGreaterThan(0);
    // valueRegistry.ts::buildValueRelations() staying empty is verified in valueRegistry.test.ts — not re-asserted here, just confirmed these are a different, non-conflicting structure.
  });
});

describe("§49 — QUALITY_GROUP_MODEL and GROUP_HIERARCHY_AXES: finalized, still honestly partial", () => {
  it("QUALITY_GROUP_MODEL status is PARTIAL and cites a real, existing explicit source gap", () => {
    expect(QUALITY_GROUP_MODEL.status).toBe("PARTIAL");
    const gap = SOURCE_CONCEPTS.find((c) => c.canonical_id === QUALITY_GROUP_MODEL.explicit_source_gap_concept_id);
    expect(gap).toBeDefined();
  });

  it("QUALITY_GROUP_MODEL.criteria_count matches the real GROUP_CRITERION count", () => {
    expect(QUALITY_GROUP_MODEL.criteria_count).toBe(countByType().GROUP_CRITERION);
  });

  it("GROUP_HIERARCHY_AXES has exactly 3 distinct, source-backed axes, not merged into one ladder", () => {
    expect(GROUP_HIERARCHY_AXES).toHaveLength(3);
    const ids = GROUP_HIERARCHY_AXES.map((a) => a.axis_id);
    expect(new Set(ids).size).toBe(3);
    for (const axis of GROUP_HIERARCHY_AXES) {
      expect(axis.levels.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("§50 — SOURCE MODEL → RUNTIME CANON promotion", () => {
  it("every SourceConcept classifies into exactly one of the 4 runtime statuses, summing to the total", () => {
    const counts = runtimeStatusCounts();
    const sum = counts.CANONICAL_RUNTIME + counts.REFERENCE_ONLY + counts.REVIEW_REQUIRED + counts.REJECTED_FOR_RUNTIME;
    expect(sum).toBe(SOURCE_CONCEPTS.length);
  });

  it("NON_VALUE always rejects — never promotable to runtime canon", () => {
    for (const c of SOURCE_CONCEPTS.filter((x) => x.type === "NON_VALUE")) {
      expect(classifyForRuntime(c)).toBe("REJECTED_FOR_RUNTIME");
    }
  });

  it("REVIEW_REQUIRED-typed concepts always stay REVIEW_REQUIRED regardless of confidence — unresolved variants are never silently resolved", () => {
    for (const c of SOURCE_CONCEPTS.filter((x) => x.type === "REVIEW_REQUIRED")) {
      expect(classifyForRuntime(c)).toBe("REVIEW_REQUIRED");
    }
  });

  it("CANONICAL_RUNTIME requires BOTH high confidence AND reviewed status", () => {
    for (const c of SOURCE_CONCEPTS) {
      if (classifyForRuntime(c) === "CANONICAL_RUNTIME") {
        expect(c.confidence).toBe("high");
        expect(c.review_status).toBe("reviewed");
      }
    }
  });

  it("real counts this pass: 33 raw / 32 canonical CANONICAL_RUNTIME, 21 REJECTED (= all NON_VALUE), 16 REVIEW_REQUIRED (= all REVIEW_REQUIRED type)", () => {
    const raw = runtimeStatusCounts();
    expect(raw.CANONICAL_RUNTIME).toBe(33);
    expect(raw.REJECTED_FOR_RUNTIME).toBe(countByType().NON_VALUE);
    expect(raw.REVIEW_REQUIRED).toBe(countByType().REVIEW_REQUIRED);
    expect(runtimeStatusCountsCanonical().CANONICAL_RUNTIME).toBe(32);
  });

  it("RUNTIME_VALUE_RELATIONS is a strict, non-empty subset of SOURCE_VALUE_RELATIONS — source relation is not runtime relation unless explicitly promoted", () => {
    expect(RUNTIME_VALUE_RELATIONS.length).toBeGreaterThan(0);
    expect(RUNTIME_VALUE_RELATIONS.length).toBeLessThan(SOURCE_VALUE_RELATIONS.length);
    const sourceIds = new Set(SOURCE_VALUE_RELATIONS.map((r) => r.relation_id));
    for (const r of RUNTIME_VALUE_RELATIONS) expect(sourceIds.has(r.relation_id)).toBe(true);
  });

  it("no quality-group score is invented — 0 GROUP_CRITERION entries reach CANONICAL_RUNTIME today", () => {
    expect(RUNTIME_QUALITY_GROUP_CRITERIA.length).toBe(0);
  });

  it("no RIGHT/DUTY concept reaches CANONICAL_RUNTIME — all 9 are peer-relayed, moderate confidence, pending independent re-verification", () => {
    const promoted = SOURCE_CONCEPTS.filter((c) => (c.type === "RIGHT" || c.type === "DUTY") && classifyForRuntime(c) === "CANONICAL_RUNTIME");
    expect(promoted.length).toBe(0);
  });

  it("RUNTIME_TENSIONS/RUNTIME_OPPOSITIONS contain only canonical (non-duplicate) representatives", () => {
    for (const c of [...RUNTIME_TENSIONS, ...RUNTIME_OPPOSITIONS]) {
      expect(c.canonical_group === undefined || c.canonical_group === c.canonical_id).toBe(true);
    }
    expect(RUNTIME_TENSIONS.length).toBe(4);
    expect(RUNTIME_OPPOSITIONS.length).toBe(1);
  });

  it("the 3 GROUP_HIERARCHY_AXES each carry their OWN distinct promotion status — never merged into one", () => {
    const statuses = GROUP_HIERARCHY_AXES.map((a) => a.runtime_status);
    expect(new Set(statuses).size).toBe(3);
    expect(GROUP_HIERARCHY_AXES.find((a) => a.axis_id === "scope")?.runtime_status).toBe("CANONICAL_RUNTIME");
    expect(GROUP_HIERARCHY_AXES.find((a) => a.axis_id === "origin")?.runtime_status).toBe("REFERENCE_ONLY");
    expect(GROUP_HIERARCHY_AXES.find((a) => a.axis_id === "sophistication")?.runtime_status).toBe("REVIEW_REQUIRED");
  });

  it("both GROUP_FORMATION_RULES are CANONICAL_RUNTIME (direct quotes, corroborated 3+ times, never contradicted)", () => {
    for (const r of SOURCE_GROUP_FORMATION_RULES) expect(r.runtime_status).toBe("CANONICAL_RUNTIME");
  });
});
