/**
 * Philos Canon — dual Observation-ingestion reconciliation, validated.
 *
 * Named assertions requested for this pass: ONE_CANONICAL_INGESTION_FUNCTION,
 * HTTP_DELEGATES_TO_CORE, SERVER_ACTION_DELEGATES_TO_CORE,
 * NO_DUPLICATE_APPEND_LOGIC, CORE_NEVER_MINTS_EVENT_ID,
 * CORE_NEVER_MINTS_RECORDED_AT, HTTP_OPTIONAL_ID_BEHAVIOR_EXPLICIT,
 * DUPLICATE_ID_REJECTED_IDENTICALLY, INVALID_OBSERVATION_ZERO_WRITE,
 * FIELD_ROUNDTRIP_IDENTICAL, ACTION_ACTIONS_NAMING_COLLISION_RESOLVED, plus
 * the legacy-separation checks carried over from the retired
 * `actions.test.ts` (LIVE_CALLER_REACHABLE, VALID_OBSERVATION_APPENDS,
 * DUPLICATE_REJECTED, PERSISTENCE_ROUNDTRIP, CANON_FIELD_COVERAGE_PRESERVED,
 * NO_LEGACY_EVENT_WRITE, NO_PROJECTION_SIDE_EFFECT, NO_DYNAMICS_SIDE_EFFECT,
 * NO_MERLIN_SIDE_EFFECT).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryPhilosEventStore } from "../../eventStore";
import type { PhilosEvent } from "../../events";
import { _setPhilosEventStore, philosEventStore } from "../../../philos-event-store";
import * as actionModule from "../action";
import { InMemoryCanonEventStore } from "../canonEventStore";
import { _setCanonEventStore, canonEventStore } from "../canonEventStoreAccessor";
import type { Observation } from "../observation";
import * as ingestionModule from "../observationIngestion";
import { ingestObservation, recordObservationAction } from "../observationIngestion";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANON_DIR = join(__dirname, "..");
const INGESTION_SOURCE = readFileSync(join(CANON_DIR, "observationIngestion.ts"), "utf-8");
const ROUTE_SOURCE = readFileSync(
  join(CANON_DIR, "../../../api/canon/observations/route.ts"),
  "utf-8",
);

/** Strips /** *\/ and // comments so absence-checks can't be tripped by a
 *  doc comment that names the very thing it explains the absence of. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const INGESTION_CODE = stripComments(INGESTION_SOURCE);
const ROUTE_CODE = stripComments(ROUTE_SOURCE);

afterEach(() => {
  _setCanonEventStore(null);
  _setPhilosEventStore(null);
  delete process.env.CANON_DATA_DIR;
});

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

describe("ACTION_ACTIONS_NAMING_COLLISION_RESOLVED", () => {
  it("actions.ts no longer exists — the server-ingestion module lives at observationIngestion.ts", () => {
    expect(existsSync(join(CANON_DIR, "actions.ts"))).toBe(false);
    expect(existsSync(join(CANON_DIR, "observationIngestion.ts"))).toBe(true);
  });

  it("action.ts (the canonical Action entity) is untouched and unrelated — no overlap in exports", () => {
    expect(existsSync(join(CANON_DIR, "action.ts"))).toBe(true);
    const actionExports = Object.keys(actionModule);
    const ingestionExports = Object.keys(ingestionModule);
    for (const name of actionExports) {
      expect(ingestionExports).not.toContain(name);
    }
    // action.ts still exports its own entity surface, unrelated to ingestion
    expect(actionModule).toHaveProperty("validateAction");
  });

  it("observationIngestion.ts never imports from ./action", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\/action["']/);
    }
  });
});

describe("ONE_CANONICAL_INGESTION_FUNCTION", () => {
  it("ingestObservation is the only place `.append(` is called for an Observation across both surfaces", () => {
    const ingestionAppendCalls = (INGESTION_CODE.match(/\.append\(/g) ?? []).length;
    const routeAppendCalls = (ROUTE_CODE.match(/\.append\(/g) ?? []).length;
    expect(ingestionAppendCalls).toBe(1); // inside ingestObservation, nowhere else
    expect(routeAppendCalls).toBe(0); // NO_DUPLICATE_APPEND_LOGIC — route no longer appends directly
  });

  it("ingestObservation is a real, directly-callable async function", () => {
    expect(typeof ingestObservation).toBe("function");
    expect(ingestObservation.constructor.name).toBe("AsyncFunction");
  });
});

describe("NO_DUPLICATE_APPEND_LOGIC", () => {
  it("route.ts no longer imports CanonAppendRejectedError or calls canonEventStore().append directly", () => {
    expect(ROUTE_CODE).not.toMatch(/CanonAppendRejectedError/);
    expect(ROUTE_CODE).not.toMatch(/canonEventStore\(\)\.append/);
  });

  it("route.ts imports ingestObservation from observationIngestion.ts — HTTP_DELEGATES_TO_CORE", () => {
    expect(ROUTE_SOURCE).toMatch(/from ["']@\/app\/lib\/philos\/canon\/observationIngestion["']/);
    expect(ROUTE_SOURCE).toMatch(/ingestObservation\(/);
  });

  it("recordObservationAction's own source calls ingestObservation, not canonEventStore().append — SERVER_ACTION_DELEGATES_TO_CORE", () => {
    expect(INGESTION_SOURCE).toMatch(/await ingestObservation\(event\)/);
  });
});

describe("CORE_NEVER_MINTS_EVENT_ID / CORE_NEVER_MINTS_RECORDED_AT", () => {
  it("ingestObservation never imports randomUUID or reaches for a clock", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/randomUUID/);
    }
    expect(INGESTION_SOURCE).not.toMatch(/randomUUID\(\)/);
    expect(INGESTION_SOURCE).not.toMatch(/new Date\(\)/);
  });

  it("the stored event's canon_event_id and recorded_at are exactly what the caller supplied", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const result = await ingestObservation({
      canon_event_id: "caller_supplied_id",
      canon_type: "observation",
      payload: baseObservation(),
      recorded_at: "2026-08-13T09:00:05Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.canon_event_id).toBe("caller_supplied_id");
      expect(result.event.recorded_at).toBe("2026-08-13T09:00:05Z");
    }
  });
});

describe("HTTP_OPTIONAL_ID_BEHAVIOR_EXPLICIT", () => {
  it("ingestObservation itself has no notion of an optional id — the CanonEvent type requires it; minting is the route's own, separate concern", () => {
    // ingestObservation's signature takes a complete CanonEvent, never a
    // partial one — optionality of canon_event_id is only ever handled in
    // route.ts's own request-body parsing (suppliedId ?? randomUUID()),
    // never inside the core.
    expect(ROUTE_SOURCE).toMatch(/suppliedId \?\? randomUUID\(\)/);
    expect(INGESTION_SOURCE).not.toMatch(/\?\?\s*randomUUID/);
  });
});

describe("DUPLICATE_ID_REJECTED_IDENTICALLY", () => {
  it("the same duplicate rejection code surfaces whether reached via ingestObservation directly or via recordObservationAction", async () => {
    const storeA = new InMemoryCanonEventStore();
    _setCanonEventStore(storeA);
    const event = {
      canon_event_id: "dup-cross-surface",
      canon_type: "observation" as const,
      payload: baseObservation(),
      recorded_at: "2026-08-13T09:00:05Z",
    };
    await ingestObservation(event, storeA);
    const secondDirect = await ingestObservation(
      { ...event, payload: baseObservation({ level: 9 }) },
      storeA,
    );
    expect(secondDirect.ok).toBe(false);
    if (!secondDirect.ok && secondDirect.reason === "rejected") {
      expect(secondDirect.rejections.map((r) => r.code)).toContain("canon_event_id_already_stored");
    }

    const storeB = new InMemoryCanonEventStore();
    _setCanonEventStore(storeB);
    await recordObservationAction("dup-cross-surface-2", baseObservation(), "2026-08-13T09:00:05Z");
    const secondViaAction = await recordObservationAction(
      "dup-cross-surface-2",
      baseObservation({ level: 9 }),
      "2026-08-13T09:00:10Z",
    );
    expect(secondViaAction.ok).toBe(false);
    if (!secondViaAction.ok) expect(secondViaAction.message).toMatch(/already/);
  });
});

describe("INVALID_OBSERVATION_ZERO_WRITE", () => {
  it("ingestObservation rejects an invalid Observation before any append, reason: invalid", async () => {
    const store = new InMemoryCanonEventStore();
    const result = await ingestObservation(
      {
        canon_event_id: "invalid_evt",
        canon_type: "observation",
        payload: baseObservation({ subject: "" }),
        recorded_at: "2026-08-13T09:00:05Z",
      },
      store,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
    expect(await store.load()).toHaveLength(0);
  });
});

describe("FIELD_ROUNDTRIP_IDENTICAL", () => {
  it("every field survives ingestObservation verbatim, including an S-frame systemicChannel", async () => {
    const store = new InMemoryCanonEventStore();
    const original = baseObservation({
      domain: "G",
      frame: "S",
      systemicChannel: "environmental",
      deficitType: "OBJECTIVE",
      provenance: "third_party",
    });
    const result = await ingestObservation(
      {
        canon_event_id: "roundtrip_evt",
        canon_type: "observation",
        payload: original,
        recorded_at: "2026-08-13T09:00:05Z",
      },
      store,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.payload).toEqual(original);
    const [loaded] = await store.load();
    expect(loaded.payload).toEqual(original);
  });
});

describe("LIVE_CALLER_REACHABLE", () => {
  it("recordObservationAction is a real, directly-callable async function", () => {
    expect(typeof recordObservationAction).toBe("function");
    expect(recordObservationAction.constructor.name).toBe("AsyncFunction");
  });

  it("the file is marked 'use server' — a genuine Next.js server-action boundary, not a plain internal helper", () => {
    expect(INGESTION_SOURCE.trimStart().startsWith('"use server";')).toBe(true);
  });
});

describe("VALID_OBSERVATION_APPENDS", () => {
  it("a valid, explicit Observation is appended and reported ok", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const result = await recordObservationAction(
      "live_evt_001",
      baseObservation(),
      "2026-08-13T09:00:05Z",
    );
    expect(result).toEqual({ ok: true, canon_event_id: "live_evt_001" });
    const loaded = await canonEventStore().load();
    expect(loaded).toHaveLength(1);
  });
});

describe("INVALID_OBSERVATION_REJECTED_WITH_ZERO_WRITE", () => {
  it("an Observation with an empty subject is rejected before any write reaches the store", async () => {
    const store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
    const result = await recordObservationAction(
      "live_evt_invalid",
      baseObservation({ subject: "" }),
      "2026-08-13T09:00:05Z",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/subject/);
    expect(await store.load()).toHaveLength(0);
  });

  it("an invalid domain is rejected with zero write", async () => {
    const store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
    const result = await recordObservationAction(
      "live_evt_invalid_domain",
      baseObservation({ domain: "physical" as unknown as Observation["domain"] }),
      "2026-08-13T09:00:05Z",
    );
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("an empty canon_event_id is rejected with zero write", async () => {
    const store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
    const result = await recordObservationAction("", baseObservation(), "2026-08-13T09:00:05Z");
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("an offsetless recorded_at is rejected with zero write", async () => {
    const store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
    const result = await recordObservationAction(
      "live_evt_bad_time",
      baseObservation(),
      "2026-08-13T09:00:05", // no offset
    );
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });
});

describe("DUPLICATE_REJECTED", () => {
  it("a re-submitted canon_event_id is rejected deterministically, not silently ignored or overwritten", async () => {
    const store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
    const first = await recordObservationAction(
      "live_evt_dup",
      baseObservation(),
      "2026-08-13T09:00:05Z",
    );
    expect(first.ok).toBe(true);

    const second = await recordObservationAction(
      "live_evt_dup",
      baseObservation({ context: "a_different_context" }),
      "2026-08-13T09:00:10Z",
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.message).toMatch(/already/);

    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].payload.context).toBe("evening_session");
  });

  it("does not throw for a duplicate — rejections are returned as values, matching app/hub/actions.ts's own philosophy", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    await recordObservationAction("live_evt_dup2", baseObservation(), "2026-08-13T09:00:05Z");
    await expect(
      recordObservationAction("live_evt_dup2", baseObservation(), "2026-08-13T09:00:10Z"),
    ).resolves.not.toThrow();
  });
});

describe("PERSISTENCE_ROUNDTRIP", () => {
  it("an Observation recorded through the live action survives a simulated restart on real disk", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "canon-ingestion-roundtrip-"));
    try {
      process.env.CANON_DATA_DIR = dataDir;
      _setCanonEventStore(null);

      const result = await recordObservationAction(
        "live_evt_roundtrip",
        baseObservation({ systemicChannel: undefined }),
        "2026-08-13T09:00:05Z",
      );
      expect(result.ok).toBe(true);

      _setCanonEventStore(null); // simulate a process restart
      const loaded = await canonEventStore().load();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].canon_event_id).toBe("live_evt_roundtrip");
      expect(loaded[0].payload).toEqual(baseObservation({ systemicChannel: undefined }));
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("CANON_FIELD_COVERAGE_PRESERVED", () => {
  it("every Observation field, including an S-frame systemicChannel, survives the live action unchanged", async () => {
    _setCanonEventStore(new InMemoryCanonEventStore());
    const original = baseObservation({
      domain: "G",
      frame: "S",
      systemicChannel: "environmental",
      deficitType: "OBJECTIVE",
      provenance: "third_party",
    });
    await recordObservationAction("live_evt_fields", original, "2026-08-13T09:00:05Z");
    const [loaded] = await canonEventStore().load();
    expect(loaded.payload).toEqual(original);
    for (const key of Object.keys(original)) {
      expect(loaded.payload).toHaveProperty(key, (original as unknown as Record<string, unknown>)[key]);
    }
  });
});

describe("NO_LEGACY_EVENT_WRITE", () => {
  it("observationIngestion.ts never imports the legacy event log (../events.ts, ../eventStore.ts, ../../philos-event-store.ts)", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\.\/events["']/);
      expect(line).not.toMatch(/from ["']\.\.\/eventStore["']/);
      expect(line).not.toMatch(/philos-event-store/);
    }
  });

  it("calling recordObservationAction never writes to the legacy PhilosEventStore, even when one is live and populated", async () => {
    const legacyStore = new InMemoryPhilosEventStore();
    const legacyEvent: PhilosEvent = {
      event_id: "legacy_evt_1",
      actor_id: "person_roei",
      entity_type: "person",
      entity_id: "person_roei",
      event_type: "person.registered",
      value_tags: [],
      timestamp: "2026-08-13T08:00:00Z",
      visibility: "public",
    };
    await legacyStore.append([legacyEvent]);
    _setPhilosEventStore(legacyStore);
    _setCanonEventStore(new InMemoryCanonEventStore());

    await recordObservationAction("live_evt_no_legacy", baseObservation(), "2026-08-13T09:00:05Z");

    const legacyLoaded = await philosEventStore().load();
    expect(legacyLoaded).toHaveLength(1);
    expect(legacyLoaded[0].event_id).toBe("legacy_evt_1");
  });
});

describe("NO_PROJECTION_SIDE_EFFECT", () => {
  it("observationIngestion.ts never imports a projection module", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/projectValueGroup|projectDynamics|projectGlobeGraph/);
    }
  });

  it("observationIngestion.ts never CALLS revalidatePath — mentioning it in a doc comment (explaining its absence) is fine, importing/calling it is not", () => {
    expect(INGESTION_SOURCE).not.toMatch(/revalidatePath\(/);
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/revalidatePath/);
    }
  });

  it("this module exports no projection function", () => {
    const mod = ingestionModule as unknown as Record<string, unknown>;
    for (const name of ["projectCanonEvents", "toValueGroupView"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("NO_DYNAMICS_SIDE_EFFECT", () => {
  it("observationIngestion.ts never imports dynamicsView or the Dynamics route", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/dynamicsView|DynamicsView/);
    }
  });
});

describe("NO_MERLIN_SIDE_EFFECT", () => {
  it("observationIngestion.ts never imports from voice-gateway, Merlin, or n8n", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/voice-gateway|merlin|n8n/);
    }
  });

  it("this module exports no network/dispatch function", () => {
    const mod = ingestionModule as unknown as Record<string, unknown>;
    for (const name of ["sendToMerlin", "dispatchToN8n"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("observationIngestion.ts — no CellState/Need/Target/Offer/Matching, no automatic inference", () => {
  it("imports nothing from cellState.ts, need.ts, target.ts, offer.ts, or matching.ts", () => {
    const importLines = INGESTION_SOURCE.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line).not.toMatch(/from ["']\.\/(cellState|need|target|offer|matching)["']/);
    }
  });

  it("recordObservationAction takes canon_event_id and recorded_at as explicit parameters — nothing is generated server-side", () => {
    expect(recordObservationAction.length).toBe(3);
  });

  it("this module exports no id-generation or clock utility of its own", () => {
    const mod = ingestionModule as unknown as Record<string, unknown>;
    for (const name of ["createIdGenerator", "systemClock", "generateObservationId"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});
