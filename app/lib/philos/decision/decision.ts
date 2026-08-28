/**
 * Philos — the Decision record.
 *
 * A Decision is the moment of choosing, and nothing else. It belongs to a
 * `DecisionCase`, it cites the Observations it was based on, it names the
 * alternatives it beat, and it points at the Action it chose. Everything
 * about what HAPPENED afterwards lives on canon records the case also
 * references — never here.
 *
 * ## What this record carries that no canon record does
 *
 * `expected_outcome` — pre-registered, written before the outcome is known,
 * never editable afterwards (the store is append-only; a changed mind is a
 * new Decision that supersedes). This is the entire basis on which "was I
 * right" is answerable rather than hindsight with a timestamp. Canon has no
 * such field: `Effect.claimed_outcome` is written AFTER, which is a different
 * fact.
 *
 * `alternatives_considered` — what else was genuinely on the table. Canon
 * records what was done, never what was rejected, so this is new. It is also
 * load-bearing: with nothing to rule out, a later claim that this decision
 * CAUSED the outcome is unfalsifiable by construction, and
 * `checkCausalRelation` refuses `causally_supported` without it.
 *
 * `decision_logic` — the rule or reasoning that took the alternatives to the
 * choice. Named after Palantir's Data/Logic/Action/Security split, where
 * Logic is the step this system previously left implicit: `Action.provenance`
 * says a person initiated it, never why this option rather than that one.
 *
 * `review_horizon` — when to come back and ask.
 *
 * ## What it does NOT carry, and where that lives instead
 *
 *   what was done              → `Action`, via `chosen_action_ref`
 *   what happened              → `Effect`, referenced by the case
 *   how it is known            → `OutcomeVerification`, referenced by the case
 *   what was learned           → `Learning`, referenced by the case
 *   how well the outcome is
 *     established              → DERIVED by `outcomeVerificationLevel`, never stored
 *
 * ## `no_action_yet` is explicit, not an absent field
 *
 * A decision can genuinely be "we decided, nothing has been done yet". That
 * is different from "we decided and forgot to link the action", and an
 * optional `chosen_action_ref` alone cannot tell them apart. The record
 * carries the distinction as a required discriminated field so a missing link
 * is a detectable defect rather than an indistinguishable silence.
 */
import { parseOffsetInstant } from "../canon/observation";
import { isRecordOrigin, type RecordOrigin } from "../recordOrigin";
import { isRiskLevel, type RiskLevel } from "./evidenceAxes";

/**
 * Review horizons, offered as a number of DAYS rather than a date. A date
 * picker asks "when exactly" when the real question is "how long before this
 * is knowable", and drags in the whole timezone problem for a field whose
 * precision does not matter. The writer turns the number into an instant with
 * the same clock that stamps `decided_at`, so the two cannot disagree.
 *
 * This lives here and not beside the writer because a `"use server"` module
 * may only export async functions.
 */
export const HORIZONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 1, label: "מחר" },
  { days: 7, label: "בעוד שבוע" },
  { days: 30, label: "בעוד חודש" },
  { days: 90, label: "בעוד שלושה חודשים" },
];

export const DEFAULT_HORIZON_DAYS = 7;
export const DAY_MS = 86_400_000;

/** What was chosen to do, or an explicit statement that nothing has been. */
export type ChosenAction =
  | { kind: "action"; action_ref: string }
  | { kind: "no_action_yet"; because: string };

export interface Decision {
  decision_id: string;
  /** The case this belongs to. Required — a decision outside a case is
   *  unreachable from the episode it is part of. */
  case_id: string;
  /** The person who decided. Server-derived from the session, never a field. */
  subject: string;
  /** What was decided, in the person's own words. NEVER generated. */
  statement: string;
  /** Why. The reasoning as it stood, not as reconstructed. */
  because: string;
  /** The rule or criterion that selected this option over the others. */
  decision_logic: string;
  /** Pre-registered. Written before the outcome is known. */
  expected_outcome: string;
  /** What else was on the table. May be empty — that caps causal claims. */
  alternatives_considered: readonly string[];
  /** `canon_event_id` of the Observations this was based on. */
  observation_refs: readonly string[];
  /** The chosen Action, or an explicit "nothing yet". */
  chosen_action: ChosenAction;
  /** The person's own confidence at decision time, [0,1]. Never computed. */
  confidence: number;
  /** Mirrors the case's risk level at decision time. */
  stakes: RiskLevel;
  decided_at: string;
  /** When to come back and ask. Must be after `decided_at`. */
  review_horizon: string;
  record_origin: RecordOrigin;
}

export type DecisionError =
  | { field: "decision_id"; reason: "empty" }
  | { field: "case_id"; reason: "empty" }
  | { field: "subject"; reason: "empty" }
  | { field: "statement"; reason: "empty" }
  | { field: "because"; reason: "empty" }
  | { field: "decision_logic"; reason: "empty" }
  | { field: "expected_outcome"; reason: "empty" }
  | { field: "alternatives_considered"; reason: "not_a_string_list" }
  | { field: "observation_refs"; reason: "not_a_string_list" }
  | { field: "chosen_action"; reason: "invalid_kind" }
  | { field: "chosen_action"; reason: "empty_reference" }
  | { field: "confidence"; reason: "not_a_probability" }
  | { field: "stakes"; reason: "unknown_value" }
  | { field: "decided_at"; reason: "invalid_or_no_offset" }
  | { field: "review_horizon"; reason: "invalid_or_no_offset" }
  | { field: "review_horizon"; reason: "not_after_decided_at" }
  | { field: "record_origin"; reason: "unknown_value" };

export interface DecisionValidation {
  valid: boolean;
  errors: DecisionError[];
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

/** Pure, deterministic, total. All checks run; no short-circuiting. */
export function validateDecision(d: Decision): DecisionValidation {
  const errors: DecisionError[] = [];

  if (!nonEmpty(d?.decision_id)) errors.push({ field: "decision_id", reason: "empty" });
  if (!nonEmpty(d?.case_id)) errors.push({ field: "case_id", reason: "empty" });
  if (!nonEmpty(d?.subject)) errors.push({ field: "subject", reason: "empty" });
  if (!nonEmpty(d?.statement)) errors.push({ field: "statement", reason: "empty" });
  if (!nonEmpty(d?.because)) errors.push({ field: "because", reason: "empty" });
  if (!nonEmpty(d?.decision_logic)) errors.push({ field: "decision_logic", reason: "empty" });
  if (!nonEmpty(d?.expected_outcome)) {
    errors.push({ field: "expected_outcome", reason: "empty" });
  }

  for (const field of ["alternatives_considered", "observation_refs"] as const) {
    const list = d?.[field];
    if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) {
      errors.push({ field, reason: "not_a_string_list" });
    }
  }

  const chosen = d?.chosen_action;
  if (!chosen || (chosen.kind !== "action" && chosen.kind !== "no_action_yet")) {
    errors.push({ field: "chosen_action", reason: "invalid_kind" });
  } else if (chosen.kind === "action" && !nonEmpty(chosen.action_ref)) {
    errors.push({ field: "chosen_action", reason: "empty_reference" });
  } else if (chosen.kind === "no_action_yet" && !nonEmpty(chosen.because)) {
    /* "Nothing yet" must say why. An unexplained absence is the silence this
       discriminated field exists to prevent. */
    errors.push({ field: "chosen_action", reason: "empty_reference" });
  }

  if (
    typeof d?.confidence !== "number" ||
    !Number.isFinite(d.confidence) ||
    d.confidence < 0 ||
    d.confidence > 1
  ) {
    errors.push({ field: "confidence", reason: "not_a_probability" });
  }

  if (!isRiskLevel(d?.stakes)) errors.push({ field: "stakes", reason: "unknown_value" });

  const decidedMs = parseOffsetInstant(d?.decided_at);
  if (decidedMs === null) errors.push({ field: "decided_at", reason: "invalid_or_no_offset" });

  const dueMs = parseOffsetInstant(d?.review_horizon);
  if (dueMs === null) {
    errors.push({ field: "review_horizon", reason: "invalid_or_no_offset" });
  } else if (decidedMs !== null && dueMs <= decidedMs) {
    errors.push({ field: "review_horizon", reason: "not_after_decided_at" });
  }

  if (!isRecordOrigin(d?.record_origin)) {
    errors.push({ field: "record_origin", reason: "unknown_value" });
  }

  return { valid: errors.length === 0, errors };
}

/** Whether this decision has actually been acted on. Total. */
export function hasChosenAction(d: Decision): boolean {
  return d?.chosen_action?.kind === "action";
}

export function chosenActionRef(d: Decision): string | undefined {
  return d?.chosen_action?.kind === "action" ? d.chosen_action.action_ref : undefined;
}
