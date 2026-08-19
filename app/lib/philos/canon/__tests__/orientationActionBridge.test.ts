/**
 * orientationActionBridge.ts — the orientation ↔ Action/Effect/Learning
 * integration boundary. Synthetic fixtures only, InMemory stores injected
 * via the accessor test-helpers, same pattern as `actionLifecycle.test.ts`.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCanonEventStore } from "../canonEventStore";
import type { Observation } from "../observation";
import type { Action } from "../action";
import { InMemoryActionStore } from "../actionStore";
import { _setActionStore } from "../actionStoreAccessor";
import type { Effect } from "../effect";
import { InMemoryEffectStore } from "../effectStore";
import { _setEffectStore } from "../effectStoreAccessor";
import { InMemoryLearningStore } from "../learningStore";
import { _setLearningStore } from "../learningStoreAccessor";
import { recordAction, recordEffect } from "../actionLifecycle";
import { resolveOrientationActionContext } from "../orientationActionBridge";

const AS_OF = "2026-08-15T13:00:00Z";

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_bridge_x",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-15T09:00:00Z",
    provenance: "self_reported",
    confidence: 0.8,
    expiry: "2026-12-01T00:00:00Z",
    level: -0.4,
    stability: 0.3,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_bridge_1",
    type: "non_transfer",
    owner: "person_bridge_x",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: ["canon_event_bridge_1"],
    reversibility: "reversible",
    time: "2026-08-15T10:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_bridge_1",
    action_ref: "action_bridge_1",
    subject: "person_bridge_x",
    concerns_subject_internal_state: true,
    claimed_outcome: {
      statement: "felt calmer",
      provenance: "self_reported",
      verifier_type: "self",
      confidence: 0.7,
      time: "2026-08-15T12:00:00Z",
      method: "self_report_checkin",
    },
    context: "evening_session",
    time: "2026-08-15T12:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

beforeEach(() => {
  _setActionStore(new InMemoryActionStore());
  _setEffectStore(new InMemoryEffectStore());
  _setLearningStore(new InMemoryLearningStore());
});

describe("resolveOrientationActionContext — orientation → action linkage", () => {
  it("resolves observation, cellState, and subject from the real persisted Observation", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([{ canon_event_id: "canon_event_bridge_1", canon_type: "observation", payload: baseObservation(), recorded_at: "2026-08-15T09:00:01Z" }]);

    const ctx = await resolveOrientationActionContext({ store, canon_event_id: "canon_event_bridge_1", asOf: AS_OF });

    expect(ctx.observation.attempted).toBe(true);
    expect(ctx.cellState.attempted).toBe(true);
    expect(ctx.subject).toBe("person_bridge_x");
  });

  it("finds a real Action only when it explicitly references this canon_event_id in inputs — reference-checked, not chronology-checked", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([{ canon_event_id: "canon_event_bridge_1", canon_type: "observation", payload: baseObservation(), recorded_at: "2026-08-15T09:00:01Z" }]);
    await recordAction(baseAction({ inputs: ["canon_event_bridge_1"] }), "2026-08-15T10:00:01Z");
    // A second, unrelated Action for the same subject that does NOT reference this Observation.
    await recordAction(baseAction({ action_id: "action_bridge_unrelated", inputs: ["some_other_ref"] }), "2026-08-15T10:05:01Z");

    const ctx = await resolveOrientationActionContext({ store, canon_event_id: "canon_event_bridge_1", asOf: AS_OF });

    expect(ctx.relatedActions.map((r) => r.action.action_id)).toEqual(["action_bridge_1"]);
    // Both real Actions for the subject still appear in the broader subject-wide lifecycle.
    expect(ctx.lifecycle.actions.map((a) => a.action.action.action_id).sort()).toEqual(
      ["action_bridge_1", "action_bridge_unrelated"].sort(),
    );
  });

  it("composes the real Action/Effect lifecycle for the Observation's subject", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([{ canon_event_id: "canon_event_bridge_1", canon_type: "observation", payload: baseObservation(), recorded_at: "2026-08-15T09:00:01Z" }]);
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    await recordEffect(baseEffect(), "2026-08-15T12:00:01Z");

    const ctx = await resolveOrientationActionContext({ store, canon_event_id: "canon_event_bridge_1", asOf: AS_OF });

    expect(ctx.lifecycle.subject).toBe("person_bridge_x");
    expect(ctx.lifecycle.counts.actions_total).toBe(1);
    expect(ctx.lifecycle.counts.effect_claimed_only).toBe(1);
  });
});

describe("resolveOrientationActionContext — honest absence, never fabricated", () => {
  it("returns subject: null and an empty lifecycle when the Observation does not exist", async () => {
    const store = new InMemoryCanonEventStore();

    const ctx = await resolveOrientationActionContext({ store, canon_event_id: "missing", asOf: AS_OF });

    expect(ctx.observation.attempted).toBe(true);
    expect(ctx.subject).toBeNull();
    expect(ctx.relatedActions).toEqual([]);
    expect(ctx.lifecycle).toEqual({
      subject: "",
      actions: [],
      counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
    });
  });

  it("reports UNKNOWN effect honestly — an Action with no Effect stays no_effect_recorded, never fabricated as verified or absent", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([{ canon_event_id: "canon_event_bridge_1", canon_type: "observation", payload: baseObservation(), recorded_at: "2026-08-15T09:00:01Z" }]);
    await recordAction(baseAction(), "2026-08-15T10:00:01Z");
    // Deliberately no recordEffect call.

    const ctx = await resolveOrientationActionContext({ store, canon_event_id: "canon_event_bridge_1", asOf: AS_OF });

    expect(ctx.lifecycle.actions[0].verification_state).toBe("no_effect_recorded");
    expect(ctx.lifecycle.counts.no_effect_recorded).toBe(1);
  });

  it("never links an Action to this Observation by proximity in time alone (no false causality)", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([{ canon_event_id: "canon_event_bridge_1", canon_type: "observation", payload: baseObservation(), recorded_at: "2026-08-15T09:00:01Z" }]);
    // Recorded moments after the Observation, same subject, but its `inputs`
    // never names this canon_event_id.
    await recordAction(baseAction({ action_id: "action_bridge_close_in_time", inputs: ["unrelated_need"] }), "2026-08-15T09:00:02Z");

    const ctx = await resolveOrientationActionContext({ store, canon_event_id: "canon_event_bridge_1", asOf: AS_OF });

    expect(ctx.relatedActions).toEqual([]);
  });
});
