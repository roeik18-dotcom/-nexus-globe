/**
 * A LEARNING RECORDED BEFORE THE EVIDENCE RULE DOES NOT CLOSE THE GATE.
 *
 * Learnings already exist that were derived from Effects the reporter
 * verified themselves, because that was the only path available at the time.
 * They are real records and this projection still lists them — hiding them
 * would be its own dishonesty. What they must not do is close
 * `LearningSupported`, because that would let the removed self-verification
 * path reach the same result through the back door.
 *
 * So they surface under their own name — UNSUPPORTED_LEGACY — with the count
 * and the refs intact, and the gate stays unmet.
 */
import { describe, expect, it } from "vitest";

import { projectDaySession, type DayIdentity } from "../daySession";
import type { ActionLifecycleSummary } from "../../canon/actionLifecycle";

const SUBJECT = "person_legacy";
const DAY_ID = `day_2026-08-27_${SUBJECT}`;

const identity: DayIdentity = {
  subject_id: SUBJECT, person_id: "p_legacy",
  /* The strongest tier a record can actually substantiate today. What this
     test is about is the Learning gate, so identity must be settled and out
     of the way — not because this projection treats it as a free pass. */
  link_status: "VERIFIED_SAME_PERSON", assurance: "SELF_ATTESTED_SAME_PERSON",
};

const openedEvent = {
  event_id: "ev_open", actor_id: "p_legacy", entity_type: "person",
  entity_id: "p_legacy", event_type: "day.opened", value_tags: [],
  timestamp: "2026-08-27T06:00:00.000Z", visibility: "private", caused_by: [],
  payload: {
    day_id: DAY_ID, subject_id: SUBJECT, intention: "i", context: "c",
    state_t0_refs: [], carry_forward_refs: [], consent: true, sourceRefs: [],
  },
};

/** One Action, one Effect, one Learning — and `verified: false`, which is what
 *  a legacy self-verified Effect now reads as. */
function lifecycle(verified: boolean): ActionLifecycleSummary {
  const effect = {
    effect_id: "effect_legacy", action_ref: "action_legacy", subject: SUBJECT,
    concerns_subject_internal_state: false,
    claimed_outcome: { statement: "s", provenance: "p", verifier_type: "self" as const, confidence: 0.8, time: "2026-08-27T12:00:00Z", method: "m" },
    context: "c", time: "2026-08-27T12:00:00Z", provenance: "p",
  };
  return {
    subject: SUBJECT,
    actions: [{
      action: {
        action: {
          action_id: "action_legacy", type: "non_transfer" as const, owner: SUBJECT,
          mechanism_scope: "self_regulation" as const, consent: true, inputs: [],
          reversibility: "r", time: "2026-08-27T10:00:00Z", provenance: "p",
          day_ref: DAY_ID,
        },
        recorded_at: "2026-08-27T10:00:01Z",
      },
      effects: [{
        effect: { effect: effect, recorded_at: "2026-08-27T12:00:01Z" },
        verified,
        learnings: [{
          learning: {
            learning_id: "learning_legacy", prior_state_ref: "cs", effect_ref: "effect_legacy",
            outcome_verification_ref: "effect_legacy::verified_outcome",
            update_method: "m", provenance: "p", confidence: 0.8,
            time: "2026-08-27T13:00:00Z", context: "c",
            result: { kind: "no_update" as const, reason: "claimed_only" as const },
          },
          recorded_at: "2026-08-27T13:00:01Z",
          delta: null,
        }],
      }],
      verification_state: verified ? "effect_verified" as const : "effect_claimed_only" as const,
    }],
    counts: {
      actions_total: 1, no_effect_recorded: 0,
      effect_claimed_only: verified ? 0 : 1, effect_verified: verified ? 1 : 0,
      learnings_with_state_prime: 0,
    },
  };
}

const project = (verified: boolean) => projectDaySession({
  date: "2026-08-27", identity,
  events: [openedEvent] as never,
  lifecycle: lifecycle(verified),
});

describe("UNSUPPORTED_LEGACY", () => {
  it("does not close LearningSupported when the Effect has no independent evidence", () => {
    const s = project(false);
    const gate = s.gates.find((g) => g.gate === "LearningSupported");
    expect(gate?.met).toBe(false);
    expect(gate?.reason).toContain("UNSUPPORTED_LEGACY");
  });

  it("still lists the Learning, under its own status, rather than pretending it does not exist", () => {
    const s = project(false);
    expect(s.learning_refs.status).toBe("UNSUPPORTED_LEGACY");
    expect(s.learning_refs.refs).toEqual(["learning_legacy"]);
    // `value === null` is this projection's word for UNKNOWN, and the gate is
    // genuinely unsatisfied — the refs stay visible alongside it.
    expect(s.learning_refs.value).toBeNull();
    expect(s.learning_refs.unresolved_reason).toContain("UNSUPPORTED_LEGACY");
  });

  it("closes the gate as SUPPORTED once the same Effect carries independent evidence", () => {
    const s = project(true);
    expect(s.gates.find((g) => g.gate === "LearningSupported")?.met).toBe(true);
    expect(s.learning_refs.status).toBe("SUPPORTED");
    expect(s.learning_refs.value).toEqual(["learning_legacy"]);
  });

  it("EvidencePresent and LearningSupported move together, never independently", () => {
    const without = project(false).gates;
    const with_ = project(true).gates;
    const g = (gs: typeof without, n: string) => gs.find((x) => x.gate === n)?.met;
    expect([g(without, "EvidencePresent"), g(without, "LearningSupported")]).toEqual([false, false]);
    expect([g(with_, "EvidencePresent"), g(with_, "LearningSupported")]).toEqual([true, true]);
  });
});
