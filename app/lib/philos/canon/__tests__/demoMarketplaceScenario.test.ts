import { describe, expect, it } from "vitest";
import { validateNeed } from "../need";
import { validateOffer } from "../offer";
import { validateTransferAgainstMatch } from "../transfer";
import { isEffectVerified, validateEffect } from "../effect";
import {
  DEMO_EFFECT,
  DEMO_NEED,
  DEMO_OFFER,
  DEMO_TRANSFER,
  buildDemoDelta,
  buildDemoLearning,
  buildDemoMatchResult,
  demoScenarioIsSchemaValid,
} from "../demoMarketplaceScenario";

describe("DEMO marketplace scenario — real canon schemas + real canon functions, never a parallel engine", () => {
  it("the Need and Offer are each structurally valid per the real validators", () => {
    expect(validateNeed(DEMO_NEED).valid).toBe(true);
    expect(validateOffer(DEMO_OFFER).valid).toBe(true);
  });

  it("evaluateMatch (real, unmodified) permits the match", () => {
    const match = buildDemoMatchResult();
    expect(match.decision).toBe("permitted");
    expect(match.rejection_reasons).toEqual([]);
  });

  it("the Transfer candidate validates against the real permitted match", () => {
    const match = buildDemoMatchResult();
    expect(validateTransferAgainstMatch(DEMO_TRANSFER, match).valid).toBe(true);
  });

  it("the Effect is structurally valid and real isEffectVerified confirms it's verified (counterparty verification, not an internal-state claim)", () => {
    expect(validateEffect(DEMO_EFFECT).valid).toBe(true);
    expect(isEffectVerified(DEMO_EFFECT)).toBe(true);
  });

  it("deriveLearning (real, unmodified) accepts the candidate state_prime given the verified Effect", () => {
    const learning = buildDemoLearning();
    expect(learning.result.kind).toBe("state_prime");
  });

  it("computeStateDelta (real, unmodified) produces the real, honest delta", () => {
    const delta = buildDemoDelta();
    expect(delta).toEqual({ domain: "C", frame: "I", level_delta: 2, stability_delta: expect.closeTo(0.2, 5) });
  });

  it("the whole scenario is schema-valid end to end", () => {
    expect(demoScenarioIsSchemaValid()).toBe(true);
  });
});
