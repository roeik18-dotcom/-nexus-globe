/** The gate that stops one person's canon records reaching another's screen. */
import { describe, expect, it } from "vitest";
import { ownedByViewer, scopeToViewer, ACTION_OWNER, EFFECT_OWNER, NEED_OWNER, OFFER_OWNER } from "../viewerScopedCanon";

const roei = { subject_id: "person_roei", person_id: "p_you" };
const bet = { subject_id: "person_bet", person_id: "p_bet" };

describe("ownedByViewer is pure, total and fail-closed", () => {
  it("returns false without a viewer — never 'everything'", () => {
    expect(ownedByViewer("person_roei", null)).toBe(false);
    expect(ownedByViewer("person_roei", {})).toBe(false);
  });
  it("matches on either identity field", () => {
    expect(ownedByViewer("person_roei", roei)).toBe(true);
    expect(ownedByViewer("p_you", roei)).toBe(true);
    expect(ownedByViewer("person_roei", bet)).toBe(false);
  });
  it("an ownerless record belongs to nobody", () => {
    expect(ownedByViewer(undefined, roei)).toBe(false);
    expect(ownedByViewer("", roei)).toBe(false);
  });
});

describe("scopeToViewer removes other people's records from the dataset", () => {
  const actions = [{ action: { owner: "person_roei" } }, { action: { owner: "person_bet" } }];
  const effects = [{ effect: { subject: "person_roei" } }, { effect: { subject: "person_bet" } }];
  const needs = [{ need: { subject: "person_roei" } }];
  const offers = [{ offer: { source: "person_roei" } }];

  it("B receives none of Roei's records", () => {
    expect(scopeToViewer(actions, ACTION_OWNER, bet)).toEqual([{ action: { owner: "person_bet" } }]);
    expect(scopeToViewer(effects, EFFECT_OWNER, bet)).toEqual([{ effect: { subject: "person_bet" } }]);
    expect(scopeToViewer(needs, NEED_OWNER, bet)).toEqual([]);
    expect(scopeToViewer(offers, OFFER_OWNER, bet)).toEqual([]);
    // The identity is absent from the DATA, not merely unrendered.
    expect(JSON.stringify(scopeToViewer(needs, NEED_OWNER, bet))).not.toContain("person_roei");
  });

  it("Roei still receives his own", () => {
    expect(scopeToViewer(actions, ACTION_OWNER, roei)).toHaveLength(1);
    expect(scopeToViewer(needs, NEED_OWNER, roei)).toHaveLength(1);
  });

  it("no viewer yields an empty slice, never the whole store", () => {
    expect(scopeToViewer(actions, ACTION_OWNER, null)).toEqual([]);
    expect(scopeToViewer(effects, EFFECT_OWNER, {})).toEqual([]);
  });

  it("RELATED PEOPLE can only ever name the viewer", () => {
    const scoped = [
      ...scopeToViewer(actions, ACTION_OWNER, bet).map(ACTION_OWNER),
      ...scopeToViewer(effects, EFFECT_OWNER, bet).map(EFFECT_OWNER),
      ...scopeToViewer(needs, NEED_OWNER, bet).map(NEED_OWNER),
      ...scopeToViewer(offers, OFFER_OWNER, bet).map(OFFER_OWNER),
    ];
    expect([...new Set(scoped)]).toEqual(["person_bet"]);
  });
});
