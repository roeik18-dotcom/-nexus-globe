import { describe, expect, it } from "vitest";

import { buildWeeklyLearningSummary } from "../weeklyLearning";
import type { ActionLifecycleSummary } from "../../canon/actionLifecycle";
import { buildValueDomainInstance } from "../personInstance";
import type { DomainStateRecord } from "../../canon/domainStateStore";

const SUBJECT = "person_weekly_test";
const NOW = "2026-08-17T12:00:00+03:00";

const EMPTY_LIFECYCLE: ActionLifecycleSummary = {
  subject: SUBJECT, actions: [],
  counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
};

describe("buildWeeklyLearningSummary", () => {
  it("is honestly all-zero/empty when no real activity exists in the window", () => {
    const summary = buildWeeklyLearningSummary({
      subject_id: SUBJECT, now: NOW, lifecycle: EMPTY_LIFECYCLE, instances: [], unresolvedUnknowns: [], nextActionLabel: null,
    });
    expect(summary.actions_this_week).toBe(0);
    expect(summary.effects_verified_this_week).toBe(0);
    expect(summary.state_transitions_this_week).toEqual([]);
    expect(summary.evidence_this_week).toEqual([]);
    expect(summary.carry_forward_priorities).toEqual([]);
  });

  it("counts only real Actions/Effects recorded within the real 7-day window, excludes older ones", () => {
    const lifecycle: ActionLifecycleSummary = {
      subject: SUBJECT,
      actions: [
        {
          action: { action: { action_id: "a_recent", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: "2026-08-16T09:00:00+03:00", provenance: "self_reported" }, recorded_at: "2026-08-16T09:00:00+03:00" },
          effects: [{
            effect: { effect: { effect_id: "e_recent", action_ref: "a_recent", subject: SUBJECT, concerns_subject_internal_state: false, claimed_outcome: { statement: "x", provenance: "self_reported", verifier_type: "self", confidence: 0.5, time: "2026-08-16T09:00:00+03:00", method: "m" }, verified_outcome: { statement: "x", provenance: "self_reported", verifier_type: "self", confidence: 0.5, time: "2026-08-16T09:00:00+03:00", method: "m" }, context: "c", time: "2026-08-16T09:00:00+03:00", provenance: "self_reported" }, recorded_at: "2026-08-16T09:00:00+03:00" },
            verified: true, learnings: [],
          }],
          verification_state: "effect_verified",
        },
        {
          action: { action: { action_id: "a_old", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: "2026-08-01T09:00:00+03:00", provenance: "self_reported" }, recorded_at: "2026-08-01T09:00:00+03:00" },
          effects: [],
          verification_state: "no_effect_recorded",
        },
      ],
      counts: { actions_total: 2, no_effect_recorded: 1, effect_claimed_only: 0, effect_verified: 1, learnings_with_state_prime: 0 },
    };
    const summary = buildWeeklyLearningSummary({ subject_id: SUBJECT, now: NOW, lifecycle, instances: [], unresolvedUnknowns: [], nextActionLabel: null });
    expect(summary.actions_this_week).toBe(1);
    expect(summary.effects_verified_this_week).toBe(1);
  });

  it("derives real state transitions within the window from real DomainState history, from_level null for the first-ever reading", () => {
    const records: DomainStateRecord[] = [
      { state_id: "s0", recorded_at: "2026-08-10T09:00:00+03:00", state: { domain_id: "music_canon", parameter_id: "p1", subject: SUBJECT, level: 0, confidence: 0.5, observed_at: "2026-08-10T09:00:00+03:00", provenance: "REAL" } },
      { state_id: "s1", recorded_at: "2026-08-16T09:00:00+03:00", state: { domain_id: "music_canon", parameter_id: "p1", subject: SUBJECT, level: 1, confidence: 0.6, observed_at: "2026-08-16T09:00:00+03:00", evidence: "real evidence", provenance: "REAL" } },
    ];
    const instance = buildValueDomainInstance({ subject_id: SUBJECT, domain_id: "music_canon", records, source_kind: "CANON", source_refs: [], asOf: NOW });
    const summary = buildWeeklyLearningSummary({ subject_id: SUBJECT, now: NOW, lifecycle: EMPTY_LIFECYCLE, instances: [instance], unresolvedUnknowns: ["unk1"], nextActionLabel: "do X" });
    expect(summary.state_transitions_this_week).toEqual([{ domain_id: "music_canon", parameter_id: "p1", from_level: 0, to_level: 1, observed_at: "2026-08-16T09:00:00+03:00" }]);
    expect(summary.evidence_this_week).toEqual(["real evidence"]);
    expect(summary.unresolved_unknowns).toEqual(["unk1"]);
    expect(summary.carry_forward_priorities).toEqual(["do X"]);
  });
});
