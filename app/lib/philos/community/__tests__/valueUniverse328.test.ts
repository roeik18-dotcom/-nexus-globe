import { describe, expect, it } from "vitest";
import { RAW_FAMILIES, RAW_SOURCE_ENTRIES, RAW_TOTAL, SUBVALUES } from "../valueUniverse328";
import { classifySubvalues, countValueUniverse } from "../valueUniverseClassification";

describe("PHILOS Value Universe (328-entry Board source) — data integrity", () => {
  it("all 328 raw entries are accounted for — 28 families + 300 source entries, none dropped", () => {
    expect(RAW_FAMILIES).toHaveLength(28);
    expect(RAW_SOURCE_ENTRIES).toHaveLength(300);
    expect(RAW_TOTAL).toBe(328);
  });

  it("every raw source entry has a unique id, no silent overwrite/collision", () => {
    const ids = RAW_SOURCE_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(300);
  });

  it("every raw family has a unique id", () => {
    const ids = RAW_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(28);
  });

  it("subvalue clustering preserves every source entry — the sum of source_entry_ids across all subvalues equals 300", () => {
    const total = SUBVALUES.reduce((sum, sv) => sum + sv.source_entry_ids.length, 0);
    expect(total).toBe(300);
  });

  it("no source entry id appears in more than one subvalue (deterministic partition, not overlapping)", () => {
    const seen = new Set<string>();
    for (const sv of SUBVALUES) {
      for (const id of sv.source_entry_ids) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(300);
  });

  it("real dedup happened — 300 raw citations collapse to fewer unique subvalues (e.g. six independent 'צדק' citations become one)", () => {
    expect(SUBVALUES.length).toBeLessThan(300);
    expect(SUBVALUES.length).toBeGreaterThan(0);
    const tzedekCluster = SUBVALUES.find((s) => s.name_he === "צדק");
    expect(tzedekCluster).toBeDefined();
    expect(tzedekCluster!.source_count).toBeGreaterThanOrEqual(3);
  });

  it("every family id referenced by a subvalue actually exists in RAW_FAMILIES — no dangling reference", () => {
    const familyIds = new Set(RAW_FAMILIES.map((f) => f.id));
    for (const sv of SUBVALUES) {
      if (sv.family_id) expect(familyIds.has(sv.family_id)).toBe(true);
    }
  });

  it("religion/tradition is never asserted as the Value Group itself — no raw entry's value_group_he is a bare religion name", () => {
    const religionNames = ["יהדות", "נצרות", "אסלאם", "בודהיזם", "הינדואיזם"];
    for (const e of RAW_SOURCE_ENTRIES) {
      expect(religionNames).not.toContain(e.value_group_he);
    }
  });
});

describe("classifySubvalues — status requires real evidence, never the document alone", () => {
  it("the 328 document's own presence is NOT sufficient for CANONICAL_RUNTIME — zero live runtime values yields zero CANONICAL_RUNTIME", () => {
    const classified = classifySubvalues(SUBVALUES, []);
    const canonical = classified.filter((s) => s.status === "CANONICAL_RUNTIME");
    expect(canonical).toHaveLength(0);
  });

  it("a real, live runtime Value name promotes its matching subvalue to CANONICAL_RUNTIME", () => {
    const classified = classifySubvalues(SUBVALUES, ["אחריות"]);
    const match = classified.find((s) => s.name_he === "אחריות" || s.name_he.includes("אחריות"));
    if (match) {
      expect(match.status).toBe("CANONICAL_RUNTIME");
      expect(match.matched_runtime_value_names.length).toBeGreaterThan(0);
    }
  });

  it("does NOT false-positive on a coincidental Hebrew substring — 'כנות' (honesty) inside 'שכנות טובה' (good neighborliness) are unrelated concepts and must not cross-match", () => {
    const konut = SUBVALUES.find((s) => s.name_he === "כנות");
    expect(konut).toBeDefined();
    const classified = classifySubvalues(SUBVALUES, ["שכנות טובה"]);
    const match = classified.find((s) => s.name_he === "כנות")!;
    expect(match.status).not.toBe("CANONICAL_RUNTIME");
    expect(match.matched_runtime_value_names).toEqual([]);
  });

  it("high-corroboration subvalues (3+ independent citations) with a real family match become REVIEW_REQUIRED, never auto-CANONICAL", () => {
    const classified = classifySubvalues(SUBVALUES, []);
    const highCorroboration = classified.filter((s) => s.source_count >= 3 && s.family_id);
    for (const s of highCorroboration) {
      expect(s.status).toBe("REVIEW_REQUIRED");
    }
    expect(highCorroboration.length).toBeGreaterThan(0);
  });

  it("low-corroboration or cross-family subvalues stay REFERENCE_ONLY, never promoted", () => {
    const classified = classifySubvalues(SUBVALUES, []);
    const weak = classified.filter((s) => s.source_count < 3 || !s.family_id);
    for (const s of weak) {
      expect(s.status).toBe("REFERENCE_ONLY");
    }
  });

  it("counts sum correctly — every subvalue falls into exactly one status bucket", () => {
    const classified = classifySubvalues(SUBVALUES, []);
    const counts = countValueUniverse(328, RAW_FAMILIES.length, classified);
    expect(counts.canonical_runtime + counts.review_required + counts.reference_only + counts.unsupported).toBe(classified.length);
    expect(counts.raw_total).toBe(328);
    expect(counts.value_families).toBe(28);
  });
});
