/**
 * Value System — registry + generic classifier acceptance.
 *
 * Contract: PHILOS_VALUE_SYSTEM_MASTER_INGEST_COMBINED_v4.1.md. The spider
 * case is a REGRESSION test of the generic engine (§12/§17.5), and a
 * second, clearly-labeled TEST fixture proves the engine is not hard-coded
 * to spider/ugliness/acceptance. The fixture text below is NOT a user
 * Observation and is never persisted — it exercises classification
 * mechanics only.
 */
import { describe, expect, it } from "vitest";

import { BASE_VALUES, CANDIDATE_VALUE_FAMILIES } from "../baseValueRegistry";
import { classifyObservationText, matchValueGroups, type OperationalGroupInput } from "../classifier";

const SPIDER_TEXT =
  "עכביש נראה שונה/מכוער ומעורר רתיעה. הרגש יכול לדחוף לפעולה פיזית של הריגה, למרות שהשכל מבין שהוא חלק מהמערכת ולא פחות חשוב רק מפני שהוא שונה. קבלת השונה היא ערך כללי. יש כאן ניגוד בין תגובה גופנית, רגשית ושכלית ובין פנימי לחיצוני.";

/** TEST FIXTURE — not a user Observation; classification mechanics only. */
const TEST_FIXTURE_HONESTY =
  "אמרתי ללקוח את האמת על העיכוב למרות שזה סיכן את העסקה. אמון הוא ערך בסיסי בעבודה שלי, והאמת חשובה גם כשקשה.";

describe("registries (contract §17.2/§6)", () => {
  it("BASE_VALUE_REGISTRY = 65, all with id/label/families/status/provenance", () => {
    expect(BASE_VALUES).toHaveLength(65);
    for (const bv of BASE_VALUES) {
      expect(bv.id).toMatch(/^BV\d{2}$/);
      expect(bv.label.length).toBeGreaterThan(1);
      expect(bv.candidate_family_refs.length).toBeGreaterThan(0);
      expect(bv.status).toBe("NORMALIZATION_BASE / REVIEW_REQUIRED");
      expect(bv.provenance).toContain("v4.1");
    }
  });

  it("VALUE_FAMILY_REGISTRY = 28, all REVIEW_REQUIRED, never auto-promoted", () => {
    expect(CANDIDATE_VALUE_FAMILIES).toHaveLength(28);
    for (const f of CANDIDATE_VALUE_FAMILIES) expect(f.status).toBe("REVIEW_REQUIRED");
  });

  it("כבוד sits in TWO families by design (F01 + F25)", () => {
    const kavod = BASE_VALUES.find((b) => b.label === "כבוד")!;
    expect(kavod.candidate_family_refs).toEqual(["F01", "F25"]);
  });

  it("every family's base_value_refs round-trip to the base registry", () => {
    for (const f of CANDIDATE_VALUE_FAMILIES) {
      expect(f.base_value_refs.length).toBeGreaterThan(0);
      for (const ref of f.base_value_refs) {
        expect(BASE_VALUES.find((b) => b.id === ref)!.candidate_family_refs).toContain(f.id);
      }
    }
  });
});

describe("SPIDER_REGRESSION (contract §12/§17.5)", () => {
  const c = classifyObservationText(SPIDER_TEXT);

  it("base values: קבלה + שונות CLAIMED; anything else conditional only", () => {
    const byLabel = Object.fromEntries(c.base_value_matches.map((m) => [m.label, m]));
    expect(byLabel["קבלה"].tier).toBe("CLAIMED");
    expect(byLabel["שונות"].tier).toBe("CLAIMED");
    // no non-conditional certification beyond the claimed pair
    for (const m of c.base_value_matches) {
      if (m.label !== "קבלה" && m.label !== "שונות") {
        expect(m.tier).not.toBe("CLAIMED");
      }
      // every match exposes its full basis
      expect(m.ref).toMatch(/^BV\d{2}$/);
      expect(m.reason.length).toBeGreaterThan(3);
      expect(m.confidence).toBeGreaterThan(0);
      expect(m.provenance).toBe("TEXT_TOKEN_MATCH");
    }
  });

  it("primary family = F21 קבלה, שונות ופלורליזם", () => {
    expect(c.value_family_matches[0].ref).toBe("F21");
    expect(c.value_family_matches[0].tier).toBe("CLAIMED");
    expect(c.value_family_matches[0].via_base_values.length).toBeGreaterThanOrEqual(2);
  });

  it("general value = the CLAIMED phrase קבלת השונה — never the family (F21 is not a general value)", () => {
    expect(c.general_value_matches).toHaveLength(1);
    expect(c.general_value_matches[0].claimed_phrase).toBe("קבלת השונה");
    expect(c.general_value_matches[0].status).toBe("GENERAL_VALUE_CANDIDATE");
    expect(c.general_value_matches[0].ref).not.toMatch(/^F\d{2}$/);
  });

  it("six classes: all six distinct cells, EMOTIONAL/COGNITIVE/PHYSICAL × INTERNAL/EXTERNAL mentioned", () => {
    expect(c.six_class_reading).toHaveLength(6);
    const ids = c.six_class_reading.map((x) => x.class);
    expect(new Set(ids).size).toBe(6);
    for (const cell of c.six_class_reading) expect(cell.mentioned).toBe(true);
  });

  it("contradictions include INTERNAL_VS_EXTERNAL, EMOTIONAL_VS_COGNITIVE, DECLARED_VALUE_VS_ACTION", () => {
    const refs = c.contradictions.map((x) => x.ref);
    expect(refs).toContain("INTERNAL_VS_EXTERNAL");
    expect(refs).toContain("EMOTIONAL_VS_COGNITIVE");
    expect(refs).toContain("COGNITIVE_VS_PHYSICAL_ACTION");
    expect(refs).toContain("DECLARED_VALUE_VS_ACTION");
  });

  it("value group = UNRESOLVED with no operational groups supplied", () => {
    expect(c.value_group_match.state).toBe("UNRESOLVED");
    expect(c.value_group_match.ref).toBeNull();
  });

  it("color roles: WHITE always; PURPLE (general value), BLUE (family), RED (action push), ORANGE (drive); no GREEN without a group", () => {
    const roles = c.color_roles.map((r) => r.role);
    expect(roles).toContain("WHITE");
    expect(roles).toContain("PURPLE");
    expect(roles).toContain("BLUE");
    expect(roles).toContain("RED");
    expect(roles).toContain("ORANGE");
    expect(roles).not.toContain("GREEN");
  });
});

describe("generic engine — TEST fixture (not spider-shaped)", () => {
  const c = classifyObservationText(TEST_FIXTURE_HONESTY);

  it("detects אמת + אמון (claim: אמון הוא ערך), not acceptance/difference", () => {
    const labels = c.base_value_matches.map((m) => m.label);
    expect(labels).toContain("אמת");
    expect(labels).toContain("אמון");
    expect(labels).not.toContain("קבלה");
    expect(labels).not.toContain("שונות");
    const emun = c.base_value_matches.find((m) => m.label === "אמון")!;
    expect(emun.tier).toBe("CLAIMED");
  });

  it("families are F06/F07 territory — F21 absent", () => {
    const refs = c.value_family_matches.map((f) => f.ref);
    expect(refs).toContain("F06");
    expect(refs).toContain("F07");
    expect(refs).not.toContain("F21");
  });

  it("general value candidate is the fixture's own claim, not קבלת השונה", () => {
    expect(c.general_value_matches[0].claimed_phrase).toContain("אמון");
  });
});

describe("value-group matching (contract §17.4)", () => {
  const claimed = classifyObservationText("שכנות טובה היא ערך מרכזי אצלי.");
  const groups = (over: Partial<OperationalGroupInput>): OperationalGroupInput[] => [{
    group_id: "grp_1", name: "שכונה תומכת", central_value: "שכנות טובה", provenance: "REAL",
    member_count: 5, operational_links: { needs: 1, offers: 0, actions: 0, effects: 0 }, ...over,
  }];

  it("MATCHED requires REAL + members + ≥1 operational relation", () => {
    const m = matchValueGroups(claimed.base_value_matches, claimed.value_family_matches, claimed.general_value_matches, groups({}));
    expect(m.state).toBe("MATCHED");
    expect(m.ref).toBe("grp_1");
  });

  it("a DEMO group can only be CANDIDATE, never MATCHED", () => {
    const m = matchValueGroups(claimed.base_value_matches, claimed.value_family_matches, claimed.general_value_matches, groups({ provenance: "DEMO" }));
    expect(m.state).toBe("CANDIDATE");
  });

  it("no operational relation → CANDIDATE (content category, not a group)", () => {
    const m = matchValueGroups(claimed.base_value_matches, claimed.value_family_matches, claimed.general_value_matches,
      groups({ operational_links: { needs: 0, offers: 0, actions: 0, effects: 0 } }));
    expect(m.state).toBe("CANDIDATE");
  });

  it("no name join → UNRESOLVED; a detected value NEVER creates a group", () => {
    const m = matchValueGroups(claimed.base_value_matches, claimed.value_family_matches, claimed.general_value_matches,
      groups({ central_value: "קיימות" }));
    expect(m.state).toBe("UNRESOLVED");
  });

  it("a TOKEN_ONLY (single-token) match alone cannot certify a group relation", () => {
    // text mentions פעולה once, no claim — single token, conditional
    const weak = classifyObservationText("נדרשת פעולה בהקדם.");
    const only = weak.base_value_matches.find((m) => m.label === "פעולה");
    expect(only?.conditional).toBe(true);
    const m = matchValueGroups(weak.base_value_matches, weak.value_family_matches, weak.general_value_matches,
      groups({ central_value: "פעולה" }));
    expect(m.state).toBe("UNRESOLVED");
  });
});
