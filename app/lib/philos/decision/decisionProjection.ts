/**
 * Philos — the Decision projection: what is due, and what the journal has
 * actually shown so far.
 *
 * ## Two questions, deliberately kept apart
 *
 * `projectReviewQueue` answers "what should I look at today". It is the
 * working surface of the journal and the only thing the first screen needs.
 *
 * `summariseOutcomes` answers "has any of this been worth doing". That is
 * the instrument the system did not previously have: the eleven-gate day
 * projection scores RECORD COMPLETENESS — whether a day was fully written
 * down — and nothing scored whether writing it down changed anything. These
 * are different questions and they get different functions.
 *
 * ## Why there is no rate, no score, and no average
 *
 * The obvious next line of code is `met / reviewed`. It is refused, and not
 * as squeamishness:
 *
 *   1. The denominator is self-selected. A person reviews the decisions they
 *      remember and skips the ones that went badly enough to avoid. A ratio
 *      over a self-selected sample is not an accuracy figure, it is a mood.
 *   2. It invites comparison across people, which canon §21 forbids and
 *      which would be meaningless anyway — one person's `significant` is
 *      another's `low`.
 *   3. A single number cannot distinguish "predicted easy things correctly"
 *      from "predicted hard things correctly", and the whole value of the
 *      journal is in the second.
 *
 * So `OutcomeSummary` carries COUNTS, always beside the total they came
 * from, and never a derived figure. A reader who wants the ratio can form it
 * and own it; the system will not hand it over pre-computed and thereby
 * imply it means something.
 *
 * `contradicted_expectations` is counted separately and is the figure
 * actually worth watching: an expectation met teaches nothing, and a journal
 * whose expectations are never contradicted is either recording only foregone
 * conclusions or not being read.
 */
import { parseOffsetInstant } from "../canon/observation";
import type { Decision } from "./decision";
import { type DecisionReview, type ExpectationOutcome } from "./decisionReview";
import { CAUSAL_RELATION, type CausalRelation } from "./evidenceAxes";

export type QueueStatus =
  /** Reviewed. Closed, whatever the outcome was. */
  | "reviewed"
  /** The horizon has arrived or passed and nothing has been written. */
  | "due"
  /** The horizon is still ahead. Nothing to do, and nothing owed. */
  | "awaiting";

export interface QueueEntry {
  decision: Decision;
  status: QueueStatus;
  review?: DecisionReview;
  /**
   * Whole days past `review_horizon`, at `now`. `0` on the day it comes due,
   * `null` when it is not yet due or already reviewed. Never negative —
   * "overdue by minus three days" is not a thing a person should read.
   */
  overdue_days: number | null;
}

const DAY_MS = 86_400_000;

/**
 * Pure and deterministic given `now`. `now` is an argument, never read from
 * the clock in here — a projection that read the time itself could not be
 * tested and would differ between server and client render.
 *
 * A decision with more than one review takes the EARLIEST by `reviewed_at`:
 * the store is append-only, so a later review is a further thought about an
 * already-closed decision, not a correction of it. It is still returned on
 * the entry so nothing is hidden.
 */
export function projectReviewQueue(
  decisions: readonly Decision[],
  reviews: readonly DecisionReview[],
  now: string,
): QueueEntry[] {
  const nowMs = parseOffsetInstant(now);

  const byDecision = new Map<string, DecisionReview[]>();
  for (const r of reviews) {
    if (typeof r?.decision_ref !== "string") continue;
    const list = byDecision.get(r.decision_ref);
    if (list) list.push(r);
    else byDecision.set(r.decision_ref, [r]);
  }

  return decisions.map((decision) => {
    const found = byDecision.get(decision.decision_id) ?? [];
    const review = [...found].sort((a, b) =>
      String(a.reviewed_at).localeCompare(String(b.reviewed_at)),
    )[0];

    if (review) {
      return { decision, status: "reviewed" as const, review, overdue_days: null };
    }

    const dueMs = parseOffsetInstant(decision.review_horizon);
    // An unparseable horizon cannot be called due. It is a broken record, and
    // saying "awaiting" is the honest reading of "we do not know when".
    if (dueMs === null || nowMs === null || nowMs < dueMs) {
      return { decision, status: "awaiting" as const, overdue_days: null };
    }

    return {
      decision,
      status: "due" as const,
      overdue_days: Math.floor((nowMs - dueMs) / DAY_MS),
    };
  });
}

/** Due first, most overdue at the top; then awaiting by nearest horizon; then
 *  reviewed, most recent first. The order a person would ask for. */
export function inQueueOrder(entries: readonly QueueEntry[]): QueueEntry[] {
  const rank: Record<QueueStatus, number> = { due: 0, awaiting: 1, reviewed: 2 };
  return [...entries].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === "due") return (b.overdue_days ?? 0) - (a.overdue_days ?? 0);
    if (a.status === "awaiting") {
      return String(a.decision.review_horizon).localeCompare(String(b.decision.review_horizon));
    }
    return String(b.review?.reviewed_at ?? "").localeCompare(String(a.review?.reviewed_at ?? ""));
  });
}

export interface OutcomeSummary {
  /** Every decision recorded. The denominator, always present. */
  total: number;
  /** Of those, how many have been reviewed at all. */
  reviewed: number;
  /** Reviewed decisions whose horizon has passed but which were not written. */
  unreviewed_overdue: number;
  /** Counts by outcome. Sums to `reviewed`. */
  met: number;
  partly: number;
  not_met: number;
  cannot_tell: number;
  /**
   * Reviews whose outcome CONTRADICTED the pre-registered expectation. The
   * figure worth watching, and the honest replacement for v1's `surprises`.
   *
   * v1 counted a free-text `surprise` field on the review. That field was
   * learning content living off the canon spine; it now belongs in a
   * `Learning`, so counting it here would mean reading a record this
   * projection has no business reaching into. `not_met` and `partly` are
   * what this projection can see, and a contradicted expectation is exactly
   * the case where a model has something to update.
   */
  contradicted_expectations: number;
  /** How far up the causal ladder the reviews actually reached. */
  by_causal_relation: Readonly<Record<CausalRelation, number>>;
}

/**
 * Pure and deterministic. Counts only — see the module header for why no
 * ratio is computed here, and why adding one later would be a regression
 * rather than a feature.
 */
export function summariseOutcomes(entries: readonly QueueEntry[]): OutcomeSummary {
  const by_causal_relation: Record<CausalRelation, number> = {
    occurred_after: 0,
    associated_with: 0,
    probably_contributed: 0,
    causally_supported: 0,
    experimentally_demonstrated: 0,
  };

  const outcomes: Record<ExpectationOutcome, number> = {
    met: 0,
    partly: 0,
    not_met: 0,
    cannot_tell: 0,
  };

  let reviewed = 0;
  let unreviewed_overdue = 0;
  let contradicted_expectations = 0;

  for (const e of entries) {
    if (e.status === "due") unreviewed_overdue += 1;
    const r = e.review;
    if (!r) continue;
    reviewed += 1;
    if (r.expectation_met in outcomes) outcomes[r.expectation_met] += 1;
    if (r.expectation_met === "not_met" || r.expectation_met === "partly") {
      contradicted_expectations += 1;
    }
    if (CAUSAL_RELATION.includes(r.causal_relation)) by_causal_relation[r.causal_relation] += 1;
  }

  return {
    total: entries.length,
    reviewed,
    unreviewed_overdue,
    met: outcomes.met,
    partly: outcomes.partly,
    not_met: outcomes.not_met,
    cannot_tell: outcomes.cannot_tell,
    contradicted_expectations,
    by_causal_relation,
  };
}
