/**
 * Philos — adapters for the v1 (commit `3d4dd87`) decision records.
 *
 * ## The rule: adapt what is there, never invent what is not
 *
 * A v1 `Decision` has no `case_id`, no `decision_logic`, no
 * `observation_refs` and no `chosen_action_ref`. A v1 `DecisionReview` has no
 * `effect_ref` and instead carries `what_happened`, `reviewer`,
 * `verification_tier` and `surprise` locally.
 *
 * None of those can be recovered by guessing. There is no rule that turns a
 * v1 review's `what_happened` into an `Effect`, because an Effect needs an
 * `action_ref` and v1 never recorded one — synthesising an Action to hang it
 * from would fabricate the very causal link this migration exists to stop
 * being fabricated.
 *
 * So the adapters are HONEST and PARTIAL. They report exactly what is
 * missing, per record, and produce a v2 record only when nothing has to be
 * invented. Everything else comes back as `needs_attention` with a reason
 * list a person can act on.
 *
 * ## Why nothing is written automatically
 *
 * `migrateDecisions` and `migrateReviews` are PURE. They return a plan; they
 * do not touch a store. Running a migration that silently rewrites an
 * append-only log would be the same class of error as an edit — the whole
 * point of the log is that what was written stays written. The v1 records
 * stay where they are; a v2 record is a NEW record, written by a person's
 * deliberate act with the missing pieces supplied.
 *
 * ## Current scope
 *
 * At the time of writing there are ZERO v1 records anywhere: `.philos-canon-data`
 * has no `decisions.jsonl` and no `decision-reviews.jsonl` (the v1 loop was
 * only ever exercised against in-memory stores). These adapters therefore
 * migrate nothing today. They exist because a v1 record COULD exist in any
 * other checkout of this repository, and a shape change with no adapter is
 * how a log becomes unreadable.
 */
import type { Decision } from "./decision";
import type { DecisionReview } from "./decisionReview";
import type { CausalRelation } from "./evidenceAxes";

// ── The v1 shapes, frozen here as the record of what they were ────────────

/** `Decision` exactly as commit `3d4dd87` wrote it. */
export interface DecisionV1 {
  decision_id: string;
  subject: string;
  statement: string;
  because: string;
  expected_outcome: string;
  alternatives_considered: readonly string[];
  confidence: number;
  /** v1 used `low | medium | significant | public` — same words as `RiskLevel`. */
  stakes: string;
  decided_at: string;
  /** RENAMED to `review_horizon` in v2. */
  review_due: string;
  record_origin: string;
}

/** `DecisionReview` exactly as commit `3d4dd87` wrote it. */
export interface DecisionReviewV1 {
  review_id: string;
  decision_ref: string;
  /** DUPLICATED `OutcomeVerification.verifier_id`. Dropped in v2. */
  reviewer: string;
  /** DUPLICATED `Effect.claimed_outcome.statement`. Dropped in v2. */
  what_happened: string;
  expectation_met: string;
  /** Learning content held off-spine. Dropped in v2. */
  surprise?: string;
  /** DUPLICATED `OutcomeVerification.verifier_type`. Dropped in v2. */
  verification_tier: string;
  outcome_verification_ref?: string;
  comparison_basis?: string;
  /** RENAMED to `causal_relation`, with renamed values. */
  causal_support: string;
  reviewed_at: string;
  reviewed_early: boolean;
  record_origin: string;
}

// ── Value renames that ARE mechanical ────────────────────────────────────

/**
 * v1 `CausalSupport` → v2 `CausalRelation`. A pure rename of the same five
 * rungs in the same order; no record changes rung, so this is safe to apply
 * without a person's judgement.
 */
export const CAUSAL_SUPPORT_V1_TO_V2: Readonly<Record<string, CausalRelation>> = {
  happened_after: "occurred_after",
  correlated: "associated_with",
  plausibly_contributed: "probably_contributed",
  causally_supported: "causally_supported",
  experimentally_shown: "experimentally_demonstrated",
};

/**
 * v1 `verification_tier` → the v2 OUTCOME axis. Note this is INFORMATIONAL
 * only: v2 does not store the level, it derives it from the canon Effect. The
 * map exists so a migration report can say what the v1 record claimed, not so
 * anything can write it back.
 */
export const TIER_V1_TO_LEVEL: Readonly<Record<string, string>> = {
  self_attested: "self_attested",
  measured: "measured",
  independent: "independently_verified",
};

// ── The plan ──────────────────────────────────────────────────────────────

export type MissingPiece =
  | "case_id"
  | "decision_logic"
  | "observation_refs"
  | "chosen_action"
  | "effect_ref"
  | "learning_for_surprise";

export interface MigrationEntry<TFrom, TTo> {
  from: TFrom;
  /** Present only when NOTHING had to be invented. */
  to?: TTo;
  /** What a person must supply before this record can become v2. */
  missing: MissingPiece[];
  /** Facts the v1 record held that v2 keeps on a canon record instead. */
  moves: { field: string; to: string; value: string }[];
}

export interface MigrationPlan<TFrom, TTo> {
  entries: MigrationEntry<TFrom, TTo>[];
  ready: number;
  needs_attention: number;
}

/**
 * Pure. Produces a plan; writes nothing.
 *
 * A v1 Decision can NEVER be adapted automatically: `case_id` and
 * `decision_logic` are required in v2 and neither is derivable. Every entry
 * comes back needing attention, which is the honest result — and the report
 * carries everything that IS recoverable so a person re-recording it does not
 * retype the parts that survived.
 */
export function migrateDecisions(v1: readonly DecisionV1[]): MigrationPlan<DecisionV1, Decision> {
  const entries = v1.map((from): MigrationEntry<DecisionV1, Decision> => {
    const missing: MissingPiece[] = ["case_id", "decision_logic"];
    if (!Array.isArray((from as unknown as Decision).observation_refs)) {
      missing.push("observation_refs");
    }
    missing.push("chosen_action");
    return { from, missing, moves: [] };
  });

  return {
    entries,
    ready: 0,
    needs_attention: entries.length,
  };
}

/**
 * Pure. Produces a plan; writes nothing.
 *
 * A v1 Review cannot be adapted either, and for a sharper reason: v2 requires
 * `effect_ref`, and creating that Effect requires an `action_ref` that v1
 * never held. The plan records where each duplicated v1 field BELONGS in v2,
 * so the person re-recording it knows the outcome text goes into the Effect
 * and the surprise into a Learning rather than being retyped into the review.
 */
export function migrateReviews(
  v1: readonly DecisionReviewV1[],
): MigrationPlan<DecisionReviewV1, DecisionReview> {
  const entries = v1.map((from): MigrationEntry<DecisionReviewV1, DecisionReview> => {
    const missing: MissingPiece[] = ["case_id", "effect_ref"];
    const moves: MigrationEntry<DecisionReviewV1, DecisionReview>["moves"] = [
      {
        field: "what_happened",
        to: "Effect.claimed_outcome.statement",
        value: from.what_happened,
      },
      { field: "reviewer", to: "OutcomeVerification.verifier_id", value: from.reviewer },
      {
        field: "verification_tier",
        to: "OutcomeVerification.verifier_type (level then DERIVED, never stored)",
        value: from.verification_tier,
      },
    ];
    if (typeof from.surprise === "string" && from.surprise.trim() !== "") {
      moves.push({ field: "surprise", to: "Learning.context", value: from.surprise });
      missing.push("learning_for_surprise");
    }
    return { from, missing, moves };
  });

  return { entries, ready: 0, needs_attention: entries.length };
}

/** A human-readable report. Used by the migration test and by any operator. */
export function describePlan(
  decisions: MigrationPlan<DecisionV1, Decision>,
  reviews: MigrationPlan<DecisionReviewV1, DecisionReview>,
): string {
  const out: string[] = [];
  out.push(
    `v1 decisions: ${decisions.entries.length} (ready ${decisions.ready}, need attention ${decisions.needs_attention})`,
  );
  out.push(
    `v1 reviews:   ${reviews.entries.length} (ready ${reviews.ready}, need attention ${reviews.needs_attention})`,
  );
  for (const e of reviews.entries) {
    for (const m of e.moves) {
      out.push(`  ${e.from.review_id}: ${m.field} → ${m.to}`);
    }
  }
  return out.join("\n");
}
