import { describe, expect, it } from "vitest";

import type { Decision } from "../decision";
import type { DecisionReview } from "../decisionReview";
import {
  inQueueOrder,
  projectReviewQueue,
  summariseOutcomes,
} from "../decisionProjection";

function decision(id: string, overrides: Partial<Decision> = {}): Decision {
  return {
    decision_id: id,
    case_id: `case_${id}`,
    subject: "person_roei",
    statement: `החלטה ${id}`,
    because: "סיבה",
    decision_logic: "שיקול",
    expected_outcome: "ציפייה",
    alternatives_considered: [],
    observation_refs: [],
    chosen_action: { kind: "action", action_ref: `act_${id}` },
    confidence: 0.5,
    stakes: "low",
    decided_at: "2026-08-01T09:00:00+03:00",
    review_horizon: "2026-08-08T09:00:00+03:00",
    record_origin: "REAL",
    ...overrides,
  };
}

function review(id: string, ref: string, overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    review_id: id,
    case_id: `case_${ref}`,
    decision_ref: ref,
    effect_ref: `eff_${ref}`,
    expectation_met: "met",
    causal_relation: "occurred_after",
    alternative_explanations: [],
    intervening_factors: [],
    counterevidence_refs: [],
    reviewed_at: "2026-08-08T10:00:00+03:00",
    reviewed_early: false,
    record_origin: "REAL",
    ...overrides,
  };
}

const NOW = "2026-08-10T09:00:00+03:00";

describe("projectReviewQueue", () => {
  it("marks a decision whose horizon has passed as due, with whole days overdue", () => {
    const [entry] = projectReviewQueue([decision("d1")], [], NOW);
    expect(entry.status).toBe("due");
    expect(entry.overdue_days).toBe(2);
  });

  it("marks a decision whose horizon is still ahead as awaiting, owing nothing", () => {
    const [entry] = projectReviewQueue(
      [decision("d1", { review_horizon: "2026-09-01T09:00:00+03:00" })],
      [],
      NOW,
    );
    expect(entry.status).toBe("awaiting");
    expect(entry.overdue_days).toBeNull();
  });

  it("never reports a negative overdue count", () => {
    const entries = projectReviewQueue(
      [decision("d1", { review_horizon: "2026-12-01T09:00:00+03:00" })],
      [],
      NOW,
    );
    expect(entries[0].overdue_days).toBeNull();
  });

  it("links a review only by explicit decision_ref, never by time proximity", () => {
    const entries = projectReviewQueue(
      [decision("d1"), decision("d2")],
      [review("r1", "d2")],
      NOW,
    );
    expect(entries.find((e) => e.decision.decision_id === "d1")!.status).toBe("due");
    expect(entries.find((e) => e.decision.decision_id === "d2")!.status).toBe("reviewed");
  });

  it("takes the EARLIEST review when a decision has more than one", () => {
    const [entry] = projectReviewQueue(
      [decision("d1")],
      [
        review("r_late", "d1", { reviewed_at: "2026-09-01T10:00:00+03:00", expectation_met: "not_met" }),
        review("r_first", "d1", { reviewed_at: "2026-08-08T10:00:00+03:00" }),
      ],
      NOW,
    );
    // Append-only: a later review is a further thought about an already
    // closed decision, not a correction of it.
    expect(entry.review!.review_id).toBe("r_first");
  });

  it("calls an unparseable horizon awaiting rather than due", () => {
    const [entry] = projectReviewQueue([decision("d1", { review_horizon: "whenever" })], [], NOW);
    expect(entry.status).toBe("awaiting");
  });

  it("is pure in `now` — it never reads the clock itself", () => {
    const earlier = projectReviewQueue([decision("d1")], [], "2026-08-01T09:00:00+03:00");
    const later = projectReviewQueue([decision("d1")], [], NOW);
    expect(earlier[0].status).toBe("awaiting");
    expect(later[0].status).toBe("due");
  });
});

describe("inQueueOrder", () => {
  it("puts what is due first, most overdue at the top", () => {
    const entries = projectReviewQueue(
      [
        decision("recent", { review_horizon: "2026-08-09T09:00:00+03:00" }),
        decision("ancient", { review_horizon: "2026-07-01T09:00:00+03:00" }),
        decision("future", { review_horizon: "2026-09-09T09:00:00+03:00" }),
      ],
      [],
      NOW,
    );
    expect(inQueueOrder(entries).map((e) => e.decision.decision_id)).toEqual([
      "ancient",
      "recent",
      "future",
    ]);
  });

  it("puts reviewed decisions last", () => {
    const entries = projectReviewQueue(
      [decision("done"), decision("open")],
      [review("r1", "done")],
      NOW,
    );
    expect(inQueueOrder(entries)[0].decision.decision_id).toBe("open");
  });
});

describe("summariseOutcomes", () => {
  it("always reports the total beside every count", () => {
    const entries = projectReviewQueue(
      [decision("d1"), decision("d2"), decision("d3")],
      [review("r1", "d1")],
      NOW,
    );
    const s = summariseOutcomes(entries);
    expect(s.total).toBe(3);
    expect(s.reviewed).toBe(1);
    expect(s.unreviewed_overdue).toBe(2);
  });

  it("counts outcomes so they sum to the number reviewed", () => {
    const entries = projectReviewQueue(
      [decision("a"), decision("b"), decision("c"), decision("d")],
      [
        review("r1", "a", { expectation_met: "met" }),
        review("r2", "b", { expectation_met: "not_met" }),
        review("r3", "c", { expectation_met: "partly" }),
        review("r4", "d", { expectation_met: "cannot_tell" }),
      ],
      NOW,
    );
    const s = summariseOutcomes(entries);
    expect(s.met + s.partly + s.not_met + s.cannot_tell).toBe(s.reviewed);
    expect(s).toMatchObject({ met: 1, not_met: 1, partly: 1, cannot_tell: 1 });
  });

  it("counts contradicted expectations — met teaches nothing", () => {
    const entries = projectReviewQueue(
      [decision("a"), decision("b"), decision("c")],
      [
        review("r1", "a", { expectation_met: "not_met" }),
        review("r2", "b", { expectation_met: "partly" }),
        review("r3", "c", { expectation_met: "met" }),
      ],
      NOW,
    );
    expect(summariseOutcomes(entries).contradicted_expectations).toBe(2);
  });

  it("reports how far up the causal ladder the reviews actually reached", () => {
    const entries = projectReviewQueue(
      [decision("a"), decision("b")],
      [
        review("r1", "a", { causal_relation: "occurred_after" }),
        review("r2", "b", { causal_relation: "probably_contributed" }),
      ],
      NOW,
    );
    const s = summariseOutcomes(entries);
    expect(s.by_causal_relation.occurred_after).toBe(1);
    expect(s.by_causal_relation.probably_contributed).toBe(1);
    expect(s.by_causal_relation.causally_supported).toBe(0);
  });

  it("exposes no rate, score or average — counts only", () => {
    // Guarding the module header's central refusal structurally: a later
    // pass that adds `accuracy` or `success_rate` fails here first.
    const s = summariseOutcomes(projectReviewQueue([decision("a")], [review("r1", "a")], NOW));
    const forbidden = ["rate", "score", "accuracy", "average", "mean", "ratio", "percent"];
    for (const key of Object.keys(s)) {
      expect(forbidden.some((f) => key.toLowerCase().includes(f))).toBe(false);
    }
  });

  it("is empty and honest with no records at all", () => {
    expect(summariseOutcomes([])).toMatchObject({ total: 0, reviewed: 0, contradicted_expectations: 0 });
  });
});
