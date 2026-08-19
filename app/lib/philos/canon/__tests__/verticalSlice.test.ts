/**
 * Philos Canon — the live vertical slice, validated end-to-end.
 *
 * Named assertions requested for this pass: FULL_SLICE_STATE_PRIME,
 * CLAIMED_ONLY_BLOCKS_STATE_PRIME, NEED_TARGET_OFFER_SOVEREIGN_OF_CELLSTATE,
 * CELLSTATE_FAILURE_DOES_NOT_BLOCK_MATCHING_OR_TRANSFER,
 * MATCH_NOT_PERMITTED_BLOCKS_TRANSFER_EFFECT_LEARNING,
 * EFFECT_ACTION_REF_MUST_MATCH_TRANSFER, OBSERVATION_NOT_FOUND_HALTS_CELLSTATE,
 * SIX_FIELDS_PRESENT_PER_ATTEMPTED_STAGE, PERSISTED_VS_DERIVED_CLASSIFICATION,
 * NO_EXECUTION, NO_MERLIN_ACTION_REGISTRY_REFERENCE, NO_NEW_STORE,
 * NO_LEGACY_EVENT_WRITE, DETERMINISTIC, STOP_POINT_FIRST_UNATTEMPTED,
 * STOP_POINT_NULL_WHEN_ALL_ATTEMPTED, STOP_POINT_IGNORES_GATED_NOT_UNATTEMPTED.
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
import {
  firstUnsupportedTransition,
  runPhilosVerticalSlice,
  type VerticalSliceInput,
} from "../verticalSlice";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, "..", "verticalSlice.ts"), "utf-8");
/** Comments deliberately narrate the rules being enforced (and so contain the
 *  very words a structural check looks for) — strip them so structural
 *  assertions below inspect only executable code, not prose. */
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
    canon_event_id: "canon_evt_vslice_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-13T09:00:05Z",
    ...overrides,
  };
}

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_vslice_001",
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
    target_id: "target_vslice_001",
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
    offer_id: "offer_vslice_001",
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
    match_id: "match_vslice_001",
    need_ref: "need_vslice_001",
    offer_ref: "offer_vslice_001",
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
    action_id: "action_vslice_001",
    type: "transfer",
    owner: "group_studio_collective",
    mechanism_scope: "melting_pot",
    consent: true,
    inputs: ["need_ref:need_vslice_001", "offer_ref:offer_vslice_001"],
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
    effect_id: "effect_vslice_001",
    action_ref: "action_vslice_001",
    subject: "person_b",
    concerns_subject_internal_state: true,
    claimed_outcome: baseVerification({ statement: "claims improved stability" }),
    context: "post_mentorship_checkin",
    time: "2026-09-05T00:00:00Z",
    provenance: "recorded_after_session",
    ...overrides,
  };
}

/** The full, internally-consistent input set for a happy-path run. Cell of the
 *  Transfer (C,R — knowledge) deliberately differs from the cell being learned
 *  from (E,I — emotional) — canon §11's own worked example: a knowledge
 *  transfer produces a downstream emotional effect on a DIFFERENT cell. */
async function fullInput(store: InMemoryCanonEventStore, overrides: Partial<VerticalSliceInput> = {}): Promise<VerticalSliceInput> {
  await store.append([baseCanonEvent()]);
  return {
    store,
    canon_event_id: "canon_evt_vslice_001",
    asOf: AS_OF,
    need: baseNeed(),
    target: baseTarget(),
    offer: baseOffer(),
    matchAttempt: baseMatchAttempt(),
    transfer: baseTransfer(),
    effect: baseEffect({ verified_outcome: baseVerification({ verifier_type: "self" }) }),
    learning: {
      learning_id: "learning_vslice_001",
      prior_state_ref: "canon_evt_vslice_001",
      outcome_verification_ref: "effect_vslice_001.verified_outcome",
      update_method: "self_reported_followup",
      provenance: "recorded_after_session",
      confidence: 0.8,
      time: "2026-09-06T00:00:00Z",
      context: "post_mentorship_checkin",
      effect_ref: "effect_vslice_001",
      candidateStatePrime: { domain: "E", frame: "I", level: -0.1, stability: 0.4 },
    },
    ...overrides,
  };
}

describe("FULL_SLICE_STATE_PRIME", () => {
  it("runs every stage to state_prime when evidence is verified and every reference matches", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));

    expect(result.observation.attempted).toBe(true);
    expect(result.cellState.attempted).toBe(true);
    expect(result.need.attempted).toBe(true);
    expect(result.target.attempted).toBe(true);
    expect(result.offer.attempted).toBe(true);
    expect(result.matching.attempted).toBe(true);
    expect(result.transfer.attempted).toBe(true);
    expect(result.effect.attempted).toBe(true);
    expect(result.learning.attempted).toBe(true);

    if (result.matching.attempted) expect(result.matching.output.decision).toBe("permitted");
    if (result.transfer.attempted) expect(result.transfer.output.valid).toBe(true);
    if (result.effect.attempted) expect(result.effect.output.verified).toBe(true);
    if (result.learning.attempted) {
      expect(result.learning.output.result.kind).toBe("state_prime");
      if (result.learning.output.result.kind === "state_prime") {
        expect(result.learning.output.result.candidate_state_prime).toEqual({
          domain: "E",
          frame: "I",
          level: -0.1,
          stability: 0.4,
        });
      }
    }
  });
});

describe("CLAIMED_ONLY_BLOCKS_STATE_PRIME", () => {
  it("attempts Learning but yields no_update/claimed_only when the Effect carries no verified_outcome", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, {});
    input.effect = baseEffect(); // no verified_outcome

    const result = await runPhilosVerticalSlice(input);

    expect(result.effect.attempted).toBe(true);
    if (result.effect.attempted) {
      expect(result.effect.output.verified).toBe(false);
      expect(result.effect.claimed_or_verified).toBe("claimed");
    }
    expect(result.learning.attempted).toBe(true);
    if (result.learning.attempted) {
      expect(result.learning.output.result).toEqual({ kind: "no_update", reason: "claimed_only" });
      expect(result.learning.claimed_or_verified).toBe("claimed");
    }
  });
});

describe("NEED_TARGET_OFFER_SOVEREIGN_OF_CELLSTATE", () => {
  it("Need, Target, and Offer are all attempted and valid even when no Observation exists at all", async () => {
    const store = new InMemoryCanonEventStore(); // empty — nothing persisted
    const result = await runPhilosVerticalSlice({
      store,
      canon_event_id: "never_appended",
      asOf: AS_OF,
      need: baseNeed(),
      target: baseTarget(),
      offer: baseOffer(),
    });

    expect(result.observation.attempted).toBe(true);
    if (result.observation.attempted) expect(result.observation.output).toBeNull();
    expect(result.cellState).toEqual({ attempted: false, reason: "observation_not_found" });

    expect(result.need.attempted).toBe(true);
    if (result.need.attempted) expect(result.need.output.valid).toBe(true);
    expect(result.target.attempted).toBe(true);
    if (result.target.attempted) expect(result.target.output.valid).toBe(true);
    expect(result.offer.attempted).toBe(true);
    if (result.offer.attempted) expect(result.offer.output.valid).toBe(true);
  });

  it("verticalSlice.ts's Need/Target stages never read the cellState variable in their branch bodies", () => {
    // Structural proof, not just a runtime coincidence: the sovereignty rule
    // (canon §12 Need ≠ Deficit) is enforced by never wiring the edge. Scanned
    // with comments stripped — the header prose narrates this exact rule and
    // would otherwise self-match.
    const needBlock = CODE_ONLY.slice(CODE_ONLY.indexOf("const need:"), CODE_ONLY.indexOf("const target:"));
    const targetBlock = CODE_ONLY.slice(CODE_ONLY.indexOf("const target:"), CODE_ONLY.indexOf("const offer:"));
    expect(needBlock).not.toMatch(/cellState/);
    expect(targetBlock).not.toMatch(/cellState/);
  });
});

describe("CELLSTATE_FAILURE_DOES_NOT_BLOCK_MATCHING_OR_TRANSFER", () => {
  it("an expired Observation blocks CellState/Learning but Matching and Transfer still run to completion", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store);
    input.canon_event_id = "canon_evt_expired";
    await store.append([
      baseCanonEvent({
        canon_event_id: "canon_evt_expired",
        payload: baseObservation({ time: "2026-01-01T00:00:00Z", expiry: "2026-02-01T00:00:00Z" }),
      }),
    ]);

    const result = await runPhilosVerticalSlice(input);

    expect(result.cellState.attempted).toBe(true);
    if (result.cellState.attempted) {
      expect(result.cellState.output).toEqual({ kind: "no_derivation", reason: "expired" });
    }

    // Matching/Transfer are wired only off Need/Offer/MatchAttempt/Transfer — not CellState.
    expect(result.matching.attempted).toBe(true);
    if (result.matching.attempted) expect(result.matching.output.decision).toBe("permitted");
    expect(result.transfer.attempted).toBe(true);
    if (result.transfer.attempted) expect(result.transfer.output.valid).toBe(true);

    // Learning is the one stage that genuinely needs a derived CellState.
    expect(result.learning).toEqual({ attempted: false, reason: "cell_state_not_derived" });
  });
});

describe("MATCH_NOT_PERMITTED_BLOCKS_TRANSFER_EFFECT_LEARNING", () => {
  it("CONSENT_false cascades: matching not_permitted -> transfer/effect/learning never attempted", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, { matchAttempt: baseMatchAttempt({ CONSENT: false }) });

    const result = await runPhilosVerticalSlice(input);

    expect(result.matching.attempted).toBe(true);
    if (result.matching.attempted) {
      expect(result.matching.output.decision).toBe("not_permitted");
      expect(result.matching.output.rejection_reasons).toContain("CONSENT_false");
    }
    expect(result.transfer).toEqual({ attempted: false, reason: "match_not_permitted" });
    expect(result.effect).toEqual({ attempted: false, reason: "transfer_invalid" });
    expect(result.learning).toEqual({ attempted: false, reason: "effect_invalid" });
  });
});

describe("EFFECT_ACTION_REF_MUST_MATCH_TRANSFER", () => {
  it("rejects (does not attempt) an Effect whose action_ref does not name this slice's own Transfer", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, {
      effect: baseEffect({ action_ref: "some_unrelated_action_id" }),
    });

    const result = await runPhilosVerticalSlice(input);

    expect(result.transfer.attempted).toBe(true);
    if (result.transfer.attempted) expect(result.transfer.output.valid).toBe(true);
    expect(result.effect).toEqual({ attempted: false, reason: "effect_action_ref_mismatch" });
    expect(result.learning).toEqual({ attempted: false, reason: "effect_invalid" });
  });
});

describe("OBSERVATION_NOT_FOUND_HALTS_CELLSTATE", () => {
  it("a canon_event_id that was never persisted: observation found=null, cellState not attempted", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice({
      store,
      canon_event_id: "never_appended",
      asOf: AS_OF,
    });

    expect(result.observation).toEqual({
      attempted: true,
      input: { canon_event_id: "never_appended" },
      output: null,
      provenance: "CanonEventStore.load(), matched by canon_event_id",
      persisted_or_derived: "persisted",
      claimed_or_verified: "not_applicable",
      canon_basis: "canon §6 (Observation) + §24 (pipeline origin: Matter+Gap+Time → Observation)",
    });
    expect(result.cellState).toEqual({ attempted: false, reason: "observation_not_found" });
  });
});

describe("SIX_FIELDS_PRESENT_PER_ATTEMPTED_STAGE", () => {
  it("every attempted stage carries input/output/provenance/persisted_or_derived/claimed_or_verified/canon_basis", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));

    for (const stage of Object.values(result)) {
      if (stage.attempted) {
        expect(stage).toHaveProperty("input");
        expect(stage).toHaveProperty("output");
        expect(typeof stage.provenance).toBe("string");
        expect(["persisted", "derived", "caller_supplied"]).toContain(stage.persisted_or_derived);
        expect(["claimed", "verified", "not_applicable"]).toContain(stage.claimed_or_verified);
        expect(typeof stage.canon_basis).toBe("string");
        expect(stage.canon_basis.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("PERSISTED_VS_DERIVED_CLASSIFICATION", () => {
  it("only the Observation stage is persisted_or_derived === persisted", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));

    expect(result.observation.attempted && result.observation.persisted_or_derived).toBe("persisted");
    for (const [name, stage] of Object.entries(result)) {
      if (name !== "observation" && stage.attempted) {
        expect(stage.persisted_or_derived).not.toBe("persisted");
      }
    }
  });
});

describe("NO_EXECUTION", () => {
  it("exports no dispatch/execute/apply/commit function", async () => {
    const mod = (await import("../verticalSlice")) as unknown as Record<string, unknown>;
    for (const name of ["execute", "dispatch", "applyTransfer", "commitTransfer", "runTransfer"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("the only await/I-O call in the whole file is store.load() — never store.append()", () => {
    expect(CODE_ONLY).not.toMatch(/\.append\(/);
    expect(CODE_ONLY).toMatch(/store\.load\(\)/);
  });
});

describe("NO_MERLIN_ACTION_REGISTRY_REFERENCE", () => {
  it("imports nothing from voice-gateway, Merlin, n8n, or any action-registry module", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/voice-gateway|merlin|n8n|registry/);
    }
  });
});

describe("NO_NEW_STORE", () => {
  it("does not import or construct any store other than the caller-supplied CanonEventStore", () => {
    expect(SOURCE).not.toMatch(/new\s+\w*Store\(/);
    expect(SOURCE).not.toMatch(/canonEventStoreAccessor/);
  });
});

describe("NO_LEGACY_EVENT_WRITE", () => {
  it("imports nothing from the legacy event store or projections", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\.\/events["']/);
      expect(line).not.toMatch(/from ["']\.\.\/eventStore["']/);
      expect(line).not.toMatch(/philos-event-store/);
      expect(line).not.toMatch(/projectValueGroup|projectDynamics|projectGlobeGraph|dynamicsView/);
    }
  });
});

describe("DETERMINISTIC", () => {
  it("same input, same output across two independent runs over independently-seeded stores", async () => {
    const storeA = new InMemoryCanonEventStore();
    const storeB = new InMemoryCanonEventStore();
    const resultA = await runPhilosVerticalSlice(await fullInput(storeA));
    const resultB = await runPhilosVerticalSlice(await fullInput(storeB));
    expect(resultA).toEqual(resultB);
  });
});

describe("STOP_POINT_FIRST_UNATTEMPTED", () => {
  it("names 'need' as the stop point when only canon_event_id/asOf are supplied (no Need/Target/Offer/... given)", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([baseCanonEvent()]);
    const result = await runPhilosVerticalSlice({ store, canon_event_id: "canon_evt_vslice_001", asOf: AS_OF });
    expect(firstUnsupportedTransition(result)).toEqual({ stage: "need", reason: "not_supplied" });
  });

  it("names 'cellState' as the stop point when the Observation itself was never persisted", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice({ store, canon_event_id: "never_appended", asOf: AS_OF });
    expect(firstUnsupportedTransition(result)).toEqual({
      stage: "cellState",
      reason: "observation_not_found",
    });
  });

  it("names 'effect' as the stop point once Transfer/Need/Target/Offer/Matching all ran but no Effect was supplied", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store);
    delete input.effect;
    delete input.learning;
    const result = await runPhilosVerticalSlice(input);
    expect(firstUnsupportedTransition(result)).toEqual({ stage: "effect", reason: "not_supplied" });
  });
});

describe("STOP_POINT_NULL_WHEN_ALL_ATTEMPTED", () => {
  it("returns null for a full happy-path run reaching state_prime", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await runPhilosVerticalSlice(await fullInput(store));
    expect(firstUnsupportedTransition(result)).toBeNull();
  });
});

describe("STOP_POINT_IGNORES_GATED_NOT_UNATTEMPTED", () => {
  it("a not_permitted Matching IS attempted, so it is not itself reported as the stop point — the stop point is the next stage that never ran", async () => {
    const store = new InMemoryCanonEventStore();
    const input = await fullInput(store, { matchAttempt: baseMatchAttempt({ CONSENT: false }) });
    const result = await runPhilosVerticalSlice(input);
    expect(result.matching.attempted).toBe(true); // attempted — just gated closed
    expect(firstUnsupportedTransition(result)).toEqual({ stage: "transfer", reason: "match_not_permitted" });
  });
});
