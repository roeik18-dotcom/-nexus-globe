/**
 * FORWARD LINKAGE — an explicit reference must survive the whole chain, and
 * an absent one must stay absent.
 *
 * Synthetic records only. No Observation(t1) is manufactured: the open
 * boundary stays open, and the test asserts that it does.
 */
import { describe, expect, it } from "vitest";
import { buildSystemTrace, traceSummary } from "../systemTrace";

const OBS = "canon_evt_test_obs_0001";
const NEED = "need_test_0001";
const OFFER = "offer_test_0001";
const ACTION = "action_test_0001";
const EFFECT = "effect_test_0001";

/** A future flow where the person DID select the originating Observation. */
const linked = () => buildSystemTrace({
  observationIds: [OBS], observationTimes: ["2026-09-01T09:00:00+03:00"],
  needIds: [NEED], offerIds: [OFFER], actionIds: [ACTION],
  actionReferencesObservation: true,
  effectIds: [EFFECT], effectHasVerifiedOutcome: true,
  effectHasObservedInRef: false, verifiedMemberships: 1, learningCount: 0,
});

/** The historical shape: no originating Observation was selected. */
const unlinked = () => buildSystemTrace({
  observationIds: [OBS], observationTimes: ["2026-09-01T09:00:00+03:00"],
  needIds: [NEED], offerIds: [OFFER], actionIds: [ACTION],
  actionReferencesObservation: false,
  effectIds: [EFFECT], effectHasVerifiedOutcome: true,
  effectHasObservedInRef: false, verifiedMemberships: 1, learningCount: 0,
});

describe("forward linkage — references survive the chain", () => {
  it("carries every explicit reference through Need -> Offer -> Action -> Effect -> Evidence", () => {
    const t = linked();
    const edge = (to: string) => t.find((e) => e.to === to)!;
    expect(edge("Offer → Match").source_record).toBe(NEED);
    expect(edge("Offer → Match").target_record).toBe(OFFER);
    expect(edge("Action").source_record).toContain(NEED);
    expect(edge("Action").source_record).toContain(OFFER);
    expect(edge("Action").target_record).toBe(ACTION);
    expect(edge("Effect").source_record).toBe(ACTION);
    expect(edge("Effect").target_record).toBe(EFFECT);
    expect(edge("Evidence").source_record).toBe(EFFECT);
    for (const to of ["Offer → Match", "Action", "Effect", "Evidence"]) {
      expect(edge(to).linkage).toBe("VERIFIED_REFERENCE_LINK");
      expect(edge(to).status).toBe("IMPLEMENTED");
    }
  });

  it("upgrades Action->Observation(t0) to LINKED when, and only when, the reference exists", () => {
    const e = (t: ReturnType<typeof linked>) => t.find((x) => x.to === "Observation (as t0)")!;
    expect(e(linked()).linkage).toBe("VERIFIED_REFERENCE_LINK");
    expect(e(linked()).status).toBe("IMPLEMENTED");
    // absence of a source reference stays UNLINKED — never repaired by proximity
    expect(e(unlinked()).linkage).toBe("UNLINKED");
    expect(e(unlinked()).status).toBe("PARTIAL");
  });

  it("uses NO timestamp-based, similarity-based or implicit linkage", () => {
    // identical records, one flag apart -> the ONLY difference is the explicit ref
    const a = JSON.stringify(linked());
    const b = JSON.stringify(unlinked());
    expect(a).not.toBe(b);
    const diffs = linked().filter((e, i) => JSON.stringify(e) !== JSON.stringify(unlinked()[i]));
    expect(diffs).toHaveLength(1);
    expect(diffs[0].to).toBe("Observation (as t0)");
  });

  it("keeps the Learning/State(t+1) boundary OPEN — no Observation(t1) is manufactured", () => {
    const t = linked();
    const t1 = t.find((e) => e.to === "Observation(t1)")!;
    expect(t1.status).toBe("MISSING_DATA");
    expect(t1.target_record).toBeNull();
    const learn = t.find((e) => e.to === "Learning / State(t+1)")!;
    expect(learn.status).toBe("OPEN_BOUNDARY");
    expect(learn.linkage).toBe("NO_LINK_POSSIBLE");
  });

  it("a fully-linked future flow raises LINKED without inventing records", () => {
    expect(traceSummary(linked()).linked).toBe(traceSummary(unlinked()).linked + 1);
    // and never claims more RECORDED than the historical shape, since no
    // record was added — only a reference populated
    expect(traceSummary(linked()).recorded).toBe(traceSummary(unlinked()).recorded);
  });
});
