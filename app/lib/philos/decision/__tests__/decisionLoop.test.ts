/**
 * The whole loop, end to end, through the REAL writers: decide → the horizon
 * arrives → review → the journal reports what it has shown.
 *
 * Everything runs against injected in-memory stores and an injected viewer.
 * Nothing here can reach `.philos-canon-data`, and no REAL record outside
 * these stores is read or written.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  setViewerProvider,
  type ViewerContext,
  type ViewerProvider,
} from "@/app/lib/philos/identity/viewerContext";
import { recordDecisionCore, recordReviewCore } from "../decisionActions";
import {
  _setDecisionReviewStore,
  _setDecisionStore,
  inMemoryDecisionReviewStore,
  inMemoryDecisionStore,
  type DecisionReviewStore,
  type DecisionStore,
} from "../decisionStore";
import {
  inQueueOrder,
  projectReviewQueue,
  summariseOutcomes,
} from "../decisionProjection";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function viewerAs(subject: string): ViewerProvider {
  const ctx: ViewerContext = {
    subject_id: subject,
    person_id: subject === "person_roei" ? "p_you" : "p_bet",
    source: "LOCAL_SINGLE_USER",
  } as ViewerContext;
  return { kind: "LOCAL_SINGLE_USER", resolve: async () => ctx };
}

let decisions: DecisionStore;
let reviews: DecisionReviewStore;

beforeEach(() => {
  decisions = inMemoryDecisionStore();
  reviews = inMemoryDecisionReviewStore();
  _setDecisionStore(decisions);
  _setDecisionReviewStore(reviews);
  setViewerProvider(viewerAs("person_roei"));
});

afterEach(() => {
  _setDecisionStore(null);
  _setDecisionReviewStore(null);
});

const DECIDE = {
  statement: "לעבור לעבוד על מסלול ההחלטות",
  because: "אין עבודת-משתמש אחת ברורה",
  expected_outcome: "בעוד שבוע יהיו שלוש החלטות שאני חוזר אליהן",
  alternatives: "להמשיך בפישוט ה-UI\nלעצור ולתכנן",
  horizon_days: "7",
  stakes: "low",
  confidence: "0.6",
};

describe("recording a decision", () => {
  it("writes one REAL record owned by the authenticated viewer", async () => {
    const r = await recordDecisionCore(formData(DECIDE));
    expect(r.ok).toBe(true);

    const [stored] = await decisions.load();
    expect(stored.decision.subject).toBe("person_roei");
    expect(stored.decision.record_origin).toBe("REAL");
    expect(stored.decision.expected_outcome).toBe(DECIDE.expected_outcome);
  });

  it("takes the subject from the session, never from the form", async () => {
    await recordDecisionCore(formData({ ...DECIDE, subject: "person_someone_else" }));
    const [stored] = await decisions.load();
    expect(stored.decision.subject).toBe("person_roei");
  });

  it("splits the alternatives textarea into a real list and drops blank lines", async () => {
    await recordDecisionCore(formData({ ...DECIDE, alternatives: "אחת\n\n   \nשתיים" }));
    const [stored] = await decisions.load();
    expect(stored.decision.alternatives_considered).toEqual(["אחת", "שתיים"]);
  });

  it("names every missing field at once rather than one per attempt", async () => {
    const r = await recordDecisionCore(formData({ statement: "רק זה" }));
    expect(r.ok).toBeUndefined();
    expect(r.error).toContain("למה");
    expect(r.error).toContain("מה אתה מצפה שיקרה");
  });

  it("computes a horizon that is genuinely in the future", async () => {
    await recordDecisionCore(formData({ ...DECIDE, horizon_days: "30" }));
    const [stored] = await decisions.load();
    expect(Date.parse(stored.decision.review_due)).toBeGreaterThan(
      Date.parse(stored.decision.decided_at),
    );
  });
});

describe("reviewing it", () => {
  async function decide(overrides: Record<string, string> = {}) {
    const r = await recordDecisionCore(formData({ ...DECIDE, ...overrides }));
    return r.decision_id!;
  }

  it("closes the decision and stores the reviewer from the session", async () => {
    const id = await decide();
    const r = await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "נרשמו ארבע",
        expectation_met: "met",
        verification_tier: "self_attested",
        causal_support: "happened_after",
      }),
    );
    expect(r.ok).toBe(true);

    const [stored] = await reviews.load();
    expect(stored.review.reviewer).toBe("person_roei");
    expect(stored.review.record_origin).toBe("REAL");
  });

  it("refuses a second review of the same decision", async () => {
    const id = await decide();
    const fd = () =>
      formData({
        decision_ref: id,
        what_happened: "מה שקרה",
        expectation_met: "met",
        verification_tier: "self_attested",
      });
    expect((await recordReviewCore(fd())).ok).toBe(true);
    expect((await recordReviewCore(fd())).reason).toBe("already_reviewed");
  });

  it("refuses a review of a decision that does not exist", async () => {
    const r = await recordReviewCore(
      formData({
        decision_ref: "dec_nope",
        what_happened: "מה שקרה",
        expectation_met: "met",
      }),
    );
    expect(r.reason).toBe("decision_not_found");
  });

  it("refuses to let a person call their OWN review independent", async () => {
    const id = await decide({ stakes: "significant" });
    const r = await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "מה שקרה",
        expectation_met: "met",
        verification_tier: "independent",
      }),
    );
    expect(r.reason).toBe("independent_tier_requires_another_person");
  });

  it("lets a DIFFERENT signed-in person review independently", async () => {
    const id = await decide({ stakes: "significant" });
    setViewerProvider(viewerAs("person_bet"));
    const r = await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "בדקתי, זה קרה",
        expectation_met: "met",
        verification_tier: "independent",
        causal_support: "causally_supported",
      }),
    );
    expect(r.ok).toBe(true);
    // Expectation resolved + independent tier + an alternative was recorded.
    expect(r.causal_support).toBe("causally_supported");
    expect(r.capped).toBe(false);
  });

  it("stores the rung the evidence EARNS, not the one that was asked for", async () => {
    const id = await decide({ stakes: "significant" });
    const r = await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "נראה לי שזה עבד",
        expectation_met: "met",
        verification_tier: "self_attested",
        causal_support: "causally_supported",
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.capped).toBe(true);
    // significant stakes are not met by self-attestation, so the claim falls
    // to what a resolved expectation alone supports.
    expect(r.causal_support).toBe("correlated");
    expect((await reviews.load())[0].review.causal_support).toBe("correlated");
  });

  it("records an early review as early rather than refusing it", async () => {
    const id = await decide({ horizon_days: "90" });
    const r = await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "כבר ברור",
        expectation_met: "not_met",
        verification_tier: "self_attested",
      }),
    );
    expect(r.ok).toBe(true);
    expect((await reviews.load())[0].review.reviewed_early).toBe(true);
  });

  it("keeps cannot_tell as a real answer", async () => {
    const id = await decide();
    const r = await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "עוד מוקדם",
        expectation_met: "cannot_tell",
        verification_tier: "self_attested",
      }),
    );
    expect(r.ok).toBe(true);
    expect((await reviews.load())[0].review.expectation_met).toBe("cannot_tell");
  });
});

describe("the journal as a whole", () => {
  it("moves a decision from awaiting to due to reviewed", async () => {
    const id = (await recordDecisionCore(formData({ ...DECIDE, horizon_days: "7" }))).decision_id!;
    const stored = (await decisions.load()).map((r) => r.decision);

    const beforeHorizon = projectReviewQueue(stored, [], stored[0].decided_at);
    expect(beforeHorizon[0].status).toBe("awaiting");

    const afterHorizon = projectReviewQueue(
      stored,
      [],
      new Date(Date.parse(stored[0].review_due) + 1000).toISOString(),
    );
    expect(afterHorizon[0].status).toBe("due");

    await recordReviewCore(
      formData({
        decision_ref: id,
        what_happened: "נסגר",
        expectation_met: "met",
        verification_tier: "self_attested",
        surprise: "החלק הקשה היה הניסוח",
      }),
    );

    const closed = projectReviewQueue(
      stored,
      (await reviews.load()).map((r) => r.review),
      new Date(Date.parse(stored[0].review_due) + 1000).toISOString(),
    );
    expect(closed[0].status).toBe("reviewed");

    const summary = summariseOutcomes(inQueueOrder(closed));
    expect(summary).toMatchObject({ total: 1, reviewed: 1, met: 1, surprises: 1 });
  });

  it("never writes outside the injected stores", async () => {
    await recordDecisionCore(formData(DECIDE));
    // The only records that exist are the ones this test put there.
    expect(await decisions.load()).toHaveLength(1);
    expect(await reviews.load()).toHaveLength(0);
  });
});
