/**
 * ─────────────────────────────────────────────────────────────────────────
 * QUARANTINE — EXISTING / EXPERIMENTAL PRODUCT RULE.
 * THIS IS NOT A CANONICAL PHILOS STATE TRANSITION.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Read this before calling anything in this file, and before citing it as
 * precedent anywhere else.
 *
 * What this module actually is: an EXISTING product rule that advances a
 * `DomainState.level` by `prior.level + 1` (`valueDomain/valueDomainConfig.ts
 * ::deriveDomainStateUpdate`) whenever a verified Effect and a real prior
 * DomainState exist. Its structural gates (same subject, real Action↔Effect
 * link, real verification threshold, real prior state) are genuine and are
 * NOT in question. The `+1` is.
 *
 * What it is NOT: canon's `State → State'` transition. Canon's own
 * `learning.ts` deliberately refuses to compute a candidate Level/Stability
 * at all — it only GATES a caller-proposed one — precisely because canon
 * §26 keeps "receiving support raises future stability/capacity" an OPEN
 * EMPIRICAL ASSUMPTION to measure, never to assert. `prior.level + 1` is an
 * assertion of exactly that assumption, in the simplest possible form.
 * Nothing in canon authorizes it, and this pass does not authorize it
 * either. It stays because it is existing, working product code with real
 * gates and its own tests — not because it was ratified.
 *
 * Therefore, standing rules for this module:
 *   - Do NOT treat a `DomainState` produced here as State(t+1) for any
 *     PHILOS canon purpose, and do not feed it into a canon `CellState`.
 *   - Do NOT copy `prior.level + 1` (or any successor formula) into canon.
 *   - Do NOT present its output on a product surface as the person's
 *     measured state having changed. It is a product-level bookkeeping
 *     increment over an existing product-level reading.
 *   - The genuine, unresolved canonical questions this rule side-steps are
 *     recorded — deliberately UNSOLVED — in `STATE-TRANSITION-BOUNDARY.md`
 *     in this same directory. Resolve them there, not here.
 *
 * The quarantine is also carried in the TYPE (`ExperimentalStateRule` /
 * `DomainStateLearningResult.rule` below), so a caller cannot consume this
 * result without the label being in front of them.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Philos Canon — DomainState Learning: real Effect → Evidence →
 * updated DomainState, closing the loop this pass's product decision
 * asked for. Pure, deterministic, no I/O.
 *
 * **Reuses `deriveDomainStateUpdate` verbatim — no parallel state-
 * advancement formula.** That function already encodes the real
 * discipline ("a state only advances when a real, checked observed_result
 * + accepted outcome exists"); this module's only job is to bridge REAL
 * canon `Action`/`Effect` records into the `DomainActionResult` shape
 * that function already accepts, and to gate the whole derivation on
 * real, structural checks BEFORE calling it — never a second copy of the
 * `level + 1` rule.
 *
 * **Evidence — reuses canon's own `Effect.verified_outcome`/
 * `isEffectVerified`, no new Evidence entity.** The task that requested
 * this module explicitly asked to check first whether a separate
 * Evidence model is genuinely required: it is not. `verified_outcome`
 * (`OutcomeVerification`: statement, provenance, verifier_type,
 * confidence, time, method) already IS canon's real evidence record —
 * `isEffectVerified` (`effect.ts`) is the real, already-tested
 * verification-threshold gate, reused here unmodified.
 *
 * **Prior state — resolved ONLY via `findLatestDomainState`
 * (`domainStateQuery.ts`), never re-derived here.** The task's own
 * instruction: "Do not duplicate prior-state logic inside Learning."
 *
 * **No parameter inference from free text.** `domain_id`/`parameter_id`
 * are always caller-supplied, explicit arguments — this module never
 * reads `Effect.claimed_outcome.statement`/`context` to guess which
 * parameter an Effect is "about." A caller who can't honestly name the
 * parameter simply cannot call this function meaningfully — that is the
 * intended failure mode, not a gap to paper over.
 */
import type { Action } from "./action";
import type { Effect } from "./effect";
import { isEffectVerified } from "./effect";
import type { DomainState } from "../valueDomain/valueDomainConfig";
import { deriveDomainStateUpdate } from "../valueDomain/valueDomainConfig";
import type { DomainStateRecord } from "./domainStateStore";
import { findLatestDomainState } from "./domainStateQuery";

/**
 * The quarantine label, carried in the type system rather than only in a
 * comment. Any caller that destructures an `ok: true` result has this
 * string in scope; any surface that renders the result can render it.
 */
export type ExperimentalStateRule = "EXPERIMENTAL_PRODUCT_RULE__NOT_CANONICAL_PHILOS_STATE_TRANSITION";
export const EXPERIMENTAL_STATE_RULE: ExperimentalStateRule =
  "EXPERIMENTAL_PRODUCT_RULE__NOT_CANONICAL_PHILOS_STATE_TRANSITION";

export type DomainStateLearningResult =
  | {
      ok: true;
      /** Always `EXPERIMENTAL_STATE_RULE` — see this module's QUARANTINE header. */
      rule: ExperimentalStateRule;
      prior_state: DomainState;
      effect_id: string;
      action_id: string;
      evidence: string;
      delta: number;
      updated_state: DomainState;
    }
  | { ok: false; reason: string };

/**
 * The one real gate: PRIOR DOMAIN STATE → ACTION → EFFECT → EVIDENCE →
 * updated DomainState. Every check is structural and real — same subject
 * end to end, Effect genuinely references this Action, verification
 * threshold genuinely met, a real prior state genuinely exists for this
 * exact (subject, domain_id, parameter_id). Any one failing blocks the
 * whole derivation with a precise, named reason — never a partial or
 * inferred result.
 */
export function deriveDomainStateLearning(params: {
  subject: string;
  domain_id: string;
  parameter_id: string;
  action: Action;
  effect: Effect;
  priorStateRecords: readonly DomainStateRecord[];
}): DomainStateLearningResult {
  const { subject, domain_id, parameter_id, action, effect, priorStateRecords } = params;

  if (action.owner !== subject) {
    return { ok: false, reason: `wrong subject — Action ${action.action_id}'s owner (${action.owner}) does not match ${subject}` };
  }
  if (effect.subject !== subject) {
    return { ok: false, reason: `wrong subject — Effect ${effect.effect_id}'s subject (${effect.subject}) does not match ${subject}` };
  }
  if (effect.action_ref !== action.action_id) {
    return { ok: false, reason: `Effect ${effect.effect_id} is not linked to Action ${action.action_id} (action_ref: ${effect.action_ref})` };
  }
  if (!isEffectVerified(effect)) {
    return { ok: false, reason: `Effect ${effect.effect_id} is not verified — evidence threshold not met (canon §17, verified_outcome required)` };
  }

  const priorState = findLatestDomainState(priorStateRecords, subject, domain_id, parameter_id, effect.time);
  if (!priorState) {
    return { ok: false, reason: `no real prior DomainState for subject=${subject}, domain_id=${domain_id}, parameter_id=${parameter_id} before ${effect.time} — Learning cannot advance a state that was never observed` };
  }

  const verifiedOutcome = effect.verified_outcome!;
  const evidence = `${verifiedOutcome.verifier_type}/${verifiedOutcome.method}: ${verifiedOutcome.statement}`;

  const updated = deriveDomainStateUpdate(priorState, {
    result_id: `dresult_${effect.effect_id}`,
    parameter_id,
    action_id: action.action_id,
    expected_result: effect.claimed_outcome.statement,
    observed_result: verifiedOutcome.statement,
    accepted: true,
    evidence,
    time: effect.time,
    provenance: "REAL",
  });
  if (!updated) {
    // Structurally unreachable given the checks above (accepted/observed_result/
    // evidence are all real by construction here) — kept as a real, honest
    // fallback rather than a non-null assertion, same defensive posture
    // `actionFormAction.ts`'s own try/catch uses for its referential-integrity class.
    return { ok: false, reason: "deriveDomainStateUpdate declined the update despite a verified Effect and real prior state — parameter_id mismatch between prior state and derived result" };
  }

  return {
    ok: true,
    rule: EXPERIMENTAL_STATE_RULE,
    prior_state: priorState,
    effect_id: effect.effect_id,
    action_id: action.action_id,
    evidence,
    delta: updated.level - priorState.level,
    updated_state: updated,
  };
}
