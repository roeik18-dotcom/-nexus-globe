/**
 * Philos Canon — Merlin handoff adapter (Merlin × Philos vertical slice #1,
 * Phase 3).
 *
 * `runPhilosVerticalSlice` (`verticalSlice.ts`) is the ONE canonical Philos
 * vertical-slice orchestrator. This file adds NO orchestration, NO
 * derivation, and NO validation of its own — it is a pure, synchronous
 * PROJECTION from an already-computed `PhilosVerticalSliceResult` onto the
 * minimal typed shape Merlin needs. Every value below is read verbatim out
 * of a stage the canonical orchestrator already ran; nothing here calls a
 * canon function, touches a store, or re-derives anything.
 *
 * **Why a separate file instead of a field on `PhilosVerticalSliceResult`
 * itself**: the two shapes serve different audiences. `PhilosVerticalSliceResult`
 * is Philos's own full evidentiary trail — nine stages, six trace fields
 * each, useful for debugging/audit. `MerlinOrientationHandoff` is
 * deliberately narrower: exactly what a caller across the Philos/Merlin
 * boundary needs to decide whether and how to act, nothing more. Keeping
 * them separate means the boundary contract can be reviewed/frozen
 * independently of the internal trace shape changing.
 *
 * **CRITICAL BOUNDARY, preserved from the internal orchestrator, not
 * reinvented**: `runPhilosVerticalSlice` never calls `.append()`, never
 * imports a dispatch/execute/apply/commit function, never references
 * Merlin/n8n/voice-gateway/any action registry (`NO_EXECUTION`,
 * `NO_MERLIN_ACTION_REGISTRY_REFERENCE`, `verticalSlice.test.ts`). This
 * adapter inherits that guarantee by construction — it reads fields off an
 * already-produced result object; it has no path to execute anything even
 * if it wanted to.
 *
 * **What is deliberately EXCLUDED from `MerlinOrientationHandoff`** (this
 * pass's explicit requirement): no tool name, no credential, no
 * `approval: true`, no execution authority, no network policy, no retry
 * policy, no ranked/scored list. `candidate_action`, when present, is one
 * validated `Transfer` + its `MatchResult` — offered as evidence a
 * melting-pot transfer is canon-permitted, never as an instruction to run
 * it. Merlin remains authoritative for capability resolution, side_effect
 * policy, approval policy, network scope, credentials, idempotency,
 * execution, and verification evidence from tools.
 */
import type { CellState } from "./cellState";
import type { Need } from "./need";
import type { Target } from "./target";
import type { Transfer, TransferError } from "./transfer";
import type { MatchResult } from "./matching";
import type { PhilosVerticalSliceResult } from "./verticalSlice";

export type VerificationState = "not_applicable" | "claimed_only" | "unverified" | "verified";

export interface OrientationCandidateAction {
  transfer: Transfer;
  match_result: MatchResult;
  transfer_valid: boolean;
  transfer_errors: TransferError[];
}

/** The Merlin handoff contract. See module header for the excluded-fields list. */
export interface MerlinOrientationHandoff {
  orientation_id: string;
  source_observation_id: string;
  current_state?: CellState;
  open_need?: Need;
  target?: Target;
  candidate_action?: OrientationCandidateAction;
  constraints: string[];
  provenance: string[];
  verification_state: VerificationState;
}

const CONSTRAINTS: readonly string[] = [
  "candidate_action, if present, is a canon-validated candidate only — Philos does not execute it",
  "Merlin remains authoritative for capability resolution, side_effect policy, approval policy, network scope, credentials, idempotency, execution, and verification evidence from tools",
  "this handoff carries no tool name, no credential, no approval=true, and no ranked/scored recommendation",
];

/**
 * `verification_state`, read off the canonical result without re-deriving
 * anything: `effect` not attempted → `"not_applicable"` (nothing claimed
 * yet); attempted with no `verified_outcome` at all → `"claimed_only"`;
 * attempted with a `verified_outcome` that `isEffectVerified` (already run
 * inside `runPhilosVerticalSlice`, exposed as `.output.verified`) judged
 * insufficient → `"unverified"`; otherwise → `"verified"`.
 */
function deriveVerificationState(result: PhilosVerticalSliceResult): VerificationState {
  if (!result.effect.attempted) return "not_applicable";
  if (!result.effect.input.verified_outcome) return "claimed_only";
  return result.effect.output.verified ? "verified" : "unverified";
}

/**
 * Pure projection, no I/O, never throws. Returns `null` when the canonical
 * result has no usable `current_state` — a handoff with no `current_state`
 * would assert Merlin has orientation context Philos never actually derived
 * (the same "never fabricate" discipline `verticalSlice.ts`'s own stages
 * already apply to themselves).
 */
export function toMerlinOrientationHandoff(
  orientation_id: string,
  result: PhilosVerticalSliceResult,
): MerlinOrientationHandoff | null {
  const cellState =
    result.cellState.attempted && result.cellState.output.kind === "cell_state"
      ? result.cellState.output.candidate
      : undefined;
  if (!cellState) return null;

  const source_observation_id = result.observation.attempted
    ? result.observation.input.canon_event_id
    : "";

  const open_need = result.need.attempted && result.need.output.valid ? result.need.input : undefined;
  const target = result.target.attempted && result.target.output.valid ? result.target.input : undefined;

  const candidate_action: OrientationCandidateAction | undefined =
    result.transfer.attempted &&
    result.transfer.output.valid &&
    result.matching.attempted &&
    result.matching.output.decision === "permitted"
      ? {
          transfer: result.transfer.input,
          match_result: result.matching.output,
          transfer_valid: result.transfer.output.valid,
          transfer_errors: result.transfer.output.errors,
        }
      : undefined;

  const provenance: string[] = [];
  for (const stage of [
    result.observation,
    result.cellState,
    result.need,
    result.target,
    result.offer,
    result.matching,
    result.transfer,
    result.effect,
    result.learning,
  ]) {
    if (stage.attempted) provenance.push(stage.provenance);
  }

  return {
    orientation_id,
    source_observation_id,
    current_state: cellState,
    open_need,
    target,
    candidate_action,
    constraints: [...CONSTRAINTS],
    provenance,
    verification_state: deriveVerificationState(result),
  };
}
