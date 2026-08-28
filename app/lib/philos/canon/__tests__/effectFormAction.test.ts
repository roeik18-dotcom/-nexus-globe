import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setActionStore } from "../actionStoreAccessor";
import { InMemoryActionStore } from "../actionStore";
import { _setEffectStore } from "../effectStoreAccessor";
import { InMemoryEffectStore } from "../effectStore";
import { recordAction } from "../actionLifecycle";
import { createEffectForCurrentUserCore } from "../effectFormAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID_EFFECT = {
  context: "self-reported via /marketplace",
  provenance: "self_reported",
  statement: "I completed the reversible self-regulation action",
  method: "self-observation",
  confidence: "0.8",
};

describe("createEffectForCurrentUserCore — real Effect creation (LOOP 6)", () => {
  let actionStore: InMemoryActionStore;
  let effectStore: InMemoryEffectStore;

  beforeEach(async () => {
    actionStore = new InMemoryActionStore();
    _setActionStore(actionStore);
    effectStore = new InMemoryEffectStore();
    _setEffectStore(effectStore);
  });
  afterEach(() => { _setActionStore(null); _setEffectStore(null); });

  it("rejects when action_ref does not reference a real, already-recorded Action", async () => {
    const result = await createEffectForCurrentUserCore(formData({ ...VALID_EFFECT, action_ref: "action_does_not_exist" }));
    expect(result.ok).toBe(false);
    expect(await effectStore.load()).toHaveLength(0);
  });

  it("rejects an out-of-range confidence", async () => {
    const stored = await recordAction(
      { action_id: "action_1", type: "non_transfer", owner: REAL_CURRENT_SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: new Date().toISOString(), provenance: "test" },
      new Date().toISOString(),
    );
    const result = await createEffectForCurrentUserCore(formData({ ...VALID_EFFECT, action_ref: stored.action.action_id, confidence: "1.5" }));
    expect(result.ok).toBe(false);
    expect(await effectStore.load()).toHaveLength(0);
  });

  it("accepts a real submission referencing a real Action, stays claimed-only when self_verified is not checked", async () => {
    const storedAction = await recordAction(
      { action_id: "action_2", type: "non_transfer", owner: REAL_CURRENT_SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: new Date().toISOString(), provenance: "test" },
      new Date().toISOString(),
    );
    const result = await createEffectForCurrentUserCore(formData({ ...VALID_EFFECT, action_ref: storedAction.action.action_id }));
    expect(result.ok).toBe(true);
    const stored = await effectStore.load();
    expect(stored[0].effect.subject).toBe(REAL_CURRENT_SUBJECT);
    expect(stored[0].effect.claimed_outcome.verifier_type).toBe("self");
    expect(stored[0].effect.verified_outcome).toBeUndefined();
  });

  // THE SELF-VERIFICATION SHORTCUT IS GONE, AND STAYS GONE.
  // This form once copied the claimed outcome into `verified_outcome` when a
  // `self_verified` checkbox was ticked, so one person could report an
  // outcome and certify it in a single submission. Submitting that field now
  // does nothing at all — asserted here rather than merely deleted, because a
  // deleted test cannot catch the shortcut being reintroduced.
  it("ignores a submitted self_verified field entirely — a reporter cannot verify their own outcome", async () => {
    const storedAction = await recordAction(
      { action_id: "action_3", type: "non_transfer", owner: REAL_CURRENT_SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: new Date().toISOString(), provenance: "test" },
      new Date().toISOString(),
    );
    const result = await createEffectForCurrentUserCore(formData({ ...VALID_EFFECT, action_ref: storedAction.action.action_id, self_verified: "on" }));
    expect(result.ok).toBe(true);
    const stored = await effectStore.load();
    expect(stored[0].effect.verified_outcome).toBeUndefined();
    // The claim itself is still recorded, and still honestly labelled a self-report.
    expect(stored[0].effect.claimed_outcome.verifier_type).toBe("self");
  });
});
