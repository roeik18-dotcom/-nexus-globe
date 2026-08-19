"use server";

/**
 * QUARANTINE — this is the write path for an EXISTING / EXPERIMENTAL
 * PRODUCT RULE, not for a canonical PHILOS state transition. Everything it
 * appends carries `deriveDomainStateUpdate`'s `prior.level + 1` increment,
 * which canon does not state and this pass does not authorize as canon.
 * Read `domainStateLearning.ts`'s QUARANTINE header before calling this,
 * and `STATE-TRANSITION-BOUNDARY.md` before generalizing from it.
 *
 * Reachability, stated rather than assumed: this action is reachable from a
 * primary user surface — `/hub/human-config` renders
 * `CreateDomainStateLearningForm`. Behavior is left intact deliberately (no
 * silent disabling of working product code); the form now labels the rule
 * as experimental at the point of use, and the result carries the
 * `rule: EXPERIMENTAL_STATE_RULE` label through to the UI.
 *
 * State-fusion backbone — the real write path for DomainState Learning:
 * resolves real, already-persisted Action/Effect/prior-DomainState
 * records, runs `deriveDomainStateLearning`'s real gate, and — only on a
 * genuine `ok: true` — appends the resulting `updated_state` through the
 * SAME real `domainStateStore()` every other DomainState write already
 * uses. Never mutates a prior record: this is one more real, chronological
 * append, exactly like `createDomainStateForCurrentUserCore`'s own writes.
 */
import { revalidatePath } from "next/cache";

import { loadActions } from "./actionStoreAccessor";
import { loadEffects } from "./effectStoreAccessor";
import { findDomainStatesForSubject } from "./domainStateStoreAccessor";
import { domainStateStore } from "./domainStateStoreAccessor";
import { deriveDomainStateLearning, EXPERIMENTAL_STATE_RULE, type ExperimentalStateRule } from "./domainStateLearning";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";

export type ApplyDomainStateLearningResult =
  | {
      ok: true;
      /** Always `EXPERIMENTAL_STATE_RULE` — the quarantine label, carried to
       *  the UI so the surface can say what rule produced this number. */
      rule: ExperimentalStateRule;
      state_id: string;
      domain_id: string;
      parameter_id: string;
      action_id: string;
      effect_id: string;
      prior_level: number;
      prior_observed_at: string;
      delta: number;
      updated_level: number;
      updated_observed_at: string;
      evidence: string;
    }
  | { ok: false; message: string };

/** Testable core — no `revalidatePath`. */
export async function applyDomainStateLearningCore(formData: FormData): Promise<ApplyDomainStateLearningResult> {
  const subject = String(formData.get("subject") ?? "").trim();
  const domain_id = String(formData.get("domain_id") ?? "").trim();
  const parameter_id = String(formData.get("parameter_id") ?? "").trim();
  const action_id = String(formData.get("action_id") ?? "").trim();
  const effect_id = String(formData.get("effect_id") ?? "").trim();

  if (!subject) return { ok: false, message: "subject is required" };
  if (!domain_id) return { ok: false, message: "domain_id is required" };
  if (!parameter_id) return { ok: false, message: "parameter_id is required" };
  if (!action_id) return { ok: false, message: "action_id is required — pick a real, already-recorded Action" };
  if (!effect_id) return { ok: false, message: "effect_id is required — pick a real, already-recorded Effect" };

  const actions = await loadActions();
  const effects = await loadEffects();
  const priorStateRecords = await findDomainStatesForSubject(subject);

  const actionRecord = actions.find((a) => a.action.action_id === action_id);
  const effectRecord = effects.find((e) => e.effect.effect_id === effect_id);
  if (!actionRecord) return { ok: false, message: `Action ${action_id} not found — cannot derive Learning from an Action that was never recorded` };
  if (!effectRecord) return { ok: false, message: `Effect ${effect_id} not found — cannot derive Learning from an Effect that was never recorded` };

  const learning = deriveDomainStateLearning({
    subject, domain_id, parameter_id,
    action: actionRecord.action, effect: effectRecord.effect,
    priorStateRecords,
  });
  if (!learning.ok) return { ok: false, message: learning.reason };

  const now = systemClock.now();
  const [stored] = await domainStateStore().append([{
    state_id: createIdGenerator().next("dstate_learned"),
    state: learning.updated_state,
    recorded_at: now,
  }]);

  return {
    ok: true,
    rule: EXPERIMENTAL_STATE_RULE,
    state_id: stored.state_id,
    domain_id, parameter_id, action_id, effect_id,
    prior_level: learning.prior_state.level,
    prior_observed_at: learning.prior_state.observed_at,
    delta: learning.delta,
    updated_level: learning.updated_state.level,
    updated_observed_at: learning.updated_state.observed_at,
    evidence: learning.evidence,
  };
}

/** The network edge. */
export async function applyDomainStateLearning(formData: FormData): Promise<ApplyDomainStateLearningResult> {
  const result = await applyDomainStateLearningCore(formData);
  if (result.ok) {
    revalidatePath("/hub/human-config");
    revalidatePath("/hub");
    revalidatePath("/dynamics");
  }
  return result;
}
