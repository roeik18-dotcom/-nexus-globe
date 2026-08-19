/**
 * Philos Canon — Transfer (PHILOS-MELTING-POT-CANON.md §11, "Transfer ⊂
 * Action").
 *
 * `Transfer = { source, target, source_cell, target_cell, resource,
 * resource_type, amount, conversion_mechanism, cost, consent, provenance,
 * reversibility, expiry/validity, claimed_outcome, verified_outcome, time }`.
 * "No automatic cell→cell fill; every edge states its causal conversion."
 *
 * **`Transfer ⊂ Action` is real structural subtyping**, not a resemblance:
 * `interface Transfer extends Action` below. Every Transfer IS an Action
 * (`type` narrowed to the literal `"transfer"`), carrying all of Action's
 * base fields (`action_id`, `owner`, `mechanism_scope`, `consent`, `inputs`,
 * `effect_ref`, `reversibility`, `time`, `provenance` — several of which
 * canon's own §11 Transfer field list restates using the same names, which
 * is exactly what "⊂" predicts) plus the Transfer-specific fields §11 adds
 * on top (`source`, `target`, `source_cell`, `target_cell`, `resource`,
 * `resource_type`, `amount`, `conversion_mechanism`, `cost`,
 * `expiry_or_validity`, `claimed_outcome`, `verified_outcome`).
 * `validateTransfer()` calls `validateAction()` first and only adds
 * Transfer-specific checks — the base checks are never duplicated.
 *
 * **`self_regulation` cannot produce a Transfer** (§13, §15 — "Self-
 * Regulation ≠ Melting Pot... Person A → group/social field → Person B" is
 * strictly interpersonal): enforced below — any Transfer with
 * `mechanism_scope !== "melting_pot"` is rejected. This is the concrete point
 * where the rule `action.ts` could only describe, not enforce, becomes real.
 *
 * **Resource lives in the transfer layer, never CellState** (§11, locked).
 * `CellState` (`cellState.ts`) has exactly four fields — `domain, frame,
 * level, stability` — no `resource`/`resource_type`/`amount` field exists on
 * it, and none is added here. **Capacity ≠ Resource: a Capacity (a cell
 * surplus-state) becomes a Resource only through an explicit conversion
 * mechanism — never automatically.** `conversion_mechanism` is therefore
 * REQUIRED (non-empty) on every Transfer — there is no code path in this
 * file that reads a `CellState` and produces a `Transfer` without one; no
 * such "auto-fill" function exists at all (enforced by absence, see
 * `__tests__/transfer.test.ts`).
 *
 * **Matching permission required before an interpersonal Transfer** (this
 * pass's explicit instruction, consistent with §14's pipeline: "... Matching
 * gates ... → Permitted Action/Transfer A→B ..."):
 * `validateTransferAgainstMatch()` requires a real `MatchResult`
 * (`matching.ts`) with `decision === "permitted"` — a `not_permitted` or
 * `invalid` match (including one rejected purely because the referenced
 * Need/Offer had expired, which `evaluateMatch` already computes) blocks the
 * Transfer. No expiry logic is duplicated here; the existing `evaluateMatch`
 * decision is trusted and re-checked, not re-derived.
 *
 * **claimed_outcome ≠ verified_outcome** (§17): `claimed_outcome` is
 * required; `verified_outcome` is optional, and its absence means "not yet
 * verified" — never "verified as false" and never auto-populated from
 * `claimed_outcome`. **Transfer does not imply successful Effect and does
 * not update State' by itself** — no function in this file reads
 * `claimed_outcome` and marks anything "verified," "succeeded," or updates
 * any `CellState`/`State'` — enforced by absence, matching `action.ts`'s
 * same discipline.
 *
 * **Anti-depletion inputs, representable but not evaluated** (§16, this
 * pass's explicit scope limit): canon's formula —
 * `TransferAllowed ⇔ Benefit(receiver) > Cost ∧ DonorPostState(consumed_
 * resource) ≥ ResourceSpecificFloor ∧ SystemicExternality ≤ AcceptedRisk` —
 * is NOT evaluated here. The one anti-depletion-relevant field this pass's
 * own required-field list includes, `cost`, is representable (required,
 * non-empty). `Benefit`/`DonorPostState`/`ResourceSpecificFloor`/
 * `SystemicExternality` are not added as separate fields: they are not in
 * this pass's specified field list, and building the formula around them is
 * explicitly out of scope ("do NOT implement anti-depletion optimization
 * yet"). Not an oversight — a scope boundary, stated here so a future reader
 * does not assume `cost` alone constitutes anti-depletion enforcement.
 *
 * SystemicChannel note (canon §18): Transfer is explicitly named. Because a
 * Transfer has TWO cell references (`source_cell`, `target_cell`), each gets
 * its own optional systemic-channel field — `source_systemic_channel_if_S` /
 * `target_systemic_channel_if_S` — required independently whenever the
 * corresponding cell's `frame === "S"`. Canon's own §11 field list for
 * Transfer does not spell out a systemic-channel field name the way Offer's
 * list does (`systemic_channel_if_S`); §18's general rule is treated as the
 * authority here regardless, exactly as it was for `need.ts`'s per-cell
 * requirement (which §12's own field list also didn't spell out) — this is
 * consistent reasoning across the whole directory, not a special case.
 *
 * Anti-ranking / permanence scope note (canon §21), matching every other
 * file in this directory: no scoring, ranking, cumulative-contribution
 * counter, reputation field, or cross-frame/cross-subject aggregation exists
 * anywhere in this file.
 */
import { type Action, type ActionError, validateAction } from "./action";
import {
  type Domain,
  type Frame,
  parseOffsetInstant,
  type SystemicChannel,
  SYSTEMIC_CHANNELS,
} from "./observation";
import type { MatchResult } from "./matching";

/** `Transfer ⊂ Action` — real structural subtyping, not a lookalike. */
export interface Transfer extends Action {
  type: "transfer";
  source: string;
  target: string;
  source_cell: { domain: Domain; frame: Frame };
  target_cell: { domain: Domain; frame: Frame };
  /** Required iff source_cell.frame === "S" (canon §18). */
  source_systemic_channel_if_S?: SystemicChannel;
  /** Required iff target_cell.frame === "S" (canon §18). */
  target_systemic_channel_if_S?: SystemicChannel;
  resource: string;
  resource_type: string;
  amount: string | number;
  /** Mandatory (§11) — the explicit mechanism by which a Capacity becomes a Resource. */
  conversion_mechanism: string;
  cost: string;
  /** canon's own field name is "expiry/validity" — represented as one field, this pass's naming choice. */
  expiry_or_validity: string;
  claimed_outcome: string;
  /** Absent = not yet verified. Never auto-populated from claimed_outcome. */
  verified_outcome?: string;
}

export type TransferError =
  | ActionError
  | { field: "type"; reason: "must_be_transfer" }
  | { field: "mechanism_scope"; reason: "transfer_requires_melting_pot" }
  | { field: "source"; reason: "empty" }
  | { field: "target"; reason: "empty" }
  | { field: "source_cell"; reason: "invalid" }
  | { field: "target_cell"; reason: "invalid" }
  | { field: "source_systemic_channel_if_S"; reason: "required_when_frame_is_S" }
  | { field: "source_systemic_channel_if_S"; reason: "invalid" }
  | { field: "target_systemic_channel_if_S"; reason: "required_when_frame_is_S" }
  | { field: "target_systemic_channel_if_S"; reason: "invalid" }
  | { field: "resource"; reason: "empty" }
  | { field: "resource_type"; reason: "empty" }
  | { field: "amount"; reason: "empty_or_not_finite" }
  | { field: "conversion_mechanism"; reason: "empty" }
  | { field: "cost"; reason: "empty" }
  | { field: "expiry_or_validity"; reason: "invalid_or_no_offset" }
  | { field: "claimed_outcome"; reason: "empty" }
  | { field: "match"; reason: "matching_not_permitted" };

export interface ValidationResult {
  valid: boolean;
  errors: TransferError[];
}

const DOMAINS: Domain[] = ["G", "E", "C"];
const FRAMES: Frame[] = ["I", "R", "S"];

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim() !== "";
}

function validateCellRef(
  cell: { domain: Domain; frame: Frame } | undefined,
): boolean {
  return !!cell && DOMAINS.includes(cell.domain) && FRAMES.includes(cell.frame);
}

/**
 * Pure, deterministic validator. Runs `validateAction()` first (Transfer IS
 * an Action), then adds Transfer-specific checks. Never throws; all
 * applicable checks run without short-circuiting.
 */
export function validateTransfer(t: Transfer): ValidationResult {
  const base = validateAction(t);
  const errors: TransferError[] = [...base.errors];

  if (t.type !== "transfer") errors.push({ field: "type", reason: "must_be_transfer" });

  // The concrete enforcement point: self_regulation cannot produce a Transfer.
  if (t.mechanism_scope !== "melting_pot") {
    errors.push({ field: "mechanism_scope", reason: "transfer_requires_melting_pot" });
  }

  if (!nonEmpty(t.source)) errors.push({ field: "source", reason: "empty" });
  if (!nonEmpty(t.target)) errors.push({ field: "target", reason: "empty" });

  const sourceCellOk = validateCellRef(t.source_cell);
  if (!sourceCellOk) errors.push({ field: "source_cell", reason: "invalid" });
  const targetCellOk = validateCellRef(t.target_cell);
  if (!targetCellOk) errors.push({ field: "target_cell", reason: "invalid" });

  if (sourceCellOk && t.source_cell.frame === "S") {
    if (
      t.source_systemic_channel_if_S === undefined ||
      !SYSTEMIC_CHANNELS.includes(t.source_systemic_channel_if_S)
    ) {
      errors.push({
        field: "source_systemic_channel_if_S",
        reason: "required_when_frame_is_S",
      });
    }
  } else if (
    t.source_systemic_channel_if_S !== undefined &&
    !SYSTEMIC_CHANNELS.includes(t.source_systemic_channel_if_S)
  ) {
    errors.push({ field: "source_systemic_channel_if_S", reason: "invalid" });
  }

  if (targetCellOk && t.target_cell.frame === "S") {
    if (
      t.target_systemic_channel_if_S === undefined ||
      !SYSTEMIC_CHANNELS.includes(t.target_systemic_channel_if_S)
    ) {
      errors.push({
        field: "target_systemic_channel_if_S",
        reason: "required_when_frame_is_S",
      });
    }
  } else if (
    t.target_systemic_channel_if_S !== undefined &&
    !SYSTEMIC_CHANNELS.includes(t.target_systemic_channel_if_S)
  ) {
    errors.push({ field: "target_systemic_channel_if_S", reason: "invalid" });
  }

  if (!nonEmpty(t.resource)) errors.push({ field: "resource", reason: "empty" });
  if (!nonEmpty(t.resource_type)) errors.push({ field: "resource_type", reason: "empty" });

  const amountOk =
    (typeof t.amount === "string" && t.amount.trim() !== "") ||
    (typeof t.amount === "number" && Number.isFinite(t.amount));
  if (!amountOk) errors.push({ field: "amount", reason: "empty_or_not_finite" });

  if (!nonEmpty(t.conversion_mechanism)) {
    errors.push({ field: "conversion_mechanism", reason: "empty" });
  }

  if (!nonEmpty(t.cost)) errors.push({ field: "cost", reason: "empty" });

  const expiryMs = parseOffsetInstant(t.expiry_or_validity);
  if (expiryMs === null) {
    errors.push({ field: "expiry_or_validity", reason: "invalid_or_no_offset" });
  }

  if (!nonEmpty(t.claimed_outcome)) {
    errors.push({ field: "claimed_outcome", reason: "empty" });
  }
  // verified_outcome is intentionally unchecked here beyond its optional
  // type — its absence is valid and meaningful ("not yet verified"), never
  // an error, and it is never derived from claimed_outcome.

  return { valid: errors.length === 0, errors };
}

/**
 * Requires a `MatchResult` with `decision === "permitted"` (`matching.ts`).
 * Does not re-derive expiry or gate logic — trusts and re-checks
 * `evaluateMatch`'s own decision, which already folds in Need/Offer expiry.
 * A `not_permitted` or `invalid` match blocks the Transfer, full stop.
 */
export function validateTransferAgainstMatch(
  t: Transfer,
  match: MatchResult,
): ValidationResult {
  const base = validateTransfer(t);
  const errors: TransferError[] = [...base.errors];

  if (match.decision !== "permitted") {
    errors.push({ field: "match", reason: "matching_not_permitted" });
  }

  return { valid: errors.length === 0, errors };
}
