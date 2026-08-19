/**
 * Philos Canon — Target (PHILOS-MELTING-POT-CANON.md §8).
 *
 * "Tension is not derivable without an explicit reference object."
 * `Target = { target_id, subject, cell, desired_state, reference_type ∈
 * {self_goal | norm | peer | threshold}, provenance, consent_status, context,
 * time, expiry }`.
 *
 * **`Observation.reference` ≠ `Target`** (§8, locked). `Observation.reference`
 * is what a `Level` is measured against — it lives on `Observation` (§6,
 * `observation.ts`) and answers "relative to what did we read this level."
 * `Target` is the desired/normative state used to derive Tension — a different
 * entity with a different shape (`desired_state` + `reference_type`, not a bare
 * `reference` string). This module does not import, extend, or structurally
 * alias `Observation` — the two types share zero fields, by design (see
 * `__tests__/target.test.ts`'s `TARGET_DISTINCT_FROM_OBSERVATION_REFERENCE`).
 *
 * "A Target whose source is `norm/peer` (not self-endorsed) is flagged
 * external and cannot trigger automatic intervention." — enforced below by
 * `isExternalTarget`/`canTriggerAutomaticIntervention`, reading only
 * `reference_type`, exactly as canon states it. No additional gate (e.g.
 * combining with `consent_status`) is added — canon's sentence names only
 * `reference_type` as the deciding factor, so this module adds only that.
 *
 * **Target is not identity** (canon §25 type boundary, `Person ≠ ... ≠
 * Target`... — Target is not explicitly listed in §25's boundary sentence, but
 * the same discipline applies by the general rule of §25: no schema-closure
 * entity is a person). This module provides no store, no "all of a subject's
 * targets" aggregate, no persistence beyond one record with its own
 * `time`/`expiry`.
 *
 * SystemicChannel note (canon §18): "Any S-cell reference used by Tension,
 * Matching, Need, Offer, Action, or Transfer must identify its
 * SystemicChannel." **Target is not named in that list.** This module
 * therefore does NOT require a SystemicChannel on an S-frame Target cell —
 * doing so would not be preserving an existing canon/runtime requirement, it
 * would be inventing a new one canon never states. If a future canon revision
 * adds Target to that list, this file needs its own explicitly-approved
 * revision; it is not assumed here.
 *
 * Anti-ranking scope note (canon §21), matching every other file in this
 * directory: no scoring, ranking, or cross-subject/cross-frame aggregation is
 * defined here.
 */
import { type Domain, type Frame, parseOffsetInstant } from "./observation";

export type ReferenceType = "self_goal" | "norm" | "peer" | "threshold";

/** canon §8. */
export interface Target {
  target_id: string;
  subject: string;
  cell: { domain: Domain; frame: Frame };
  desired_state: string;
  reference_type: ReferenceType;
  /**
   * canon lists `provenance` as a required Target field but gives it no closed
   * vocabulary (contrast Need's `provenance ∈ {self_reported, endorsed}`,
   * which canon DOES enumerate). Left as an unconstrained non-empty string —
   * inventing an enum canon never specified would be exactly the kind of
   * unsupported semantic addition this pass must avoid.
   */
  provenance: string;
  /** Same reasoning as `provenance`: canon requires the field, states no
   * enum for it. Unconstrained non-empty string. */
  consent_status: string;
  context: string;
  time: string;
  expiry: string;
}

export type TargetError =
  | { field: "target_id"; reason: "empty" }
  | { field: "subject"; reason: "empty" }
  | { field: "cell"; reason: "invalid" }
  | { field: "desired_state"; reason: "empty" }
  | { field: "reference_type"; reason: "invalid" }
  | { field: "provenance"; reason: "empty" }
  | { field: "consent_status"; reason: "empty" }
  | { field: "context"; reason: "empty" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "expiry"; reason: "invalid_or_no_offset" }
  | { field: "expiry"; reason: "not_after_time" };

export interface ValidationResult {
  valid: boolean;
  errors: TargetError[];
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];
const REFERENCE_TYPES: ReferenceType[] = ["self_goal", "norm", "peer", "threshold"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic validator. No I/O, never throws, all applicable checks
 * run without short-circuiting — same discipline as the rest of this directory.
 */
export function validateTarget(t: Target): ValidationResult {
  const errors: TargetError[] = [];

  if (!nonEmpty(t.target_id)) errors.push({ field: "target_id", reason: "empty" });
  if (!nonEmpty(t.subject)) errors.push({ field: "subject", reason: "empty" });

  if (!t.cell || !DOMAINS.includes(t.cell.domain) || !FRAMES.includes(t.cell.frame)) {
    errors.push({ field: "cell", reason: "invalid" });
  }

  if (!nonEmpty(t.desired_state)) {
    errors.push({ field: "desired_state", reason: "empty" });
  }

  if (!REFERENCE_TYPES.includes(t.reference_type)) {
    errors.push({ field: "reference_type", reason: "invalid" });
  }

  if (!nonEmpty(t.provenance)) errors.push({ field: "provenance", reason: "empty" });
  if (!nonEmpty(t.consent_status)) {
    errors.push({ field: "consent_status", reason: "empty" });
  }
  if (!nonEmpty(t.context)) errors.push({ field: "context", reason: "empty" });

  const timeMs = parseOffsetInstant(t.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  const expiryMs = parseOffsetInstant(t.expiry);
  if (expiryMs === null) {
    errors.push({ field: "expiry", reason: "invalid_or_no_offset" });
  } else if (timeMs !== null && expiryMs <= timeMs) {
    errors.push({ field: "expiry", reason: "not_after_time" });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * canon §8: "A Target whose source is norm/peer (not self-endorsed) is
 * flagged external." Reads only `reference_type`, exactly as canon states.
 */
export function isExternalTarget(t: Target): boolean {
  return t.reference_type === "norm" || t.reference_type === "peer";
}

/**
 * canon §8: an external Target "cannot trigger automatic intervention." The
 * direct negation of `isExternalTarget` — no additional condition is added.
 */
export function canTriggerAutomaticIntervention(t: Target): boolean {
  return !isExternalTarget(t);
}
