/**
 * EVERY TERMINAL SAYS WHETHER ANYONE ELSE CHECKED THIS — IN BOTH STATES.
 *
 * The nine surfaces used to hardcode "no evidence" as prose, so the sentence
 * could not become wrong and could not become right either. These tests hold
 * the replacement to a stricter standard: each terminal must state the
 * evidence fact and the learning fact, the wording must actually change with
 * the facts, and it must stay readable Hebrew rather than leaking field names.
 */
import { describe, expect, it } from "vitest";

import { terminalMeaning, type DayChain } from "../terminalMeaning";

const TERMINALS = [
  "hub", "brain", "dynamics", "marketplace", "community",
  "planet", "world", "human-config", "evidence",
] as const;

const chain = (o: Partial<DayChain> = {}): DayChain => ({
  hasObservation: true, hasStateT0: true, hasAction: true, hasEffect: true,
  hasVerifiedEvidence: false, hasLearning: false,
  markedCount: 6, unmarkedCount: 4,
  ...o,
});

const lines = (t: (typeof TERMINALS)[number], c: DayChain) => {
  const m = terminalMeaning(t, c);
  return [...m.known, ...m.unknown].join(" | ");
};

describe("evidence and learning are stated on all nine terminals", () => {
  it.each(TERMINALS)("%s says both facts when neither exists", (t) => {
    const text = lines(t, chain());
    expect(text).toContain("אין ראיה");
    expect(text).toContain("לא נרשמה מסקנה");
  });

  it.each(TERMINALS)("%s says both facts when both exist", (t) => {
    const text = lines(t, chain({ hasVerifiedEvidence: true, hasLearning: true }));
    expect(text).toContain("אומתה בידי אדם אחר");
    expect(text).toContain("נרשמה מסקנה");
    // The *evidence* sentence must flip. "אין ראיה שהפעולה גרמה לתוצאה" is a
    // separate and still-true statement about causation, so match the
    // specific sentence rather than the bare word.
    expect(text).not.toContain("אין ראיה: התוצאה דווחה");
    expect(text).not.toContain("אין ראיה, מפני שטרם");
  });

  it.each(TERMINALS)("%s moves the evidence line from unknown to known once it is true", (t) => {
    const without = terminalMeaning(t, chain());
    const with_ = terminalMeaning(t, chain({ hasVerifiedEvidence: true }));
    expect(without.unknown.some((l) => l.includes("ראיה"))).toBe(true);
    expect(without.known.some((l) => l.includes("אומתה בידי אדם אחר"))).toBe(false);
    expect(with_.known.some((l) => l.includes("אומתה בידי אדם אחר"))).toBe(true);
  });

  it.each(TERMINALS)("%s never leaks a field name or code token into the reader's text", (t) => {
    const text = lines(t, chain({ hasVerifiedEvidence: true, hasLearning: true }));
    for (const token of ["verifier_type", "verified_outcome", "EvidencePresent", "LearningSupported", "effect_id", "subject_consent"]) {
      expect(text).not.toContain(token);
    }
  });

  it("distinguishes 'not checked' from 'nothing to check yet'", () => {
    const noEffect = lines("hub", chain({ hasAction: false, hasEffect: false }));
    expect(noEffect).toContain("טרם נרשמה תוצאה");
    const reported = lines("hub", chain());
    expect(reported).toContain("דיווח עצמי אינו אימות");
  });

  it("offers verification as the next step while the outcome is unchecked", () => {
    // The prompt links to THAT Effect's own screen, so the verifier does not
    // have to find it again on a page full of somebody else's material.
    expect(terminalMeaning("hub", chain({ effect_id: "effect_x" })).nextAction?.href)
      .toBe("/verify/effect_x");
    expect(terminalMeaning("hub", chain({ hasVerifiedEvidence: true, effect_id: "effect_x" })).nextAction?.href)
      .toBe("/hub#day-closing-record");
  });

  it("does not invent a verify link when no Effect has been recorded", () => {
    // Without an Effect there is nothing to verify, and `/verify/undefined`
    // would be a link to a page that cannot exist.
    expect(terminalMeaning("hub", chain()).nextAction?.href).toBe("/hub");
    expect(terminalMeaning("evidence", chain()).nextAction?.href).toBe("/hub");
  });
});
