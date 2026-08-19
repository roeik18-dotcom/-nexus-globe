import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _setActionStore } from "../actionStoreAccessor";
import { InMemoryActionStore } from "../actionStore";
import { _setEffectStore } from "../effectStoreAccessor";
import { InMemoryEffectStore } from "../effectStore";
import { _setDomainStateStore } from "../domainStateStoreAccessor";
import { InMemoryDomainStateStore } from "../domainStateStore";
import { applyDomainStateLearningCore } from "../domainStateLearningAction";
import type { Action } from "../action";
import type { Effect } from "../effect";

const SUBJECT = "test_subject";
const DOMAIN_ID = "human_temperament";
const PARAMETER_ID = "temperament_pace";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const REAL_ACTION: Action = {
  action_id: "action_1", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation",
  consent: true, inputs: [], reversibility: "reversible", time: "2026-08-16T10:00:00Z", provenance: "test",
};
const VERIFIED_EFFECT: Effect = {
  effect_id: "effect_1", action_ref: "action_1", subject: SUBJECT, concerns_subject_internal_state: false,
  claimed_outcome: { statement: "claimed", provenance: "test", verifier_type: "self", confidence: 1, time: "2026-08-16T11:00:00Z", method: "observation" },
  verified_outcome: { statement: "verified", provenance: "test", verifier_type: "self", confidence: 1, time: "2026-08-16T11:00:00Z", method: "observation" },
  context: "test", time: "2026-08-16T11:00:00Z", provenance: "test",
};

describe("applyDomainStateLearningCore — real write path over real (isolated) stores", () => {
  let actionStore: InMemoryActionStore;
  let effectStore: InMemoryEffectStore;
  let domainStateStore: InMemoryDomainStateStore;

  beforeEach(async () => {
    actionStore = new InMemoryActionStore();
    await actionStore.append([{ action: REAL_ACTION, recorded_at: REAL_ACTION.time }]);
    _setActionStore(actionStore);

    effectStore = new InMemoryEffectStore();
    await effectStore.append([{ effect: VERIFIED_EFFECT, recorded_at: VERIFIED_EFFECT.time }]);
    _setEffectStore(effectStore);

    domainStateStore = new InMemoryDomainStateStore();
    await domainStateStore.append([{
      state_id: "dstate_prior_1",
      state: { domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID, subject: SUBJECT, level: 0.3, confidence: 0.8, observed_at: "2026-08-15T10:00:00Z", provenance: "REAL" },
      recorded_at: "2026-08-15T10:00:00Z",
    }]);
    _setDomainStateStore(domainStateStore);
  });

  afterEach(() => {
    _setActionStore(null);
    _setEffectStore(null);
    _setDomainStateStore(null);
  });

  it("PERMITTED PATH: real prior state + real linked verified Effect → appends a real updated DomainState", async () => {
    const result = await applyDomainStateLearningCore(formData({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID, action_id: "action_1", effect_id: "effect_1",
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updated_level).toBe(1.3);
      expect(result.delta).toBe(1);
      // BEFORE → ACTION → EFFECT → LEARNING → AFTER — the full real
      // display shape the UI renders, all real, not fabricated.
      expect(result.prior_level).toBe(0.3);
      expect(result.action_id).toBe("action_1");
      expect(result.effect_id).toBe("effect_1");
      expect(result.evidence).toContain("verified");
    }
    const all = await domainStateStore.load();
    expect(all).toHaveLength(2); // prior + newly appended — history preserved, never overwritten
    expect(all[0].state.level).toBe(0.3); // the prior record is untouched
    expect(all[1].state.level).toBe(1.3);
  });

  it("BLOCKED: unknown action_id — cannot derive Learning from an Action that was never recorded", async () => {
    const result = await applyDomainStateLearningCore(formData({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID, action_id: "nope", effect_id: "effect_1",
    }));
    expect(result.ok).toBe(false);
    expect(await domainStateStore.load()).toHaveLength(1); // unchanged
  });

  it("BLOCKED: unknown effect_id", async () => {
    const result = await applyDomainStateLearningCore(formData({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID, action_id: "action_1", effect_id: "nope",
    }));
    expect(result.ok).toBe(false);
    expect(await domainStateStore.load()).toHaveLength(1);
  });

  it("BLOCKED: real gate propagates through the write path — wrong parameter yields 0 new writes", async () => {
    const result = await applyDomainStateLearningCore(formData({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: "a_parameter_with_no_prior_state", action_id: "action_1", effect_id: "effect_1",
    }));
    expect(result.ok).toBe(false);
    expect(await domainStateStore.load()).toHaveLength(1);
  });
});
