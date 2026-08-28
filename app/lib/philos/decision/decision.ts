/**
 * Philos — the Decision record.
 *
 * **This module is not a canon closure.** `PHILOS-MELTING-POT-CANON.md`
 * describes Observation → State → Action → Effect → OutcomeVerification →
 * Learning → State'. It says nothing about decisions, and this file does not
 * pretend otherwise: every field below is this pass's own construction,
 * stated plainly, in the same way `matching.ts` and `effect.ts` state theirs
 * where canon under-specifies. What it IS is a narrower, human-sized entry
 * point onto that same spine — a Decision is the thing a person actually has
 * before an Action exists, and a Review is what closes it.
 *
 * **Why this record exists at all.** The system could already record that a
 * day was completely written down. It could not record whether writing it
 * down was worth doing. Those are different instruments, and only the first
 * existed. A Decision carries a PRE-REGISTERED expectation, which is the one
 * field that makes the later question answerable; without it, a review is
 * hindsight wearing a timestamp.
 *
 * ## The three fields that do the work
 *
 * `expected_outcome` — written BEFORE the outcome is known, and never
 * editable afterwards (the store is append-only; a changed mind is a new
 * Decision that supersedes, never an edit). This is the whole basis on which
 * "was I right" can be asked without the answer being constructed after the
 * fact.
 *
 * `alternatives_considered` — what else was genuinely on the table. A
 * decision with no alternatives was not a decision, it was a reflex, and
 * `causal_support` above `plausibly_contributed` is refused without at least
 * one (see `decisionReview.ts`). This is the cheapest available guard
 * against a journal that records only foregone conclusions.
 *
 * `stakes` — the tier that decides how much verification the review needs.
 * Every Effect in this codebase currently demands an independent verifier
 * regardless of consequence, which is correct for a public claim and absurd
 * for "I took the earlier train". That uniform requirement is a policy line,
 * not an architecture: `VerifierType` already carries
 * `self | counterparty | third_party | observed_measured`. `REQUIRED_TIER`
 * below is the whole of the change.
 *
 * ## What this module deliberately does NOT do
 *
 * It does not score decisions, rank them, average them, or maintain a
 * per-person quality figure. Canon §21's anti-ranking scope holds here
 * exactly as it holds in `canon/` — and it matters more here, because a
 * "decision quality score" is precisely the plausible-sounding artefact this
 * record makes easy and which would be false. Counting how many expectations
 * were met is a description of a set of records. It is not a measure of a
 * person, and nothing here may present it as one.
 *
 * It does not infer that a decision caused its outcome. See
 * `decisionReview.ts::CAUSAL_SUPPORT` — the record has a field for how
 * strongly causality is supported, whose default is the weakest value, and
 * whose stronger values are gated rather than asserted.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";

/**
 * How much the decision can cost if it is wrong. This is the person's own
 * declaration at decision time, never inferred from the text — nothing here
 * reads the statement and guesses. It drives exactly one thing: how much
 * verification the eventual review requires (`REQUIRED_TIER`).
 *
 * Ordered weakest to strongest consequence, and that order is load-bearing:
 * `tierAtLeast` compares by index.
 */
export const STAKES = ["low", "medium", "significant", "public"] as const;
export type Stakes = (typeof STAKES)[number];

/**
 * Who may attest that the reviewed outcome actually happened. Deliberately
 * the SAME vocabulary as `canon/outcomeVerification.ts::VerifierType`, not a
 * parallel one — a review that reaches `independent` produces a real
 * OutcomeVerification through the existing writer, and a second vocabulary
 * would let the two disagree about what "verified" means.
 *
 * Ordered weakest to strongest.
 */
export const VERIFICATION_TIERS = ["self_attested", "measured", "independent"] as const;
export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

/**
 * THE TIERING. The one policy statement in this module.
 *
 * `low` — self-attested is enough, and it is MARKED as self-attested; the
 *   record never rounds it up to "verified". Honest and frictionless is
 *   available, and it is what makes a daily journal usable at all.
 * `medium` — something outside the decider's own say-so: a measurement, a
 *   receipt, a counterparty. Not necessarily a person.
 * `significant` / `public` — an independent verifier, which is the existing
 *   `independentEvidence.ts` path unchanged.
 *
 * A person may always verify MORE strongly than their stakes require; the
 * gate is a floor, never a ceiling.
 */
export const REQUIRED_TIER: Readonly<Record<Stakes, VerificationTier>> = {
  low: "self_attested",
  medium: "measured",
  significant: "independent",
  public: "independent",
};

/** Total, never throws. Index comparison over the declared order. */
export function tierAtLeast(actual: VerificationTier, required: VerificationTier): boolean {
  const a = VERIFICATION_TIERS.indexOf(actual);
  const r = VERIFICATION_TIERS.indexOf(required);
  return a >= 0 && r >= 0 && a >= r;
}

/**
 * Review horizons, offered as a number of DAYS rather than a date.
 *
 * A date picker asks a person "when exactly" when the real question is "how
 * long before this is knowable", and it drags the whole timezone problem into
 * a field whose precision genuinely does not matter. The writer turns the
 * chosen number into an instant using the same clock that stamps
 * `decided_at`, so the two can never disagree about what "now" was.
 *
 * This lives here, and not beside the writer, because a `"use server"` module
 * may only export async functions — a plain exported array in one makes every
 * route that imports it fail at runtime.
 */
export const HORIZONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 1, label: "מחר" },
  { days: 7, label: "בעוד שבוע" },
  { days: 30, label: "בעוד חודש" },
  { days: 90, label: "בעוד שלושה חודשים" },
];

export const DEFAULT_HORIZON_DAYS = 7;
export const DAY_MS = 86_400_000;

export interface Decision {
  decision_id: string;
  /** The person whose decision this is. */
  subject: string;
  /** What was decided, in the person's own words. NEVER generated. */
  statement: string;
  /** Why — the reasoning as it stood at the time, not as reconstructed. */
  because: string;
  /**
   * What the person expects to be true when the review comes due. Written
   * before the outcome is known; that is the entire point of the field.
   */
  expected_outcome: string;
  /**
   * What else was genuinely on the table. May be empty — plenty of real
   * decisions have no live alternative — but an empty list caps how strongly
   * the review may later claim causality.
   */
  alternatives_considered: readonly string[];
  /** The person's own confidence at decision time, [0,1]. Never computed. */
  confidence: number;
  stakes: Stakes;
  /** When the decision was made. Offset instant. */
  decided_at: string;
  /**
   * When to come back and ask. Offset instant, and must be after
   * `decided_at` — a review horizon in the past is not a horizon.
   */
  review_due: string;
  record_origin: RecordOrigin;
}

export type DecisionError =
  | { field: "decision_id"; reason: "empty" }
  | { field: "subject"; reason: "empty" }
  | { field: "statement"; reason: "empty" }
  | { field: "because"; reason: "empty" }
  | { field: "expected_outcome"; reason: "empty" }
  | { field: "alternatives_considered"; reason: "not_a_string_list" }
  | { field: "confidence"; reason: "not_a_probability" }
  | { field: "stakes"; reason: "unknown_value" }
  | { field: "decided_at"; reason: "invalid_or_no_offset" }
  | { field: "review_due"; reason: "invalid_or_no_offset" }
  | { field: "review_due"; reason: "not_after_decided_at" }
  | { field: "record_origin"; reason: "unknown_value" };

export interface DecisionValidation {
  valid: boolean;
  errors: DecisionError[];
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

const STAKES_SET: ReadonlySet<string> = new Set(STAKES);

export function isStakes(v: unknown): v is Stakes {
  return typeof v === "string" && STAKES_SET.has(v);
}

/**
 * Pure, deterministic, total. Every applicable check runs — no
 * short-circuiting — so a caller sees everything wrong at once rather than
 * one thing per attempt. Same discipline as `validateLearning`.
 */
export function validateDecision(d: Decision): DecisionValidation {
  const errors: DecisionError[] = [];

  if (!nonEmpty(d?.decision_id)) errors.push({ field: "decision_id", reason: "empty" });
  if (!nonEmpty(d?.subject)) errors.push({ field: "subject", reason: "empty" });
  if (!nonEmpty(d?.statement)) errors.push({ field: "statement", reason: "empty" });
  if (!nonEmpty(d?.because)) errors.push({ field: "because", reason: "empty" });
  if (!nonEmpty(d?.expected_outcome)) {
    errors.push({ field: "expected_outcome", reason: "empty" });
  }

  if (
    !Array.isArray(d?.alternatives_considered) ||
    d.alternatives_considered.some((a) => typeof a !== "string")
  ) {
    errors.push({ field: "alternatives_considered", reason: "not_a_string_list" });
  }

  if (
    typeof d?.confidence !== "number" ||
    !Number.isFinite(d.confidence) ||
    d.confidence < 0 ||
    d.confidence > 1
  ) {
    errors.push({ field: "confidence", reason: "not_a_probability" });
  }

  if (!isStakes(d?.stakes)) errors.push({ field: "stakes", reason: "unknown_value" });

  const decidedMs = parseOffsetInstant(d?.decided_at);
  if (decidedMs === null) errors.push({ field: "decided_at", reason: "invalid_or_no_offset" });

  const dueMs = parseOffsetInstant(d?.review_due);
  if (dueMs === null) {
    errors.push({ field: "review_due", reason: "invalid_or_no_offset" });
  } else if (decidedMs !== null && dueMs <= decidedMs) {
    errors.push({ field: "review_due", reason: "not_after_decided_at" });
  }

  if (!isRecordOrigin(d?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * The verification floor this decision's stakes impose on its eventual
 * review. Total; falls back to the strictest tier for an unrecognised
 * stakes value rather than the most permissive one, so a malformed record
 * can never buy itself a weaker requirement.
 */
export function requiredTierFor(stakes: Stakes | string): VerificationTier {
  return isStakes(stakes) ? REQUIRED_TIER[stakes] : "independent";
}
