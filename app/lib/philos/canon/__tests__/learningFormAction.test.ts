import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setCanonEventStore } from "../canonEventStoreAccessor";
import { InMemoryCanonEventStore } from "../canonEventStore";
import { _setEffectStore } from "../effectStoreAccessor";
import { InMemoryEffectStore } from "../effectStore";
import { _setLearningStore } from "../learningStoreAccessor";
import { _setActionStore } from "../actionStoreAccessor";
import { InMemoryActionStore } from "../actionStore";
import { InMemoryVerificationStore } from "../outcomeVerificationStore";
import { _setVerificationStore } from "../outcomeVerificationStoreAccessor";
import type { Action } from "../action";
import type { OutcomeVerification } from "../outcomeVerification";
import { InMemoryLearningStore } from "../learningStore";
import { recordObservationAction } from "../observationWriter";
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

/** The verifier is a DIFFERENT person from both the actor and the subject. */
const OTHER_PERSON = "person_independent_verifier";

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_1",
    type: "non_transfer",
    owner: REAL_CURRENT_SUBJECT,
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: [],
    reversibility: "reversible",
    time: NOW,
    provenance: "self_reported",
    ...overrides,
  };
}

function makeVerification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "confirmed the reported outcome",
    provenance: "counterparty_report",
    verifier_type: "counterparty",
    verifier_id: OTHER_PERSON,
    confidence: 0.8,
    time: NOW,
    method: "direct_observation",
    // `makeVerifiedEffect` sets concerns_subject_internal_state: true, so
    // canon §17 requires the subject's explicit consent for a non-self check.
    subject_consent: true,
    ...overrides,
  };
}

/** NOTE the name: this Effect carries `verified_outcome` ON THE RECORD.
 *  That field no longer confers verification — see the forgery test below. */
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
  let actionStore: InMemoryActionStore;
  let verificationStore: InMemoryVerificationStore;

  beforeEach(async () => {
    canonStore = new InMemoryCanonEventStore();
    _setCanonEventStore(canonStore);
    effectStore = new InMemoryEffectStore();
    _setEffectStore(effectStore);
    learningStore = new InMemoryLearningStore();
    _setLearningStore(learningStore);
    actionStore = new InMemoryActionStore();
    _setActionStore(actionStore);
    verificationStore = new InMemoryVerificationStore();
    _setVerificationStore(verificationStore);
    await actionStore.append([{ action: makeAction(), recorded_at: NOW }]);
  });
  afterEach(() => {
    _setCanonEventStore(null); _setEffectStore(null); _setLearningStore(null);
    _setActionStore(null); _setVerificationStore(null);
  });

  /** Everything the writer needs except the verification, which each test supplies. */
  async function given(effect: Effect, evt = "evt_1") {
    await recordObservationAction(evt, makeObservation(), NOW);
    await effectStore.append([{ effect, recorded_at: NOW }]);
  }
  const submit = (effect_ref: string, canon_event_id: string) =>
    createLearningForCurrentUserCore(formData({
      effect_ref, canon_event_id,
      update_method: "self-assessment", provenance: "self_reported",
      context: "reassessed after the action",
      confidence: "0.8", candidate_level: "3", candidate_stability: "1",
    }));

  it("rejects when effect_ref does not reference a real, already-recorded Effect", async () => {
    const result = await submit("effect_missing", "evt_1");
    expect(result.ok).toBe(false);
    expect(await learningStore.load()).toHaveLength(0);
  });

  it("rejects when canon_event_id does not reference a real, already-recorded Observation", async () => {
    await effectStore.append([{ effect: makeVerifiedEffect("action_1"), recorded_at: NOW }]);
    await verificationStore.append([{ verification_id: "v1", effect_id: "effect_1", recorded_at: NOW, verification: makeVerification() }]);
    const result = await submit("effect_1", "evt_missing");
    expect(result.ok).toBe(false);
    expect(await learningStore.load()).toHaveLength(0);
  });

  // ── THE EVIDENCE PRECONDITION ───────────────────────────────────────────

  it("refuses outright when no verification exists — an Effect alone is a claim, not evidence", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toBe("evidence_missing");
    expect(await learningStore.load()).toHaveLength(0);
  });

  // FORGERY. The Effect record itself claims `verified_outcome`, exactly as a
  // record written by the old self-verification path would. There is no
  // separate verification, so nobody independent ever checked it, and the
  // writer must not be fooled by the Effect vouching for itself.
  it("refuses an Effect whose own verified_outcome is set but which no separate verification covers", async () => {
    await given(makeVerifiedEffect("action_1"));
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toBe("evidence_missing");
    expect(await learningStore.load()).toHaveLength(0);
  });

  it("refuses a self verification — confirming your own report adds nothing to it", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    await verificationStore.append([{
      verification_id: "v_self", effect_id: "effect_1", recorded_at: NOW,
      verification: makeVerification({ verifier_type: "self", verifier_id: REAL_CURRENT_SUBJECT }),
    }]);
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toBe("verifier_type_self_not_independent");
  });

  // FORGERY. The KIND says third_party; the IDENTITY is the person who acted.
  // A label cannot make someone independent of themselves.
  it("refuses a verification labelled third_party whose verifier is the actor", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    await verificationStore.append([{
      verification_id: "v_actor", effect_id: "effect_1", recorded_at: NOW,
      verification: makeVerification({ verifier_type: "third_party", verifier_id: REAL_CURRENT_SUBJECT }),
    }]);
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    // The subject check runs first, and here the actor IS the subject.
    if (!result.ok) expect(result.refusal).toBe("verifier_is_subject");
  });

  it("refuses a verification whose verifier is the subject the Effect is about", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined, subject: "person_other_subject" }));
    await verificationStore.append([{
      verification_id: "v_subj", effect_id: "effect_1", recorded_at: NOW,
      verification: makeVerification({ verifier_id: "person_other_subject" }),
    }]);
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toBe("verifier_is_subject");
  });

  // FORGERY. An unnamed verifier cannot be shown to be anyone other than the
  // actor, so absence of a name must never read as independence.
  it("refuses a verification that names no verifier at all", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    await verificationStore.append([{
      verification_id: "v_anon", effect_id: "effect_1", recorded_at: NOW,
      verification: makeVerification({ verifier_id: undefined }),
    }]);
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toBe("verifier_id_missing");
  });

  // canon §17 — an outsider may not declare a person's inner state settled.
  it("refuses an independent verification of an internal state without the subject's consent", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    await verificationStore.append([{
      verification_id: "v_noconsent", effect_id: "effect_1", recorded_at: NOW,
      verification: makeVerification({ subject_consent: undefined }),
    }]);
    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toBe("internal_state_needs_subject_consent");
  });

  // ── ACCEPTANCE ──────────────────────────────────────────────────────────

  it("accepts and produces a real state_prime when an independent verification exists", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    await verificationStore.append([{
      verification_id: "v_ok", effect_id: "effect_1", recorded_at: NOW, verification: makeVerification(),
    }]);

    const result = await submit("effect_1", "evt_1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outcome).toBe("state_prime");
    const stored = await learningStore.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].learning.result.kind).toBe("state_prime");
    // The Learning cites the verification record that permitted it — not a
    // string assembled from the Effect's own id.
    expect(stored[0].learning.outcome_verification_ref).toBe("v_ok");
  });

  it("leaves the stored Effect untouched — the verification is joined for the derivation, never written back", async () => {
    await given(makeVerifiedEffect("action_1", { verified_outcome: undefined }));
    await verificationStore.append([{
      verification_id: "v_ok", effect_id: "effect_1", recorded_at: NOW, verification: makeVerification(),
    }]);
    await submit("effect_1", "evt_1");

    const [storedEffect] = await effectStore.load();
    expect(storedEffect.effect.verified_outcome).toBeUndefined();
  });
});
