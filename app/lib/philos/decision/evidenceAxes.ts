/**
 * Philos — THE TWO AXES, kept apart on purpose.
 *
 * ## Why two
 *
 * "Someone checked that this happened" and "this happened because of what
 * you did" are different claims, and the first has never implied the second.
 * Collapsing them is the oldest error in this codebase's neighbourhood: an
 * independent verifier attests an OUTCOME, and a system that treats that
 * attestation as evidence of CAUSATION has silently upgraded a fact into an
 * explanation.
 *
 *   `OutcomeVerificationLevel` — how well established is it that the outcome
 *   occurred at all.
 *   `CausalRelation` — how well established is it that the decision is why.
 *
 * **Independent verification never raises `CausalRelation` by itself.**
 * `checkCausalRelation` computes a CEILING and returns `min(claimed,
 * ceiling)`. A stronger verification can only ever REMOVE a blocker; it can
 * never push a claim upward that the claimant did not make. This is enforced
 * by test, not just by intent — see `__tests__/evidenceAxes.test.ts`.
 *
 * ## Where each axis lives
 *
 * `OutcomeVerificationLevel` is NEVER STORED. It is derived, on read, from
 * the canon `Effect` and its `OutcomeVerification` — the records that already
 * hold this fact. Storing it on a review record as well is exactly the
 * parallel-model duplication this module exists to undo: two objects would
 * hold one semantic fact and could disagree.
 *
 * `CausalRelation` IS stored, on `DecisionReview`, because no canon record
 * has ever carried it. That is the one genuinely new fact in the decision
 * loop.
 */
import { isEffectVerified, type Effect } from "../canon/effect";
import type { VerifierType } from "../canon/outcomeVerification";

// ── AXIS 1 — did the outcome happen ───────────────────────────────────────

/** Weakest to strongest. Order is load-bearing: levels compare by index. */
export const OUTCOME_VERIFICATION = [
  "self_attested",
  "measured",
  "corroborated",
  "independently_verified",
] as const;
export type OutcomeVerificationLevel = (typeof OUTCOME_VERIFICATION)[number];

/**
 * The canon `VerifierType` → this axis. A total map, so a new verifier type
 * cannot silently fall through to a strong level.
 *
 *   `self`              — the decider's own say-so.
 *   `observed_measured` — an instrument or a record, not a person's opinion.
 *   `counterparty`      — the other side of the same interaction. Real
 *                         corroboration, but not disinterested.
 *   `third_party`       — someone with no stake, which is the only thing this
 *                         codebase has ever called independent.
 */
const BY_VERIFIER_TYPE: Readonly<Record<VerifierType, OutcomeVerificationLevel>> = {
  self: "self_attested",
  observed_measured: "measured",
  counterparty: "corroborated",
  third_party: "independently_verified",
};

/**
 * Derive the level from the canon records that already hold the fact.
 *
 * An Effect with no `verified_outcome` is `self_attested` — the claim exists
 * and nothing has checked it. An Effect whose verification exists but does
 * NOT pass `isEffectVerified` (canon's own gate: an unconsented third-party
 * check of an internal state, for instance) is capped at `corroborated`,
 * because something was recorded but canon refuses to call it verified.
 *
 * Pure, total, never throws.
 */
export function outcomeVerificationLevel(effect: Effect | undefined): OutcomeVerificationLevel {
  const v = effect?.verified_outcome;
  if (!effect || !v) return "self_attested";

  const level = BY_VERIFIER_TYPE[v.verifier_type];
  if (level === undefined) return "self_attested";

  /* CANON'S GATE WINS. `isEffectVerified` is the reader of record for
     whether a verification counts; disagreeing with it here would let this
     module present as independently verified something the rest of the
     system treats as unverified. */
  if (level === "independently_verified" && !isEffectVerified(effect)) {
    return "corroborated";
  }
  return level;
}

export function levelAtLeast(
  actual: OutcomeVerificationLevel,
  required: OutcomeVerificationLevel,
): boolean {
  const a = OUTCOME_VERIFICATION.indexOf(actual);
  const r = OUTCOME_VERIFICATION.indexOf(required);
  return a >= 0 && r >= 0 && a >= r;
}

// ── AXIS 2 — is the decision why ──────────────────────────────────────────

export const CAUSAL_RELATION = [
  "occurred_after",
  "associated_with",
  "probably_contributed",
  "causally_supported",
  "experimentally_demonstrated",
] as const;
export type CausalRelation = (typeof CAUSAL_RELATION)[number];

/** The rung a review gets for free. Chronology needs no permission. */
export const DEFAULT_CAUSAL_RELATION: CausalRelation = "occurred_after";

// ── RISK POLICY ───────────────────────────────────────────────────────────

/**
 * How much the case costs if the decision is wrong. Declared by the person,
 * never inferred from the text.
 */
export const RISK_LEVELS = ["low", "medium", "significant", "public"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * THE POLICY. The floor each risk level puts under the OUTCOME axis.
 *
 *   low         — self-attested is permitted, and is MARKED self-attested.
 *   medium      — a measurement or a record.
 *   significant — measured or corroborated (floor: measured).
 *   public      — public or irreversible claims need a disinterested checker.
 *
 * A malformed level falls back to the STRICTEST floor, so a broken record can
 * never buy itself a weaker requirement.
 */
export const REQUIRED_LEVEL: Readonly<Record<RiskLevel, OutcomeVerificationLevel>> = {
  low: "self_attested",
  medium: "measured",
  significant: "measured",
  public: "independently_verified",
};

const RISK_SET: ReadonlySet<string> = new Set(RISK_LEVELS);

export function isRiskLevel(v: unknown): v is RiskLevel {
  return typeof v === "string" && RISK_SET.has(v);
}

export function requiredLevelFor(risk: RiskLevel | string): OutcomeVerificationLevel {
  return isRiskLevel(risk) ? REQUIRED_LEVEL[risk] : "independently_verified";
}

export function meetsRiskFloor(
  level: OutcomeVerificationLevel,
  risk: RiskLevel | string,
): boolean {
  return levelAtLeast(level, requiredLevelFor(risk));
}

// ── THE CAUSAL GATE ───────────────────────────────────────────────────────

export type CausalCapReason =
  | "expectation_unresolved"
  | "outcome_below_risk_floor"
  | "no_alternative_explanations"
  | "no_comparison_basis";

export interface CausalRelationCheck {
  /** The strongest rung this evidence supports. */
  entitled: CausalRelation;
  /** What was claimed. */
  claimed: CausalRelation;
  /** True when `claimed` exceeded `entitled` and was brought down. */
  capped: boolean;
  reasons: CausalCapReason[];
}

function rung(c: CausalRelation): number {
  return CAUSAL_RELATION.indexOf(c);
}

const RELATION_SET: ReadonlySet<string> = new Set(CAUSAL_RELATION);

/**
 * Pure, total, never throws, never mutates its inputs.
 *
 * **This function can only ever lower a claim.** It returns
 * `min(claimed, ceiling)`. There is no input — including
 * `independently_verified` on the other axis — that makes the result stronger
 * than what the reviewer actually claimed. That is the separation of the two
 * axes, expressed as code rather than as a comment.
 *
 * The conditions, each a NECESSARY condition for the rung above it:
 *   `associated_with`            — the expectation was resolved at all.
 *   `probably_contributed`       — the outcome axis meets the risk floor.
 *   `causally_supported`         — at least one alternative explanation was
 *                                  recorded and considered. With nothing to
 *                                  rule out, "this is why" is unfalsifiable.
 *   `experimentally_demonstrated`— a named repetition or control.
 *
 * Never rejects: an over-claim is returned at the rung it earns, because
 * refusing would discard the reviewer's account entirely.
 */
export function checkCausalRelation(input: {
  claimed: CausalRelation;
  risk_level: RiskLevel | string;
  outcome_level: OutcomeVerificationLevel;
  expectation_resolved: boolean;
  alternative_explanations: readonly string[];
  comparison_basis?: string;
}): CausalRelationCheck {
  const {
    claimed,
    risk_level,
    outcome_level,
    expectation_resolved,
    alternative_explanations,
    comparison_basis,
  } = input;

  const meetsFloor = meetsRiskFloor(outcome_level, risk_level);
  const hasAlternatives =
    Array.isArray(alternative_explanations) &&
    alternative_explanations.some((a) => typeof a === "string" && a.trim() !== "");
  const hasComparison = typeof comparison_basis === "string" && comparison_basis.trim() !== "";

  const reasons: CausalCapReason[] = [];
  if (!expectation_resolved) reasons.push("expectation_unresolved");
  if (!meetsFloor) reasons.push("outcome_below_risk_floor");
  if (!hasAlternatives) reasons.push("no_alternative_explanations");
  if (!hasComparison) reasons.push("no_comparison_basis");

  let ceiling: CausalRelation = "occurred_after";
  if (expectation_resolved) ceiling = "associated_with";
  if (expectation_resolved && meetsFloor) ceiling = "probably_contributed";
  if (expectation_resolved && meetsFloor && hasAlternatives) ceiling = "causally_supported";
  if (expectation_resolved && meetsFloor && hasAlternatives && hasComparison) {
    ceiling = "experimentally_demonstrated";
  }

  const wanted = RELATION_SET.has(claimed) ? claimed : DEFAULT_CAUSAL_RELATION;
  /* MIN, never max. The ceiling can only pull a claim down. */
  const entitled = rung(wanted) <= rung(ceiling) ? wanted : ceiling;

  return {
    entitled,
    claimed: wanted,
    capped: rung(wanted) > rung(ceiling),
    reasons: reasons.filter((why) => bounds(why, wanted)),
  };
}

/** Which rungs each condition is a precondition for. */
function bounds(reason: CausalCapReason, wanted: CausalRelation): boolean {
  const w = rung(wanted);
  switch (reason) {
    case "expectation_unresolved":
      return w >= rung("associated_with");
    case "outcome_below_risk_floor":
      return w >= rung("probably_contributed");
    case "no_alternative_explanations":
      return w >= rung("causally_supported");
    case "no_comparison_basis":
      return w >= rung("experimentally_demonstrated");
  }
}
