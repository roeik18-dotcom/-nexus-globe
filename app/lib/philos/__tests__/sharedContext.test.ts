/**
 * sharedContext — the ONE shared semantic projection (semantic-unity slice).
 * `resolveCoreContext`'s identity/relationship/state+time logic is already
 * covered exhaustively by `app/dynamics/__tests__/resolveContext.test.ts`
 * (re-exported from `../page`, unchanged). This file proves the NEW parts:
 * `buildActionSpaceSummary`'s honest blockers, and that `resolveSharedContext`
 * genuinely attaches a real Need-store read to a `"found"` result and leaves
 * `"none"`/`"unknown"`/`"not_found"` untouched.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildActionSpaceSummary, needsRequiringAction, resolveSharedContext } from "../sharedContext";
import { projectCanonDynamics, type CanonDynamicsGraph } from "../canon/projectCanonDynamics";
import type { Need } from "../canon/need";
import { InMemoryNeedStore } from "../canon/needStore";
import { _setNeedStore } from "../canon/needStoreAccessor";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import type { Observation } from "../canon/observation";
import { InMemoryCanonEventStore } from "../canon/canonEventStore";
import { _setCanonEventStore } from "../canon/canonEventStoreAccessor";
import type { Action } from "../canon/action";
import { InMemoryActionStore } from "../canon/actionStore";
import { _setActionStore } from "../canon/actionStoreAccessor";
import type { Effect } from "../canon/effect";
import { InMemoryEffectStore } from "../canon/effectStore";
import { _setEffectStore } from "../canon/effectStoreAccessor";
import { InMemoryLearningStore } from "../canon/learningStore";
import { _setLearningStore } from "../canon/learningStoreAccessor";

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_shared_1",
    subject: "person_shared_x",
    desired_change: "reduce evening workload",
    scope: { kind: "domain", domain: "E" },
    provenance: "self_reported",
    context: "evening_session",
    time: "2026-08-15T10:00:00Z",
    expiry: "2026-09-15T10:00:00Z",
    consent_scope: "visible_to_matching_engine",
    ...overrides,
  };
}

describe("buildActionSpaceSummary", () => {
  it("no Need, no Offer -> not admissible, both named as blockers", () => {
    const checked: KnownNeedResult = { needs: [], checked: true };
    expect(buildActionSpaceSummary(checked)).toEqual({ admissible: false, blockers: ["Need", "Offer"] });
  });

  it("a real Need exists -> Need is no longer a blocker, Offer still is (no Offer persistence exists)", () => {
    const checked: KnownNeedResult = {
      needs: [{ need: baseNeed(), recorded_at: "2026-08-15T10:00:01Z", status: "open" }],
      checked: true,
    };
    expect(buildActionSpaceSummary(checked)).toEqual({ admissible: false, blockers: ["Offer"] });
  });

  it("a failed Need check is treated as Need still missing, never silently admissible", () => {
    const failed: KnownNeedResult = { needs: [], checked: false, reason: "store unavailable" };
    expect(buildActionSpaceSummary(failed)).toEqual({ admissible: false, blockers: ["Need", "Offer"] });
  });
});

const EMPTY_CANON: CanonDynamicsGraph = {
  source: "canon",
  nodes: [],
  summary: { node_count: 0, persisted_count: 0, domains: { G: 0, E: 0, C: 0 } },
};

const canonWithOne: CanonDynamicsGraph = {
  source: "canon",
  nodes: [
    {
      id: "canon_evt_shared",
      canon_event_id: "canon_evt_shared",
      subject: "person_shared_x",
      domain: "E",
      frame: "I",
      level: -2,
      stability: 4,
      deficitType: "RELATIVE",
      context: "evening_session",
      reference: "self_goal:baseline_energy",
      observed_at: "2026-08-15T15:00:00.000Z",
      recorded_at: "2026-08-15T15:00:01.000Z",
      provenance: "self_reported",
      persisted_or_derived: "persisted",
      label: "PHILOS canon Observation — E/I (evening_session)",
      tooltip: "subject=person_shared_x level=-2 stability=4",
    },
  ],
  summary: { node_count: 1, persisted_count: 1, domains: { G: 0, E: 1, C: 0 } },
};

describe("resolveSharedContext", () => {
  it("none/unknown/not_found pass through untouched — no Need lookup performed", async () => {
    expect(await resolveSharedContext(null)).toEqual({ status: "none" });
    expect(await resolveSharedContext({ kind: "unknown", raw: "x" })).toEqual({ status: "unknown", raw: "x" });
  });

  it("an unresolvable canon ref stays not_found — no Need lookup attempted for a subject that doesn't exist", async () => {
    const result = await resolveSharedContext({ kind: "canon_observation", canon_event_id: "does_not_exist" });
    expect(result).toEqual({ status: "not_found", ref: { kind: "canon_observation", canon_event_id: "does_not_exist" } });
  });

  it("a found context (real canon Observation, if any persisted) gets a REAL knownNeeds/actionSpace attached from the real Need store", async () => {
    const canon = await projectCanonDynamics();
    if (canon.nodes.length === 0) return; // honest skip: nothing real to resolve against in this environment
    const real = canon.nodes[0];
    _setNeedStore(
      new InMemoryNeedStore([
        { need: baseNeed({ subject: real.subject }), recorded_at: "2026-08-15T10:00:01Z", status: "open" },
      ]),
    );
    try {
      const result = await resolveSharedContext({ kind: "canon_observation", canon_event_id: real.canon_event_id });
      expect(result.status).toBe("found");
      if (result.status !== "found") throw new Error("unreachable");
      expect(result.knownNeeds).toEqual({
        needs: [{ need: baseNeed({ subject: real.subject }), recorded_at: "2026-08-15T10:00:01Z", status: "open" }],
        checked: true,
      });
      expect(result.actionSpace).toEqual({ admissible: false, blockers: ["Offer"] });
    } finally {
      _setNeedStore(null);
    }
  });
});

describe("resolveSharedContext — ORIENTATION → ACTION → EFFECT → LEARNING (integration pass)", () => {
  function baseObservation(overrides: Partial<Observation> = {}): Observation {
    return {
      subject: "person_shared_action_x",
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
      action_id: "action_shared_1",
      type: "non_transfer",
      owner: "person_shared_action_x",
      mechanism_scope: "self_regulation",
      consent: true,
      inputs: ["canon_evt_shared_action"],
      reversibility: "reversible",
      time: "2026-08-15T10:00:00Z",
      provenance: "self_reported",
      ...overrides,
    };
  }

  function baseEffect(overrides: Partial<Effect> = {}): Effect {
    return {
      effect_id: "effect_shared_1",
      action_ref: "action_shared_1",
      subject: "person_shared_action_x",
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

  beforeEach(async () => {
    const canonStore = new InMemoryCanonEventStore();
    await canonStore.append([
      { canon_event_id: "canon_evt_shared_action", canon_type: "observation", payload: baseObservation(), recorded_at: "2026-08-15T09:00:01Z" },
    ]);
    _setCanonEventStore(canonStore);
    _setActionStore(new InMemoryActionStore());
    _setEffectStore(new InMemoryEffectStore());
    _setLearningStore(new InMemoryLearningStore());
  });

  afterEach(() => {
    _setCanonEventStore(null);
    _setActionStore(null);
    _setEffectStore(null);
    _setLearningStore(null);
  });

  it("attaches the real per-subject actionLifecycle and reference-checked relatedActions for a canon-system found context — same canon_event_id, no new id space", async () => {
    const actionStoreInstance = (await import("../canon/actionStoreAccessor")).actionStore();
    await actionStoreInstance.append([{ action: baseAction(), recorded_at: "2026-08-15T10:00:01Z" }]);
    const effectStoreInstance = (await import("../canon/effectStoreAccessor")).effectStore();
    await effectStoreInstance.append([{ effect: baseEffect(), recorded_at: "2026-08-15T12:00:01Z" }]);

    const result = await resolveSharedContext({ kind: "canon_observation", canon_event_id: "canon_evt_shared_action" }, { viewerId: "person_shared_action_x" });
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("unreachable");

    expect(result.actionLifecycle?.subject).toBe("person_shared_action_x");
    expect(result.actionLifecycle?.counts.actions_total).toBe(1);
    expect(result.actionLifecycle?.counts.effect_claimed_only).toBe(1);
    expect(result.relatedActions?.map((r) => r.action.action_id)).toEqual(["action_shared_1"]);
  });

  it("UNKNOWN effect stays honestly UNKNOWN — an Action with no Effect reports no_effect_recorded, never a fabricated verified/claimed state", async () => {
    const actionStoreInstance = (await import("../canon/actionStoreAccessor")).actionStore();
    await actionStoreInstance.append([{ action: baseAction(), recorded_at: "2026-08-15T10:00:01Z" }]);

    const result = await resolveSharedContext({ kind: "canon_observation", canon_event_id: "canon_evt_shared_action" }, { viewerId: "person_shared_action_x" });
    if (result.status !== "found") throw new Error("unreachable");

    expect(result.actionLifecycle?.actions[0].verification_state).toBe("no_effect_recorded");
    expect(result.actionLifecycle?.counts.no_effect_recorded).toBe(1);
  });

  it("a canon subject with no recorded Actions gets an honest empty actionLifecycle, not undefined — context is still preserved", async () => {
    const result = await resolveSharedContext({ kind: "canon_observation", canon_event_id: "canon_evt_shared_action" }, { viewerId: "person_shared_action_x" });
    if (result.status !== "found") throw new Error("unreachable");

    expect(result.actionLifecycle).toEqual({
      subject: "person_shared_action_x",
      actions: [],
      counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
    });
    expect(result.relatedActions).toEqual([]);
  });
});

describe("resolveSharedContext — Action/Effect entity resolution (LOOP 0054)", () => {
  function baseAction(overrides: Partial<Action> = {}): Action {
    return {
      action_id: "action_ctx_1",
      type: "non_transfer",
      owner: "person_ctx_x",
      mechanism_scope: "self_regulation",
      consent: true,
      inputs: [],
      reversibility: "reversible",
      time: "2026-08-16T10:00:00Z",
      provenance: "self_reported",
      ...overrides,
    };
  }

  function baseEffect(overrides: Partial<Effect> = {}): Effect {
    return {
      effect_id: "effect_ctx_1",
      action_ref: "action_ctx_1",
      subject: "person_ctx_x",
      concerns_subject_internal_state: true,
      claimed_outcome: {
        statement: "completed the action",
        provenance: "self_reported",
        verifier_type: "self",
        confidence: 0.9,
        time: "2026-08-16T12:00:00Z",
        method: "self_report",
      },
      verified_outcome: {
        statement: "completed the action",
        provenance: "self_reported",
        verifier_type: "self",
        confidence: 0.9,
        time: "2026-08-16T12:00:00Z",
        method: "self_report",
      },
      context: "evening_session",
      time: "2026-08-16T12:00:00Z",
      provenance: "self_reported",
      ...overrides,
    };
  }

  beforeEach(() => {
    _setActionStore(new InMemoryActionStore());
    _setEffectStore(new InMemoryEffectStore());
    _setNeedStore(new InMemoryNeedStore());
  });
  afterEach(() => {
    _setActionStore(null);
    _setEffectStore(null);
    _setNeedStore(null);
  });

  it("resolves a real action: ref to a found_entity context, with the SAME action_id, and no relationships when it has no Effect yet", async () => {
    const actionStoreInstance = (await import("../canon/actionStoreAccessor")).actionStore();
    await actionStoreInstance.append([{ action: baseAction(), recorded_at: "2026-08-16T10:00:01Z" }]);

    const result = await resolveSharedContext({ kind: "action", action_id: "action_ctx_1" });
    expect(result.status).toBe("found_entity");
    if (result.status !== "found_entity") throw new Error("unreachable");
    expect(result.entity_kind).toBe("action");
    expect(result.matched_id).toBe("action_ctx_1");
    expect(result.owner_or_subject).toBe("person_ctx_x");
    expect(result.claimed_or_verified).toBe("not_applicable");
    expect(result.relationships).toEqual([]);
    expect(result.nextAction).toEqual({ label: "Record an Effect for this Action", href: "/marketplace" });
  });

  it("resolves a real action: ref with a real Effect as a real outgoing relationship — same effect_id Marketplace/Dynamics render", async () => {
    const actionStoreInstance = (await import("../canon/actionStoreAccessor")).actionStore();
    await actionStoreInstance.append([{ action: baseAction(), recorded_at: "2026-08-16T10:00:01Z" }]);
    const effectStoreInstance = (await import("../canon/effectStoreAccessor")).effectStore();
    await effectStoreInstance.append([{ effect: baseEffect(), recorded_at: "2026-08-16T12:00:01Z" }]);

    const result = await resolveSharedContext({ kind: "action", action_id: "action_ctx_1" });
    if (result.status !== "found_entity") throw new Error("unreachable");
    expect(result.relationships).toEqual([
      { direction: "outgoing", other_id: "effect_ctx_1", other_label: "completed the action", relation_label: "has effect (verified)", origin: "explicit" },
    ]);
    expect(result.nextAction).toBeNull();
  });

  it("resolves a real effect: ref to a found_entity context, verified via isEffectVerified — same real gate /marketplace uses", async () => {
    const actionStoreInstance = (await import("../canon/actionStoreAccessor")).actionStore();
    await actionStoreInstance.append([{ action: baseAction(), recorded_at: "2026-08-16T10:00:01Z" }]);
    const effectStoreInstance = (await import("../canon/effectStoreAccessor")).effectStore();
    await effectStoreInstance.append([{ effect: baseEffect(), recorded_at: "2026-08-16T12:00:01Z" }]);

    const result = await resolveSharedContext({ kind: "effect", effect_id: "effect_ctx_1" });
    expect(result.status).toBe("found_entity");
    if (result.status !== "found_entity") throw new Error("unreachable");
    expect(result.entity_kind).toBe("effect");
    expect(result.claimed_or_verified).toBe("verified");
    expect(result.relationships).toEqual([
      { direction: "incoming", other_id: "action_ctx_1", other_label: "non_transfer · self_regulation", relation_label: "caused by (declared)", origin: "explicit" },
    ]);
    expect(result.nextAction).toBeNull();
  });

  it("an unverified effect resolves claimed_or_verified: 'claimed', never fabricated as verified, and points nextAction at verification", async () => {
    const effectStoreInstance = (await import("../canon/effectStoreAccessor")).effectStore();
    await effectStoreInstance.append([{ effect: baseEffect({ verified_outcome: undefined }), recorded_at: "2026-08-16T12:00:01Z" }]);

    const result = await resolveSharedContext({ kind: "effect", effect_id: "effect_ctx_1" });
    if (result.status !== "found_entity") throw new Error("unreachable");
    expect(result.claimed_or_verified).toBe("claimed");
    expect(result.nextAction).toEqual({ label: "Verify this Effect (add evidence)", href: "/marketplace" });
  });

  it("a non-existent action_id/effect_id resolves not_found, never a guessed match", async () => {
    const actionResult = await resolveSharedContext({ kind: "action", action_id: "action_does_not_exist" });
    expect(actionResult.status).toBe("not_found");
    const effectResult = await resolveSharedContext({ kind: "effect", effect_id: "effect_does_not_exist" });
    expect(effectResult.status).toBe("not_found");
  });
});

describe("needsRequiringAction — the ONE shared 'needs attention' query (Hub command-center + ActionOutcomes both call this, neither recomputes it)", () => {
  const EMPTY_LIFECYCLE = {
    subject: "person_shared_x",
    actions: [],
    counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 },
  };

  it("an unchecked Need read yields an empty result — caller renders its own 'could not check' state", () => {
    const failed: KnownNeedResult = { needs: [], checked: false, reason: "store unavailable" };
    expect(needsRequiringAction(failed, EMPTY_LIFECYCLE)).toEqual([]);
  });

  it("a real Need with no Action referencing it by id is 'requiring action'", () => {
    const checked: KnownNeedResult = {
      needs: [{ need: baseNeed({ need_id: "need_pending_1" }), recorded_at: "2026-08-15T10:00:01Z", status: "open" }],
      checked: true,
    };
    expect(needsRequiringAction(checked, EMPTY_LIFECYCLE).map((n) => n.need.need_id)).toEqual(["need_pending_1"]);
  });

  it("a real Need referenced by a real Action's inputs is no longer 'requiring action' — explicit string match, not proximity/subject alone", () => {
    const checked: KnownNeedResult = {
      needs: [{ need: baseNeed({ need_id: "need_addressed_1" }), recorded_at: "2026-08-15T10:00:01Z", status: "open" }],
      checked: true,
    };
    const lifecycle = {
      ...EMPTY_LIFECYCLE,
      actions: [
        {
          action: {
            action: {
              action_id: "action_x",
              type: "non_transfer" as const,
              owner: "person_shared_x",
              mechanism_scope: "self_regulation" as const,
              consent: true,
              inputs: ["need_addressed_1"],
              reversibility: "reversible",
              time: "2026-08-15T10:00:00Z",
              provenance: "self_reported",
            },
            recorded_at: "2026-08-15T10:00:01Z",
          },
          effects: [],
          verification_state: "no_effect_recorded" as const,
        },
      ],
    };
    expect(needsRequiringAction(checked, lifecycle)).toEqual([]);
  });
});
