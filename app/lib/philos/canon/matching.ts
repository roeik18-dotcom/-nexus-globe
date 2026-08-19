/**
 * Philos Canon — Matching (PHILOS-MELTING-POT-CANON.md §10, boolean gate).
 *
 * "Matching is boolean eligibility, not an optimizer:
 * `Permitted(edge) ⇔ CAN ∧ WANTS ∧ ALLOWED ∧ APPROPRIATE ∧ AVAILABLE ∧
 * CONSENT`. Consent, rights, appropriateness, and safety are **hard gates**
 * and must never be encoded as soft optimizer costs. Output = permitted
 * edges. **Matching ≠ Flow**: Matching answers "may and should these be
 * connected?"; Flow answers "how much, from where, to where, at what cost,
 * when?" — and runs only AFTER an edge is permitted."
 *
 * **Provenance-of-shape note, stated plainly because it differs from every
 * other file in this directory:** unlike Observation (§6), Need (§12),
 * Target (§8), and Offer (§11), canon §10 does **not** give Matching its own
 * `Matching = { ... }` schema closure — it defines only the boolean rule
 * quoted above verbatim. The `MatchAttempt`/`MatchResult` record shapes below
 * (match_id, need_ref, offer_ref, decision, rejection_reasons, etc.) are this
 * task's own explicit specification for a runtime representation of one
 * evaluated match attempt — not a canon quote. The RULE is canon-cited; the
 * surrounding record is this pass's synthesis, clearly marked as such so a
 * future reader never mistakes it for locked schema.
 *
 * **Matching ⇏ Transfer, ⇏ Action, ⇏ amount allocation** — enforced by
 * absence: this file exports no function that produces a Transfer, an
 * Action, or any resource quantity. Matching's only output is a boolean
 * decision + why (`MatchResult`). "Matching ≠ Flow" (§10) — Flow (how much,
 * at what cost) is explicitly out of scope for this pass and this file.
 *
 * **Need is sovereign; Offer does not auto-create a match** (§12, §11):
 * `evaluateMatch` takes a pre-existing, already-validated `Need` and `Offer`
 * as required parameters — it has no path to fabricate either. Referential
 * integrity is checked (`need_ref === need.need_id`,
 * `offer_ref === offer.offer_id`) so a match can never silently substitute a
 * different Need/Offer than the one it claims to evaluate.
 *
 * **Expiry invalidates Matching** (this pass's explicit hard invariant,
 * consistent with — though not a verbatim quote of — canon's general expiry
 * discipline for every schema-closure entity, §6/§8/§11/§12/§21): if either
 * the referenced `Need` or `Offer` has expired as of the match attempt's
 * `time`, the match is rejected regardless of the six gates. An unparseable
 * expiry is treated as already-expired — fail closed, never assume
 * unexpired.
 *
 * **All six gates are hard, equally-weighted, and un-overridable** — pure
 * boolean AND, no numeric weighting, no threshold, no partial credit. A
 * single `false` gate rejects the match no matter how many of the other five
 * are `true`. A **missing** (non-boolean) gate is never assumed `true`: it
 * makes the attempt structurally `invalid`, a decision distinct from
 * `not_permitted` (a structurally complete attempt where the formula itself
 * evaluates false).
 *
 * SystemicChannel note (canon §18): "Any S-cell reference used by Tension,
 * Matching, Need, Offer, Action, or Transfer must identify its
 * SystemicChannel." Matching IS named — `systemic_channel_if_S` (Offer's
 * literal field-name convention, reused here for the same reason) is
 * required when `cell.frame === "S"`.
 *
 * Anti-ranking scope note (canon §21), matching every other file in this
 * directory: no scoring, ranking, cumulative-contribution counter, or
 * cross-frame/cross-subject aggregation exists anywhere in this file.
 */
import {
  type Domain,
  type Frame,
  parseOffsetInstant,
  type SystemicChannel,
  SYSTEMIC_CHANNELS,
} from "./observation";
import type { Need } from "./need";
import type { Offer } from "./offer";

/**
 * One evaluated match attempt's inputs. See module header: this shape is
 * this task's own specification, not a canon schema closure.
 */
export interface MatchAttempt {
  match_id: string;
  need_ref: string;
  offer_ref: string;
  source: string;
  target: string;
  cell: { domain: Domain; frame: Frame };
  /** Required iff cell.frame === "S" (canon §18; Matching is named). */
  systemic_channel_if_S?: SystemicChannel;
  CAN: boolean;
  WANTS: boolean;
  ALLOWED: boolean;
  APPROPRIATE: boolean;
  AVAILABLE: boolean;
  CONSENT: boolean;
  context: string;
  time: string;
}

export type MatchAttemptError =
  | { field: "match_id"; reason: "empty" }
  | { field: "need_ref"; reason: "empty" }
  | { field: "offer_ref"; reason: "empty" }
  | { field: "source"; reason: "empty" }
  | { field: "target"; reason: "empty" }
  | { field: "cell"; reason: "invalid" }
  | { field: "systemic_channel_if_S"; reason: "required_when_frame_is_S" }
  | { field: "systemic_channel_if_S"; reason: "invalid" }
  | { field: GateName; reason: "not_a_boolean" }
  | { field: "context"; reason: "empty" }
  | { field: "time"; reason: "invalid_or_no_offset" };

export interface ValidationResult {
  valid: boolean;
  errors: MatchAttemptError[];
}

type GateName = "CAN" | "WANTS" | "ALLOWED" | "APPROPRIATE" | "AVAILABLE" | "CONSENT";
const GATE_NAMES: GateName[] = ["CAN", "WANTS", "ALLOWED", "APPROPRIATE", "AVAILABLE", "CONSENT"];

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Structural validation only — does not evaluate the boolean formula, does
 * not check Need/Offer expiry or referential match (that is `evaluateMatch`'s
 * job, which calls this first). A gate that is missing or not a real boolean
 * is an ERROR here — never silently coerced to `true` or `false`.
 */
export function validateMatchAttempt(a: MatchAttempt): ValidationResult {
  const errors: MatchAttemptError[] = [];

  if (!nonEmpty(a.match_id)) errors.push({ field: "match_id", reason: "empty" });
  if (!nonEmpty(a.need_ref)) errors.push({ field: "need_ref", reason: "empty" });
  if (!nonEmpty(a.offer_ref)) errors.push({ field: "offer_ref", reason: "empty" });
  if (!nonEmpty(a.source)) errors.push({ field: "source", reason: "empty" });
  if (!nonEmpty(a.target)) errors.push({ field: "target", reason: "empty" });

  const cellOk = !!a.cell && DOMAINS.includes(a.cell.domain) && FRAMES.includes(a.cell.frame);
  if (!cellOk) errors.push({ field: "cell", reason: "invalid" });

  if (cellOk && a.cell.frame === "S") {
    if (
      a.systemic_channel_if_S === undefined ||
      !SYSTEMIC_CHANNELS.includes(a.systemic_channel_if_S)
    ) {
      errors.push({ field: "systemic_channel_if_S", reason: "required_when_frame_is_S" });
    }
  } else if (
    a.systemic_channel_if_S !== undefined &&
    !SYSTEMIC_CHANNELS.includes(a.systemic_channel_if_S)
  ) {
    errors.push({ field: "systemic_channel_if_S", reason: "invalid" });
  }

  for (const gate of GATE_NAMES) {
    if (typeof a[gate] !== "boolean") {
      errors.push({ field: gate, reason: "not_a_boolean" });
    }
  }

  if (!nonEmpty(a.context)) errors.push({ field: "context", reason: "empty" });

  const timeMs = parseOffsetInstant(a.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  return { valid: errors.length === 0, errors };
}

export type MatchDecision = "permitted" | "not_permitted" | "invalid";

export type RejectionReason =
  | "attempt_malformed"
  | "need_ref_mismatch"
  | "offer_ref_mismatch"
  | "need_expired"
  | "offer_expired"
  | "CAN_false"
  | "WANTS_false"
  | "ALLOWED_false"
  | "APPROPRIATE_false"
  | "AVAILABLE_false"
  | "CONSENT_false";

/** Output only — "Output = permitted edges" (§10). Never a resource amount, a
 *  Transfer, or an Action. */
export interface MatchResult {
  match_id: string;
  decision: MatchDecision;
  rejection_reasons: RejectionReason[];
}

/**
 * `Permitted(edge) ⇔ CAN ∧ WANTS ∧ ALLOWED ∧ APPROPRIATE ∧ AVAILABLE ∧
 * CONSENT` (§10), plus this pass's expiry invariant. Pure and deterministic:
 * same inputs, same output; no I/O; never throws. `need`/`offer` are
 * required parameters — this function cannot be called without a real,
 * pre-existing Need and Offer, structurally preventing it from fabricating
 * either.
 */
export function evaluateMatch(attempt: MatchAttempt, need: Need, offer: Offer): MatchResult {
  const structural = validateMatchAttempt(attempt);
  if (!structural.valid) {
    return {
      match_id: nonEmpty(attempt?.match_id) ? attempt.match_id : "",
      decision: "invalid",
      rejection_reasons: ["attempt_malformed"],
    };
  }

  const reasons: RejectionReason[] = [];

  if (attempt.need_ref !== need.need_id) reasons.push("need_ref_mismatch");
  if (attempt.offer_ref !== offer.offer_id) reasons.push("offer_ref_mismatch");

  // structural.valid guarantees attempt.time parses; non-null assertion is safe here.
  const timeMs = parseOffsetInstant(attempt.time) as number;
  const needExpiryMs = parseOffsetInstant(need.expiry);
  const offerExpiryMs = parseOffsetInstant(offer.expiry);
  // Fail closed: an unparseable expiry is treated as already-expired, never
  // as unexpired.
  if (needExpiryMs === null || needExpiryMs <= timeMs) reasons.push("need_expired");
  if (offerExpiryMs === null || offerExpiryMs <= timeMs) reasons.push("offer_expired");

  if (!attempt.CAN) reasons.push("CAN_false");
  if (!attempt.WANTS) reasons.push("WANTS_false");
  if (!attempt.ALLOWED) reasons.push("ALLOWED_false");
  if (!attempt.APPROPRIATE) reasons.push("APPROPRIATE_false");
  if (!attempt.AVAILABLE) reasons.push("AVAILABLE_false");
  if (!attempt.CONSENT) reasons.push("CONSENT_false");

  return {
    match_id: attempt.match_id,
    decision: reasons.length === 0 ? "permitted" : "not_permitted",
    rejection_reasons: reasons,
  };
}
