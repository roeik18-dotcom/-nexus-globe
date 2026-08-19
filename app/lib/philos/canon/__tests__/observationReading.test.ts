/**
 * ObservationReading — the one shared, deterministic text-reading every
 * terminal consumes. The contract under test:
 *   - detections are token matches with the matched token exposed
 *   - the 3×2 grid stays six DISTINCT cells (no dimension/orientation merge)
 *   - the general-value join matches the REAL universe at two separate
 *     tiers (family / subvalue) and returns honest nulls otherwise
 *   - the principle appears only for aversion+contradiction texts, always
 *     with its non-absolute qualifier
 *   - nothing invents a level, an Effect, or a group relation
 */
import { describe, expect, it } from "vitest";

import { deriveObservationReading } from "../observationReading";
import { RAW_FAMILIES, SUBVALUES } from "@/app/lib/philos/community/valueUniverse328";

const UNIVERSE = { subvalues: SUBVALUES, families: RAW_FAMILIES };

const SPIDER_TEXT =
  "עכביש נראה שונה/מכוער ומעורר רתיעה. הרגש יכול לדחוף לפעולה פיזית של הריגה, למרות שהשכל מבין שהוא חלק מהמערכת ולא פחות חשוב רק מפני שהוא שונה. קבלת השונה היא ערך כללי. יש כאן ניגוד בין תגובה גופנית, רגשית ושכלית ובין פנימי לחיצוני.";

const MARK = {
  canon_event_id: "obs_test_1",
  subject: "person_roei",
  domain: "E" as const,
  frame: "I" as const,
  observed_at: "2026-08-17T12:00:00+00:00",
  provenance: "self_reported" as const,
  confidence: 0.9,
  context: SPIDER_TEXT,
};

describe("deriveObservationReading — spider text", () => {
  const r = deriveObservationReading(MARK, UNIVERSE);

  it("keeps evidence fields verbatim from the record", () => {
    expect(r.canon_event_id).toBe("obs_test_1");
    expect(r.recorded_cell).toEqual({ domain: "E", frame: "I" });
    expect(r.context).toBe(SPIDER_TEXT);
  });

  it("detects all three dimensions, each with its own token", () => {
    const byDim = Object.fromEntries(r.dimensions.map((d) => [d.dimension, d.matched_token]));
    expect(byDim.PHYSICAL).toBeTruthy();
    expect(byDim.EMOTIONAL).toBeTruthy();
    expect(byDim.COGNITIVE).toBeTruthy();
    // six distinct cells: 3 dimensions and 2 orientations stay separate lists
    expect(r.dimensions).toHaveLength(3);
    expect(r.orientations).toHaveLength(2);
  });

  it("detects both orientations and the contradiction", () => {
    const byOri = Object.fromEntries(r.orientations.map((o) => [o.orientation, o.matched_token]));
    expect(byOri.INTERNAL).toBe("פנימי");
    expect(byOri.EXTERNAL).toBe("חיצוני");
    expect(r.contradiction.detected).toBe(true);
    expect(r.contradiction.matched_token).toBe("ניגוד");
  });

  it("joins the claimed value to the real universe FAMILY tier (F21), honest null at subvalue tier", () => {
    expect(r.general_value?.claimed_phrase).toBe("קבלת השונה");
    expect(r.general_value?.matched_family?.family_id).toBe("F21");
    expect(r.general_value?.matched_family?.stems).toEqual(expect.arrayContaining(["קבל", "שונ"]));
    // no subvalue shares ≥2 stems with the claim — must be null, not a guess
    expect(r.general_value?.matched_subvalue).toBeNull();
  });

  it("attaches the general principle WITH its non-absolute qualifier", () => {
    expect(r.principle).not.toBeNull();
    expect(r.principle!.text).toContain("אינם מבססים ערך מערכתי נמוך");
    expect(r.principle!.qualifier).toContain("לא איסור מוחלט");
  });
});

describe("deriveObservationReading — non-matching text", () => {
  const r = deriveObservationReading(
    { ...MARK, canon_event_id: "obs_test_2", context: "מדדתי דופק גבוה אחרי ריצה." },
    UNIVERSE,
  );

  it("reports unmentioned dimensions/orientations as null tokens, not detections", () => {
    expect(r.dimensions.every((d) => d.matched_token === null)).toBe(true);
    expect(r.orientations.every((o) => o.matched_token === null)).toBe(true);
  });

  it("no contradiction, no value claim, no principle", () => {
    expect(r.contradiction.detected).toBe(false);
    expect(r.general_value).toBeNull();
    expect(r.principle).toBeNull();
  });
});
