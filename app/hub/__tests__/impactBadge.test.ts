/**
 * The impact badge must never render blank.
 *
 * When `under_review` was added to the domain, ValueHub's LEVEL_LABEL /
 * LEVEL_MARK / LEVEL_STYLE were typed `Record<string, …>`. A level with no entry
 * produced `undefined` for all three: no mark, no text, no colour — a badge that
 * silently said nothing about a claim someone had actively asked to be checked.
 * That is worse than wrong, because an empty badge reads as "unremarkable".
 *
 * The maps are now `Record<VerificationLevel, …>`, so a missing level is a
 * compile error. These tests are the runtime half of that guarantee: they walk
 * every level the projection can actually emit and assert a renderable badge.
 *
 * There is no DOM test tooling in this repo, so this checks the lookup tables the
 * badge is built from rather than the rendered markup.
 */

import { describe, expect, it } from "vitest";

import { LEVEL_LABEL, LEVEL_MARK, LEVEL_STYLE } from "../ValueHub";
import { projectValueGroup, type VerificationLevel } from "@/app/lib/philos/projectValueGroup";
import { SEED_GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";

/** Every level the domain declares. Kept as a literal so adding one fails here. */
const ALL_LEVELS: VerificationLevel[] = [
  "unverified",
  "under_review",
  "verified",
  "partial",
  "inferred",
  "rejected",
  "inconclusive",
];

describe("impact badge covers every verification level", () => {
  it.each(ALL_LEVELS)("%s has a non-empty label", (level) => {
    expect(LEVEL_LABEL[level]).toBeTruthy();
    expect(LEVEL_LABEL[level].trim().length).toBeGreaterThan(0);
  });

  it.each(ALL_LEVELS)("%s has a non-empty mark", (level) => {
    expect(LEVEL_MARK[level]).toBeTruthy();
    expect(LEVEL_MARK[level].trim().length).toBeGreaterThan(0);
  });

  it.each(ALL_LEVELS)("%s has a colour", (level) => {
    expect(LEVEL_STYLE[level]).toBeDefined();
    expect(LEVEL_STYLE[level].color).toBeTruthy();
  });

  it("the three maps agree on which levels exist", () => {
    expect(Object.keys(LEVEL_LABEL).sort()).toEqual([...ALL_LEVELS].sort());
    expect(Object.keys(LEVEL_MARK).sort()).toEqual([...ALL_LEVELS].sort());
    expect(Object.keys(LEVEL_STYLE).sort()).toEqual([...ALL_LEVELS].sort());
  });
});

describe("under_review is visibly its own state", () => {
  it("does not reuse the verified label, mark or colour", () => {
    expect(LEVEL_LABEL.under_review).not.toBe(LEVEL_LABEL.verified);
    expect(LEVEL_MARK.under_review).not.toBe(LEVEL_MARK.verified);
    expect(LEVEL_STYLE.under_review.color).not.toBe(LEVEL_STYLE.verified.color);
  });

  it("does not reuse the unverified colour either — being checked is not the same as ignored", () => {
    expect(LEVEL_STYLE.under_review.color).not.toBe(LEVEL_STYLE.unverified.color);
  });

  it("its label does not claim verification", () => {
    // must not read as "אומת" (verified) on its own
    expect(LEVEL_LABEL.under_review).not.toContain("אומת");
  });

  it("every level has a distinct label", () => {
    const labels = ALL_LEVELS.map((l) => LEVEL_LABEL[l]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("the seed log's current state renders", () => {
  it("the impact under review resolves to a renderable badge", () => {
    const v = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY);
    expect(v).not.toBeNull();
    for (const i of v!.impact) {
      expect(LEVEL_LABEL[i.verification_level]).toBeTruthy();
      expect(LEVEL_MARK[i.verification_level]).toBeTruthy();
      expect(LEVEL_STYLE[i.verification_level]?.color).toBeTruthy();
    }
  });

  it("an impact with an open request exposes the requester and reason", () => {
    const v = projectValueGroup(VALUE_GROUP_EVENTS, SEED_GROUP_ID, SEED_TODAY);
    const reviewing = v!.impact.filter((i) => i.verification_level === "under_review");
    for (const i of reviewing) {
      expect(i.review_request).not.toBeNull();
      expect(i.review_request!.requester_name).toBeTruthy();
      expect(i.review_request!.reason).toBeTruthy();
      expect(i.review_request!.requested_verifier_role).toBeTruthy();
    }
  });
});
