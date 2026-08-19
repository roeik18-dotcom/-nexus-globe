/**
 * Philos Canon — Learning & the State' boundary (PHILOS-MELTING-POT-CANON.md
 * §17, §24, §26).
 *
 * "Learning: cross-cutting `State → State'`; home of the empirical question
 * 'did this raise future stability/capacity, or merely patch a symptom?' (an
 * assumption to measure, not assert)." Last stage of the §24 pipeline:
 * `... → Effect → OutcomeVerification → Learning → State'`.
 *
 * **This is the tersest schema closure in the whole canon** — one sentence,
 * no field list at all (contrast §6/§8/§11/§12's full closures, or even
 * §17's own Effect/OutcomeVerification sentence, which at least names a
 * shape). Every field on `Learning` below is this pass's own necessary
 * construction from the mission's explicit field list, not a canon quote —
 * stated plainly, matching the same honesty already applied to `matching.ts`
 * and `effect.ts` where canon under-specifies.
 *
 * **The central design decision, stated up front:** canon explicitly frames
 * "receiving support raises future stability/capacity" as an **open
 * empirical assumption to measure, not assert** (§26, item 1). Any function
 * that computed a NEW `Level`/`Stability` number from verified evidence via
 * some formula would have to encode a regeneration/update premise —
 * exactly the assumption canon says must remain unasserted. **This module
 * therefore never computes a candidate `State'` — it only GATES one.**
 * `deriveLearning` takes a `candidateStatePrime` as an input (proposed by
 * the caller, from reasoning entirely outside this module's scope) and
 * decides only whether canon's stated preconditions (verified evidence,
 * matching cell identity, no expired/mismatched evidence) permit that
 * candidate to be returned as `state_prime`, or force `no_update`. This is
 * the same "gate, don't compute" shape already used for `matching.ts`'s
 * `evaluateMatch` (which gates six caller-supplied booleans, never derives
 * them) — applied here to the same purpose: keep the empirical formula
 * un-invented while still making the boundary mechanically real.
 *
 * **`claimed-only cannot generate State'`, `unverified Effect cannot mutate
 * State`, `verification alone does not automatically imply a state
 * change`**: `deriveLearning` checks, in order: the `effect_ref` actually
 * matches the supplied `Effect` (no silent substitution); `effect.
 * verified_outcome` exists at all (its absence → `"claimed_only"`); the
 * verification is AUTHORITATIVE per `effect.ts::isEffectVerified` (present
 * but insufficient, e.g. unconsented third-party on an internal-state claim
 * → `"unverified_effect"`); the verification's own `confidence` is not the
 * literal zero-floor of its already-established `[0,1]` scale (→
 * `"insufficient_evidence"` — a boundary check, not an invented cutoff, see
 * below); the verification's `time` is not after this Learning event's own
 * `time` (→ `"evidence_expired_or_irrelevant"` — a temporal-ordering check;
 * see the note on staleness below); and the candidate's `(domain, frame)`
 * matches the prior state's exactly (→ `"cell_identity_mismatch"`). Only if
 * every gate passes does `result.kind` become `"state_prime"`.
 *
 * **On the `"insufficient_evidence"` threshold — not invented:** canon gives
 * no numeric confidence cutoff anywhere. Rather than picking an arbitrary
 * number (0.5? 0.7?), this module uses the one boundary that requires no
 * invention: `confidence === 0` is insufficient by the literal definition of
 * a `[0,1]` scale, not by a chosen threshold. Any confidence `> 0` passes
 * this specific gate — a deliberately narrow, defensible check, not a
 * disguised optimizer.
 *
 * **On "expired/irrelevant evidence" — not a fabricated TTL:** `CellState`
 * (`cellState.ts`) carries no timestamp of its own (by its own earlier,
 * canon-literal design — §4's definition is exactly `(Level, Stability)`),
 * so there is no canon-cited or type-available way to check "how long ago"
 * a prior state was recorded. This module does **not** invent a staleness
 * window/TTL duration to fill that gap. What it DOES check, mechanically and
 * without invention, is temporal ORDERING: the verification's own `time`
 * must not be after the Learning event's `time` — a verification cannot
 * justify an update it chronologically follows. `"irrelevant"` in the
 * stricter sense (an effect_ref that doesn't match) is a separate, distinct
 * reason (`"effect_ref_mismatch"`), not conflated with staleness.
 *
 * **State' identity boundary** ("preserve cell/frame/SystemicChannel
 * identity exactly," "update only the addressed state coordinate," "no
 * silent mutation of unrelated cells," "no implicit multi-cell
 * propagation," "State' must remain a CellState(Level, Stability), not gain
 * new hidden fields"): `candidateStatePrime` is typed exactly `CellState`
 * (`cellState.ts`'s own type, re-exported, not re-declared) — it cannot
 * structurally carry any field beyond `domain, frame, level, stability`.
 * `deriveLearning` rejects any candidate whose `domain`/`frame` differs from
 * the prior state's, and — when the cell's `frame === "S"` — rejects a
 * mismatched `priorSystemicChannel`/`candidateSystemicChannel` pair (`
 * CellState` itself carries no SystemicChannel field, matching every other
 * file in this directory's treatment: the channel travels alongside a cell
 * reference as a sibling parameter, never embedded in `CellState`). There is
 * no mechanism here that touches any cell other than the one addressed —
 * `deriveLearning` never receives, and could not iterate over, "all of a
 * subject's cells."
 *
 * **Longitudinal trend ≠ a single update event**: this module represents
 * exactly one `Learning` record per call — no store, no history, no trend
 * inference across multiple `Learning` events. Building that is separate,
 * future, explicitly out-of-scope work (enforced by absence, see
 * `__tests__/learning.test.ts`).
 *
 * Anti-ranking / anti-optimizer scope note (canon §21), matching every other
 * file in this directory: no scoring, ranking, cumulative-contribution
 * counter, permanent person profile, or cross-frame/cross-subject
 * aggregation exists anywhere in this file.
 */
import { type CellState, validateCellState } from "./cellState";
import type { Effect } from "./effect";
import { isEffectVerified } from "./effect";
import {
  type Domain,
  type Frame,
  parseOffsetInstant,
  type SystemicChannel,
  SYSTEMIC_CHANNELS,
} from "./observation";

export type NoUpdateReason =
  | "effect_ref_mismatch"
  | "claimed_only"
  | "unverified_effect"
  | "insufficient_evidence"
  | "evidence_expired_or_irrelevant"
  | "cell_identity_mismatch";

export type LearningResult =
  | { kind: "state_prime"; candidate_state_prime: CellState }
  | { kind: "no_update"; reason: NoUpdateReason };

/** See module header for the provenance of this shape — this pass's own
 *  necessary construction, canon gives no field list for Learning. */
export interface Learning {
  learning_id: string;
  prior_state_ref: string;
  effect_ref: string;
  outcome_verification_ref: string;
  update_method: string;
  provenance: string;
  confidence: number;
  time: string;
  context: string;
  result: LearningResult;
}

export type LearningError =
  | { field: "learning_id"; reason: "empty" }
  | { field: "prior_state_ref"; reason: "empty" }
  | { field: "effect_ref"; reason: "empty" }
  | { field: "outcome_verification_ref"; reason: "empty" }
  | { field: "update_method"; reason: "empty" }
  | { field: "provenance"; reason: "empty" }
  | { field: "confidence"; reason: "not_a_probability" }
  | { field: "time"; reason: "invalid_or_no_offset" }
  | { field: "context"; reason: "empty" }
  | { field: "result"; reason: "invalid_kind" }
  | { field: "result.candidate_state_prime"; reason: "invalid_cell_state" }
  | { field: "result.reason"; reason: "invalid" };

export interface ValidationResult {
  valid: boolean;
  errors: LearningError[];
}

const NO_UPDATE_REASONS: NoUpdateReason[] = [
  "effect_ref_mismatch",
  "claimed_only",
  "unverified_effect",
  "insufficient_evidence",
  "evidence_expired_or_irrelevant",
  "cell_identity_mismatch",
];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/**
 * Pure, deterministic, structural validator. Never throws; all applicable
 * checks run without short-circuiting.
 */
export function validateLearning(l: Learning): ValidationResult {
  const errors: LearningError[] = [];

  if (!nonEmpty(l.learning_id)) errors.push({ field: "learning_id", reason: "empty" });
  if (!nonEmpty(l.prior_state_ref)) {
    errors.push({ field: "prior_state_ref", reason: "empty" });
  }
  if (!nonEmpty(l.effect_ref)) errors.push({ field: "effect_ref", reason: "empty" });
  if (!nonEmpty(l.outcome_verification_ref)) {
    errors.push({ field: "outcome_verification_ref", reason: "empty" });
  }
  if (!nonEmpty(l.update_method)) errors.push({ field: "update_method", reason: "empty" });
  if (!nonEmpty(l.provenance)) errors.push({ field: "provenance", reason: "empty" });

  if (
    typeof l.confidence !== "number" ||
    !Number.isFinite(l.confidence) ||
    l.confidence < 0 ||
    l.confidence > 1
  ) {
    errors.push({ field: "confidence", reason: "not_a_probability" });
  }

  const timeMs = parseOffsetInstant(l.time);
  if (timeMs === null) errors.push({ field: "time", reason: "invalid_or_no_offset" });

  if (!nonEmpty(l.context)) errors.push({ field: "context", reason: "empty" });

  if (!l.result || (l.result.kind !== "state_prime" && l.result.kind !== "no_update")) {
    errors.push({ field: "result", reason: "invalid_kind" });
  } else if (l.result.kind === "state_prime") {
    const csResult = validateCellState(l.result.candidate_state_prime);
    if (!csResult.valid) {
      errors.push({ field: "result.candidate_state_prime", reason: "invalid_cell_state" });
    }
  } else if (l.result.kind === "no_update") {
    if (!NO_UPDATE_REASONS.includes(l.result.reason)) {
      errors.push({ field: "result.reason", reason: "invalid" });
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface DeriveLearningParams {
  learning_id: string;
  prior_state_ref: string;
  outcome_verification_ref: string;
  update_method: string;
  provenance: string;
  confidence: number;
  time: string;
  context: string;
  /** effect_ref as declared by the caller — checked against `effect.effect_id`. */
  effect_ref: string;
  /** The real, pre-existing Effect being learned from — required, not fabricated. */
  effect: Effect;
  /** The real, pre-existing prior CellState — required, not fabricated. */
  priorState: CellState;
  /** Required iff priorState.frame === "S" (canon §18's channel-identity discipline, applied here to state continuity rather than a new cell reference). */
  priorSystemicChannel?: SystemicChannel;
  /** The caller's proposed new state — NEVER computed by this module. See module header. */
  candidateStatePrime: CellState;
  /** Required iff candidateStatePrime.frame === "S"; must equal priorSystemicChannel. */
  candidateSystemicChannel?: SystemicChannel;
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];

function channelOk(frame: Frame, channel: SystemicChannel | undefined): boolean {
  if (frame !== "S") return true; // not required outside S — same asymmetric-permit pattern used throughout this directory
  return channel !== undefined && SYSTEMIC_CHANNELS.includes(channel);
}

/**
 * The State' boundary. Pure and deterministic: same inputs, same output; no
 * I/O; never throws; never mutates any of its inputs. Always returns a full
 * `Learning` record — the gating outcome lives in `result`, never as an
 * exception. See module header for the exact gate order and reasoning.
 */
export function deriveLearning(params: DeriveLearningParams): Learning {
  const {
    learning_id,
    prior_state_ref,
    outcome_verification_ref,
    update_method,
    provenance,
    confidence,
    time,
    context,
    effect_ref,
    effect,
    priorState,
    priorSystemicChannel,
    candidateStatePrime,
    candidateSystemicChannel,
  } = params;

  const learningTimeMs = parseOffsetInstant(time);

  let result: LearningResult;

  const priorCellValid =
    DOMAINS.includes(priorState?.domain) &&
    FRAMES.includes(priorState?.frame) &&
    channelOk(priorState?.frame, priorSystemicChannel);
  const candidateCellValid =
    DOMAINS.includes(candidateStatePrime?.domain) &&
    FRAMES.includes(candidateStatePrime?.frame) &&
    channelOk(candidateStatePrime?.frame, candidateSystemicChannel);

  const effectIsObject = typeof effect === "object" && effect !== null;

  if (!effectIsObject || effect_ref !== effect.effect_id) {
    result = { kind: "no_update", reason: "effect_ref_mismatch" };
  } else if (!effect.verified_outcome) {
    result = { kind: "no_update", reason: "claimed_only" };
  } else if (!isEffectVerified(effect)) {
    result = { kind: "no_update", reason: "unverified_effect" };
  } else if (effect.verified_outcome.confidence === 0) {
    result = { kind: "no_update", reason: "insufficient_evidence" };
  } else if (
    learningTimeMs === null ||
    (() => {
      const verifiedTimeMs = parseOffsetInstant(effect.verified_outcome!.time);
      return verifiedTimeMs === null || verifiedTimeMs > learningTimeMs;
    })()
  ) {
    result = { kind: "no_update", reason: "evidence_expired_or_irrelevant" };
  } else if (!priorCellValid || !candidateCellValid) {
    result = { kind: "no_update", reason: "cell_identity_mismatch" };
  } else if (
    candidateStatePrime.domain !== priorState.domain ||
    candidateStatePrime.frame !== priorState.frame ||
    (priorState.frame === "S" && priorSystemicChannel !== candidateSystemicChannel)
  ) {
    result = { kind: "no_update", reason: "cell_identity_mismatch" };
  } else {
    result = { kind: "state_prime", candidate_state_prime: candidateStatePrime };
  }

  return {
    learning_id,
    prior_state_ref,
    effect_ref,
    outcome_verification_ref,
    update_method,
    provenance,
    confidence,
    time,
    context,
    result,
  };
}
