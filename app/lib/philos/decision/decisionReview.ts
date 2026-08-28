/**
 * Philos — the Decision Review.
 *
 * ## What this record is now, and what it was
 *
 * The first pass gave `DecisionReview` its own `what_happened`, `reviewer`
 * and `verification_tier`, plus a `surprise` field holding learning content.
 * Every one of those already had a canon home:
 *
 *   `what_happened`      → `Effect.claimed_outcome.statement`
 *   `reviewer`           → `OutcomeVerification.verifier_id`
 *   `verification_tier`  → `OutcomeVerification.verifier_type`
 *   `surprise`           → `Learning`
 *
 * Two objects held one fact each, could disagree, and the canon-side one was
 * never written at all — so the day's gates saw nothing while the journal
 * showed a completed review. All four fields are GONE from this record. The
 * review now REFERENCES the Effect and, when there is one, the Learning.
 *
 * ## What genuinely belongs here, because no canon record carries it
 *
 * `expectation_met` — the comparison of a PRE-REGISTERED expectation against
 * what happened. Canon can say what was claimed and what was verified; it has
 * never held what was predicted beforehand, so it cannot express whether the
 * prediction held.
 *
 * `causal_relation` and its supporting fields — how strongly the DECISION is
 * implicated in the outcome. `Effect.action_ref` asserts that an Effect
 * belongs to an Action; it has never graded that link, and an
 * `OutcomeVerification` grades only whether the outcome occurred.
 *
 * The two axes stay apart: see `evidenceAxes.ts`. The outcome-verification
 * level is DERIVED from the referenced Effect on read and is deliberately
 * absent from this record.
 *
 * ## `cannot_tell` is a first-class result
 *
 * Not a failed review. Most consequential decisions are genuinely unresolved
 * at their first horizon, and a journal that forces a verdict teaches people
 * to invent one.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";
import { CAUSAL_RELATION, type CausalRelation } from "./evidenceAxes";

export const EXPECTATION_OUTCOMES = ["met", "partly", "not_met", "cannot_tell"] as const;
export type ExpectationOutcome = (typeof EXPECTATION_OUTCOMES)[number];

/** `cannot_tell` is deliberately excluded — nothing can correlate with it. */
export function isResolved(outcome: ExpectationOutcome): boolean {
  return outcome === "met" || outcome === "partly" || outcome === "not_met";
}

export interface DecisionReview {
  review_id: string;
  /** The case this closes a decision within. */
  case_id: string;
  /** The Decision being reviewed. Explicit link only. */
  decision_ref: string;
  /**
   * THE EFFECT THIS REVIEW IS ABOUT. Required, and the reason this record no
   * longer restates the outcome: what happened, who verified it and how are
   * all read from here. The writer either references an Effect that already
   * exists or creates one through the canon Effect writer first — it never
   * stores the outcome locally.
   */
  effect_ref: string;
  /** Did the pre-registered expectation hold. The genuinely new comparison. */
  expectation_met: ExpectationOutcome;

  // ── The causal axis. Stored here because canon has no field for it. ──
  /** The rung EARNED. `checkCausalRelation` computes it; it is never read
   *  straight from a form. */
  causal_relation: CausalRelation;
  /** The reviewer's own confidence in the causal claim, [0,1]. Optional —
   *  absent is honest, a fabricated number is not. */
  causal_confidence?: number;
  /** What else could explain this outcome. Required for `causally_supported`. */
  alternative_explanations: readonly string[];
  /** What else was going on that could have moved the result. */
  intervening_factors: readonly string[];
  /** The window over which the outcome was assessed. */
  time_window?: string;
  /** Records that CUT AGAINST the claim. Kept explicitly so a review can be
   *  honest about what it is arguing past. */
  counterevidence_refs: readonly string[];
  /** A named repetition or control. Required for the top rung only. */
  comparison_basis?: string;

  /** `Learning.learning_id` produced from this review, when one was. */
  learning_ref?: string;

  reviewed_at: string;
  /** True when written before the decision's `review_horizon`. Recorded,
   *  never hidden — an early review is allowed and is marked. */
  reviewed_early: boolean;
  record_origin: RecordOrigin;
}

export type DecisionReviewError =
  | { field: "review_id"; reason: "empty" }
  | { field: "case_id"; reason: "empty" }
  | { field: "decision_ref"; reason: "empty" }
  | { field: "effect_ref"; reason: "empty" }
  | { field: "expectation_met"; reason: "unknown_value" }
  | { field: "causal_relation"; reason: "unknown_value" }
  | { field: "causal_confidence"; reason: "not_a_probability" }
  | { field: "alternative_explanations"; reason: "not_a_string_list" }
  | { field: "intervening_factors"; reason: "not_a_string_list" }
  | { field: "counterevidence_refs"; reason: "not_a_string_list" }
  | { field: "reviewed_at"; reason: "invalid_or_no_offset" }
  | { field: "reviewed_early"; reason: "not_a_boolean" }
  | { field: "record_origin"; reason: "unknown_value" };

export interface DecisionReviewValidation {
  valid: boolean;
  errors: DecisionReviewError[];
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

const OUTCOME_SET: ReadonlySet<string> = new Set(EXPECTATION_OUTCOMES);
const RELATION_SET: ReadonlySet<string> = new Set(CAUSAL_RELATION);

/** Pure, deterministic, total. All checks run; no short-circuiting. */
export function validateDecisionReview(r: DecisionReview): DecisionReviewValidation {
  const errors: DecisionReviewError[] = [];

  if (!nonEmpty(r?.review_id)) errors.push({ field: "review_id", reason: "empty" });
  if (!nonEmpty(r?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(r?.decision_ref)) errors.push({ field: "decision_ref", reason: "empty" });
  /* THE LOAD-BEARING REQUIREMENT. A review with no Effect would be a review
     that restates an outcome nothing else knows about — the exact duplication
     this record was rebuilt to remove. */
  if (!nonEmpty(r?.effect_ref)) errors.push({ field: "effect_ref", reason: "empty" });

  if (typeof r?.expectation_met !== "string" || !OUTCOME_SET.has(r.expectation_met)) {
    errors.push({ field: "expectation_met", reason: "unknown_value" });
  }
  if (typeof r?.causal_relation !== "string" || !RELATION_SET.has(r.causal_relation)) {
    errors.push({ field: "causal_relation", reason: "unknown_value" });
  }

  if (r?.causal_confidence !== undefined) {
    const c = r.causal_confidence;
    if (typeof c !== "number" || !Number.isFinite(c) || c < 0 || c > 1) {
      errors.push({ field: "causal_confidence", reason: "not_a_probability" });
    }
  }

  for (const field of [
    "alternative_explanations",
    "intervening_factors",
    "counterevidence_refs",
  ] as const) {
    const list = r?.[field];
    if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) {
      errors.push({ field, reason: "not_a_string_list" });
    }
  }

  if (parseOffsetInstant(r?.reviewed_at) === null) {
    errors.push({ field: "reviewed_at", reason: "invalid_or_no_offset" });
  }
  if (typeof r?.reviewed_early !== "boolean") {
    errors.push({ field: "reviewed_early", reason: "not_a_boolean" });
  }
  if (!isRecordOrigin(r?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }

  return { valid: errors.length === 0, errors };
}
