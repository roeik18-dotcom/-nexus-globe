/**
 * Philos — the Decision Review, and the causal-support ladder.
 *
 * A Review is the second half of a Decision: the person comes back at the
 * horizon they set and says what actually happened. Everything here exists
 * to stop that account from quietly becoming a causal claim.
 *
 * ## The defect this module is built to fix
 *
 * `Action → Effect` never proved that the action caused the effect, and —
 * worse — the projection had no field that could carry the difference. An
 * independent verifier attests that an outcome OCCURRED; nothing in the
 * record could express what they had not attested. For a system whose whole
 * discipline is separating Detected from Verified, that was a contradiction
 * at the centre rather than a missing feature.
 *
 * `CausalSupport` is that missing field. Five rungs, weakest first, and the
 * weakest is the DEFAULT — a review says "this happened afterwards" unless
 * something specific earns more.
 *
 * ## Why the ladder is gated rather than asserted
 *
 * Anyone can type "my action caused this". The gates below are the smallest
 * set of conditions under which that sentence is not merely a feeling:
 *
 *   - `happened_after` — always available. Chronology is a fact about the
 *     records and needs no permission.
 *   - `correlated` — needs the expectation to have been resolved at all
 *     (`met`/`partly`/`not_met`). "I cannot tell" cannot be correlated with
 *     anything.
 *   - `plausibly_contributed` — additionally needs the stakes' required
 *     verification tier to be satisfied. A self-attested review of a
 *     significant decision does not reach this rung.
 *   - `causally_supported` — additionally needs at least one recorded
 *     alternative. If nothing else was ever on the table, "this is why it
 *     happened" has no competitor to have beaten, and the claim is
 *     unfalsifiable by construction.
 *   - `experimentally_shown` — additionally needs the review to name a
 *     repetition or a control (`comparison_basis`). Nothing in this codebase
 *     runs experiments; the rung exists so that the ladder does not stop one
 *     rung below the truth and imply that `causally_supported` is the
 *     ceiling. It is expected to stay unused for a long time, and that is a
 *     correct outcome, not a gap.
 *
 * `checkCausalClaim` returns the HIGHEST rung the evidence supports. A
 * caller that asks for more gets the honest lower rung plus the reason —
 * never a rejection, because refusing to record the review at all would just
 * lose the person's account of what happened.
 *
 * ## `cannot_tell` is a first-class result
 *
 * `ExpectationOutcome` includes `cannot_tell`, and it is not a failure to
 * review. Most consequential decisions are genuinely unresolved at their
 * first horizon. A journal that forces a verdict teaches people to invent
 * one, which is the exact failure mode this whole record set exists to
 * avoid.
 *
 * ## No scoring
 *
 * Nothing here ranks decisions or people, and `decisionProjection.ts` counts
 * records without ever dividing one count by another to produce a rate. See
 * that file's header for why the ratio specifically is refused.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";
import {
  type Decision,
  requiredTierFor,
  tierAtLeast,
  type VerificationTier,
  VERIFICATION_TIERS,
} from "./decision";

/** Weakest to strongest. The order is load-bearing: rungs compare by index. */
export const CAUSAL_SUPPORT = [
  "happened_after",
  "correlated",
  "plausibly_contributed",
  "causally_supported",
  "experimentally_shown",
] as const;
export type CausalSupport = (typeof CAUSAL_SUPPORT)[number];

/** The rung a review gets for free. Chronology needs no permission. */
export const DEFAULT_CAUSAL_SUPPORT: CausalSupport = "happened_after";

export const EXPECTATION_OUTCOMES = ["met", "partly", "not_met", "cannot_tell"] as const;
export type ExpectationOutcome = (typeof EXPECTATION_OUTCOMES)[number];

/** `cannot_tell` is deliberately excluded — see module header. */
export function isResolved(outcome: ExpectationOutcome): boolean {
  return outcome === "met" || outcome === "partly" || outcome === "not_met";
}

export interface DecisionReview {
  review_id: string;
  /** The Decision this closes. Explicit link only — never inferred by time. */
  decision_ref: string;
  /** Who wrote the review. For an `independent` tier this is not the decider. */
  reviewer: string;
  /** What actually happened, in the person's own words. NEVER generated. */
  what_happened: string;
  expectation_met: ExpectationOutcome;
  /**
   * What the person did not see coming. Optional, and the most valuable
   * field in the record: a met expectation teaches nothing, a surprise is
   * the only place a model actually updates.
   */
  surprise?: string;
  /** How this outcome was established. Floor set by the Decision's stakes. */
  verification_tier: VerificationTier;
  /**
   * The OutcomeVerification this review produced, when the tier is
   * `independent`. Explicit reference into the existing canon store — this
   * module never re-implements verification, it points at it.
   */
  outcome_verification_ref?: string;
  /**
   * A named repetition or control, if one exists. Required for — and only
   * meaningful at — `experimentally_shown`.
   */
  comparison_basis?: string;
  /** The rung CLAIMED. What the record is entitled to is computed, not read. */
  causal_support: CausalSupport;
  reviewed_at: string;
  /** True when written before `decision.review_due`. Recorded, never hidden. */
  reviewed_early: boolean;
  record_origin: RecordOrigin;
}

export type DecisionReviewError =
  | { field: "review_id"; reason: "empty" }
  | { field: "decision_ref"; reason: "empty" }
  | { field: "reviewer"; reason: "empty" }
  | { field: "what_happened"; reason: "empty" }
  | { field: "expectation_met"; reason: "unknown_value" }
  | { field: "verification_tier"; reason: "unknown_value" }
  | { field: "causal_support"; reason: "unknown_value" }
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
const TIER_SET: ReadonlySet<string> = new Set(VERIFICATION_TIERS);
const SUPPORT_SET: ReadonlySet<string> = new Set(CAUSAL_SUPPORT);

/** Pure, deterministic, total. All checks run; no short-circuiting. */
export function validateDecisionReview(r: DecisionReview): DecisionReviewValidation {
  const errors: DecisionReviewError[] = [];

  if (!nonEmpty(r?.review_id)) errors.push({ field: "review_id", reason: "empty" });
  if (!nonEmpty(r?.decision_ref)) errors.push({ field: "decision_ref", reason: "empty" });
  if (!nonEmpty(r?.reviewer)) errors.push({ field: "reviewer", reason: "empty" });
  if (!nonEmpty(r?.what_happened)) errors.push({ field: "what_happened", reason: "empty" });

  if (typeof r?.expectation_met !== "string" || !OUTCOME_SET.has(r.expectation_met)) {
    errors.push({ field: "expectation_met", reason: "unknown_value" });
  }
  if (typeof r?.verification_tier !== "string" || !TIER_SET.has(r.verification_tier)) {
    errors.push({ field: "verification_tier", reason: "unknown_value" });
  }
  if (typeof r?.causal_support !== "string" || !SUPPORT_SET.has(r.causal_support)) {
    errors.push({ field: "causal_support", reason: "unknown_value" });
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

export type CausalCapReason =
  | "expectation_unresolved"
  | "verification_below_stakes"
  | "no_alternative_considered"
  | "no_comparison_basis";

export interface CausalClaimCheck {
  /** The highest rung this evidence actually supports. */
  entitled: CausalSupport;
  /** What the review asked for. */
  claimed: CausalSupport;
  /** True when `claimed` exceeded `entitled` and was brought down. */
  capped: boolean;
  /** Why it could go no higher. Ordered weakest-blocking-condition first. */
  reasons: CausalCapReason[];
}

function rung(c: CausalSupport): number {
  return CAUSAL_SUPPORT.indexOf(c);
}

/**
 * The gate. Pure, total, never throws, never mutates its inputs.
 *
 * Returns the highest rung the supplied evidence supports, together with
 * every condition that stopped it going further — so a screen can say
 * "this is 'happened after' because nothing else was on the table" rather
 * than just showing a demoted word.
 *
 * Never rejects. A review whose claim is too strong is still recorded; it is
 * recorded at the rung it earns.
 */
export function checkCausalClaim(input: {
  claimed: CausalSupport;
  decision: Pick<Decision, "stakes" | "alternatives_considered">;
  expectation_met: ExpectationOutcome;
  verification_tier: VerificationTier;
  comparison_basis?: string;
}): CausalClaimCheck {
  const { claimed, decision, expectation_met, verification_tier, comparison_basis } = input;
  const reasons: CausalCapReason[] = [];

  const resolved = isResolved(expectation_met);
  const meetsTier = tierAtLeast(verification_tier, requiredTierFor(decision.stakes));
  const hasAlternative =
    Array.isArray(decision.alternatives_considered) &&
    decision.alternatives_considered.some((a) => typeof a === "string" && a.trim() !== "");
  const hasComparison = typeof comparison_basis === "string" && comparison_basis.trim() !== "";

  // Each condition is checked independently and ALL failures are reported —
  // a review blocked by three separate things should say so once, not force
  // three round trips.
  if (!resolved) reasons.push("expectation_unresolved");
  if (!meetsTier) reasons.push("verification_below_stakes");
  if (!hasAlternative) reasons.push("no_alternative_considered");
  if (!hasComparison) reasons.push("no_comparison_basis");

  let ceiling: CausalSupport = "happened_after";
  if (resolved) ceiling = "correlated";
  if (resolved && meetsTier) ceiling = "plausibly_contributed";
  if (resolved && meetsTier && hasAlternative) ceiling = "causally_supported";
  if (resolved && meetsTier && hasAlternative && hasComparison) {
    ceiling = "experimentally_shown";
  }

  const wanted = SUPPORT_SET.has(claimed) ? claimed : DEFAULT_CAUSAL_SUPPORT;
  const entitled = rung(wanted) <= rung(ceiling) ? wanted : ceiling;

  return {
    entitled,
    claimed: wanted,
    capped: rung(wanted) > rung(ceiling),
    // Only the reasons that actually bound THIS claim are interesting; a
    // review claiming `correlated` does not need to hear about comparison
    // bases it never wanted.
    reasons: reasons.filter((why) => boundsClaim(why, wanted)),
  };
}

/** Which rungs each condition is a precondition for. */
function boundsClaim(reason: CausalCapReason, wanted: CausalSupport): boolean {
  const w = rung(wanted);
  switch (reason) {
    case "expectation_unresolved":
      return w >= rung("correlated");
    case "verification_below_stakes":
      return w >= rung("plausibly_contributed");
    case "no_alternative_considered":
      return w >= rung("causally_supported");
    case "no_comparison_basis":
      return w >= rung("experimentally_shown");
  }
}

/**
 * Whether this review satisfies the verification floor its Decision's stakes
 * impose. Separate from the causal ladder on purpose: a `low`-stakes
 * decision self-attested is perfectly in order and must not be shown as
 * deficient, even though it can never reach `plausibly_contributed`.
 */
export function meetsStakesFloor(
  decision: Pick<Decision, "stakes">,
  review: Pick<DecisionReview, "verification_tier">,
): boolean {
  return tierAtLeast(review.verification_tier, requiredTierFor(decision.stakes));
}
