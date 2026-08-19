/**
 * Philos Canon — Merlin handoff adapter, validated as a pure projection over
 * the canonical `runPhilosVerticalSlice` result.
 *
 * Named assertions: ADAPTER_NOT_ORCHESTRATOR, HANDOFF_FIELD_SET_EXACT,
 * EXCLUDED_FIELDS_ABSENT, NO_CELLSTATE_NO_HANDOFF, CANDIDATE_ACTION_REQUIRES_
 * PERMITTED_MATCH_AND_VALID_TRANSFER, NEED_TARGET_OMITTED_WHEN_INVALID_OR_
 * ABSENT, VERIFICATION_STATE_FOUR_WAY, PROVENANCE_TRACES_ATTEMPTED_STAGES_ONLY,
 * PURE_NO_IO.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { CanonEvent } from "../canonEvent";
import { InMemoryCanonEventStore } from "../canonEventStore";
import type { Observation } from "../observation";
import type { Need } from "../need";
import type { Target } from "../target";
import type { Offer } from "../offer";
import type { MatchAttempt } from "../matching";
import type { Transfer } from "../transfer";
import type { Effect } from "../effect";
import type { OutcomeVerification } from "../outcomeVerification";
import { runPhilosVerticalSlice, type VerticalSliceInput } from "../verticalSlice";
import { toMerlinOrientationHandoff } from "../merlinHandoff";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, "..", "merlinHandoff.ts"), "utf-8");
const CODE_ONLY = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const AS_OF = "2026-09-10T00:00:00Z";

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_b",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-13T09:00:00Z",
    provenance: "self_reported",
    confidence: 0.8,
    expiry: "2026-12-01T00:00:00Z",
    level: -0.4,
    stability: 0.3,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function baseCanonEvent(overrides: Partial<CanonEvent> = {}): CanonEvent {
  return {
    canon_event_id: "canon_evt_handoff_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-13T09:00:05Z",
    ...overrides,
  };
}

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_handoff_001",
    subject: "person_b",
    desired_change: "learn mixing fundamentals",
    scope: { kind: "cells", cells: [{ domain: "C", frame: "R" }] },
    provenance: "self_reported",
    context: "skill_gap",
    time: "2026-08-15T00:00:00Z",
    expiry: "2026-12-01T00:00:00Z",
    consent_scope: "visible_to_matched_offers",
    ...overrides,
  };
}

function baseTarget(overrides: Partial<Target> = {}): Target {
  return {
    target_id: "target_handoff_001",
    subject: "person_b",
    cell: { domain: "E", frame: "I" },
    desired_state: "baseline emotional stability restored",
    reference_type: "self_goal",
    provenance: "self_declared",
    consent_status: "consented",
    context: "evening_session",
    time: "2026-08-15T00:00:00Z",
    expiry: "2026-12-01T00:00:00Z",
    ...overrides,
  };
}

function baseOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    offer_id: "offer_handoff_001",
    source: "person_a",
    source_cell: { domain: "C", frame: "R" },
    available_resource: "mixing mentorship",
    resource_type: "knowledge",
    amount_or_capacity: "2 sessions",
    competence: "professional",
    willingness: true,
    consent: true,
    availability: "weekends",
    cost: "none",
    constraints: [],
    expiry: "2026-12-01T00:00:00Z",
    provenance: "self_declared",
    ...overrides,
  };
}

function baseMatchAttempt(overrides: Partial<MatchAttempt> = {}): MatchAttempt {
  return {
    match_id: "match_handoff_001",
    need_ref: "need_handoff_001",
    offer_ref: "offer_handoff_001",
    source: "person_a",
    target: "person_b",
    cell: { domain: "C", frame: "R" },
    CAN: true,
    WANTS: true,
    ALLOWED: true,
    APPROPRIATE: true,
    AVAILABLE: true,
    CONSENT: true,
    context: "mentorship_matching_round",
    time: "2026-08-16T00:00:00Z",
    ...overrides,
  };
}

function baseTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    action_id: "action_handoff_001",
    type: "transfer",
    owner: "group_studio_collective",
    mechanism_scope: "melting_pot",
    consent: true,
    inputs: ["need_ref:need_handoff_001", "offer_ref:offer_handoff_001"],
    reversibility: "irreversible_knowledge_transfer_reversible_time_only",
    time: "2026-08-17T00:00:00Z",
    provenance: "matched_via_melting_pot",
    source: "person_a",
    target: "person_b",
    source_cell: { domain: "C", frame: "R" },
    target_cell: { domain: "C", frame: "R" },
    resource: "mixing mentorship session",
    resource_type: "knowledge",
    amount: "2 sessions",
    conversion_mechanism: "explanation/mentoring",
    cost: "1 hour donor time per session",
    expiry_or_validity: "2026-09-15T00:00:00Z",
    claimed_outcome: "recipient completed a self-produced mix using the guidance",
    ...overrides,
  };
}

function baseVerification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "recipient reports improved emotional stability",
    provenance: "self_reported_in_followup",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-09-05T00:00:00Z",
    method: "follow-up interview",
    ...overrides,
  };
}

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_handoff_001",
    action_ref: "action_handoff_001",
    subject: "person_b",
    concerns_subject_internal_state: true,
    claimed_outcome: baseVerification({ statement: "claims improved stability" }),
    context: "post_mentorship_checkin",
    time: "2026-09-05T00:00:00Z",
    provenance: "recorded_after_session",
    ...overrides,
  };
}

async function fullInput(
  store: InMemoryCanonEventStore,
  overrides: Partial<VerticalSliceInput> = {},
): Promise<VerticalSliceInput> {
  await store.append([baseCanonEvent()]);
  return {
    store,
    canon_event_id: "canon_evt_handoff_001",
    asOf: AS_OF,
    need: baseNeed(),
    target: baseTarget(),
    offer: baseOffer(),
    matchAttempt: baseMatchAttempt(),
    transfer: baseTransfer(),
    ...overrides,
  };
}

describe("ADAPTER_NOT_ORCHESTRATOR", () => {
  it("merlinHandoff.ts calls no canon derivation/validation function itself — it only reads fields off an already-produced result", () => {
    for (const forbidden of [
      "deriveCellStateFromObservation",
      "deriveCellStateForPersistedObservation",
      "evaluateMatch",
      "validateTransferAgainstMatch",
      "validateNeed",
      "validateTarget",
      "validateOffer",
      "deriveLearning",
      "ingestObservation",
      "store.load",
      "store.append",
      "await ",
    ]) {
      expect(CODE_ONLY).not.toContain(forbidden);
    }
  });

  it("toMerlinOrientationHandoff is synchronous, not async", () => {
    expect(toMerlinOrientationHandoff.constructor.name).not.toBe("AsyncFunction");
  });
});

describe("HANDOFF_FIELD_SET_EXACT", () => {
  it("a full happy-path handoff carries exactly the eight spec'd fields, nothing more", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const handoff = toMerlinOrientationHandoff("orient_001", result);

    expect(handoff).not.toBeNull();
    expect(Object.keys(handoff!).sort()).toEqual(
      [
        "candidate_action",
        "constraints",
        "current_state",
        "open_need",
        "orientation_id",
        "provenance",
        "source_observation_id",
        "target",
        "verification_state",
      ].sort(),
    );
  });
});

describe("EXCLUDED_FIELDS_ABSENT", () => {
  // Note: `constraints` deliberately SAYS "no tool name, no credential, ..."
  // as disclosure prose — a bare substring scan would self-match that
  // sentence. These checks instead look for the shape a real violation would
  // take: a JSON key or a `MerlinOrientationHandoff`/`OrientationCandidateAction`
  // field declaration actually named after one of the excluded concepts.
  it("no tool-name/credential/approval=true/network-policy/retry-policy KEY anywhere in a handoff, even with a candidate_action present", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const handoff = toMerlinOrientationHandoff("orient_002", result);

    expect(handoff?.candidate_action).toBeDefined();
    const serialized = JSON.stringify(handoff).toLowerCase();
    for (const forbiddenKey of [
      "\"tool_name\":",
      "\"toolname\":",
      "\"credential\":",
      "\"credentials\":",
      "\"api_key\":",
      "\"apikey\":",
      "\"approval\":",
      "\"approved\":true",
      "\"network_scope\":",
      "\"networkscope\":",
      "\"retry_policy\":",
      "\"retrypolicy\":",
      "\"allowed_hosts\":",
    ]) {
      expect(serialized).not.toContain(forbiddenKey);
    }
  });

  it("the MerlinOrientationHandoff / OrientationCandidateAction interfaces declare no field named after an excluded concept", () => {
    const interfaceBlock = CODE_ONLY.slice(
      CODE_ONLY.indexOf("interface OrientationCandidateAction"),
      CODE_ONLY.indexOf("const CONSTRAINTS"),
    );
    for (const forbidden of [
      /tool_?name\s*[:?]/i,
      /credential\s*[:?]/i,
      /api_?key\s*[:?]/i,
      /approval\s*[:?]/i,
      /approved\s*[:?]/i,
      /network_?scope\s*[:?]/i,
      /retry_?policy\s*[:?]/i,
      /allowed_?hosts\s*[:?]/i,
    ]) {
      expect(interfaceBlock).not.toMatch(forbidden);
    }
  });
});

describe("NO_CELLSTATE_NO_HANDOFF", () => {
  it("returns null when the Observation was never persisted (no CellState derivable)", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice({
      store,
      canon_event_id: "never_appended",
      asOf: AS_OF,
    });
    expect(toMerlinOrientationHandoff("orient_003", result)).toBeNull();
  });

  it("returns null when the Observation has expired as of asOf", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([
      baseCanonEvent({
        canon_event_id: "canon_evt_expired",
        payload: baseObservation({ time: "2026-01-01T00:00:00Z", expiry: "2026-02-01T00:00:00Z" }),
      }),
    ]);
    const result = await runPhilosVerticalSlice({
      store,
      canon_event_id: "canon_evt_expired",
      asOf: AS_OF,
    });
    expect(toMerlinOrientationHandoff("orient_004", result)).toBeNull();
  });
});

describe("CANDIDATE_ACTION_REQUIRES_PERMITTED_MATCH_AND_VALID_TRANSFER", () => {
  it("candidate_action is present and carries the real Transfer + MatchResult when the match is permitted and the transfer validates", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const handoff = toMerlinOrientationHandoff("orient_005", result);

    expect(handoff?.candidate_action).toBeDefined();
    expect(handoff?.candidate_action?.transfer.action_id).toBe("action_handoff_001");
    expect(handoff?.candidate_action?.match_result.decision).toBe("permitted");
    expect(handoff?.candidate_action?.transfer_valid).toBe(true);
  });

  it("candidate_action is absent when the match is not permitted", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, { matchAttempt: baseMatchAttempt({ CONSENT: false }) });
    const result = await runPhilosVerticalSlice(input);
    const handoff = toMerlinOrientationHandoff("orient_006", result);

    expect(handoff).not.toBeNull(); // CellState still derivable — orientation itself is valid
    expect(handoff?.candidate_action).toBeUndefined();
  });

  it("candidate_action is absent when no transfer/need/offer/matchAttempt were supplied at all", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([baseCanonEvent()]);
    const result = await runPhilosVerticalSlice({ store, canon_event_id: "canon_evt_handoff_001", asOf: AS_OF });
    const handoff = toMerlinOrientationHandoff("orient_007", result);

    expect(handoff).not.toBeNull();
    expect(handoff?.candidate_action).toBeUndefined();
    expect(handoff?.open_need).toBeUndefined();
    expect(handoff?.target).toBeUndefined();
  });
});

describe("NEED_TARGET_OMITTED_WHEN_INVALID_OR_ABSENT", () => {
  it("open_need is omitted when the supplied Need fails its own canon validator", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, { need: baseNeed({ need_id: "" }) });
    const result = await runPhilosVerticalSlice(input);
    const handoff = toMerlinOrientationHandoff("orient_008", result);
    expect(handoff?.open_need).toBeUndefined();
  });

  it("target is present verbatim when valid", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const handoff = toMerlinOrientationHandoff("orient_009", result);
    expect(handoff?.target).toEqual(baseTarget());
  });
});

describe("VERIFICATION_STATE_FOUR_WAY", () => {
  it("not_applicable when no Effect was supplied", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    expect(toMerlinOrientationHandoff("orient_010", result)?.verification_state).toBe("not_applicable");
  });

  it("claimed_only when the Effect carries no verified_outcome", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, { effect: baseEffect() });
    const result = await runPhilosVerticalSlice(input);
    expect(toMerlinOrientationHandoff("orient_011", result)?.verification_state).toBe("claimed_only");
  });

  it("unverified when a third_party verification lacks subject_consent for an internal-state Effect", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, {
      effect: baseEffect({
        verified_outcome: baseVerification({ verifier_type: "third_party", subject_consent: false }),
      }),
    });
    const result = await runPhilosVerticalSlice(input);
    expect(toMerlinOrientationHandoff("orient_012", result)?.verification_state).toBe("unverified");
  });

  it("verified when self-verified", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, {
      effect: baseEffect({ verified_outcome: baseVerification({ verifier_type: "self" }) }),
    });
    const result = await runPhilosVerticalSlice(input);
    expect(toMerlinOrientationHandoff("orient_013", result)?.verification_state).toBe("verified");
  });
});

describe("PROVENANCE_TRACES_ATTEMPTED_STAGES_ONLY", () => {
  it("provenance carries exactly the attempted stages' own provenance strings, in stage order, verbatim", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const handoff = toMerlinOrientationHandoff("orient_014", result);

    const expected = [
      result.observation,
      result.cellState,
      result.need,
      result.target,
      result.offer,
      result.matching,
      result.transfer,
    ]
      .filter((s) => s.attempted)
      .map((s) => (s as { provenance: string }).provenance);

    expect(handoff?.provenance).toEqual(expected);
  });

  it("provenance is empty-effect-free when effect/learning were never supplied", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const handoff = toMerlinOrientationHandoff("orient_015", result);
    expect(handoff?.provenance.some((p) => p.toLowerCase().includes("learning"))).toBe(false);
  });
});

describe("PURE_NO_IO", () => {
  it("calling toMerlinOrientationHandoff never mutates the result object it was given", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    const before = JSON.stringify(result);
    toMerlinOrientationHandoff("orient_016", result);
    expect(JSON.stringify(result)).toBe(before);
  });

  it("is deterministic — same result object, same handoff", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    expect(toMerlinOrientationHandoff("orient_017", result)).toEqual(
      toMerlinOrientationHandoff("orient_017", result),
    );
  });
});
