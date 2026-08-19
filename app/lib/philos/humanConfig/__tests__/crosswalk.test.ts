/**
 * Crosswalk tests. Two layers:
 *   1. Invariants on synthetic fixtures — total, deterministic, and above
 *      all: no Production unit may ever be reported as runtime-active.
 *   2. A live run against the REAL 189-row Source Lock, so the numbers in
 *      the report are measured rather than asserted.
 */
import { describe, expect, it } from "vitest";

import {
  buildHumanConfigCrosswalk, normalizeHeading, RUNTIME_ACTIVE_LOCK_TYPES,
  type CrosswalkLockRow, type CrosswalkUnitRow,
} from "../crosswalk";
import { ACTIVE_HUMAN_TYPES } from "../../canonical/activeConfig";
import { loadHumanMaster } from "../../canonical/humanMasterLoader";

const lock = (o: Partial<CrosswalkLockRow>): CrosswalkLockRow => ({
  SOURCE_NUMBER: "1", SOURCE_HEADING: "h", SOURCE_SECTION: "s",
  SOURCE_FILE: "f.docx", TYPE: "THEORY_REFERENCE", RUNTIME_STATUS: "REVIEW", ...o,
});
const unit = (o: Partial<CrosswalkUnitRow>): CrosswalkUnitRow => ({
  Canonical_ID: "C1", Heading: "h", Section: "s", Type: "טענה/עיקרון", ...o,
});

describe("crosswalk — the non-negotiable invariant", () => {
  it("never reports a Production unit as runtime-active, even under an active lock row", () => {
    const x = buildHumanConfigCrosswalk({
      lockRows: [lock({ TYPE: "DYNAMIC_PARAMETER", RUNTIME_STATUS: "RUNTIME_READY" })],
      unitRows: [unit({})],
    });
    const u = x.unit_rows[0];
    expect(u.verdict).toBe("RUNTIME_CANDIDATE");
    // The word is load-bearing: candidate, never active.
    expect(u.basis).toContain("CANDIDATE only");
    expect(u.basis).toContain("NOT runtime-active");
    // And no field on the unit side even expresses activation.
    expect(Object.keys(u)).not.toContain("runtime_active");
  });

  it("keeps the activation rule identical to activeConfig.ts (no silent drift)", () => {
    expect([...RUNTIME_ACTIVE_LOCK_TYPES].sort()).toEqual([...ACTIVE_HUMAN_TYPES].sort());
  });

  it("preserves provenance on both sides — neither is relabelled into the other's vocabulary", () => {
    const x = buildHumanConfigCrosswalk({
      lockRows: [lock({ SOURCE_NUMBER: 42, TYPE: "SCALE", SOURCE_FILE: "lock.docx" })],
      unitRows: [unit({ Canonical_ID: "HU-9", Type: "אקסיומה/אפוריזם" })],
    });
    expect(x.lock_rows[0].source_number).toBe("42");
    expect(x.lock_rows[0].lock_type).toBe("SCALE");
    expect(x.lock_rows[0].source_file).toBe("lock.docx");
    expect(x.unit_rows[0].canonical_id).toBe("HU-9");
    expect(x.unit_rows[0].unit_type).toBe("אקסיומה/אפוריזם");
  });
});

describe("crosswalk — verdict classification", () => {
  it("MISSING_IN_2_1 when no unit shares the heading", () => {
    const x = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "alone" })], unitRows: [unit({ Heading: "other" })] });
    expect(x.lock_rows[0].verdict).toBe("MISSING_IN_2_1");
  });

  it("EXACT_MATCH for a character-identical heading in the same section", () => {
    const x = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "תודעה", SOURCE_SECTION: "A" })], unitRows: [unit({ Heading: "תודעה", Section: "A" })] });
    expect(x.lock_rows[0].verdict).toBe("EXACT_MATCH");
  });

  it("RENAMED when only punctuation/whitespace differs", () => {
    const x = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "— תודעה —", SOURCE_SECTION: "A" })], unitRows: [unit({ Heading: "תודעה", Section: "A" })] });
    expect(x.lock_rows[0].verdict).toBe("RENAMED");
  });

  it("SEMANTIC_MATCH when the heading joins but the Sections disagree", () => {
    const x = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "תודעה", SOURCE_SECTION: "חלק ג" })], unitRows: [unit({ Heading: "תודעה", Section: "פתיחה" })] });
    expect(x.lock_rows[0].verdict).toBe("SEMANTIC_MATCH");
  });

  it("SPLIT for a few units, EXPANDED for many", () => {
    const few = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "h" })], unitRows: [unit({ Canonical_ID: "a" }), unit({ Canonical_ID: "b" })] });
    expect(few.lock_rows[0].verdict).toBe("SPLIT");
    const many = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "h" })], unitRows: Array.from({ length: 9 }, (_, i) => unit({ Canonical_ID: `u${i}` })) });
    expect(many.lock_rows[0].verdict).toBe("EXPANDED");
  });

  it("MERGED when several lock rows collapse onto one heading", () => {
    const x = buildHumanConfigCrosswalk({
      lockRows: [lock({ SOURCE_NUMBER: 1 }), lock({ SOURCE_NUMBER: 2 })],
      unitRows: [unit({})],
    });
    expect(x.lock_rows[0].verdict).toBe("MERGED");
  });

  it("CONFLICT for a lock row with no heading to join on", () => {
    const x = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "" })], unitRows: [unit({})] });
    expect(x.lock_rows[0].verdict).toBe("CONFLICT");
  });

  it("REVIEW_REQUIRED wins over any link verdict", () => {
    const x = buildHumanConfigCrosswalk({
      lockRows: [lock({ TYPE: "DYNAMIC_PARAMETER", RUNTIME_STATUS: "RUNTIME_READY" })],
      unitRows: [unit({ Semantic_State: "REVIEW_REQUIRED" })],
    });
    expect(x.unit_rows[0].verdict).toBe("REVIEW_REQUIRED");
  });

  it("SOURCE_ONLY when no lock row governs the heading", () => {
    const x = buildHumanConfigCrosswalk({ lockRows: [lock({ SOURCE_HEADING: "x" })], unitRows: [unit({ Heading: "y" })] });
    expect(x.unit_rows[0].verdict).toBe("SOURCE_ONLY");
  });
});

describe("normalizeHeading — conservative by design", () => {
  it("folds punctuation, whitespace and niqqud but never stems or translates", () => {
    expect(normalizeHeading(" — תודעה, הכרה —  ")).toBe(normalizeHeading("תודעה הכרה"));
    // Different words must NOT collapse.
    expect(normalizeHeading("תודעה")).not.toBe(normalizeHeading("הכרה"));
  });
  it("is total over junk input", () => {
    for (const v of [null, undefined, "", "   ", 42]) expect(typeof normalizeHeading(v)).toBe("string");
  });
});

describe("crosswalk — live run against the REAL 189-row Source Lock", () => {
  it("classifies every real lock row, with no row left unclassified", () => {
    const rows = loadHumanMaster().map((r) => ({
      SOURCE_NUMBER: r.SOURCE_NUMBER, SOURCE_HEADING: r.SOURCE_HEADING,
      SOURCE_SECTION: r.SOURCE_SECTION, SOURCE_FILE: r.SOURCE_FILE,
      TYPE: r.TYPE, RUNTIME_STATUS: r.RUNTIME_STATUS,
    })) as CrosswalkLockRow[];
    const x = buildHumanConfigCrosswalk({ lockRows: rows, unitRows: [] });
    expect(x.summary.lock_total).toBe(189);
    expect(x.lock_rows.every((r) => !!r.verdict)).toBe(true);
    // With no 2.1 side supplied, every joinable row is honestly MISSING.
    expect(x.summary.lock_by_verdict.MISSING_IN_2_1).toBeGreaterThan(0);
    // The runtime-active count must equal activeConfig's own 19.
    expect(x.lock_rows.filter((r) => r.runtime_active).length).toBe(19);
  });
});
