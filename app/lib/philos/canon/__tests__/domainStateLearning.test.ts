import { describe, expect, it } from "vitest";
import { deriveDomainStateLearning } from "../domainStateLearning";
import type { Action } from "../action";
import type { Effect } from "../effect";
import type { DomainStateRecord } from "../domainStateStore";
import type { DomainState } from "../../valueDomain/valueDomainConfig";

const SUBJECT = "test_subject";
const DOMAIN_ID = "human_temperament";
const PARAMETER_ID = "temperament_pace";

function action(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_1", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation",
    consent: true, inputs: [], reversibility: "reversible", time: "2026-08-16T10:00:00Z", provenance: "test",
    ...overrides,
  };
}
function effect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_1", action_ref: "action_1", subject: SUBJECT, concerns_subject_internal_state: false,
    claimed_outcome: { statement: "claimed", provenance: "test", verifier_type: "self", confidence: 1, time: "2026-08-16T11:00:00Z", method: "observation" },
    verified_outcome: { statement: "verified outcome", provenance: "test", verifier_type: "self", confidence: 1, time: "2026-08-16T11:00:00Z", method: "observation" },
    context: "test", time: "2026-08-16T11:00:00Z", provenance: "test",
    ...overrides,
  };
}
function priorRecord(overrides: Partial<DomainState> = {}): DomainStateRecord {
  const state: DomainState = {
    domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID, subject: SUBJECT, level: 0.3, confidence: 0.8,
    observed_at: "2026-08-15T10:00:00Z", provenance: "REAL", ...overrides,
  };
  return { state_id: "dstate_prior_1", state, recorded_at: state.observed_at };
}

describe("deriveDomainStateLearning — real Effect → Evidence → updated DomainState, gated end to end", () => {
  it("PERMITTED PATH: same subject, linked Effect, verified, real prior state → real updated state", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect(), priorStateRecords: [priorRecord()],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prior_state.level).toBe(0.3);
      expect(result.updated_state.level).toBe(1.3); // deriveDomainStateUpdate's real +1 rule, reused verbatim
      expect(result.delta).toBe(1);
      expect(result.updated_state.domain_id).toBe(DOMAIN_ID);
      expect(result.updated_state.parameter_id).toBe(PARAMETER_ID);
      expect(result.evidence).toContain("self/observation");
    }
  });

  it("BLOCKED: no real prior DomainState for this exact parameter", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect(), priorStateRecords: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("no real prior DomainState");
  });

  it("BLOCKED: wrong parameter — a prior state exists, but for a DIFFERENT parameter", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect(),
      priorStateRecords: [priorRecord({ parameter_id: "temperament_activity_level" })],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("no real prior DomainState");
  });

  it("BLOCKED: wrong subject — Action owner does not match", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action({ owner: "someone_else" }), effect: effect(), priorStateRecords: [priorRecord()],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("wrong subject");
  });

  it("BLOCKED: wrong subject — Effect subject does not match", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect({ subject: "someone_else" }), priorStateRecords: [priorRecord()],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("wrong subject");
  });

  it("BLOCKED: Effect not linked to this Action (action_ref mismatch)", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect({ action_ref: "a_different_action" }), priorStateRecords: [priorRecord()],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not linked");
  });

  it("BLOCKED: unverified Effect — evidence threshold not met, never inferred as verified", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect({ verified_outcome: undefined }), priorStateRecords: [priorRecord()],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("not verified");
  });

  it("never uses a prior state from a LATER time than the Effect — chronological only", () => {
    const result = deriveDomainStateLearning({
      subject: SUBJECT, domain_id: DOMAIN_ID, parameter_id: PARAMETER_ID,
      action: action(), effect: effect({ time: "2026-08-14T10:00:00Z" }), // effect BEFORE the only prior state
      priorStateRecords: [priorRecord({ observed_at: "2026-08-15T10:00:00Z" })],
    });
    expect(result.ok).toBe(false);
  });
});
