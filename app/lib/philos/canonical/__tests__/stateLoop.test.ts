/**
 * Phase 4 ROUNDTRIP_PASS — State(t0) → Action → Effect → Evidence →
 * Learning → State(t1), persisted, then re-projected through the SAME
 * `buildValueDomainInstance` Hub/Dynamics would call, proving the
 * post-loop instance reflects exactly what was persisted (no drift between
 * what the loop wrote and what the shared projection reads back).
 *
 * InMemory*Store injected via each store's own accessor test-helper — same
 * pattern `actionLifecycle.test.ts` already established. Never touches a
 * real data directory.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Action } from "../../canon/action";
import { InMemoryActionStore } from "../../canon/actionStore";
import { _setActionStore } from "../../canon/actionStoreAccessor";
import type { Effect } from "../../canon/effect";
import { InMemoryEffectStore } from "../../canon/effectStore";
import { _setEffectStore } from "../../canon/effectStoreAccessor";
import type { OutcomeVerification } from "../../canon/outcomeVerification";
import { InMemoryDomainStateStore } from "../../canon/domainStateStore";
import { _setDomainStateStore, domainStateStore } from "../../canon/domainStateStoreAccessor";
import type { DomainState } from "../../valueDomain/valueDomainConfig";
import { advanceDomainState, StateLoopNoPriorStateError, StateLoopUnresolvedRefError } from "../stateLoop";
import { buildValueDomainInstance } from "../personInstance";
import { MUSIC_CANON_DOMAIN_ID } from "../musicMasterLoader";

const SUBJECT = "person_state_loop_test";
const PARAMETER = "harmony_practice";

function priorState(overrides: Partial<DomainState> = {}): DomainState {
  return {
    domain_id: MUSIC_CANON_DOMAIN_ID,
    parameter_id: PARAMETER,
    subject: SUBJECT,
    level: 0,
    confidence: 0.6,
    observed_at: "2026-08-14T09:00:00+03:00",
    evidence: "initial reading",
    provenance: "REAL",
    ...overrides,
  };
}

function verification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "identified 3 consecutive cadences correctly",
    provenance: "self_reported",
    verifier_type: "self",
    confidence: 0.85,
    time: "2026-08-16T09:00:00+03:00",
    method: "self_report_checkin",
    ...overrides,
  };
}

function action(overrides: Partial<Omit<Action, "owner" | "time">> = {}): Omit<Action, "owner" | "time"> {
  return {
    action_id: "action_state_loop_1",
    type: "non_transfer",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: [],
    reversibility: "reversible",
    provenance: "self_reported",
    ...overrides,
  };
}

beforeEach(async () => {
  _setActionStore(new InMemoryActionStore());
  _setEffectStore(new InMemoryEffectStore());
  _setDomainStateStore(new InMemoryDomainStateStore());
  await domainStateStore().append([{ state_id: "seed_1", state: priorState(), recorded_at: priorState().observed_at }]);
});

afterEach(() => {
  _setActionStore(null);
  _setEffectStore(null);
  _setDomainStateStore(null);
});

describe("advanceDomainState — full roundtrip", () => {
  it("advances State(t0) to State(t1) when the Effect is verified, and persists real refs", async () => {
    const result = await advanceDomainState({
      subject: SUBJECT,
      domain_id: MUSIC_CANON_DOMAIN_ID,
      parameter_id: PARAMETER,
      asOf: "2026-08-16T09:00:00+03:00",
      action: action(),
      effect: {
        effect_id: "effect_state_loop_1",
        concerns_subject_internal_state: false,
        claimed_outcome: verification({ statement: "expected to identify 3 cadences" }),
        verified_outcome: verification(),
        context: "harmony practice session",
        provenance: "self_reported",
      },
      sourceRefs: [{ kind: "MUSIC", source_number: "GEN-MU-PROC-04" }],
    });

    expect(result.priorState.level).toBe(0);
    expect(result.action.action.action_id).toBe("action_state_loop_1");
    expect(result.effect.effect.effect_id).toBe("effect_state_loop_1");
    expect(result.evidence.verified).toBe(true);
    expect(result.learning.attempted).toBe(true);
    if (result.learning.attempted && result.learning.kind === "state_prime") {
      expect(result.learning.state.state.level).toBe(1);
      expect(result.learning.state.state.source_refs).toEqual(["MUSIC:GEN-MU-PROC-04"]);
    } else {
      throw new Error("expected state_prime");
    }

    // Re-project through the SAME builder Hub/Dynamics call — proves no
    // drift between what the loop wrote and what the shared projection reads.
    const allRecords = await domainStateStore().load();
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: MUSIC_CANON_DOMAIN_ID, records: allRecords,
      source_kind: "CANON", source_refs: [], asOf: "2026-08-17T00:00:00+03:00",
    });
    expect(instance.current_state[0]).toMatchObject({ level: 1 });
    expect(instance.changed).toBe(true);
    expect(instance.history).toHaveLength(2);
    expect(instance.evidence).toContain("initial reading");
  });

  it("gates closed (no State(t1) persisted) when the Effect is claimed-only, never verified", async () => {
    const before = await domainStateStore().load();

    const result = await advanceDomainState({
      subject: SUBJECT,
      domain_id: MUSIC_CANON_DOMAIN_ID,
      parameter_id: PARAMETER,
      asOf: "2026-08-16T09:00:00+03:00",
      action: action({ action_id: "action_state_loop_2" }),
      effect: {
        effect_id: "effect_state_loop_2",
        concerns_subject_internal_state: false,
        claimed_outcome: verification({ statement: "expected result, not yet observed" }),
        context: "harmony practice session",
        provenance: "self_reported",
      },
      sourceRefs: [],
    });

    expect(result.evidence.verified).toBe(false);
    expect(result.learning).toEqual({ attempted: true, kind: "no_update", reason: "gate_closed" });

    const after = await domainStateStore().load();
    expect(after.length).toBe(before.length); // no new DomainState persisted
    // The Action and Effect ARE real and persisted even though the state gate stayed closed.
    expect(result.action.action.action_id).toBe("action_state_loop_2");
    expect(result.effect.effect.effect_id).toBe("effect_state_loop_2");
  });

  it("rejects a canonical ref that does not resolve, before persisting anything", async () => {
    await expect(
      advanceDomainState({
        subject: SUBJECT,
        domain_id: MUSIC_CANON_DOMAIN_ID,
        parameter_id: PARAMETER,
        asOf: "2026-08-16T09:00:00+03:00",
        action: action({ action_id: "action_state_loop_3" }),
        effect: {
          effect_id: "effect_state_loop_3",
          concerns_subject_internal_state: false,
          claimed_outcome: verification(),
          verified_outcome: verification(),
          context: "harmony practice session",
          provenance: "self_reported",
        },
        sourceRefs: [{ kind: "MUSIC", source_number: "DOES-NOT-EXIST" }],
      }),
    ).rejects.toThrow(StateLoopUnresolvedRefError);
  });

  it("refuses to advance a (subject, domain_id, parameter_id) with no real prior state", async () => {
    await expect(
      advanceDomainState({
        subject: "person_with_no_state",
        domain_id: MUSIC_CANON_DOMAIN_ID,
        parameter_id: PARAMETER,
        asOf: "2026-08-16T09:00:00+03:00",
        action: action({ action_id: "action_state_loop_4" }),
        effect: {
          effect_id: "effect_state_loop_4",
          concerns_subject_internal_state: false,
          claimed_outcome: verification(),
          context: "n/a",
          provenance: "self_reported",
        },
        sourceRefs: [],
      }),
    ).rejects.toThrow(StateLoopNoPriorStateError);
  });
});
