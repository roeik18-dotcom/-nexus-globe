/**
 * Philos Canon — Persisted Observation → CellState derivation, validated.
 *
 * Named assertions requested for this pass: PERSISTED_OBSERVATION_READ,
 * CANON_EVENT_TO_OBSERVATION_ROUNDTRIP, OBSERVATION_TO_CELLSTATE_VALID,
 * INSUFFICIENT_OBSERVATION_NO_DERIVATION, FRAME_IDENTITY_PRESERVED,
 * SYSTEMIC_CHANNEL_PRESERVED, PROVENANCE_LINK_PRESERVED, NO_NEED_GENERATION,
 * NO_TENSION_INFERENCE, NO_LEGACY_EVENT_WRITE, NO_PROJECTION_SIDE_EFFECT,
 * NO_DYNAMICS_SIDE_EFFECT.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CanonEvent } from "../canonEvent";
import { InMemoryCanonEventStore } from "../canonEventStore";
import * as derivationModule from "../cellStateDerivation";
import {
  type CellStateDerivationProvenance,
  deriveCellStateForPersistedObservation,
  deriveCellStateFromObservation,
} from "../cellStateDerivation";
import { validateCellState } from "../cellState";
import type { Observation } from "../observation";
import { InMemoryPhilosEventStore } from "../../eventStore";
import type { PhilosEvent } from "../../events";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, "..", "cellStateDerivation.ts"), "utf-8");

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_roei",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-13T09:00:00Z",
    provenance: "self_reported",
    confidence: 0.7,
    expiry: "2026-09-13T09:00:00Z",
    level: -0.3,
    stability: 0.5,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function baseCanonEvent(overrides: Partial<CanonEvent> = {}): CanonEvent {
  return {
    canon_event_id: "canon_evt_derive_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-13T09:00:05Z",
    ...overrides,
  };
}

const AS_OF = "2026-08-20T00:00:00Z"; // well within the observation's expiry above

describe("PERSISTED_OBSERVATION_READ", () => {
  it("reads a persisted CanonEvent<Observation> from a real CanonEventStore and derives from it", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([baseCanonEvent()]);

    const result = await deriveCellStateForPersistedObservation(
      store,
      "canon_evt_derive_001",
      AS_OF,
    );
    expect(result.kind).toBe("cell_state");
  });

  it("returns no_derivation/event_not_found for a canon_event_id that was never persisted", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await deriveCellStateForPersistedObservation(store, "never_appended", AS_OF);
    expect(result).toEqual({ kind: "no_derivation", reason: "event_not_found" });
  });
});

describe("CANON_EVENT_TO_OBSERVATION_ROUNDTRIP", () => {
  it("the Observation extracted from a persisted CanonEvent is field-for-field identical to what was appended", async () => {
    const store = new InMemoryCanonEventStore();
    const original = baseObservation({ context: "roundtrip_check", confidence: 0.55 });
    await store.append([baseCanonEvent({ payload: original })]);

    const loaded = await store.load();
    expect(loaded[0].payload).toEqual(original);

    const result = await deriveCellStateForPersistedObservation(
      store,
      "canon_evt_derive_001",
      AS_OF,
    );
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(result.provenance.source_observation_confidence).toBe(0.55);
    }
  });
});

describe("OBSERVATION_TO_CELLSTATE_VALID", () => {
  it("produces a structurally valid CellState candidate — domain/frame/level/stability copied verbatim", () => {
    const event = baseCanonEvent({
      payload: baseObservation({ domain: "C", frame: "R", level: 2.4, stability: 0.9 }),
    });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(result.candidate).toEqual({ domain: "C", frame: "R", level: 2.4, stability: 0.9 });
      expect(validateCellState(result.candidate).valid).toBe(true);
    }
  });

  it("is a direct field projection, not a computed/invented value — level and stability match the source exactly, including negative and fractional values", () => {
    const event = baseCanonEvent({ payload: baseObservation({ level: -7.125, stability: 0.001 }) });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(result.candidate.level).toBe(-7.125);
      expect(result.candidate.stability).toBe(0.001);
    }
  });
});

describe("INSUFFICIENT_OBSERVATION_NO_DERIVATION", () => {
  it("returns no_derivation for a structurally invalid CanonEvent, never a guessed CellState", () => {
    const event = baseCanonEvent({ payload: baseObservation({ subject: "" }) });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result).toEqual({ kind: "no_derivation", reason: "canon_event_invalid" });
  });

  it("returns no_derivation for zero confidence — the literal floor of the [0,1] scale, not an invented threshold", () => {
    const event = baseCanonEvent({ payload: baseObservation({ confidence: 0 }) });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result).toEqual({ kind: "no_derivation", reason: "zero_confidence" });
  });

  it("does NOT treat any positive confidence, however small, as insufficient", () => {
    const event = baseCanonEvent({ payload: baseObservation({ confidence: 0.001 }) });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
  });

  it("returns no_derivation for an Observation that has expired as of asOf", () => {
    const event = baseCanonEvent({
      payload: baseObservation({ time: "2026-01-01T00:00:00Z", expiry: "2026-02-01T00:00:00Z" }),
    });
    const result = deriveCellStateFromObservation(event, "2026-08-20T00:00:00Z");
    expect(result).toEqual({ kind: "no_derivation", reason: "expired" });
  });

  it("returns no_derivation for an unparseable asOf, never crashing", () => {
    const result = deriveCellStateFromObservation(baseCanonEvent(), "not-a-date");
    expect(result).toEqual({ kind: "no_derivation", reason: "as_of_unparseable" });
  });

  it("returns no_derivation/canon_event_invalid for a non-observation canon_type — CanonType has exactly one value today, so validateCanonEvent's own structural check already covers this; no separate reason exists, and this test documents why rather than asserting a dead branch", () => {
    const event = baseCanonEvent({
      canon_type: "cell_state" as unknown as CanonEvent["canon_type"],
    });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result).toEqual({ kind: "no_derivation", reason: "canon_event_invalid" });
  });

  it("never throws on malformed input", () => {
    expect(() =>
      deriveCellStateFromObservation({} as unknown as CanonEvent, AS_OF),
    ).not.toThrow();
  });
});

describe("FRAME_IDENTITY_PRESERVED", () => {
  it("the candidate's domain and frame exactly match the source Observation's, for every one of the 9 cells", () => {
    const domains: Observation["domain"][] = ["G", "E", "C"];
    const frames: Observation["frame"][] = ["I", "R", "S"];
    for (const domain of domains) {
      for (const frame of frames) {
        const event = baseCanonEvent({
          payload: baseObservation({
            domain,
            frame,
            ...(frame === "S" ? { systemicChannel: "material" as const } : {}),
          }),
        });
        const result = deriveCellStateFromObservation(event, AS_OF);
        expect(result.kind).toBe("cell_state");
        if (result.kind === "cell_state") {
          expect(result.candidate.domain).toBe(domain);
          expect(result.candidate.frame).toBe(frame);
        }
      }
    }
  });
});

describe("SYSTEMIC_CHANNEL_PRESERVED", () => {
  it("an S-frame Observation's systemicChannel is carried in the derivation provenance", () => {
    const event = baseCanonEvent({
      payload: baseObservation({ domain: "G", frame: "S", systemicChannel: "economic" }),
    });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(result.provenance.source_observation_systemic_channel).toBe("economic");
    }
  });

  it("CellState itself carries no systemicChannel field — the channel lives only in provenance, matching cellState.ts's own design", () => {
    const event = baseCanonEvent({
      payload: baseObservation({ domain: "G", frame: "S", systemicChannel: "economic" }),
    });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(Object.prototype.hasOwnProperty.call(result.candidate, "systemicChannel")).toBe(false);
      expect(Object.keys(result.candidate).sort()).toEqual(["domain", "frame", "level", "stability"]);
    }
  });

  it("a non-S-frame Observation's provenance carries no systemicChannel field at all (undefined, not null or empty)", () => {
    const event = baseCanonEvent({ payload: baseObservation({ frame: "I" }) });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(
        Object.prototype.hasOwnProperty.call(result.provenance, "source_observation_systemic_channel"),
      ).toBe(false);
    }
  });
});

describe("PROVENANCE_LINK_PRESERVED", () => {
  it("the derivation provenance names the exact source canon_event_id", () => {
    const event = baseCanonEvent({ canon_event_id: "canon_evt_specific_link" });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(result.provenance.source_canon_event_id).toBe("canon_evt_specific_link");
    }
  });

  it("provenance also carries the source Observation's own provenance, time, and confidence — full traceability, not just an id", () => {
    const event = baseCanonEvent({
      payload: baseObservation({ provenance: "third_party", time: "2026-08-13T09:00:00Z", confidence: 0.42 }),
    });
    const result = deriveCellStateFromObservation(event, AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      const p: CellStateDerivationProvenance = result.provenance;
      expect(p.source_observation_provenance).toBe("third_party");
      expect(p.source_observation_time).toBe("2026-08-13T09:00:00Z");
      expect(p.source_observation_confidence).toBe(0.42);
    }
  });
});

describe("NO_NEED_GENERATION", () => {
  it("cellStateDerivation.ts never imports need.ts, target.ts, or offer.ts", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\/(need|target|offer)["']/);
    }
  });

  it("this module exports no Need-producing function", () => {
    const mod = derivationModule as unknown as Record<string, unknown>;
    for (const name of ["createNeed", "deriveNeedFromObservation", "toNeed"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_TARGET_GENERATION", () => {
  it("cellStateDerivation.ts never imports target.ts (re-checked as its own named point, not folded into NO_NEED_GENERATION)", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\/target["']/);
    }
  });

  it("this module exports no Target-producing function, and a CellState candidate carries no reference_type/desired_state field (Target's own shape, target.ts)", () => {
    const mod = derivationModule as unknown as Record<string, unknown>;
    for (const name of ["createTarget", "deriveTargetFromObservation", "toTarget"]) {
      expect(mod[name]).toBeUndefined();
    }
    const result = deriveCellStateFromObservation(baseCanonEvent(), AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      for (const forbidden of ["reference_type", "desired_state", "target_id"]) {
        expect(Object.prototype.hasOwnProperty.call(result.candidate, forbidden)).toBe(false);
      }
    }
  });
});

describe("NO_TENSION_INFERENCE", () => {
  it("cellStateDerivation.ts imports nothing matching/naming Tension in its imports", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/[Tt]ension/);
    }
  });

  it("the CellState candidate carries no tension field — Tension is not part of CellState (canon §4)", () => {
    const result = deriveCellStateFromObservation(baseCanonEvent(), AS_OF);
    expect(result.kind).toBe("cell_state");
    if (result.kind === "cell_state") {
      expect(Object.prototype.hasOwnProperty.call(result.candidate, "tension")).toBe(false);
    }
  });

  it("this module exports no Tension/Deficit-computing function", () => {
    const mod = derivationModule as unknown as Record<string, unknown>;
    for (const name of ["computeTension", "deriveDeficit", "inferDeficit"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_LEGACY_EVENT_WRITE", () => {
  it("cellStateDerivation.ts never imports the legacy event log", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\.\/events["']/);
      expect(line).not.toMatch(/from ["']\.\.\/eventStore["']/);
      expect(line).not.toMatch(/philos-event-store/);
    }
  });

  it("running a derivation never writes to a live, populated legacy PhilosEventStore", async () => {
    const legacyStore = new InMemoryPhilosEventStore();
    const legacyEvent: PhilosEvent = {
      event_id: "legacy_evt_derive_check",
      actor_id: "person_roei",
      entity_type: "person",
      entity_id: "person_roei",
      event_type: "person.registered",
      value_tags: [],
      timestamp: "2026-08-13T08:00:00Z",
      visibility: "public",
    };
    await legacyStore.append([legacyEvent]);

    deriveCellStateFromObservation(baseCanonEvent(), AS_OF); // no store parameter accepted at all for the pure path

    const legacyLoaded = await legacyStore.load();
    expect(legacyLoaded).toHaveLength(1);
    expect(legacyLoaded[0].event_id).toBe("legacy_evt_derive_check");
  });
});

describe("NO_PROJECTION_SIDE_EFFECT", () => {
  it("cellStateDerivation.ts never imports a projection module", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/projectValueGroup|projectDynamics|projectGlobeGraph/);
    }
  });

  it("this module exports no projection function", () => {
    const mod = derivationModule as unknown as Record<string, unknown>;
    for (const name of ["projectCellStates", "toValueGroupView"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_DYNAMICS_SIDE_EFFECT", () => {
  it("cellStateDerivation.ts never imports dynamicsView or the Dynamics route", () => {
    const importLines = SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/dynamicsView|DynamicsView/);
    }
  });
});

describe("cellStateDerivation — no persistence, no aggregation, determinism", () => {
  it("this module exports no CellState store/persistence function — a candidate is returned, never written", () => {
    const mod = derivationModule as unknown as Record<string, unknown>;
    for (const name of ["saveCellState", "cellStateStore", "persistCellState"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("this module exports no multi-observation combination/aggregation function", () => {
    const mod = derivationModule as unknown as Record<string, unknown>;
    for (const name of ["combineObservations", "aggregateObservations", "weightedAverage"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("is deterministic — same input, same output", () => {
    const event = baseCanonEvent();
    expect(deriveCellStateFromObservation(event, AS_OF)).toEqual(
      deriveCellStateFromObservation(event, AS_OF),
    );
  });

  it("never mutates its input CanonEvent", () => {
    const event = baseCanonEvent();
    const before = JSON.stringify(event);
    deriveCellStateFromObservation(event, AS_OF);
    expect(JSON.stringify(event)).toBe(before);
  });
});
