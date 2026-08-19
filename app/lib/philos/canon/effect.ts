/**
 * Philos Canon — Effect (PHILOS-MELTING-POT-CANON.md §17).
 *
 * "Effect: measured change, `claimed_outcome` vs `verified_outcome`."
 * Fourth stage of the §24 pipeline: `... → Action (including Transfer) →
 * Effect → OutcomeVerification → Learning → State'`.
 *
 * **Field-list note, same honesty as `matching.ts`:** canon §17 does not
 * give Effect a full `Effect = { ... }` schema closure the way §6/§8/§11/
 * §12 do for Observation/Target/Offer/Need — it names only `claimed_outcome`
 * and `verified_outcome`, each shaped by `OutcomeVerification`
 * (`outcomeVerification.ts`). The surrounding record (`effect_id`,
 * `action_ref`, `subject`, `concerns_subject_internal_state`, `context`,
 * `time`, `provenance`) is this pass's own necessary construction to make
 * the stated hard rules mechanically checkable — clearly marked as such, not
 * presented as a canon quote.
 *
 * **Execution of an Action does NOT imply a successful Effect** — enforced
 * structurally: there is no automatic constructor here that takes an
 * `Action`/`Transfer` and produces an `Effect`. An `Effect` is only ever
 * built from its own explicit fields, including its own `claimed_outcome` —
 * nothing here reads `Action.consent === true` (or any Transfer field) and
 * infers success. See `__tests__/effect.test.ts`'s `ACTION_SUCCESS_NOT_
 * ASSUMED`.
 *
 * **Effect must reference its causal Action/Transfer**: `action_ref` is
 * required, non-empty — since `Transfer ⊂ Action` (`transfer.ts`), a
 * Transfer's own `action_id` (inherited from `Action`) is what `action_ref`
 * points at; no separate `transfer_ref` field is needed.
 *
 * **`claimed_outcome` ≠ `verified_outcome`**: `claimed_outcome` is required;
 * `verified_outcome` is optional and independent — never derived from
 * `claimed_outcome`, matching the exact discipline already established for
 * `transfer.ts`'s own (simpler, string-typed) claimed/verified fields.
 *
 * **A claimed outcome must never update `State'` as though verified, and
 * Effect does not mutate CellState by itself** (§17): no function in this
 * file writes to, mutates, or "resolves" any `CellState`. `isEffectVerified`
 * (below) only ever RETURNS a boolean judgment about verification
 * sufficiency — it has no side effect and nothing in this codebase consumes
 * its result to mutate state, because no such consumer exists yet (Learning
 * and State' mutation are explicitly out of scope this pass).
 *
 * **Verification of a subject's internal state requires subject/self
 * evidence or subject-consented verification** (§17): `concerns_subject_
 * internal_state: boolean` is a REQUIRED, explicit field on every Effect —
 * deliberately not auto-derived from a cell/domain heuristic canon does not
 * specify, so every Effect creator must consciously declare whether this
 * rule applies. `isEffectVerified` then applies canon's rule exactly: `self`
 * is always sufficient; any other `verifier_type` is sufficient only when
 * `concerns_subject_internal_state` is `false` (external/systemic facts,
 * outside the rule's stated scope) OR `subject_consent === true` on that
 * verification. A `third_party` verification of an internal-state claim
 * without `subject_consent` therefore can never, by itself, mark the Effect
 * verified — this is the concrete enforcement of "third_party cannot
 * unilaterally declare the subject fixed."
 *
 * **Verification does not itself perform Learning** — `isEffectVerified`
 * answers "is this verification sufficient," nothing more; no function here
 * is named or shaped like a Learning step (`State → State'`), and none
 * exists (out of scope, per instruction).
 *
 * **No permanent outcome profile**: this module provides no store, no "all
 * effects for a subject" aggregate, no persistence beyond one record with
 * its own `time`.
 *
 * Anti-ranking scope note (canon §21), matching every other file in this
 * directory: no scoring, ranking, or cross-frame/cross-subject aggregation
 * exists anywhere in this file.
 */
import { parseOffsetInstant } from "./observation";
import {
  type OutcomeVerification,
  type OutcomeVerificationError,
  validateOutcomeVerification,
} from "./outcomeVerification";

/** See module header for the provenance of this shape. */
export interface Effect {
  effect_id: string;
  /** References the causal Action/Transfer (Action.action_id / Transfer.action_id). */
  action_ref: string;
  subject: string;
  /** Explicit, required — never auto-derived. Gates the subject-consent rule below. */
  concerns_subject_internal_state: boolean;
  claimed_outcome: OutcomeVerification;
  /** Independent of claimed_outcome; absent = not yet verified. */
  verified_outcome?: OutcomeVerification;
  context: string;
  time: string;
  provenance: string;
  /**
   * OBSERVED-IN — the `canon_event_id` of the Observation in which this
   * Effect's outcome was actually recorded. The t1 half of the temporal
   * chain.
   *
   * **Why this field exists.** `Action.inputs` could already name the
   * Observation an Action came FROM (t0), and `CausalChainFlow` already
   * reads it that way. Nothing could express the other half: which
   * Observation recorded what happened AFTER. Without it, two real
   * observations could be compared but a change could never be attributed
   * to an Action, because no record said the second observation was the one
   * that observed this Effect. Ratified 2026-08-19 as the minimum addition
   * that closes that gap.
   *
   * **Why it lives on Effect and not on Observation.** An Observation is a
   * MEASUREMENT. Giving it a pointer at an Action would put a causal claim
   * inside a measurement record, and canon §6 already defines
   * `Observation.reference` as what the Level was measured against — a
   * baseline, not a record link. `Effect` is already the chain's linking
   * record (it carries `action_ref`), so the second link belongs here too.
   *
   * **Optional, and that is load-bearing.** Every Effect recorded before
   * this field existed stays structurally valid, and an Effect whose
   * outcome was never observed in a later Observation simply does not carry
   * it. Absent means "no observation recorded this outcome" — a real state,
   * never a default to fill in.
   *
   * **It does not license a change claim by itself.** It says which
   * Observation recorded the outcome. Whether the person's state changed
   * still needs the comparison to find a real difference, and the
   * Learning/State' boundary still governs whether that difference is a
   * state transition (`STATE-TRANSITION-BOUNDARY.md`).
   */
  observed_in_ref?: string;
}

export type EffectError =
  | { field: "effect_id"; reason: "empty" }
  | { field: "action_ref"; reason: "empty" }
  | { field: "subject"; reason: "empty" }
  | { field: "concerns_subject_internal_state"; reason: "not_a_boolean" }
  | { field: "claimed_outcome"; reason: "invalid"; errors: OutcomeVerificationError[] }
  | { field: "verified_outcome"; reason: "invalid"; errors: OutcomeVerificationError[] }
  | { field: "context"; reason: "empty" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "provenance"; reason: "empty" }
  | { field: "observed_in_ref"; reason: "empty" };

export interface ValidationResult {
  valid: boolean;
  errors: EffectError[];
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Pure, deterministic, structural validator only — does not decide whether
 * `verified_outcome` is SUFFICIENT authority (see `isEffectVerified`). Never
 * throws; all applicable checks run without short-circuiting.
 */
export function validateEffect(e: Effect): ValidationResult {
  const errors: EffectError[] = [];

  if (!nonEmpty(e.effect_id)) errors.push({ field: "effect_id", reason: "empty" });
  if (!nonEmpty(e.action_ref)) errors.push({ field: "action_ref", reason: "empty" });
  if (!nonEmpty(e.subject)) errors.push({ field: "subject", reason: "empty" });

  if (typeof e.concerns_subject_internal_state !== "boolean") {
    errors.push({ field: "concerns_subject_internal_state", reason: "not_a_boolean" });
  }

  // Guard before delegating: `claimed_outcome` is required, but a malformed
  // caller could omit it entirely (undefined) or pass a non-object — reading
  // .statement off `undefined` would throw, which "never crash" forbids.
  if (isObject(e.claimed_outcome)) {
    const claimedResult = validateOutcomeVerification(e.claimed_outcome);
    if (!claimedResult.valid) {
      errors.push({ field: "claimed_outcome", reason: "invalid", errors: claimedResult.errors });
    }
  } else {
    errors.push({ field: "claimed_outcome", reason: "invalid", errors: [] });
  }

  // Optional, but not free-form: present-and-empty is a caller bug, not
  // "no observation". Absent is the honest way to say there is none.
  if (e.observed_in_ref !== undefined && !nonEmpty(e.observed_in_ref)) {
    errors.push({ field: "observed_in_ref", reason: "empty" });
  }

  if (e.verified_outcome !== undefined) {
    if (isObject(e.verified_outcome)) {
      const verifiedResult = validateOutcomeVerification(e.verified_outcome);
      if (!verifiedResult.valid) {
        errors.push({
          field: "verified_outcome",
          reason: "invalid",
          errors: verifiedResult.errors,
        });
      }
    } else {
      errors.push({ field: "verified_outcome", reason: "invalid", errors: [] });
    }
  }

  if (!nonEmpty(e.context)) errors.push({ field: "context", reason: "empty" });

  const timeMs = parseOffsetInstant(e.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  if (!nonEmpty(e.provenance)) errors.push({ field: "provenance", reason: "empty" });

  return { valid: errors.length === 0, errors };
}

/**
 * canon §17's authority rule, applied exactly: `self` is always sufficient;
 * any other `verifier_type` is sufficient only when the Effect does not
 * concern the subject's internal state, or when `subject_consent === true`.
 * A missing `verified_outcome` is simply not verified — never an error, and
 * never treated as "verified as false." Pure: returns a judgment only, never
 * mutates `effect`, never touches any CellState, never performs Learning.
 */
export function isEffectVerified(effect: Effect): boolean {
  if (!effect.verified_outcome) return false;
  const v = effect.verified_outcome;
  if (v.verifier_type === "self") return true;
  if (!effect.concerns_subject_internal_state) return true;
  return v.subject_consent === true;
}
