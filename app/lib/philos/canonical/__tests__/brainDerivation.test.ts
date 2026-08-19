import { describe, expect, it } from "vitest";

import type { ActionLifecycleSummary } from "../../canon/actionLifecycle";
import { buildBrainDerivation } from "../brainDerivation";
import { buildValueDomainInstance } from "../personInstance";
import type { DomainStateRecord } from "../../canon/domainStateStore";

const SUBJECT = "person_brain_test";

function lifecycleWithVerifiedRoundtrip(): ActionLifecycleSummary {
  return {
    subject: SUBJECT,
    actions: [
      {
        action: {
          action: {
            action_id: "action_1", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation",
            consent: true, inputs: [], reversibility: "reversible", time: "2026-08-16T09:00:00+03:00", provenance: "self_reported",
          },
          recorded_at: "2026-08-16T09:00:00+03:00",
        },
        effects: [
          {
            effect: {
              effect: {
                effect_id: "effect_1", action_ref: "action_1", subject: SUBJECT, concerns_subject_internal_state: false,
                claimed_outcome: { statement: "expected to practice", provenance: "self_reported", verifier_type: "self", confidence: 0.7, time: "2026-08-16T09:00:00+03:00", method: "self_report" },
                verified_outcome: { statement: "practiced and identified 3 cadences", provenance: "self_reported", verifier_type: "self", confidence: 0.9, time: "2026-08-16T09:05:00+03:00", method: "self_report_checkin" },
                context: "harmony practice", time: "2026-08-16T09:05:00+03:00", provenance: "self_reported",
              },
              recorded_at: "2026-08-16T09:05:00+03:00",
            },
            verified: true,
            learnings: [
              {
                learning: {
                  learning_id: "learning_1", prior_state_ref: "s0", effect_ref: "effect_1", outcome_verification_ref: "ov1",
                  update_method: "gate", provenance: "derived", confidence: 0.9, time: "2026-08-16T09:06:00+03:00", context: "harmony",
                  result: { kind: "state_prime", candidate_state_prime: { domain: "E", frame: "I", level: 1, stability: 0.5 } },
                },
                recorded_at: "2026-08-16T09:06:00+03:00",
                delta: null,
              },
            ],
          },
        ],
        verification_state: "effect_verified",
      },
    ],
    counts: { actions_total: 1, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 1, learnings_with_state_prime: 1 },
  };
}

const EMPTY_LIFECYCLE: ActionLifecycleSummary = {
  subject: SUBJECT, actions: [],
  counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
};

describe("buildBrainDerivation", () => {
  it("makes a completed Action→Effect→Evidence→Learning roundtrip visible as change → evidence → learning → next action", () => {
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: lifecycleWithVerifiedRoundtrip(), instances: [] });

    expect(derivation.changes).toHaveLength(1);
    const change = derivation.changes[0];
    expect(change.what_changed).toContain("action_1");
    expect(change.why_it_changed).toBe("practiced and identified 3 cadences");
    expect(change.evidence).toContain("[VERIFIED]");
    expect(change.learnings).toEqual([{ learning_id: "learning_1", kind: "state_prime" }]);

    expect(derivation.why_it_changed).toContain("practiced and identified 3 cadences");
    expect(derivation.evidence.some((e) => e.includes("VERIFIED"))).toBe(true);
    // No open loops in this fixture, no empty instances -> honest null next_action
    expect(derivation.next_action).toBeNull();
  });

  it("surfaces an open loop (no Effect recorded) as UNKNOWN and as the NEXT_ACTION", () => {
    const lifecycle: ActionLifecycleSummary = {
      subject: SUBJECT,
      actions: [
        {
          action: { action: { action_id: "action_2", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: "2026-08-16T09:00:00+03:00", provenance: "self_reported" }, recorded_at: "2026-08-16T09:00:00+03:00" },
          effects: [],
          verification_state: "no_effect_recorded",
        },
      ],
      counts: { actions_total: 1, no_effect_recorded: 1, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
    };
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle, instances: [] });
    expect(derivation.unknown.some((u) => u.includes("no Effect recorded"))).toBe(true);
    expect(derivation.next_action?.label).toContain("action_2");
    expect(derivation.changes[0].evidence).toBeNull();
    expect(derivation.changes[0].why_it_changed).toBeNull();
  });

  it("keeps the cited OutcomeVerification's real verifier/confidence/method/time instead of flattening them away", () => {
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: lifecycleWithVerifiedRoundtrip(), instances: [] });

    expect(derivation.evidence_records).toHaveLength(1);
    const r = derivation.evidence_records[0];
    // Every field verbatim off `effect_1.verified_outcome` — the record the
    // string form (`evidence[]`) drops everything but statement+method from.
    expect(r.stance).toBe("VERIFIED");
    expect(r.statement).toBe("practiced and identified 3 cadences");
    expect(r.verifier_type).toBe("self");
    expect(r.confidence).toBe(0.9);
    expect(r.method).toBe("self_report_checkin");
    expect(r.time).toBe("2026-08-16T09:05:00+03:00");
    expect(r.effect_id).toBe("effect_1");
    expect(r.action_id).toBe("action_1");
    // The string form is unchanged for its existing consumers.
    expect(derivation.evidence.some((e) => e.startsWith("[VERIFIED]"))).toBe(true);
  });

  it("cites the claimed_outcome — labelled CLAIMED — when the Effect is not verified", () => {
    const lifecycle = lifecycleWithVerifiedRoundtrip();
    lifecycle.actions[0].effects[0].verified = false;
    lifecycle.actions[0].verification_state = "effect_claimed_only";
    lifecycle.counts = { actions_total: 1, no_effect_recorded: 0, effect_claimed_only: 1, effect_verified: 0, learnings_with_state_prime: 1 };

    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle, instances: [] });
    const r = derivation.evidence_records[0];
    expect(r.stance).toBe("CLAIMED");
    expect(r.statement).toBe("expected to practice");
    expect(r.confidence).toBe(0.7);
    expect(r.verifier_type).toBe("self");
  });

  it("has no evidence_record for an Action with no Effect at all", () => {
    const lifecycle: ActionLifecycleSummary = {
      subject: SUBJECT,
      actions: [
        {
          action: { action: { action_id: "action_3", type: "non_transfer", owner: SUBJECT, mechanism_scope: "self_regulation", consent: true, inputs: [], reversibility: "reversible", time: "2026-08-16T09:00:00+03:00", provenance: "self_reported" }, recorded_at: "2026-08-16T09:00:00+03:00" },
          effects: [],
          verification_state: "no_effect_recorded",
        },
      ],
      counts: { actions_total: 1, no_effect_recorded: 1, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
    };
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle, instances: [] });
    expect(derivation.changes[0].evidence_record).toBeNull();
    expect(derivation.evidence_records).toEqual([]);
  });

  it("states the open Learning/State(t+1) boundary when a verified Effect exists but no Learning transition does", () => {
    // Same fixture as the completed roundtrip, minus the Learning record —
    // i.e. exactly the shape person_roei's real store has today (1 Action,
    // 1 verified Effect, 0 Learning records).
    const lifecycle = lifecycleWithVerifiedRoundtrip();
    lifecycle.actions[0].effects[0].learnings = [];
    lifecycle.counts.learnings_with_state_prime = 0;

    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle, instances: [] });

    // The verified evidence is still reported truthfully...
    expect(derivation.evidence.some((e) => e.includes("[VERIFIED]"))).toBe(true);
    // ...and the boundary is stated, not left to be inferred from adjacency.
    const boundary = derivation.unknown.find((u) => u.includes("no Learning transition is established"));
    expect(boundary).toBeDefined();
    expect(boundary).toContain("does not prove Learning or State(t+1)");
    expect(derivation.changes[0].learnings).toEqual([]);
  });

  it("does not repeat the boundary line when a real Learning transition record exists", () => {
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: lifecycleWithVerifiedRoundtrip(), instances: [] });
    expect(derivation.unknown.some((u) => u.includes("no Learning transition is established"))).toBe(false);
  });

  it("keeps hypotheses structurally separate from evidence, never fabricated without a real marker", () => {
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: EMPTY_LIFECYCLE, instances: [] });
    expect(derivation.hypotheses).toEqual([]);
    expect(derivation.evidence).toEqual([]);
  });

  it("surfaces a real White/COLOR_ID=0 OPEN conflict as CONFIG REVIEW (not a hypothesis) when a Color ref is cited", () => {
    const records: DomainStateRecord[] = [
      {
        state_id: "s1", recorded_at: "2026-08-15T10:00:00+03:00",
        state: {
          domain_id: "music_canon", parameter_id: "p1", subject: SUBJECT, level: 1, confidence: 0.5,
          observed_at: "2026-08-15T10:00:00+03:00", provenance: "REAL", source_refs: ["COLOR:0"],
        },
      },
    ];
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: "music_canon", records, source_kind: "CANON",
      source_refs: [{ kind: "COLOR", source_number: "0" }], asOf: "2026-08-16T00:00:00+03:00",
    });
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: EMPTY_LIFECYCLE, instances: [instance] });
    // Semantic-integrity repair: config provenance markers are review
    // metadata about the CONFIG, never hypotheses about the subject.
    expect(derivation.config_review.some((h) => h.includes("COLOR:0") && h.includes("OPEN"))).toBe(true);
    expect(derivation.hypotheses).toHaveLength(0);
    expect(derivation.evidence.every((e) => !e.includes("HYPOTHESIS") && !e.includes("CONFIG_REVIEW"))).toBe(true);
  });

  it("NEXT-ACTION TRUTH: pending Need outranks everything; first-observation prompt gated on hasRealObservation", () => {
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: "music_canon", records: [], source_kind: "CANON", source_refs: [], asOf: "2026-08-16T00:00:00+03:00",
    });
    // a real observation exists → the stale "רשום תצפית ראשונה" must NOT appear
    const gated = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: EMPTY_LIFECYCLE, instances: [instance], hasRealObservation: true });
    expect(gated.next_action?.label ?? "").not.toContain("רשום תצפית ראשונה");
    // a pending Need wins the priority order outright
    const withNeed = buildBrainDerivation({
      subject_id: SUBJECT, lifecycle: EMPTY_LIFECYCLE, instances: [instance],
      pendingNeeds: [{ need_id: "n1", desired_change: "לגבש צעד" }], hasRealObservation: true,
    });
    expect(withNeed.next_action?.label).toBe("טפל בצורך: לגבש צעד");
  });

  it("reports empty current_state as UNKNOWN and offers it as the next action when no open Action/Effect loop exists", () => {
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: "music_canon", records: [], source_kind: "CANON", source_refs: [], asOf: "2026-08-16T00:00:00+03:00",
    });
    const derivation = buildBrainDerivation({ subject_id: SUBJECT, lifecycle: EMPTY_LIFECYCLE, instances: [instance] });
    expect(derivation.unknown.some((u) => u.includes("music_canon"))).toBe(true);
    expect(derivation.next_action?.label).toContain("music_canon");
  });
});
