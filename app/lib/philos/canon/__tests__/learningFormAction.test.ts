import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setCanonEventStore } from "../canonEventStoreAccessor";
import { InMemoryCanonEventStore } from "../canonEventStore";
import { _setEffectStore } from "../effectStoreAccessor";
import { InMemoryEffectStore } from "../effectStore";
import { _setLearningStore } from "../learningStoreAccessor";
import { InMemoryLearningStore } from "../learningStore";
import { recordObservationAction } from "../observationIngestion";
import { createLearningForCurrentUserCore } from "../learningFormAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import type { Observation } from "../observation";
import type { Effect } from "../effect";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const NOW = new Date().toISOString();

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: REAL_CURRENT_SUBJECT,
    domain: "E",
    frame: "I",
    reference: "self_baseline",
    context: "test",
    time: NOW,
    provenance: "self_reported",
    confidence: 0.9,
    expiry: new Date(Date.now() + 86400000).toISOString(),
    level: 2,
    stability: 0,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function makeVerifiedEffect(action_ref: string, overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_1",
    action_ref,
    subject: REAL_CURRENT_SUBJECT,
    concerns_subject_internal_state: true,
    claimed_outcome: { statement: "felt better", provenance: "self_reported", verifier_type: "self", confidence: 0.8, time: NOW, method: "self-observation" },
    verified_outcome: { statement: "felt better", provenance: "self_reported", verifier_type: "self", confidence: 0.8, time: NOW, method: "self-observation" },
    context: "test",
    time: NOW,
    provenance: "self_reported",
    ...overrides,
  };
}

describe("createLearningForCurrentUserCore — real Learning creation (LOOP 6)", () => {
  let canonStore: InMemoryCanonEventStore;
  let effectStore: InMemoryEffectStore;
  let learningStore: InMemoryLearningStore;

  beforeEach(() => {
    canonStore = new InMemoryCanonEventStore();
    _setCanonEventStore(canonStore);
    effectStore = new InMemoryEffectStore();
    _setEffectStore(effectStore);
    learningStore = new InMemoryLearningStore();
    _setLearningStore(learningStore);
  });
  afterEach(() => { _setCanonEventStore(null); _setEffectStore(null); _setLearningStore(null); });

  it("rejects when effect_ref does not reference a real, already-recorded Effect", async () => {
    const result = await createLearningForCurrentUserCore(formData({
      effect_ref: "effect_missing", canon_event_id: "evt_1", update_method: "m", provenance: "p", context: "c",
      confidence: "0.5", candidate_level: "1", candidate_stability: "0.5",
    }));
    expect(result.ok).toBe(false);
    expect(await learningStore.load()).toHaveLength(0);
  });

  it("rejects when canon_event_id does not reference a real, already-recorded Observation", async () => {
    await effectStore.append([{ effect: makeVerifiedEffect("action_1"), recorded_at: NOW }]);
    const result = await createLearningForCurrentUserCore(formData({
      effect_ref: "effect_1", canon_event_id: "evt_missing", update_method: "m", provenance: "p", context: "c",
      confidence: "0.5", candidate_level: "1", candidate_stability: "0.5",
    }));
    expect(result.ok).toBe(false);
    expect(await learningStore.load()).toHaveLength(0);
  });

  it("produces a real state_prime when the referenced Effect is genuinely verified and the Observation cell matches", async () => {
    await recordObservationAction("evt_1", makeObservation(), NOW);
    await effectStore.append([{ effect: makeVerifiedEffect("action_1"), recorded_at: NOW }]);

    const result = await createLearningForCurrentUserCore(formData({
      effect_ref: "effect_1", canon_event_id: "evt_1", update_method: "self-assessment", provenance: "self_reported", context: "reassessed after the action",
      confidence: "0.8", candidate_level: "3", candidate_stability: "1",
    }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outcome).toBe("state_prime");
    const stored = await learningStore.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].learning.result.kind).toBe("state_prime");
  });

  it("produces an honest no_update (claimed_only) when the referenced Effect was never verified — never fabricates a state change", async () => {
    await recordObservationAction("evt_2", makeObservation(), NOW);
    await effectStore.append([{ effect: makeVerifiedEffect("action_1", { effect_id: "effect_2", verified_outcome: undefined }), recorded_at: NOW }]);

    const result = await createLearningForCurrentUserCore(formData({
      effect_ref: "effect_2", canon_event_id: "evt_2", update_method: "self-assessment", provenance: "self_reported", context: "reassessed",
      confidence: "0.8", candidate_level: "3", candidate_stability: "1",
    }));

    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.outcome).toBe("no_update"); expect(result.reason).toBe("claimed_only"); }
  });
});
