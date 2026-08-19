/**
 * Philos Canon — CanonEventStore accessor, validated.
 *
 * Named assertions requested for this pass: CANON_EVENT_STORE_SINGLETON,
 * SAME_INSTANCE_RETURNED, CONFIGURED_PATH_STABLE, TEST_RESET_ISOLATED,
 * OBSERVATION_APPEND_THROUGH_ACCESSOR, PERSISTENCE_ROUNDTRIP_THROUGH_ACCESSOR,
 * DUPLICATE_EVENT_REJECTED, NO_LEGACY_EVENTTYPE_CHANGE,
 * NO_PROJECTION_SIDE_EFFECT, NO_DYNAMICS_SIDE_EFFECT, NO_MERLIN_SIDE_EFFECT.
 *
 * Isolation discipline: every test that touches the real singleton resets it
 * via `_setCanonEventStore(null)` in `afterEach`, so no test observes another
 * test's injected store, and the REAL default (`.philos-canon-data` under
 * `process.cwd()`) is never constructed by this suite except in the one test
 * that explicitly targets a controlled temp directory via `CANON_DATA_DIR`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonEvent } from "../canonEvent";
import * as accessorModule from "../canonEventStoreAccessor";
import {
  _setCanonEventStore,
  canonEventStore,
  loadCanonEvents,
} from "../canonEventStoreAccessor";
import { CanonAppendRejectedError, InMemoryCanonEventStore } from "../canonEventStore";
import type { EventType } from "../../events";
import type { Observation } from "../observation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACCESSOR_SOURCE = readFileSync(join(__dirname, "..", "canonEventStoreAccessor.ts"), "utf-8");

afterEach(() => {
  _setCanonEventStore(null);
  delete process.env.CANON_DATA_DIR;
});

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
    canon_event_id: "canon_evt_accessor_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-12T20:00:05Z",
    ...overrides,
  };
}

describe("CANON_EVENT_STORE_SINGLETON", () => {
  it("canonEventStore() returns a CanonEventStore-shaped object with load/append", () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const store = canonEventStore();
    expect(typeof store.load).toBe("function");
    expect(typeof store.append).toBe("function");
  });

  it("importing this module performs no disk mutation — construction is lazy, inside createDefaultCanonStore(), never at the top level", () => {
    // "new FileSystemCanonEventStore" must appear exactly once, and that one
    // occurrence must be indented (inside a function body), never as a
    // column-0 top-level statement that would run at import time.
    const occurrences = ACCESSOR_SOURCE.split("\n").filter((line) =>
      line.includes("new FileSystemCanonEventStore"),
    );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatch(/^\s+\S/); // indented, not column-0
  });
});

describe("SAME_INSTANCE_RETURNED", () => {
  it("repeated calls to canonEventStore() return the identical instance", () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const a = canonEventStore();
    const b = canonEventStore();
    expect(a).toBe(b); // reference equality, not just structural equality
  });

  it("state written through one call is visible through a later call — proving it's the same store, not a fresh one each time", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    await canonEventStore().append([baseCanonEvent()]);
    const loaded = await canonEventStore().load();
    expect(loaded).toHaveLength(1);
  });
});

describe("CONFIGURED_PATH_STABLE", () => {
  it("CANON_DATA_DIR, when set, determines where the default store persists — and stays stable across repeated accessor calls", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "canon-accessor-path-"));
    try {
      process.env.CANON_DATA_DIR = dataDir;
      _setCanonEventStore(null); // force re-creation from the env var
      await canonEventStore().append([baseCanonEvent()]);
      expect(existsSync(join(dataDir, "canon-events.jsonl"))).toBe(true);

      // A second call must use the SAME configured path, not re-read the env
      // var and rebuild — proven by appending again and finding both events.
      await canonEventStore().append([baseCanonEvent({ canon_event_id: "canon_evt_accessor_002" })]);
      const loaded = await canonEventStore().load();
      expect(loaded).toHaveLength(2);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("defaults to .philos-canon-data (a sibling of .philos-data, never nested inside it) when CANON_DATA_DIR is unset", () => {
    expect(ACCESSOR_SOURCE).toMatch(/\.philos-canon-data/);
    expect(ACCESSOR_SOURCE).not.toMatch(/\.philos-data.*canon/);
  });

  it("the actual process.env lookup uses CANON_DATA_DIR, never PHILOS_DATA_DIR — PHILOS_DATA_DIR may be cited in a doc comment (what was read), never used as live code", () => {
    const envLines = ACCESSOR_SOURCE.split("\n").filter((l) => l.includes("process.env."));
    expect(envLines.length).toBeGreaterThan(0);
    for (const line of envLines) {
      expect(line).toMatch(/CANON_DATA_DIR/);
      expect(line).not.toMatch(/PHILOS_DATA_DIR/);
    }
  });
});

describe("TEST_RESET_ISOLATED", () => {
  it("_setCanonEventStore(null) forces the next call to construct a fresh default store", async () => {
    const injected = new InMemoryCanonEventStore();
    await injected.append([baseCanonEvent()]);
    _setCanonEventStore(injected);
    expect(await (await canonEventStore().load())).toHaveLength(1);

    _setCanonEventStore(null);
    process.env.CANON_DATA_DIR = mkdtempSync(join(tmpdir(), "canon-accessor-reset-"));
    try {
      const fresh = canonEventStore();
      expect(fresh).not.toBe(injected);
      expect(await fresh.load()).toHaveLength(0); // fresh store, no carried-over state
    } finally {
      rmSync(process.env.CANON_DATA_DIR!, { recursive: true, force: true });
    }
  });

  it("_setCanonEventStore lets a test inject an isolated in-memory store with zero shared state across tests", async () => {
    const storeA = new InMemoryCanonEventStore();
    _setCanonEventStore(storeA);
    await canonEventStore().append([baseCanonEvent({ canon_event_id: "only_in_a" })]);

    _setCanonEventStore(new InMemoryCanonEventStore()); // a fresh, unrelated store
    const loaded = await canonEventStore().load();
    expect(loaded).toHaveLength(0); // storeA's event is not visible here
  });
});

describe("OBSERVATION_APPEND_THROUGH_ACCESSOR", () => {
  it("appends a valid Observation CanonEvent through canonEventStore() directly", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const appended = await canonEventStore().append([baseCanonEvent()]);
    expect(appended).toHaveLength(1);
  });

  it("appends through loadCanonEvents()'s companion read path and sees the same event", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    await canonEventStore().append([baseCanonEvent()]);
    const loaded = await loadCanonEvents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].canon_type).toBe("observation");
  });
});

describe("PERSISTENCE_ROUNDTRIP_THROUGH_ACCESSOR", () => {
  it("an event appended through the accessor survives a simulated restart (fresh accessor state, same configured directory)", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "canon-accessor-roundtrip-"));
    try {
      process.env.CANON_DATA_DIR = dataDir;
      _setCanonEventStore(null);
      await canonEventStore().append([baseCanonEvent({ canon_event_id: "roundtrip_evt" })]);

      // Simulate a restart: clear the singleton, keep the same configured dir.
      _setCanonEventStore(null);
      const loaded = await loadCanonEvents();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].canon_event_id).toBe("roundtrip_evt");
      expect(loaded[0].payload).toEqual(baseObservation());
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("DUPLICATE_EVENT_REJECTED", () => {
  it("a re-appended canon_event_id through the accessor is rejected, not silently ignored", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    await canonEventStore().append([baseCanonEvent()]);
    await expect(canonEventStore().append([baseCanonEvent()])).rejects.toBeInstanceOf(
      CanonAppendRejectedError,
    );
    const loaded = await loadCanonEvents();
    expect(loaded).toHaveLength(1);
  });
});

describe("NO_LEGACY_EVENTTYPE_CHANGE", () => {
  it("all 16 known EventType literals still type-check against the live union", () => {
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

  it("canonEventStoreAccessor.ts imports nothing from ../events.ts, ../eventStore.ts, or ../../philos-event-store.ts", () => {
    const importLines = ACCESSOR_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\.\/events["']/);
      expect(line).not.toMatch(/from ["']\.\.\/eventStore["']/);
      expect(line).not.toMatch(/philos-event-store/);
    }
  });
});

describe("NO_PROJECTION_SIDE_EFFECT", () => {
  it("canonEventStoreAccessor.ts never imports a projection module", () => {
    const importLines = ACCESSOR_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/projectValueGroup|projectDynamics|projectGlobeGraph/);
    }
  });

  it("this module exports no projection function", () => {
    const mod = accessorModule as unknown as Record<string, unknown>;
    for (const name of ["projectCanonEvents", "toValueGroupView"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_DYNAMICS_SIDE_EFFECT", () => {
  it("canonEventStoreAccessor.ts never imports dynamicsView or the Dynamics route", () => {
    const importLines = ACCESSOR_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/dynamicsView|DynamicsView/);
    }
  });

  it("this module exports no Dynamics-shaped function", () => {
    const mod = accessorModule as unknown as Record<string, unknown>;
    for (const name of ["buildCanonDynamicsView", "toDynamicsGraph"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_MERLIN_SIDE_EFFECT", () => {
  it("canonEventStoreAccessor.ts never imports from voice-gateway, Merlin, or n8n", () => {
    const importLines = ACCESSOR_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/voice-gateway|merlin|n8n/);
    }
  });

  it("this module exports no network/dispatch function", () => {
    const mod = accessorModule as unknown as Record<string, unknown>;
    for (const name of ["sendToMerlin", "dispatchToN8n"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("live routes now reach this accessor (superseded note: a later, separately-approved pass wired app/api/canon/observations/route.ts and its [canonEventId] siblings) — confirmed by reading their source, not assumed", () => {
    const routeFiles = [
      "app/api/canon/observations/route.ts",
      "app/api/canon/observations/[canonEventId]/route.ts",
      "app/api/canon/observations/[canonEventId]/cell-state/route.ts",
    ];
    for (const rel of routeFiles) {
      const src = readFileSync(join(process.cwd(), rel), "utf-8");
      expect(src).toContain("philos/canon/canonEventStoreAccessor");
    }
  });
});

describe("Accessor — never touches Observation semantics", () => {
  it("payload survives append→load through the accessor with zero field loss", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const original = baseObservation({
      domain: "C",
      frame: "S",
      systemicChannel: "informational",
      deficitType: "OBJECTIVE",
    });
    await canonEventStore().append([baseCanonEvent({ payload: original })]);
    const [loaded] = await loadCanonEvents();
    expect(loaded.payload).toEqual(original);
  });

  it("canon_type remains 'observation' — no second canon_type accepted or assumed", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const event = baseCanonEvent();
    expect(event.canon_type).toBe("observation");
    await expect(
      canonEventStore().append([
        { ...event, canon_type: "cell_state" as unknown as CanonEvent["canon_type"] },
      ]),
    ).rejects.toBeInstanceOf(CanonAppendRejectedError);
  });
});
