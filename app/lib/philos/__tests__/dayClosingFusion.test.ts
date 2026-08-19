/**
 * dayClosingFusion.ts — question engine tests. Builds real
 * `ActionLifecycleEntry`/`ActionLifecycleSummary` values through the SAME
 * in-memory-store + recordAction/recordEffect/recordLearning path
 * `actionLifecycle.test.ts` uses, rather than hand-typing fixtures — so
 * these tests exercise the real shape, not an approximation of it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Action } from "../canon/action";
import { InMemoryActionStore } from "../canon/actionStore";
import { _setActionStore } from "../canon/actionStoreAccessor";
import type { Effect } from "../canon/effect";
import { InMemoryEffectStore } from "../canon/effectStore";
import { _setEffectStore } from "../canon/effectStoreAccessor";
import type { OutcomeVerification } from "../canon/outcomeVerification";
import { InMemoryLearningStore } from "../canon/learningStore";
import { _setLearningStore } from "../canon/learningStoreAccessor";
import type { CellState } from "../canon/cellState";
import { recordAction, recordEffect, recordLearning, buildActionLifecycleSummary } from "../canon/actionLifecycle";
import type { NeedRecord } from "../canon/needStore";
import type { TensionItem } from "../tension";
import type { OrientationCore } from "../orientationCore";
import type { EntityLink } from "../bridge/entityLink";
import {
  buildDayClosingQuestions,
  buildDayReconciliation,
  buildCarryForward,
  buildNextDayOpening,
} from "../dayClosingFusion";
import { buildDemoMusicConfig, DEMO_MUSIC_SUBJECT } from "../valueDomain/demoMusicDomain";

function mark(overrides: Partial<{ canon_event_id: string; subject: string; domain: "G" | "E" | "C"; level: number; stability: number; observed_at: string }>) {
  return {
    id: overrides.canon_event_id ?? "x",
    canon_event_id: overrides.canon_event_id ?? "x",
    subject: overrides.subject ?? "person_test_x",
    domain: overrides.domain ?? "E",
    frame: "I" as const,
    level: overrides.level ?? 0,
    stability: overrides.stability ?? 0.5,
    deficitType: "RELATIVE" as const,
    context: "test",
    reference: "self_goal:test",
    observed_at: overrides.observed_at ?? "2026-08-15T10:00:00.000Z",
    recorded_at: "2026-08-15T10:00:01.000Z",
    provenance: "self_reported" as const,
    persisted_or_derived: "persisted" as const,
    label: "test",
    tooltip: "test",
  };
}

function verification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "reported feeling less overloaded this evening",
    provenance: "self_reported",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-08-15T12:00:00Z",
    method: "self_report_checkin",
    ...overrides,
  };
}

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_1",
    type: "non_transfer",
    owner: "person_test_x",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: ["need_1"],
    reversibility: "reversible",
    time: "2026-08-15T10:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_1",
    action_ref: "action_1",
    subject: "person_test_x",
    concerns_subject_internal_state: true,
    claimed_outcome: verification(),
    context: "evening_session",
    time: "2026-08-15T12:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

const priorState: CellState = { domain: "E", frame: "I", level: -2, stability: 0.4 };
const candidateStatePrime: CellState = { domain: "E", frame: "I", level: -1, stability: 0.5 };

const TODAY = "2026-08-15";

beforeEach(() => {
  _setActionStore(new InMemoryActionStore());
  _setEffectStore(new InMemoryEffectStore());
  _setLearningStore(new InMemoryLearningStore());
});

describe("buildDayClosingQuestions — every real question class", () => {
  it("CLARIFY: an Action with no Effect at all", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const lifecycle = await buildActionLifecycleSummary("person_test_x");
    const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === TODAY);
    const questions = buildDayClosingQuestions({ todaysActions, pendingNeeds: [], tensions: [], lifecycle });
    expect(questions.some((q) => q.question_class === "clarify" && q.related_action_id === "action_1")).toBe(true);
  });

  it("EVIDENCE: an Action with a claimed but unverified Effect", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    await recordEffect(baseEffect(), "2026-08-15T12:00:01Z");
    const lifecycle = await buildActionLifecycleSummary("person_test_x");
    const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === TODAY);
    const questions = buildDayClosingQuestions({ todaysActions, pendingNeeds: [], tensions: [], lifecycle });
    expect(questions.some((q) => q.question_class === "evidence" && q.related_action_id === "action_1")).toBe(true);
    expect(questions.some((q) => q.question_class === "clarify")).toBe(false);
  });

  it("no questions for a fully verified, realized Action with matching claimed/verified text", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const stmt = verification();
    await recordEffect(baseEffect({ verified_outcome: stmt }), "2026-08-15T12:00:01Z");
    await recordLearning({
      learning_id: "learning_1",
      prior_state_ref: "cs_1",
      effect_ref: "effect_1",
      outcome_verification_ref: "ver_1",
      update_method: "manual_review",
      provenance: "self_reported",
      confidence: 0.8,
      time: "2026-08-15T13:00:00Z",
      context: "evening_session",
      effect: baseEffect({ verified_outcome: stmt }),
      priorState,
      candidateStatePrime,
      recordedAt: "2026-08-15T13:00:01Z",
    });
    const lifecycle = await buildActionLifecycleSummary("person_test_x");
    const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === TODAY);
    const questions = buildDayClosingQuestions({ todaysActions, pendingNeeds: [], tensions: [], lifecycle });
    const realClasses = questions.filter((q) => q.status === "open");
    expect(realClasses).toEqual([]);
  });

  it("EXPECTED_VS_ACTUAL: claimed and verified outcome statements genuinely differ", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    await recordEffect(baseEffect({ verified_outcome: verification({ statement: "actually felt more overloaded" }) }), "2026-08-15T12:00:01Z");
    const lifecycle = await buildActionLifecycleSummary("person_test_x");
    const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === TODAY);
    const questions = buildDayClosingQuestions({ todaysActions, pendingNeeds: [], tensions: [], lifecycle });
    expect(questions.some((q) => q.question_class === "expected_vs_actual")).toBe(true);
  });

  it("GAP + NEXT_ACTION: a pending Need with no Action", () => {
    const need: NeedRecord = {
      need: { need_id: "need_1", subject: "person_test_x", desired_change: "learn compost basics", scope: { kind: "domain", domain: "C" }, provenance: "self_reported", context: "test", time: "2026-08-15T09:00:00Z", expiry: "2026-09-15T09:00:00Z", consent_scope: "visible_to_matching_engine" },
      recorded_at: "2026-08-15T09:00:01Z",
      status: "open",
    };
    const emptyLifecycle = { subject: "person_test_x", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };
    const questions = buildDayClosingQuestions({ todaysActions: [], pendingNeeds: [need], tensions: [], lifecycle: emptyLifecycle });
    expect(questions.some((q) => q.question_class === "gap" && q.related_need_id === "need_1")).toBe(true);
    expect(questions.some((q) => q.question_class === "next_action" && q.related_need_id === "need_1")).toBe(true);
  });

  it("CONSTRAINT: only high/medium severity tensions produce a question", () => {
    const tensions: TensionItem[] = [
      { id: "t1", subject: "person_test_x", config_family: "human", label: "x", current_state: "deficit", change_direction: "worsening", severity: "high", evidence_source: "test", provenance: "REAL", status: "open" },
      { id: "t2", subject: "person_test_x", config_family: "human", label: "y", current_state: "ok", change_direction: "stable", severity: "low", evidence_source: "test", provenance: "REAL", status: "open" },
    ];
    const emptyLifecycle = { subject: "s", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };
    const questions = buildDayClosingQuestions({ todaysActions: [], pendingNeeds: [], tensions, lifecycle: emptyLifecycle });
    const constraintQs = questions.filter((q) => q.question_class === "constraint");
    expect(constraintQs).toHaveLength(1);
    expect(constraintQs[0].related_tension_id).toBe("t1");
  });

  it("VALUE and HUMAN_VALUE are always present and always status=blocked — never fabricated as open", () => {
    const emptyLifecycle = { subject: "s", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };
    const questions = buildDayClosingQuestions({ todaysActions: [], pendingNeeds: [], tensions: [], lifecycle: emptyLifecycle });
    const value = questions.find((q) => q.question_class === "value");
    const humanValue = questions.find((q) => q.question_class === "human_value");
    expect(value?.status).toBe("blocked");
    expect(humanValue?.status).toBe("blocked");
  });

  it("a day with nothing unresolved produces only the two standing blocked questions — not a static checklist", () => {
    const emptyLifecycle = { subject: "s", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };
    const questions = buildDayClosingQuestions({ todaysActions: [], pendingNeeds: [], tensions: [], lifecycle: emptyLifecycle });
    expect(questions).toHaveLength(2);
    expect(questions.every((q) => q.status === "blocked")).toBe(true);
  });
});

const NEED_1: NeedRecord = {
  need: { need_id: "need_1", subject: "person_test_x", desired_change: "learn compost basics", scope: { kind: "domain", domain: "C" }, provenance: "self_reported", context: "test", time: "2026-08-15T09:00:00Z", expiry: "2026-09-15T09:00:00Z", consent_scope: "visible_to_matching_engine" },
  recorded_at: "2026-08-15T09:00:01Z",
  status: "open",
};

const EMPTY_LIFECYCLE = { subject: "person_test_x", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };

describe("buildDayReconciliation — INTENT → ACTION → EFFECT chain, classified", () => {
  it("a pending Need is not_executed; PLANNED is never fabricated as a separate status", async () => {
    const entries = buildDayReconciliation({ pendingNeeds: [NEED_1], todaysActions: [] });
    expect(entries).toEqual([{ id: "need_need_1", kind: "need", label: "learn compost basics", status: "not_executed", related_need_id: "need_1" }]);
  });

  it("classifies today's actions by their real verification_state", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const lifecycle1 = await buildActionLifecycleSummary("person_test_x");
    const entries1 = buildDayReconciliation({ pendingNeeds: [], todaysActions: lifecycle1.actions });
    expect(entries1[0].status).toBe("executed");
  });
});

describe("buildCarryForward — one canonical carry-forward object", () => {
  const core: OrientationCore = { subject: "person_test_x", E: mark({ level: -2, observed_at: "2026-08-15T10:00:00.000Z" }), priorE: mark({ level: -3, observed_at: "2026-08-14T10:00:00.000Z" }) };
  const tensions: TensionItem[] = [
    { id: "t1", subject: "person_test_x", config_family: "human", label: "רגש בגירעון", current_state: "level -2", change_direction: "improving", severity: "high", evidence_source: "test", provenance: "REAL", status: "open" },
  ];

  it("value_domain_state is always unknown_blocked — never fabricated", () => {
    const cf = buildCarryForward({
      subject: "person_test_x", today: "2026-08-15", core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [NEED_1], tensions, todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
    });
    expect(cf.value_domain_state).toBe("unknown_blocked");
    expect(cf.open_needs).toEqual([NEED_1]);
    expect(cf.unresolved_tensions).toEqual(tensions);
  });

  it("collective_propagation is empty for a private Action with no real bridge link — never fabricated", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const lifecycle = await buildActionLifecycleSummary("person_test_x");
    const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === TODAY);
    const cf = buildCarryForward({
      subject: "person_test_x", today: TODAY, core, lifecycle,
      pendingNeeds: [], tensions: [], todaysActions, realizedLearningsToday: 0, bridgeRegistry: [],
    });
    expect(cf.collective_propagation).toEqual([]);
  });

  it("collective_propagation surfaces a real bridge link when one exists for today's Action", async () => {
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    const lifecycle = await buildActionLifecycleSummary("person_test_x");
    const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === TODAY);
    const link: EntityLink = {
      link_id: "link_test", relation: "ACTION_AFFECTS_COMMUNITY",
      source: { type: "action", canonical_id: "action_1", source_system: "test", source_local_id: "action_1" },
      target: { type: "community", canonical_id: "demo_vg_x", source_system: "test", source_local_id: "demo_vg_x" },
      provenance: "DEMO", confidence: 1,
    };
    const cf = buildCarryForward({
      subject: "person_test_x", today: TODAY, core, lifecycle,
      pendingNeeds: [], tensions: [], todaysActions, realizedLearningsToday: 0, bridgeRegistry: [link],
    });
    expect(cf.collective_propagation).toEqual([link]);
  });
});

describe("buildNextDayOpening — generated from the SAME carry-forward, answers the 7 questions", () => {
  it("a fully-open day produces real, non-empty answers referencing the actual open items", () => {
    const core: OrientationCore = { subject: "person_test_x", E: mark({ level: -2 }), priorE: mark({ level: -3, observed_at: "2026-08-14T10:00:00.000Z" }) };
    const tensions: TensionItem[] = [
      { id: "t1", subject: "person_test_x", config_family: "human", label: "רגש בגירעון", current_state: "level -2", change_direction: "improving", severity: "high", evidence_source: "test", provenance: "REAL", status: "open" },
    ];
    const cf = buildCarryForward({
      subject: "person_test_x", today: "2026-08-15", core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [NEED_1], tensions, todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
    });
    const opening = buildNextDayOpening(cf);
    expect(opening.what_is_constrained).toContain("רגש בגירעון");
    expect(opening.next_relevant_action).toContain("learn compost basics");
    expect(opening.what_matters_most).toBe("רגש בגירעון");
  });

  it("a fully-resolved day states UNKNOWN honestly rather than fabricating a possibility", () => {
    const core: OrientationCore = { subject: "person_test_x" };
    const cf = buildCarryForward({
      subject: "person_test_x", today: "2026-08-15", core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
    });
    const opening = buildNextDayOpening(cf);
    expect(opening.what_possibility_exists).toContain("לא ידוע");
    expect(opening.what_is_constrained).toContain("אין Tension");
    expect(opening.what_remains_open).toContain("אין Need");
  });

  it("a REAL subject with no attached Value Domain always states unknown_blocked, never the DEMO domain's content", () => {
    const core: OrientationCore = { subject: "person_test_x" };
    const cf = buildCarryForward({
      subject: "person_test_x", today: "2026-08-15", core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
    });
    expect(cf.value_domain_state).toBe("unknown_blocked");
    const opening = buildNextDayOpening(cf);
    expect(opening.what_changed_in_value_domain).toContain("לא נבחר Value Domain");
  });
});

describe("Generic Value-Domain Config engine — full DEMO cycle (Music reference instance)", () => {
  it("Day Opening N -> domain Action -> observed result -> evidence -> domain parameter update -> Day Closing N -> carry-forward -> Day Opening N+1", () => {
    const today = "2026-08-15";
    const musicConfig = buildDemoMusicConfig(today);
    const core: OrientationCore = { subject: DEMO_MUSIC_SUBJECT };

    const cf = buildCarryForward({
      subject: DEMO_MUSIC_SUBJECT, today, core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
      valueDomain: { config: musicConfig, subject: DEMO_MUSIC_SUBJECT },
    });

    expect(cf.value_domain_state).not.toBe("unknown_blocked");
    if (cf.value_domain_state === "unknown_blocked") throw new Error("unreachable");

    // The domain parameter that had a real accepted+evidenced result today
    // actually advanced (prior level 1 -> 2); the untouched parameter did not.
    expect(cf.value_domain_state.updated_states).toHaveLength(1);
    expect(cf.value_domain_state.updated_states[0].parameter_id).toBe("demo_param_harmony_practice");
    expect(cf.value_domain_state.updated_states[0].level).toBe(2);
    const harmonyRow = cf.value_domain_state.summary.find((s) => s.parameter_id === "demo_param_harmony_practice")!;
    expect(harmonyRow.current_level).toBe(2);
    const repertoireRow = cf.value_domain_state.summary.find((s) => s.parameter_id === "demo_param_repertoire_breadth")!;
    expect(repertoireRow.current_level).toBe(0); // untouched today, stays at prior level

    // Day Opening(N+1), generated FROM this same carry-forward.
    const nextOpening = buildNextDayOpening(cf);
    expect(nextOpening.what_changed_in_value_domain).toContain("1 פרמטר");
    expect(nextOpening.active_domain_gap).toContain("רוחב רפרטואר");
    expect(nextOpening.domain_action_today).toContain("1 תוצאת");

    // Human state is independently derived — attaching a Value-Domain
    // config never mutates it (proves "do not mutate Human state merely
    // because Domain state changed").
    expect(cf.human_change.every((r) => r.current_level === null)).toBe(true);
  });

  it("a second, unrelated domain instance can reuse the exact same contract with zero code changes here", () => {
    const today = "2026-08-15";
    const otherDomainConfig = {
      domain: { domain_id: "demo_domain_woodworking", label: "[DEMO] נגרות", provenance: "DEMO" as const },
      parameters: [{ parameter_id: "wp1", domain_id: "demo_domain_woodworking", label: "דיוק חיתוך", definition: "test", provenance: "DEMO" as const }],
      states: [{ domain_id: "demo_domain_woodworking", parameter_id: "wp1", subject: "demo_wood_subject", level: 0, confidence: 0.8, observed_at: "2026-08-14T10:00:00Z", provenance: "DEMO" as const }],
      capabilities: [],
      gaps: [],
      acceptanceCriteria: [],
      actionResults: [{ result_id: "wr1", parameter_id: "wp1", expected_result: "e", observed_result: "o", accepted: true, evidence: "ev", time: `${today}T09:00:00Z`, provenance: "DEMO" as const }],
    };
    const core: OrientationCore = { subject: "demo_wood_subject" };
    const cf = buildCarryForward({
      subject: "demo_wood_subject", today, core, lifecycle: EMPTY_LIFECYCLE,
      pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
      valueDomain: { config: otherDomainConfig, subject: "demo_wood_subject" },
    });
    expect(cf.value_domain_state).not.toBe("unknown_blocked");
    if (cf.value_domain_state === "unknown_blocked") throw new Error("unreachable");
    expect(cf.value_domain_state.updated_states[0].level).toBe(1);
  });
});
