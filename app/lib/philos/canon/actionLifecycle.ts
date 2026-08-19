/**
 * Philos Canon — ActionLifecycle: the real, minimum, end-to-end
 * ORIENTATION → PROPOSED ACTION → ACTOR → TARGET → RESOURCE → CONSTRAINT →
 * EXECUTION → EXPECTED EFFECT → OBSERVED EFFECT → EVIDENCE → DELTA →
 * LEARNING → UPDATED STATE lifecycle, wired to real persistence.
 *
 * **What is genuinely persisted here vs. what stays caller-supplied — stated
 * plainly, not blurred:**
 *   - ORIENTATION (Observation → CellState) — persisted (`CanonEventStore`,
 *     unchanged) / derived (`cellStateDerivation.ts`, unchanged).
 *   - PROPOSED ACTION, ACTOR (`Action.owner`) — persisted NEW this pass
 *     (`actionStore.ts`).
 *   - TARGET, RESOURCE (`Offer.available_resource`/`resource_type`),
 *     CONSTRAINT (`Offer.constraints`) — these remain the same
 *     CALLER-SUPPLIED, validated-but-not-persisted `Target`/`Offer` values
 *     `verticalSlice.ts` already established (no `TargetStore`/`OfferStore`
 *     exists — canon §11 itself calls Offer "ephemeral / per-match", and no
 *     instruction this pass asked for permanent Target/Offer storage). A
 *     real, stored `Action.inputs: string[]` references whichever
 *     Need/Target/Offer id fed it, by id — the link is honest and real, the
 *     referenced Target/Offer record itself is just not durable.
 *   - EXECUTION — the stored `Action` itself (never dispatched/executed —
 *     same "PHILOS never executes anything" discipline as every file in
 *     this directory).
 *   - EXPECTED EFFECT / OBSERVED EFFECT / EVIDENCE — persisted NEW this pass
 *     (`effectStore.ts`, wrapping `Effect.claimed_outcome`/
 *     `verified_outcome`, each an `OutcomeVerification`).
 *   - DELTA, LEARNING, UPDATED STATE — persisted NEW this pass
 *     (`learningStore.ts`, wrapping `Learning` + a computed `StateDelta`).
 *
 * **CHRONOLOGY != CAUSALITY, enforced structurally, not by convention:**
 * every function below that associates one record with another
 * (`recordEffect`→its Action, `recordLearning`→its Effect,
 * `buildActionLifecycleSummary`'s own aggregation) does so ONLY via an
 * explicit id reference already present on the incoming record
 * (`effect.action_ref`, `learning.effect_ref`) — checked against the real
 * store. No function here ever joins two records because they are near each
 * other in `recorded_at` order, and no function here computes or exposes a
 * "most recent Action" as if it were a cause of anything. `inActionOrder`/
 * `inEffectOrder`/`inLearningOrder` (the stores' own sort helpers) exist
 * only for stable log DISPLAY order — nothing here treats that order as
 * evidence of causation.
 *
 * **ACTION != EFFECT, EFFECT != LEARNING**: enforced by construction —
 * three separate stores, three separate id spaces, linked only by explicit
 * reference fields, never merged into one record type.
 *
 * **NO VERIFIED EFFECT != NO EFFECT**: `buildActionLifecycleSummary`
 * reports, per Action, THREE distinct real states — `no_effect_recorded`
 * (zero Effect records reference this Action), `effect_claimed_only` (at
 * least one Effect exists, none is `isEffectVerified`), and
 * `effect_verified` (at least one Effect is `isEffectVerified`) — never
 * collapsing the first two into one "no effect" bucket.
 */
import { type Action, validateAction } from "./action";
import { actionStore, loadActions } from "./actionStoreAccessor";
import type { ActionRecord } from "./actionStore";
import { type Effect, isEffectVerified } from "./effect";
import { effectStore, findEffectsForAction, loadEffects } from "./effectStoreAccessor";
import type { EffectRecord } from "./effectStore";
import { type DeriveLearningParams, deriveLearning } from "./learning";
import { learningStore, findLearningsForEffect } from "./learningStoreAccessor";
import type { LearningRecord } from "./learningStore";
import { computeStateDelta, type StateDelta } from "./stateDelta";

// ── PROPOSED ACTION / ACTOR — record a real Action ─────────────────────────

export class ActionReferentialIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionReferentialIntegrityError";
  }
}

/**
 * Records a real Action (PROPOSED ACTION, ACTOR = `action.owner`, EXECUTION
 * candidate). Validates structurally (`validateAction`, defense-in-depth —
 * the store re-checks this too, same discipline as every other primitive in
 * this directory) then appends. Never executes anything; this is storage
 * only.
 */
export async function recordAction(action: Action, recordedAt: string): Promise<ActionRecord> {
  const validation = validateAction(action);
  if (!validation.valid) {
    throw new ActionReferentialIntegrityError(
      `Action ${action?.action_id ?? "(no id)"} failed structural validation before recording`,
    );
  }
  const [stored] = await actionStore().append([{ action, recorded_at: recordedAt }]);
  return stored;
}

// ── EXPECTED EFFECT / OBSERVED EFFECT / EVIDENCE — record a real Effect ────

export class EffectReferentialIntegrityError extends Error {
  readonly action_ref: string;
  constructor(actionRef: string) {
    super(`Effect.action_ref "${actionRef}" does not reference any real, already-stored Action — refusing to record an Effect for an Action that was never recorded`);
    this.name = "EffectReferentialIntegrityError";
    this.action_ref = actionRef;
  }
}

/**
 * Records a real Effect (EXPECTED EFFECT = `effect.claimed_outcome`,
 * OBSERVED EFFECT = `effect.verified_outcome`, EVIDENCE = either
 * `OutcomeVerification`). Requires `effect.action_ref` to name a REAL,
 * already-recorded Action — checked here (the one place both stores are in
 * scope), never assumed. This is the persisted analogue of
 * `verticalSlice.ts`'s in-memory `effect_action_ref_mismatch` gate.
 */
export async function recordEffect(effect: Effect, recordedAt: string): Promise<EffectRecord> {
  const actions = await loadActions();
  const actionExists = actions.some((r) => r.action.action_id === effect.action_ref);
  if (!actionExists) throw new EffectReferentialIntegrityError(effect.action_ref);

  const [stored] = await effectStore().append([{ effect, recorded_at: recordedAt }]);
  return stored;
}

// ── DELTA / LEARNING / UPDATED STATE — record a real Learning ──────────────

export class LearningReferentialIntegrityError extends Error {
  readonly effect_ref: string;
  constructor(effectRef: string) {
    super(`Learning.effect_ref "${effectRef}" does not reference any real, already-stored Effect — refusing to record a Learning for an Effect that was never recorded`);
    this.name = "LearningReferentialIntegrityError";
    this.effect_ref = effectRef;
  }
}

export interface RecordLearningParams extends DeriveLearningParams {
  recordedAt: string;
  /** Required iff the accepted state_prime's cell is S-frame — see `stateDelta.ts`. */
  candidateSystemicChannelForDelta?: import("./observation").SystemicChannel;
}

/**
 * Derives (`learning.ts::deriveLearning`, unmodified — never re-implemented)
 * and records a real Learning. Requires `params.effect_ref` to name a REAL,
 * already-recorded Effect — checked here. Computes DELTA
 * (`stateDelta.ts::computeStateDelta`) only when the derivation actually
 * produced a `state_prime`; `null` otherwise (see module header — a
 * `no_update` Learning is still real, just delta-less).
 */
export async function recordLearning(params: RecordLearningParams): Promise<LearningRecord> {
  const effects = await loadEffects();
  const effectExists = effects.some((r) => r.effect.effect_id === params.effect_ref);
  if (!effectExists) throw new LearningReferentialIntegrityError(params.effect_ref);

  const learning = deriveLearning(params);

  let delta: StateDelta | null = null;
  if (learning.result.kind === "state_prime") {
    delta = computeStateDelta(params.priorState, learning.result.candidate_state_prime, {
      priorSystemicChannel: params.priorSystemicChannel,
      updatedSystemicChannel: params.candidateSystemicChannelForDelta ?? params.priorSystemicChannel,
    });
  }

  const [stored] = await learningStore().append([{ learning, recorded_at: params.recordedAt, delta }]);
  return stored;
}

// ── Read side: the honest, per-subject lifecycle view ──────────────────────

export type EffectVerificationState = "no_effect_recorded" | "effect_claimed_only" | "effect_verified";

export interface EffectWithLearning {
  effect: EffectRecord;
  verified: boolean;
  learnings: LearningRecord[];
}

export interface ActionLifecycleEntry {
  action: ActionRecord;
  effects: EffectWithLearning[];
  verification_state: EffectVerificationState;
}

export interface ActionLifecycleSummary {
  subject: string;
  actions: ActionLifecycleEntry[];
  counts: {
    actions_total: number;
    no_effect_recorded: number;
    effect_claimed_only: number;
    effect_verified: number;
    learnings_with_state_prime: number;
  };
}

function classify(effects: EffectWithLearning[]): EffectVerificationState {
  if (effects.length === 0) return "no_effect_recorded";
  return effects.some((e) => e.verified) ? "effect_verified" : "effect_claimed_only";
}

/**
 * The real, checked, per-subject (ACTOR) lifecycle read. Every Action is a
 * real stored record whose `owner` matches `subject`; every Effect attached
 * to it is found ONLY via `effect.action_ref` (never chronology); every
 * Learning attached to an Effect is found ONLY via `learning.effect_ref`.
 * Returns an honest empty summary (never throws) when the subject has
 * recorded nothing yet — the same "checked, not skipped" contract
 * `findKnownNeeds` already established.
 */
export async function buildActionLifecycleSummary(subject: string | undefined): Promise<ActionLifecycleSummary> {
  if (subject === undefined) {
    return { subject: "", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };
  }

  const allActions = await loadActions();
  const ownActions = allActions.filter((r) => r.action.owner === subject);

  const entries: ActionLifecycleEntry[] = [];
  let learningsWithStatePrime = 0;

  for (const actionRecord of ownActions) {
    const effectRecords = await findEffectsForAction(actionRecord.action.action_id);
    const effects: EffectWithLearning[] = [];
    for (const effectRecord of effectRecords) {
      const learnings = await findLearningsForEffect(effectRecord.effect.effect_id);
      learningsWithStatePrime += learnings.filter((l) => l.learning.result.kind === "state_prime").length;
      effects.push({ effect: effectRecord, verified: isEffectVerified(effectRecord.effect), learnings });
    }
    entries.push({ action: actionRecord, effects, verification_state: classify(effects) });
  }

  const counts = {
    actions_total: entries.length,
    no_effect_recorded: entries.filter((e) => e.verification_state === "no_effect_recorded").length,
    effect_claimed_only: entries.filter((e) => e.verification_state === "effect_claimed_only").length,
    effect_verified: entries.filter((e) => e.verification_state === "effect_verified").length,
    learnings_with_state_prime: learningsWithStatePrime,
  };

  return { subject, actions: entries, counts };
}
