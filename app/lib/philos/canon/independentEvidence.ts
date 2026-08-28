/**
 * ONE RULE, ONE PLACE: when does a verification make an Effect into Evidence?
 *
 * The writer (`verifyEffectAction`) and the reader (`actionLifecycle`,
 * `daySession`) must never disagree about this. If the writer enforced
 * independence and the reader only checked "is a verification present," then
 * anything already in the store — or written by an older path — would count as
 * evidence forever. So both call THIS function, and neither restates the rule.
 *
 * Independence has three parts, all required:
 *   1. KIND — `verifier_type` is not `self`. A person confirming their own
 *      report is a claim repeated twice, not a claim checked once.
 *   2. IDENTITY — the verifier is a named person who is neither the subject
 *      the Effect is about nor the actor who performed the Action. Kind alone
 *      is a label; identity is the fact.
 *   3. AUTHORITY (canon §17) — an independent verifier may not declare a
 *      person's INTERNAL state settled without that person's consent. External
 *      and systemic facts are outside that rule and need no consent.
 *
 * A verification failing any part is not an error to be repaired. It is simply
 * not evidence, and the Effect stays an unverified claim.
 */
import type { Effect } from "./effect";
import { type OutcomeVerification, validateOutcomeVerification, type VerifierType } from "./outcomeVerification";
import type { VerificationRecord } from "./outcomeVerificationStore";

/** Every kind except `self`. Derived by exclusion so that adding a kind to
 *  canon's enum makes it independent by default rather than silently dropping
 *  it — a new kind of outside check is still an outside check. */
export function isIndependentKind(t: VerifierType): boolean {
  return t !== "self";
}

export type EvidenceRefusal =
  | "no_verification"
  | "invalid_verification"
  | "verifier_type_self_not_independent"
  | "verifier_id_missing"
  | "verifier_is_subject"
  | "verifier_is_actor"
  | "internal_state_needs_subject_consent";

export interface EvidenceCheckInput {
  verification: OutcomeVerification;
  /** The subject the Effect is ABOUT. */
  subject: string;
  /** The owner of the Action that caused the Effect, when it is known.
   *  `undefined` means the Action could not be resolved — the actor check is
   *  then reported as unmet rather than quietly passed. */
  actor: string | undefined;
  concerns_subject_internal_state: boolean;
}

export type EvidenceCheck =
  | { independent: true }
  | { independent: false; refusal: EvidenceRefusal };

/** The whole rule. Order is deliberate: structure, then kind, then identity,
 *  then authority — each answer is only meaningful once the previous holds. */
export function checkIndependentEvidence(input: EvidenceCheckInput): EvidenceCheck {
  const { verification: v, subject, actor, concerns_subject_internal_state } = input;

  if (!validateOutcomeVerification(v).valid) {
    return { independent: false, refusal: "invalid_verification" };
  }
  if (!isIndependentKind(v.verifier_type)) {
    return { independent: false, refusal: "verifier_type_self_not_independent" };
  }

  const verifier = typeof v.verifier_id === "string" ? v.verifier_id.trim() : "";
  if (verifier === "") {
    /* An unnamed verifier cannot be shown to be anyone other than the actor.
       Absence of a name is not evidence of independence. */
    return { independent: false, refusal: "verifier_id_missing" };
  }
  if (verifier === subject) {
    return { independent: false, refusal: "verifier_is_subject" };
  }
  /* An unresolved Action fails closed. We cannot show the verifier is not the
     actor, so we do not claim it. */
  if (actor === undefined || verifier === actor) {
    return { independent: false, refusal: "verifier_is_actor" };
  }

  if (concerns_subject_internal_state && v.subject_consent !== true) {
    return { independent: false, refusal: "internal_state_needs_subject_consent" };
  }

  return { independent: true };
}

/**
 * Reader-side convenience: given an Effect, its actor, and every verification
 * in the store, is this Effect independently verified Evidence?
 *
 * Deliberately ignores `effect.verified_outcome`. That field could historically
 * be written by the same form, in the same submission, by the same person who
 * reported the outcome — so it can attest to a claim but never to a check.
 * Evidence comes only from a separate verification record.
 */
export function findIndependentVerification(
  effect: Effect,
  actor: string | undefined,
  verifications: readonly VerificationRecord[],
): VerificationRecord | undefined {
  return verifications.find(
    (r) =>
      r.effect_id === effect.effect_id &&
      checkIndependentEvidence({
        verification: r.verification,
        subject: effect.subject,
        actor,
        concerns_subject_internal_state: effect.concerns_subject_internal_state,
      }).independent,
  );
}

/** The boolean form, for callers that only need the fact. */
export function isIndependentlyVerified(
  effect: Effect,
  actor: string | undefined,
  verifications: readonly VerificationRecord[],
): boolean {
  return findIndependentVerification(effect, actor, verifications) !== undefined;
}
