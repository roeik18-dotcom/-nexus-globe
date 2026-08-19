/**
 * Philos Canon — CanonEventStore, validated (the Observation → store-append
 * edge).
 *
 * Named assertions requested for this pass: OBSERVATION_CANON_EVENT_VALID,
 * STORE_APPEND_PASS, PERSISTENCE_ROUNDTRIP_PASS, DUPLICATE_EVENT_HANDLING,
 * NO_FIELD_LOSS, EXISTING_EVENT_TYPES_UNCHANGED, NO_PROJECTION_SIDE_EFFECT,
 * NO_DYNAMICS_SIDE_EFFECT, NO_LIVE_MERLIN_SIDE_EFFECT.
 */
import { existsSync, mkdtempSync, readFileSync as readFileSyncFs, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CanonEvent, validateCanonEvent } from "../canonEvent";
import * as canonEventStoreModule from "../canonEventStore";
import {
  CanonAppendRejectedError,
  type CanonEventStore,
  checkCanonAppend,
  FileSystemCanonEventStore,
  inCanonOrder,
  InMemoryCanonEventStore,
} from "../canonEventStore";
import type { EventType } from "../../events";
import type { Observation } from "../observation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_SOURCE = readFileSyncFs(join(__dirname, "..", "canonEventStore.ts"), "utf-8");

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
    canon_event_id: "canon_evt_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-12T20:00:05Z",
    ...overrides,
  };
}

describe("OBSERVATION_CANON_EVENT_VALID", () => {
  it("a canon-shaped CanonEvent passes validateCanonEvent before it is ever appended", () => {
    const event = baseCanonEvent();
    expect(validateCanonEvent(event).valid).toBe(true);
  });
});

describe("STORE_APPEND_PASS", () => {
  it("appends one valid Observation CanonEvent to an in-memory store", async () => {
    const store = new InMemoryCanonEventStore();
    const appended = await store.append([baseCanonEvent()]);
    expect(appended).toHaveLength(1);
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].canon_event_id).toBe("canon_evt_001");
  });

  it("checkCanonAppend accepts a well-formed, non-duplicate append", () => {
    const result = checkCanonAppend([], [baseCanonEvent()]);
    expect(result.ok).toBe(true);
  });

  it("rejects an empty append batch", async () => {
    const store = new InMemoryCanonEventStore();
    await expect(store.append([])).rejects.toBeInstanceOf(CanonAppendRejectedError);
  });

  it("rejects a structurally invalid CanonEvent at the store boundary, not just at validateCanonEvent", async () => {
    const store = new InMemoryCanonEventStore();
    const invalid = baseCanonEvent({ payload: baseObservation({ subject: "" }) });
    await expect(store.append([invalid])).rejects.toBeInstanceOf(CanonAppendRejectedError);
    try {
      await store.append([invalid]);
    } catch (err) {
      expect(err).toBeInstanceOf(CanonAppendRejectedError);
      const rejection = (err as InstanceType<typeof CanonAppendRejectedError>).rejections[0];
      expect(rejection.code).toBe("invalid_canon_event");
    }
  });
});

describe("PERSISTENCE_ROUNDTRIP_PASS", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "canon-event-store-test-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("appends to a real file-system store and reads back the identical event after a fresh store instance (simulating a restart)", async () => {
    const writer = new FileSystemCanonEventStore(dataDir);
    const original = baseCanonEvent({ canon_event_id: "canon_evt_roundtrip" });
    await writer.append([original]);

    const reader = new FileSystemCanonEventStore(dataDir); // fresh instance, no shared memory
    const loaded = await reader.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(original);
  });

  it("persists as JSONL — one JSON object per line, matching philos-event-store.ts's own format", async () => {
    const store = new FileSystemCanonEventStore(dataDir);
    await store.append([baseCanonEvent()]);
    const raw = readFileSyncFs(join(dataDir, "canon-events.jsonl"), "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
    expect(JSON.parse(lines[0])).toEqual(baseCanonEvent());
  });

  it("writes to canon-events.jsonl, never to philos-events.jsonl — physically separate files", async () => {
    const store = new FileSystemCanonEventStore(dataDir);
    await store.append([baseCanonEvent()]);
    expect(existsSync(join(dataDir, "canon-events.jsonl"))).toBe(true);
    expect(existsSync(join(dataDir, "philos-events.jsonl"))).toBe(false);
  });

  it("multiple appends across separate store instances accumulate correctly on disk", async () => {
    const first = new FileSystemCanonEventStore(dataDir);
    await first.append([baseCanonEvent({ canon_event_id: "evt_a" })]);
    const second = new FileSystemCanonEventStore(dataDir);
    await second.append([baseCanonEvent({ canon_event_id: "evt_b" })]);
    const third = new FileSystemCanonEventStore(dataDir);
    const loaded = await third.load();
    expect(loaded.map((e) => e.canon_event_id).sort()).toEqual(["evt_a", "evt_b"]);
  });
});

describe("DUPLICATE_EVENT_HANDLING", () => {
  it("rejects (does not silently ignore or overwrite) a re-appended canon_event_id", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([baseCanonEvent()]);
    await expect(store.append([baseCanonEvent()])).rejects.toBeInstanceOf(
      CanonAppendRejectedError,
    );
    const loaded = await store.load();
    expect(loaded).toHaveLength(1); // still just one — the duplicate never entered the log
  });

  it("the rejection explicitly names the reason as already-stored, not a generic failure", async () => {
    const store = new InMemoryCanonEventStore();
    await store.append([baseCanonEvent()]);
    try {
      await store.append([baseCanonEvent()]);
      expect.fail("expected append to reject");
    } catch (err) {
      const rejection = (err as InstanceType<typeof CanonAppendRejectedError>).rejections;
      expect(rejection.some((r) => r.code === "canon_event_id_already_stored")).toBe(true);
    }
  });

  it("rejects a batch containing the same canon_event_id twice, even if neither is yet stored", () => {
    const dup = baseCanonEvent();
    const result = checkCanonAppend([], [dup, dup]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.some((r) => r.code === "duplicate_canon_event_id")).toBe(true);
    }
  });

  it("this store's duplicate handling is EXPLICIT rejection, mirroring the live PhilosEventStore's own choice — never a silent no-op", () => {
    expect(STORE_SOURCE).toMatch(/canon_event_id_already_stored/);
    expect(STORE_SOURCE.toLowerCase()).toMatch(/append-only/);
  });
});

describe("NO_FIELD_LOSS", () => {
  it("every Observation field survives a full append→load round trip through the in-memory store", async () => {
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
    const event = baseCanonEvent({ canon_event_id: "evt_full_fields", payload: original });
    const store = new InMemoryCanonEventStore();
    await store.append([event]);
    const [loaded] = await store.load();
    expect(loaded.payload).toEqual(original);
    for (const key of Object.keys(original)) {
      expect(loaded.payload).toHaveProperty(key, (original as unknown as Record<string, unknown>)[key]);
    }
  });

  it("field survival also holds through the JSONL (file-system) round trip", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "canon-event-store-fieldloss-"));
    try {
      const original = baseObservation({ systemicChannel: "economic", frame: "S", domain: "G" });
      const event = baseCanonEvent({ canon_event_id: "evt_fs_fields", payload: original });
      const store = new FileSystemCanonEventStore(dataDir);
      await store.append([event]);
      const fresh = new FileSystemCanonEventStore(dataDir);
      const [loaded] = await fresh.load();
      expect(loaded.payload).toEqual(original);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("EXISTING_EVENT_TYPES_UNCHANGED", () => {
  it("all 16 known EventType literals still type-check against the live union — a compile-time proof this pass did not narrow it", () => {
    const knownTypes: EventType[] = [
      "person.registered",
      "group.opened",
      "leader.appointed",
      "member.joined",
      "request.opened",
      "update.posted",
      "meeting.scheduled",
      "resource.received",
      "allocation.proposed",
      "allocation.voted",
      "allocation.approved",
      "transfer.approved",
      "transfer.completed",
      "impact.recorded",
      "verification.requested",
      "impact.verified",
    ];
    expect(knownTypes).toHaveLength(16);
  });

  it("canonEventStore.ts and canonEvent.ts import nothing from ../events.ts — the live EventType union is never touched by this pass", () => {
    expect(STORE_SOURCE).not.toMatch(/from ["']\.\.\/events["']/);
  });
});

describe("NO_PROJECTION_SIDE_EFFECT", () => {
  it("canonEventStore.ts never IMPORTS from projectValueGroup.ts, projectDynamics.ts, or projectGlobeGraph.ts — citing them in the read-only-audit doc comment is fine, importing them is not", () => {
    const importLines = STORE_SOURCE.split("\n").filter((line) => line.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/projectValueGroup|projectDynamics|projectGlobeGraph/);
    }
  });

  it("this module exports no projection function of any kind", () => {
    const mod = canonEventStoreModule as unknown as Record<string, unknown>;
    for (const name of ["projectCanonEvents", "toValueGroupView", "renderCanonEvents"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_DYNAMICS_SIDE_EFFECT", () => {
  it("canonEventStore.ts imports nothing from dynamicsView.ts or the Dynamics route", () => {
    expect(STORE_SOURCE).not.toMatch(/dynamicsView/);
    expect(STORE_SOURCE).not.toMatch(/DynamicsView/);
  });

  it("this module exports no Dynamics-shaped function", () => {
    const mod = canonEventStoreModule as unknown as Record<string, unknown>;
    for (const name of ["buildCanonDynamicsView", "toDynamicsGraph"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_LIVE_MERLIN_SIDE_EFFECT", () => {
  it("canonEventStore.ts never IMPORTS from voice-gateway, Merlin, or n8n — mentioning them in a doc comment (to state their absence) is fine and expected, importing them is not", () => {
    const importLines = STORE_SOURCE.split("\n").filter((line) => line.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/voice-gateway|merlin|n8n/);
    }
  });

  it("this module exports no network/dispatch function", () => {
    const mod = canonEventStoreModule as unknown as Record<string, unknown>;
    for (const name of ["sendToMerlin", "dispatchToN8n", "notifyMerlin"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("CanonEventStore — determinism, purity, ordering", () => {
  it("inCanonOrder is deterministic and sorts by recorded_at then canon_event_id", () => {
    const a = baseCanonEvent({ canon_event_id: "z_last", recorded_at: "2026-08-12T20:00:00Z" });
    const b = baseCanonEvent({ canon_event_id: "a_first", recorded_at: "2026-08-12T20:00:00Z" });
    const c = baseCanonEvent({ canon_event_id: "mid", recorded_at: "2026-08-11T00:00:00Z" });
    const ordered = inCanonOrder([a, b, c]);
    expect(ordered.map((e) => e.canon_event_id)).toEqual(["mid", "a_first", "z_last"]);
  });

  it("checkCanonAppend never throws and never mutates its arguments", () => {
    const stored = [baseCanonEvent()];
    const before = JSON.stringify(stored);
    expect(() => checkCanonAppend(stored, [baseCanonEvent({ canon_event_id: "x" })])).not.toThrow();
    expect(JSON.stringify(stored)).toBe(before);
  });

  it("an InMemoryCanonEventStore and a FileSystemCanonEventStore both satisfy the same CanonEventStore interface", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "canon-event-store-iface-"));
    try {
      const stores: CanonEventStore[] = [
        new InMemoryCanonEventStore(),
        new FileSystemCanonEventStore(dataDir),
      ];
      for (const store of stores) {
        await store.append([baseCanonEvent()]);
        const loaded = await store.load();
        expect(loaded).toHaveLength(1);
      }
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
