/**
 * Philos Canon — OutcomeVerification (PHILOS-MELTING-POT-CANON.md §17).
 *
 * "OutcomeVerification: `claimed_outcome` and `verified_outcome` each carry
 * `{ provenance, verifier_type ∈ {self, counterparty, third_party,
 * observed_measured}, confidence, time, method }`. A claimed outcome must
 * **never** update `State'` as though verified. Verification of a subject's
 * internal state requires subject/self evidence or subject-consented
 * verification."
 *
 * `verifier_type` note: canon's own literal enum token is `observed_measured`
 * (underscore, matching this directory's other closed vocabularies —
 * `DeficitType`, `Provenance`, etc.) — not "observed/measured." Kept
 * verbatim from canon's text, not the slash form.
 *
 * `statement` field note: canon's §17 field list — `{provenance,
 * verifier_type, confidence, time, method}` — describes the METADATA
 * attached to a claimed/verified outcome; it does not separately name a
 * field for the outcome's own content (what is actually being claimed or
 * verified). A record with only metadata and no content would be
 * meaningless, so `statement` is added here as the minimal, necessary
 * content field — the same kind of necessity-driven addition already made
 * elsewhere in this directory (e.g. Need's per-cell `systemicChannel`, not
 * spelled out in §12's own field list but required by §18's separate rule).
 *
 * `subject_consent` field note: canon states the rule ("subject/self
 * evidence or subject-consented verification") but its own §17 field list
 * does not name a consent field. This one is added, optional, because the
 * rule cannot be mechanically checked without SOME field carrying that fact.
 * It is checked in `effect.ts` (which has the context — whether an Effect
 * concerns a subject's internal state — that this record alone does not),
 * not enforced here as a blanket requirement, since canon's rule is scoped
 * to internal-state verification specifically, not every verification.
 *
 * This module defines no store, no aggregation, no scoring — a single
 * verification record and its structural validator only (canon §21
 * anti-ranking scope note, matching every other file in this directory).
 */
import { parseOffsetInstant } from "./observation";

export type VerifierType = "self" | "counterparty" | "third_party" | "observed_measured";

/** canon §17 (metadata fields) + `statement` (content) + `subject_consent`
 *  (necessary addition — see module header). */
export interface OutcomeVerification {
  /** What is being claimed or verified — the content, not the metadata. */
  statement: string;
  provenance: string;
  verifier_type: VerifierType;
  confidence: number;
  time: string;
  method: string;
  /** Present + `true` iff the subject explicitly consented to THIS
   *  verification act. Only load-bearing when the parent Effect concerns
   *  the subject's own internal state and `verifier_type !== "self"` — see
   *  `effect.ts::isEffectVerified`. */
  subject_consent?: boolean;
}

export type OutcomeVerificationError =
  | { field: "statement"; reason: "empty" }
  | { field: "provenance"; reason: "empty" }
  | { field: "verifier_type"; reason: "invalid" }
  | { field: "confidence"; reason: "not_a_probability" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "method"; reason: "empty" }
  | { field: "subject_consent"; reason: "not_a_boolean_if_present" };

export interface ValidationResult {
  valid: boolean;
  errors: OutcomeVerificationError[];
}

const VERIFIER_TYPES: VerifierType[] = ["self", "counterparty", "third_party", "observed_measured"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic, structural validator only — does not decide whether a
 * verification is SUFFICIENT authority for a subject-internal-state claim
 * (that needs Effect-level context and lives in `effect.ts`). Never throws;
 * all applicable checks run without short-circuiting.
 */
export function validateOutcomeVerification(v: OutcomeVerification): ValidationResult {
  const errors: OutcomeVerificationError[] = [];

  if (!nonEmpty(v.statement)) errors.push({ field: "statement", reason: "empty" });
  if (!nonEmpty(v.provenance)) errors.push({ field: "provenance", reason: "empty" });

  if (!VERIFIER_TYPES.includes(v.verifier_type)) {
    errors.push({ field: "verifier_type", reason: "invalid" });
  }

  if (
    typeof v.confidence !== "number" ||
    !Number.isFinite(v.confidence) ||
    v.confidence < 0 ||
    v.confidence > 1
  ) {
    errors.push({ field: "confidence", reason: "not_a_probability" });
  }

  const timeMs = parseOffsetInstant(v.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  if (!nonEmpty(v.method)) errors.push({ field: "method", reason: "empty" });

  if (v.subject_consent !== undefined && typeof v.subject_consent !== "boolean") {
    errors.push({ field: "subject_consent", reason: "not_a_boolean_if_present" });
  }

  return { valid: errors.length === 0, errors };
}
