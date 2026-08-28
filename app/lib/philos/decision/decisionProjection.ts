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
 * `surprises` is counted separately and is the figure actually worth
 * watching: an expectation met teaches nothing, and a journal producing no
 * surprises is either recording only foregone conclusions or not being read.
 */
import { parseOffsetInstant } from "../canon/observation";
import type { Decision } from "./decision";
import {
  type CausalSupport,
  CAUSAL_SUPPORT,
  type DecisionReview,
  type ExpectationOutcome,
} from "./decisionReview";

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
   * Whole days past `review_due`, at `now`. `0` on the day it comes due,
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

    const dueMs = parseOffsetInstant(decision.review_due);
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
      return String(a.decision.review_due).localeCompare(String(b.decision.review_due));
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
  /** Reviews carrying a non-empty `surprise`. The figure worth watching. */
  surprises: number;
  /** How far up the causal ladder the reviews actually reached. */
  by_causal_support: Readonly<Record<CausalSupport, number>>;
}

/**
 * Pure and deterministic. Counts only — see the module header for why no
 * ratio is computed here, and why adding one later would be a regression
 * rather than a feature.
 */
export function summariseOutcomes(entries: readonly QueueEntry[]): OutcomeSummary {
  const by_causal_support: Record<CausalSupport, number> = {
    happened_after: 0,
    correlated: 0,
    plausibly_contributed: 0,
    causally_supported: 0,
    experimentally_shown: 0,
  };

  const outcomes: Record<ExpectationOutcome, number> = {
    met: 0,
    partly: 0,
    not_met: 0,
    cannot_tell: 0,
  };

  let reviewed = 0;
  let unreviewed_overdue = 0;
  let surprises = 0;

  for (const e of entries) {
    if (e.status === "due") unreviewed_overdue += 1;
    const r = e.review;
    if (!r) continue;
    reviewed += 1;
    if (r.expectation_met in outcomes) outcomes[r.expectation_met] += 1;
    if (typeof r.surprise === "string" && r.surprise.trim() !== "") surprises += 1;
    if (CAUSAL_SUPPORT.includes(r.causal_support)) by_causal_support[r.causal_support] += 1;
  }

  return {
    total: entries.length,
    reviewed,
    unreviewed_overdue,
    met: outcomes.met,
    partly: outcomes.partly,
    not_met: outcomes.not_met,
    cannot_tell: outcomes.cannot_tell,
    surprises,
    by_causal_support,
  };
}
