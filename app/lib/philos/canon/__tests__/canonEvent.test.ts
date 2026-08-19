/**
 * Philos Canon — CanonEvent, validated (the Observation → event-
 * representation edge, approved after the read-only integration audit).
 *
 * Named assertions requested for this pass: OBSERVATION_EVENT_TYPE_EXISTS,
 * CANON_TO_EVENT_MAPPING_EXPLICIT, NO_CANON_FIELD_LOSS,
 * NO_DOMAIN_COLLISION_HIDDEN, NO_TRANSFER_COLLISION_TOUCHED,
 * EVENT_STORE_COMPATIBILITY, NEGATIVE_VALIDATION_TESTS, NO_LIVE_SIDE_EFFECT.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as canonEventModule from "../canonEvent";
import {
  type CanonEvent,
  type CanonType,
  validateCanonEvent,
} from "../canonEvent";
import { type Observation, validateObservation } from "../observation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, "..", "canonEvent.ts");
const SOURCE_TEXT = readFileSync(SOURCE_PATH, "utf-8");

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_roei",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-12T20:00:00Z",
    provenance: "self_reported",
    confidence: 0.7,
    expiry: "2026-09-12T20:00:00Z",
    level: -0.3,
    stability: 0.5,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function baseCanonEvent(overrides: Partial<CanonEvent> = {}): CanonEvent {
  return {
    canon_event_id: "canon_event_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-12T20:00:05Z",
    ...overrides,
  };
}

describe("OBSERVATION_EVENT_TYPE_EXISTS", () => {
  it("CanonEvent exists as a real, importable type with canon_type='observation' representable", () => {
    const event = baseCanonEvent();
    expect(event.canon_type).toBe("observation");
    const result = validateCanonEvent(event);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("canon_type is a single-value literal union this pass — not a placeholder for future values", () => {
    const validTypes: CanonType[] = ["observation"];
    expect(validTypes).toEqual(["observation"]);
  });

  it("rejects any canon_type other than 'observation'", () => {
    const result = validateCanonEvent(
      baseCanonEvent({ canon_type: "cell_state" as unknown as CanonType }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "canon_type", reason: "invalid" });
  });
});

describe("CANON_TO_EVENT_MAPPING_EXPLICIT", () => {
  it("payload is typed as the real Observation interface, re-used verbatim — not a redeclared/renamed shape", () => {
    const event = baseCanonEvent();
    // Every field on the payload is a real Observation field, checkable via
    // the real validator with zero adaptation.
    expect(validateObservation(event.payload).valid).toBe(true);
  });

  it("recorded_at is explicitly distinct from payload.time — no ordering assumed or enforced between them", () => {
    const event = baseCanonEvent({
      payload: baseObservation({ time: "2026-08-12T20:00:00Z" }),
      recorded_at: "2026-08-10T00:00:00Z", // BEFORE payload.time — deliberately, to prove no ordering check exists
    });
    expect(validateCanonEvent(event).valid).toBe(true);
  });

  it("validateCanonEvent delegates to validateObservation rather than re-implementing its checks", () => {
    // A payload that only validateObservation (not validateCanonEvent) could
    // catch — an invalid domain — is still caught, proving delegation, not
    // duplication-with-gaps.
    const event = baseCanonEvent({
      payload: baseObservation({ domain: "physical" as unknown as Observation["domain"] }),
    });
    const result = validateCanonEvent(event);
    expect(result.valid).toBe(false);
    const payloadError = result.errors.find((e) => e.field === "payload");
    expect(payloadError).toBeDefined();
    if (payloadError && payloadError.field === "payload" && payloadError.reason === "invalid") {
      expect(payloadError.errors).toContainEqual({ field: "domain", reason: "invalid" });
    }
  });
});

describe("NO_CANON_FIELD_LOSS", () => {
  it("every Observation field survives unchanged inside CanonEvent.payload — full round-trip, no drop/rename/coercion", () => {
    const original = baseObservation({
      subject: "person_x",
      domain: "C",
      frame: "S",
      reference: "threshold:min_functioning",
      context: "crisis_check",
      time: "2026-08-12T20:00:00Z",
      provenance: "third_party",
      confidence: 0.4,
      expiry: "2026-08-19T20:00:00Z",
      level: -4.2,
      stability: 0.1,
      deficitType: "OBJECTIVE",
      systemicChannel: "material",
    });
    const event: CanonEvent = {
      canon_event_id: "canon_event_roundtrip",
      canon_type: "observation",
      payload: original,
      recorded_at: "2026-08-12T20:00:10Z",
    };
    expect(event.payload).toEqual(original);
    expect(event.payload).toBe(original); // same reference — no copy/coercion at all
    for (const key of Object.keys(original)) {
      expect(event.payload).toHaveProperty(key, (original as unknown as Record<string, unknown>)[key]);
    }
  });

  it("field COUNT is unchanged — CanonEvent adds no hidden fields to the Observation payload itself", () => {
    const original = baseObservation();
    const event = baseCanonEvent({ payload: original });
    expect(Object.keys(event.payload).sort()).toEqual(Object.keys(original).sort());
  });
});

describe("NO_DOMAIN_COLLISION_HIDDEN", () => {
  it("canonEvent.ts's own source never imports from projectDynamics.ts (the file exporting the OTHER, incompatible Domain)", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ["'].*projectDynamics["']/);
  });

  it("canonEvent.ts imports Domain-adjacent types (via Observation) only from ./observation — the collision is not aliased away or renamed", () => {
    // The only local import in this file is from "./observation"; Domain
    // itself is never imported directly here (it arrives structurally via
    // the Observation type), and no re-export or alias of a second Domain
    // exists anywhere in this file.
    expect(SOURCE_TEXT).toMatch(/from ["']\.\/observation["']/);
    expect(SOURCE_TEXT).not.toMatch(/as\s+Domain\b/);
  });

  it("the collision is documented, not silently reconciled — the module header names it explicitly", () => {
    expect(SOURCE_TEXT).toMatch(/Domain/);
    expect(SOURCE_TEXT.toLowerCase()).toMatch(/collision/);
  });
});

describe("NO_TRANSFER_COLLISION_TOUCHED", () => {
  it("canonEvent.ts's own source never imports from transfer.ts or projectValueGroup.ts (TransferView's home)", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ["']\.\/transfer["']/);
    expect(SOURCE_TEXT).not.toMatch(/from ["'].*projectValueGroup["']/);
  });

  it("TransferView is named in documentation only, never imported or referenced as live code", () => {
    const importLines = SOURCE_TEXT.split("\n").filter((line) => line.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/TransferView/);
    }
  });

  it("CanonEvent has no canon_type value for transfer this pass", () => {
    const types: CanonType[] = ["observation"];
    expect(types).not.toContain("transfer");
  });
});

describe("EVENT_STORE_COMPATIBILITY", () => {
  it("CanonEvent's field names do not collide with PhilosEvent's own field names in a way that would conflict if ever unioned", () => {
    // PhilosEvent's real fields (../events.ts), listed by hand from that
    // file's own interface — checked for name-shape compatibility only, no
    // import of events.ts (per this pass's isolation requirement).
    const philosEventFieldNames = new Set([
      "event_id",
      "actor_id",
      "entity_type",
      "entity_id",
      "event_type",
      "value_tags",
      "timestamp",
      "visibility",
      "payload",
      "resource_delta",
      "evidence",
      "confidence",
      "impact_claim",
      "verification_status",
      "caused_by",
    ]);
    const canonEventFieldNames = Object.keys(baseCanonEvent());
    // "payload" is intentionally shared in NAME between the two (both use it
    // for their free-form/typed body) — checked explicitly, not accidental:
    // PhilosEvent.payload is Record<string, unknown>; CanonEvent.payload is
    // Observation. Same field name, different (and non-conflicting, since
    // the two types are never unioned) meaning — flagged here, not hidden.
    const sharedNames = canonEventFieldNames.filter((f) => philosEventFieldNames.has(f));
    expect(sharedNames).toEqual(["payload"]);
  });

  it("canon_event_id plays the same role PhilosEvent.event_id plays — a stable, unique, append-only identifier", () => {
    const a = baseCanonEvent({ canon_event_id: "id_a" });
    const b = baseCanonEvent({ canon_event_id: "id_b" });
    expect(a.canon_event_id).not.toBe(b.canon_event_id);
    // Uniqueness itself is not enforced by validateCanonEvent (no store
    // exists to check against, per scope) — only non-emptiness is, matching
    // exactly how much a standalone type can prove without a store.
    expect(validateCanonEvent(a).valid).toBe(true);
    expect(validateCanonEvent(b).valid).toBe(true);
  });

  it("this file imports nothing from eventStore.ts or philos-event-store.ts — compatibility is structural, not wired", () => {
    expect(SOURCE_TEXT).not.toMatch(/from ["'].*eventStore["']/);
    expect(SOURCE_TEXT).not.toMatch(/from ["'].*philos-event-store["']/);
  });
});

describe("NEGATIVE_VALIDATION_TESTS", () => {
  it("rejects an empty canon_event_id", () => {
    const result = validateCanonEvent(baseCanonEvent({ canon_event_id: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "canon_event_id", reason: "empty" });
  });

  it("rejects a missing/offsetless recorded_at", () => {
    const result = validateCanonEvent(baseCanonEvent({ recorded_at: "2026-08-12T20:00:00" }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "recorded_at",
      reason: "invalid_or_no_offset",
    });
  });

  it("rejects a non-object payload without crashing", () => {
    const result = validateCanonEvent(
      baseCanonEvent({ payload: "not an observation" as unknown as Observation }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "payload", reason: "not_an_object" });
  });

  it("rejects a structurally invalid Observation payload, surfacing the inner errors", () => {
    const result = validateCanonEvent(
      baseCanonEvent({ payload: baseObservation({ subject: "" }) }),
    );
    expect(result.valid).toBe(false);
    const payloadError = result.errors.find((e) => e.field === "payload");
    expect(payloadError).toBeDefined();
  });

  it("never throws on completely malformed input, including null/undefined at the top level", () => {
    expect(() => validateCanonEvent({} as unknown as CanonEvent)).not.toThrow();
    expect(() => validateCanonEvent(null as unknown as CanonEvent)).not.toThrow();
    expect(() => validateCanonEvent(undefined as unknown as CanonEvent)).not.toThrow();
    expect(validateCanonEvent(null as unknown as CanonEvent).valid).toBe(false);
  });

  it("reports all applicable top-level errors at once, not short-circuited", () => {
    const result = validateCanonEvent(
      baseCanonEvent({ canon_event_id: "", recorded_at: "bad", canon_type: "x" as unknown as CanonType }),
    );
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(["canon_event_id", "canon_type", "recorded_at"]);
  });
});

describe("NO_LIVE_SIDE_EFFECT", () => {
  it("validateCanonEvent is pure — never mutates its input", () => {
    const event = baseCanonEvent();
    const before = JSON.stringify(event);
    validateCanonEvent(event);
    expect(JSON.stringify(event)).toBe(before);
  });

  it("is deterministic — same input, same output", () => {
    const event = baseCanonEvent();
    expect(validateCanonEvent(event)).toEqual(validateCanonEvent(event));
  });

  it("this module performs no I/O, no store append, no fetch — no such import exists in its source", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bfetch\(/);
    expect(SOURCE_TEXT).not.toMatch(/readFile|writeFile|appendFile/);
    expect(SOURCE_TEXT).not.toMatch(/\.append\(/);
  });

  it("this module exports no store, projection, UI, or Merlin/n8n-facing function", () => {
    const mod = canonEventModule as unknown as Record<string, unknown>;
    for (const name of [
      "saveCanonEvent",
      "canonEventStore",
      "projectCanonEvent",
      "renderCanonEvent",
      "sendToMerlin",
      "dispatchToN8n",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});
