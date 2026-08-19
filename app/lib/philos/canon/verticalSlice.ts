/**
 * Philos Canon — the live vertical slice: Observation → CellState → Need/
 * Target/Offer → Matching → Transfer candidate → Effect → Learning/State'.
 *
 * This module invents NOTHING new. Every stage below calls an
 * already-built, already-tested canon function verbatim
 * (`cellStateDerivation.ts::deriveCellStateFromObservation`,
 * `need.ts::validateNeed`, `target.ts::validateTarget`,
 * `offer.ts::validateOffer`, `matching.ts::evaluateMatch`,
 * `transfer.ts::validateTransferAgainstMatch`, `effect.ts::validateEffect`/
 * `isEffectVerified`, `learning.ts::deriveLearning`). What did not exist
 * before this pass is the WIRING: one orchestrator that runs them in canon's
 * own §24 dependency order, carrying real outputs from one stage into the
 * next real input (never re-deriving, never fabricating a substitute), and
 * making the resulting evidentiary trail — input, output, provenance,
 * persisted-vs-derived, claimed-vs-verified, canon citation — mechanically
 * inspectable per stage.
 *
 * **Sequencing, exactly canon's own §24 chain, no reordering:**
 *   `Observation (persisted) → CellState (derived, single-Observation) →
 *   {Need, Target, Offer} (sovereign, caller-supplied, NOT derived from
 *   CellState) → Matching (gated on Need+Offer) → Transfer candidate (gated
 *   on a PERMITTED match) → Effect (gated on a referentially-correct
 *   action_ref) → Learning/State' (gated on VERIFIED evidence)`.
 *
 * **Need/Target are sovereign — the enforcement is literally the absence of
 * a wire.** This orchestrator's `need`/`target` stages read `input.need`/
 * `input.target` ONLY — never `cellState`. There is no code path anywhere
 * in this file that reads a CellState/Level/Stability value and produces or
 * gates a Need or Target; canon §12's "Need ≠ Deficit" and §8's Target
 * schema closure are honored by never wiring that edge, exactly as
 * `need.ts`/`target.ts` already established for themselves in isolation —
 * this file does not create the edge just because it now has both values in
 * scope simultaneously.
 *
 * **Target's role stays a validated pass-through, never a Tension input.**
 * Canon §7 defines Tension as a derived relation from `(CellState, Target)`
 * — but "do not invent unresolved Tension/Deficit inference" is this whole
 * engagement's own standing rule. This module validates a supplied `Target`
 * (proving it CAN be attached to a slice) and stops there; no function here
 * reads both a `CellState` and a `Target` together to produce anything.
 *
 * **Two referential-integrity checks added here, not new semantics — just
 * enforcing what `effect.ts`'s and `learning.ts`'s own doc comments already
 * stated but had no live caller to check yet:**
 *   1. `effect.action_ref === transfer.action_id` — "Effect must reference
 *      its causal Action/Transfer" (`effect.ts` header). No prior caller
 *      existed to verify this cross-object equality; this orchestrator is
 *      the first, and rejects (`effect_action_ref_mismatch`) rather than
 *      silently trusting an unrelated `action_ref` string.
 *   2. Learning's `effect`/`priorState` are wired AUTOMATICALLY from this
 *      slice's own `effect` input and its own derived `cellState.candidate`
 *      — never re-accepted as separate caller-supplied parameters — so a
 *      caller structurally cannot ask this pipeline to "learn from" an
 *      Effect or a prior state that didn't come from this same slice.
 *      (`deriveLearning`'s own `effect_ref !== effect.effect_id` gate is
 *      reused verbatim for the id-level check; this file adds no new gate
 *      logic on top of it.)
 *
 * **Claimed ≠ Verified, proved live, not asserted:** the `effect` stage's
 * `claimed_or_verified` field is computed by calling `effect.ts::
 * isEffectVerified` (unmodified) — never inferred from `claimed_outcome`
 * alone. The `learning` stage is deliberately ATTEMPTED even when the
 * Effect is claimed-only or unverified — `deriveLearning`'s own gates
 * (`"claimed_only"`, `"unverified_effect"`, `"insufficient_evidence"`,
 * `"evidence_expired_or_irrelevant"`) are the live proof that claimed
 * evidence cannot produce `state_prime`, not a pipeline-level shortcut that
 * hides the attempt.
 *
 * **PHILOS never executes anything — enforced by absence, same discipline
 * as every file in this directory.** This module's ONLY I/O is one read:
 * `store.load()` to find the persisted Observation. Nothing here writes to
 * `CanonEventStore` (no `.append()` call anywhere in this file), persists a
 * `CellState`/`Need`/`Target`/`Offer`/`MatchResult`/`Transfer`/`Effect`/
 * `Learning` anywhere, or calls any dispatch/execute/apply/commit function —
 * none exists in this file, and none is imported.
 *
 * **PHILOS never bypasses (or even references) Merlin's Action Registry.**
 * A `transfer` stage that comes out `valid: true` (structurally sound,
 * matched, permitted) is a CANDIDATE — evidence that this Transfer COULD be
 * executed, never a claim that it WAS or an instruction that it should be.
 * Whatever downstream system actually dispatches a real transfer (Merlin's
 * capability/action framework, `voice-gateway/app/capabilities/**`, out of
 * this track's ownership entirely) is not imported, referenced, called, or
 * even named as a literal string anywhere in this file's logic — it is
 * mentioned only in this comment, as the documented boundary this module
 * stops at. See `PHILOS-MELTING-POT-CANON.md` — canon itself only ever says
 * "Action" / "Transfer" as *data*, never specifies an executor.
 *
 * **Derived ≠ Persisted, held throughout:** `cellState`, `matching`,
 * `transfer`(validity), `effect`(verification), and `learning` are ALL
 * derived-in-memory values, returned to the caller and never written
 * anywhere. `Observation` alone is persisted (via `CanonEventStore`,
 * unchanged). This module adds no new store, matching this pass's own
 * explicit persisted-vs-derived policy for every primitive downstream of
 * Observation.
 *
 * **Legacy separation, unchanged:** no import of `../events`, `../eventStore`,
 * `../../philos-event-store`, any `project*` module, `dynamicsView`, Merlin,
 * n8n, or the Nexus coordinator.
 */
import type { CanonEvent } from "./canonEvent";
import type { CanonEventStore } from "./canonEventStore";
import {
  deriveCellStateFromObservation,
  type CellStateDerivationResult,
} from "./cellStateDerivation";
import { type Need, type NeedError, validateNeed } from "./need";
import { type Target, type TargetError, validateTarget } from "./target";
import { type Offer, type OfferError, validateOffer } from "./offer";
import { type MatchAttempt, type MatchResult, evaluateMatch } from "./matching";
import { type Transfer, type TransferError, validateTransferAgainstMatch } from "./transfer";
import { type Effect, type EffectError, validateEffect, isEffectVerified } from "./effect";
import { type Learning, type DeriveLearningParams, deriveLearning } from "./learning";

// ── Evidentiary envelope, one shape per transition, everywhere ─────────────

export type PersistedOrDerived = "persisted" | "derived" | "caller_supplied";
export type ClaimedOrVerified = "claimed" | "verified" | "not_applicable";

/** The six facts this pass requires be provable at every transition. */
export interface Transition<TInput, TOutput> {
  input: TInput;
  output: TOutput;
  provenance: string;
  persisted_or_derived: PersistedOrDerived;
  claimed_or_verified: ClaimedOrVerified;
  canon_basis: string;
}

/** A stage either never ran (its prerequisite/own input was absent or
 *  gated closed — `reason` says which) or ran and produced a `Transition`.
 *  "Attempted" is not "succeeded" — an attempted stage can still report a
 *  closed gate (e.g. `matching.output.decision === "not_permitted"`) inside
 *  its own `output`, using that stage's own existing result type verbatim. */
export type StageResult<TInput, TOutput> =
  | { attempted: false; reason: StageSkipReason }
  | ({ attempted: true } & Transition<TInput, TOutput>);

export type StageSkipReason =
  | "not_supplied"
  | "observation_not_found"
  | "cell_state_not_derived"
  | "need_or_offer_missing_or_invalid"
  | "match_not_permitted"
  | "transfer_invalid"
  | "effect_action_ref_mismatch"
  | "effect_invalid";

// ── Input: every stage's data is either read (Observation) or explicitly
//    caller-supplied. Nothing is optional-with-a-default; absence means
//    "this stage of the slice is not being exercised this call," never a
//    silently-invented value. ─────────────────────────────────────────────

export interface VerticalSliceInput {
  store: CanonEventStore;
  canon_event_id: string;
  /** Explicit, caller-supplied instant — same "no clock of its own"
   *  discipline as `cellStateDerivation.ts`. */
  asOf: string;
  need?: Need;
  target?: Target;
  offer?: Offer;
  matchAttempt?: MatchAttempt;
  transfer?: Transfer;
  effect?: Effect;
  /** `effect` and `priorState` are deliberately NOT part of this shape —
   *  they are wired automatically from `input.effect` and this slice's own
   *  derived `cellState.candidate`. See module header, point 2. */
  learning?: Omit<DeriveLearningParams, "effect" | "priorState">;
}

export interface PhilosVerticalSliceResult {
  observation: StageResult<{ canon_event_id: string }, CanonEvent | null>;
  cellState: StageResult<CanonEvent, CellStateDerivationResult>;
  need: StageResult<Need, { valid: boolean; errors: NeedError[] }>;
  target: StageResult<Target, { valid: boolean; errors: TargetError[] }>;
  offer: StageResult<Offer, { valid: boolean; errors: OfferError[] }>;
  matching: StageResult<MatchAttempt, MatchResult>;
  transfer: StageResult<Transfer, { valid: boolean; errors: TransferError[] }>;
  effect: StageResult<Effect, { valid: boolean; errors: EffectError[]; verified: boolean }>;
  learning: StageResult<DeriveLearningParams, Learning>;
}

const skipped = (reason: StageSkipReason): { attempted: false; reason: StageSkipReason } => ({
  attempted: false,
  reason,
});

/**
 * The one, pure(-except-for-the-single-read) orchestrator. Deterministic
 * given a deterministic `store.load()`; never throws (every callee here is
 * itself total); never mutates any input object; never writes to `store` or
 * anywhere else.
 */
export async function runPhilosVerticalSlice(
  input: VerticalSliceInput,
): Promise<PhilosVerticalSliceResult> {
  // ── 1. Observation — persisted, read by explicit id. ──────────────────
  const events = await input.store.load();
  const found = events.find((e) => e.canon_event_id === input.canon_event_id) ?? null;

  const observation: PhilosVerticalSliceResult["observation"] = {
    attempted: true,
    input: { canon_event_id: input.canon_event_id },
    output: found,
    provenance: "CanonEventStore.load(), matched by canon_event_id",
    persisted_or_derived: "persisted",
    claimed_or_verified: "not_applicable",
    canon_basis: "canon §6 (Observation) + §24 (pipeline origin: Matter+Gap+Time → Observation)",
  };

  // ── 2. CellState — derived from exactly the one Observation above. ────
  let cellState: PhilosVerticalSliceResult["cellState"];
  if (!found) {
    cellState = skipped("observation_not_found");
  } else {
    const result = deriveCellStateFromObservation(found, input.asOf);
    cellState = {
      attempted: true,
      input: found,
      output: result,
      provenance: "cellStateDerivation.ts::deriveCellStateFromObservation — single-Observation field projection, no aggregation",
      persisted_or_derived: "derived",
      claimed_or_verified: "not_applicable",
      canon_basis: "canon §4 (CellState) + §24 (Observation → Cell → CellState)",
    };
  }
  const cellStateCandidate = cellState.attempted && cellState.output.kind === "cell_state"
    ? cellState.output.candidate
    : null;

  // ── 3. Need — sovereign, caller-supplied, NEVER reads cellState. ──────
  const need: PhilosVerticalSliceResult["need"] = input.need
    ? {
        attempted: true,
        input: input.need,
        output: validateNeed(input.need),
        provenance: "caller-supplied Need, validated structurally only",
        persisted_or_derived: "caller_supplied",
        claimed_or_verified: "not_applicable",
        canon_basis: "canon §12 — Need is sovereign; Need ≠ Deficit; never derived from CellState",
      }
    : skipped("not_supplied");

  // ── 4. Target — sovereign, caller-supplied, no Tension is computed. ───
  const target: PhilosVerticalSliceResult["target"] = input.target
    ? {
        attempted: true,
        input: input.target,
        output: validateTarget(input.target),
        provenance: "caller-supplied Target, validated structurally only — not combined with CellState",
        persisted_or_derived: "caller_supplied",
        claimed_or_verified: "not_applicable",
        canon_basis: "canon §8 — Target is Tension's reference object; Tension itself is out of scope here",
      }
    : skipped("not_supplied");

  // ── 5. Offer — donor-side, caller-supplied. ────────────────────────────
  const offer: PhilosVerticalSliceResult["offer"] = input.offer
    ? {
        attempted: true,
        input: input.offer,
        output: validateOffer(input.offer),
        provenance: "caller-supplied Offer, validated structurally only",
        persisted_or_derived: "caller_supplied",
        claimed_or_verified: "not_applicable",
        canon_basis: "canon §11 — Offer, donor-side schema closure, ephemeral/per-match",
      }
    : skipped("not_supplied");

  // ── 6. Matching — requires a REAL, valid Need and Offer plus an attempt. ─
  let matching: PhilosVerticalSliceResult["matching"];
  const needUsable = need.attempted && need.output.valid && input.need;
  const offerUsable = offer.attempted && offer.output.valid && input.offer;
  if (!input.matchAttempt || !needUsable || !offerUsable) {
    matching = skipped(needUsable && offerUsable ? "not_supplied" : "need_or_offer_missing_or_invalid");
  } else {
    const result = evaluateMatch(input.matchAttempt, input.need!, input.offer!);
    matching = {
      attempted: true,
      input: input.matchAttempt,
      output: result,
      provenance: "matching.ts::evaluateMatch over the real, caller-supplied Need and Offer above",
      persisted_or_derived: "derived",
      claimed_or_verified: "not_applicable",
      canon_basis: "canon §10 — Matching boolean gate: CAN∧WANTS∧ALLOWED∧APPROPRIATE∧AVAILABLE∧CONSENT",
    };
  }

  // ── 7. Transfer candidate — requires a PERMITTED match. Never executed. ─
  let transfer: PhilosVerticalSliceResult["transfer"];
  if (!input.transfer) {
    transfer = skipped("not_supplied");
  } else if (!matching.attempted || matching.output.decision !== "permitted") {
    transfer = skipped("match_not_permitted");
  } else {
    const result = validateTransferAgainstMatch(input.transfer, matching.output);
    transfer = {
      attempted: true,
      input: input.transfer,
      output: result,
      provenance: "transfer.ts::validateTransferAgainstMatch — candidate only; not dispatched, not executed",
      persisted_or_derived: "caller_supplied",
      claimed_or_verified: "claimed", // Transfer.claimed_outcome exists; canon's real claimed/verified apparatus is Effect/OutcomeVerification, below
      canon_basis: "canon §11 (Transfer ⊂ Action, §13) + §14 (Permitted Action/Transfer requires Matching gates)",
    };
  }

  // ── 8. Effect — requires a VALID transfer candidate this Effect actually
  //    references (action_ref === transfer.action_id, "Effect must
  //    reference its causal Action/Transfer", effect.ts). ────────────────
  let effect: PhilosVerticalSliceResult["effect"];
  if (!input.effect) {
    effect = skipped("not_supplied");
  } else if (!transfer.attempted || !transfer.output.valid) {
    effect = skipped("transfer_invalid");
  } else if (input.effect.action_ref !== input.transfer!.action_id) {
    effect = skipped("effect_action_ref_mismatch");
  } else {
    const validation = validateEffect(input.effect);
    const verified = isEffectVerified(input.effect);
    effect = {
      attempted: true,
      input: input.effect,
      output: { valid: validation.valid, errors: validation.errors, verified },
      provenance: "effect.ts::validateEffect + isEffectVerified, over an Effect referencing this slice's own Transfer candidate",
      persisted_or_derived: "caller_supplied",
      claimed_or_verified: verified ? "verified" : "claimed",
      canon_basis: "canon §17 — Effect: claimed_outcome vs verified_outcome; subject-consent authority rule",
    };
  }

  // ── 9. Learning / State' — requires this slice's own Effect (any
  //    verification status — the gate below is the live proof of "claimed
  //    != verified") and this slice's own derived CellState as priorState.
  //    `effect`/`priorState` are wired here, never re-accepted as params. ─
  let learning: PhilosVerticalSliceResult["learning"];
  if (!input.learning) {
    learning = skipped("not_supplied");
  } else if (!cellStateCandidate) {
    learning = skipped("cell_state_not_derived");
  } else if (!effect.attempted || !effect.output.valid) {
    learning = skipped("effect_invalid");
  } else {
    const params: DeriveLearningParams = {
      ...input.learning,
      effect: input.effect!,
      priorState: cellStateCandidate,
    };
    const result = deriveLearning(params);
    learning = {
      attempted: true,
      input: params,
      output: result,
      provenance: "learning.ts::deriveLearning — gates a caller-proposed candidate_state_prime against verified evidence + cell-identity; never computes a new Level/Stability itself",
      persisted_or_derived: "derived",
      claimed_or_verified: result.result.kind === "state_prime" ? "verified" : "claimed",
      canon_basis: "canon §17/§24/§26 — Learning: State' boundary; open empirical assumption, gated not asserted",
    };
  }

  return { observation, cellState, need, target, offer, matching, transfer, effect, learning };
}

// ── Stop-point introspection — added for the read-only Merlin-orientation
//    HTTP endpoint (`app/api/canon/observations/[canonEventId]/orientation`).
//    Pure inspection of an already-produced `PhilosVerticalSliceResult`; adds
//    no derivation, no new gate, no new semantics — it only names the first
//    stage (in canon's own §24 order) that came back `attempted: false`, using
//    the `reason` that stage's own branch above already recorded. ─────────

export type StageName =
  | "observation"
  | "cellState"
  | "need"
  | "target"
  | "offer"
  | "matching"
  | "transfer"
  | "effect"
  | "learning";

const STAGE_ORDER: readonly StageName[] = [
  "observation",
  "cellState",
  "need",
  "target",
  "offer",
  "matching",
  "transfer",
  "effect",
  "learning",
];

export interface UnsupportedTransition {
  stage: StageName;
  reason: StageSkipReason;
}

/**
 * The first stage, in pipeline order, this slice did not attempt — `null` if
 * every stage was attempted. A stage that WAS attempted but gated its own
 * outcome closed (e.g. Matching `decision: "not_permitted"`) is not reported
 * here; that fact lives on the stage's own `output`, not as an "unsupported
 * transition" (this function only ever reads `attempted`/`reason`, nothing
 * else). Pure, synchronous, no I/O, never throws.
 */
export function firstUnsupportedTransition(
  result: PhilosVerticalSliceResult,
): UnsupportedTransition | null {
  for (const stage of STAGE_ORDER) {
    const s = result[stage];
    if (!s.attempted) return { stage, reason: s.reason };
  }
  return null;
}
