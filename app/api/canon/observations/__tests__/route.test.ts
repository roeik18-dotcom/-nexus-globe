/**
 * The FIRST live Observation caller — acceptance.
 *
 * Store isolation follows the sanctioned seam already used by
 * `canonEventStoreAccessor.test.ts`: inject via `_setCanonEventStore(store)`
 * and reset to `null` in `afterEach`, so no test observes another's state and
 * nothing ever writes to the real `.philos-canon-data`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CANON_STORE_FILENAME,
  FileSystemCanonEventStore,
  InMemoryCanonEventStore,
} from "@/app/lib/philos/canon/canonEventStore";
import {
  _setCanonEventStore,
  loadCanonEvents,
} from "@/app/lib/philos/canon/canonEventStoreAccessor";
import type { Observation } from "@/app/lib/philos/canon/observation";

import { POST } from "../route";

const TOKEN = "test-canon-ingest-token";

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

function post(body: unknown, token: string | null = TOKEN): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return POST(
    new Request("http://localhost/api/canon/observations", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  process.env.CANON_INGEST_TOKEN = TOKEN;
  _setCanonEventStore(new InMemoryCanonEventStore());
});

afterEach(() => {
  _setCanonEventStore(null);
  delete process.env.CANON_INGEST_TOKEN;
});

describe("LIVE_CALLER_REACHABLE", () => {
  it("is a real route module exporting POST, reaching the accessor", async () => {
    expect(typeof POST).toBe("function");
    const res = await post({ observation: baseObservation() });
    expect(res.status).toBe(201);
    // reached the process-wide accessor, not some private store
    expect(await loadCanonEvents()).toHaveLength(1);
  });
});

describe("AUTH (fail closed)", () => {
  it("401s without a token", async () => {
    expect((await post({ observation: baseObservation() }, null)).status).toBe(401);
    expect(await loadCanonEvents()).toHaveLength(0);
  });

  it("401s with the wrong token", async () => {
    expect((await post({ observation: baseObservation() }, "nope")).status).toBe(401);
    expect(await loadCanonEvents()).toHaveLength(0);
  });

  it("401s when CANON_INGEST_TOKEN is unconfigured", async () => {
    delete process.env.CANON_INGEST_TOKEN;
    expect((await post({ observation: baseObservation() })).status).toBe(401);
    expect(await loadCanonEvents()).toHaveLength(0);
  });
});

describe("VALID_OBSERVATION_APPENDS", () => {
  it("appends one canon event and echoes it back", async () => {
    const res = await post({ observation: baseObservation() });
    expect(res.status).toBe(201);
    const { event } = await res.json();
    expect(event.canon_type).toBe("observation");
    expect(event.payload).toEqual(baseObservation()); // payload verbatim, nothing added/dropped
    expect(typeof event.canon_event_id).toBe("string");
    expect(typeof event.recorded_at).toBe("string");
    // recorded_at is the record's own timestamp, distinct from payload.time
    expect(event.recorded_at).not.toBe(event.payload.time);
  });

  it("accepts an S-frame observation carrying its required systemicChannel", async () => {
    const obs = baseObservation({ frame: "S", systemicChannel: "institutional" });
    const res = await post({ observation: obs });
    expect(res.status).toBe(201);
    expect((await loadCanonEvents())[0].payload.systemicChannel).toBe("institutional");
  });
});

describe("INVALID_OBSERVATION_REJECTED — zero persistence", () => {
  it("400s on a canon-invalid observation and stores nothing", async () => {
    const res = await post({ observation: baseObservation({ subject: "", confidence: 5 }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_observation");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { field: "subject", reason: "empty" },
        { field: "confidence", reason: "not_a_probability" },
      ]),
    );
    expect(await loadCanonEvents()).toHaveLength(0);
  });

  it("400s when frame=S omits systemicChannel (canon §18) and stores nothing", async () => {
    const res = await post({ observation: baseObservation({ frame: "S" }) });
    expect(res.status).toBe(400);
    expect(await loadCanonEvents()).toHaveLength(0);
  });

  it("400s on malformed JSON / non-object body / bad id, storing nothing", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post([1, 2, 3])).status).toBe(400);
    expect((await post({ observation: "nope" })).status).toBe(400);
    expect((await post({ observation: baseObservation(), canon_event_id: "" })).status).toBe(400);
    expect(await loadCanonEvents()).toHaveLength(0);
  });

  it("never writes a file when validation fails (real filesystem store)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "canon-route-nowrite-"));
    try {
      _setCanonEventStore(new FileSystemCanonEventStore(dir));
      const res = await post({ observation: baseObservation({ level: Number.NaN }) });
      expect(res.status).toBe(400);
      expect(existsSync(join(dir, CANON_STORE_FILENAME))).toBe(false); // not one byte
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("DUPLICATE_REJECTED — explicit idempotency key", () => {
  it("409s when the same canon_event_id is posted twice, storing one event", async () => {
    const id = "obs-fixed-id-1";
    expect((await post({ canon_event_id: id, observation: baseObservation() })).status).toBe(201);

    const second = await post({ canon_event_id: id, observation: baseObservation({ level: 9 }) });
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe("append_rejected");
    expect(body.rejections.map((r: { code: string }) => r.code)).toContain(
      "canon_event_id_already_stored",
    );

    const stored = await loadCanonEvents();
    expect(stored).toHaveLength(1);
    expect(stored[0].payload.level).toBe(-0.3); // first write untouched by the retry
  });

  it("without a supplied id each request is a distinct event (not idempotent, by design)", async () => {
    await post({ observation: baseObservation() });
    await post({ observation: baseObservation() });
    const stored = await loadCanonEvents();
    expect(stored).toHaveLength(2);
    expect(stored[0].canon_event_id).not.toBe(stored[1].canon_event_id);
  });
});

describe("PERSISTENCE_ROUNDTRIP", () => {
  it("survives to real disk and reloads field-for-field", async () => {
    const dir = mkdtempSync(join(tmpdir(), "canon-route-roundtrip-"));
    try {
      _setCanonEventStore(new FileSystemCanonEventStore(dir));
      const obs = baseObservation({ frame: "S", systemicChannel: "economic", level: 1.25 });
      const res = await post({ canon_event_id: "rt-1", observation: obs });
      expect(res.status).toBe(201);

      // on-disk JSONL
      const raw = readFileSync(join(dir, CANON_STORE_FILENAME), "utf-8").trim();
      expect(raw.split("\n")).toHaveLength(1);
      expect(JSON.parse(raw).payload).toEqual(obs);

      // reload through a brand-new store instance over the same directory
      _setCanonEventStore(new FileSystemCanonEventStore(dir));
      const reloaded = await loadCanonEvents();
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].canon_event_id).toBe("rt-1");
      expect(reloaded[0].canon_type).toBe("observation");
      expect(reloaded[0].payload).toEqual(obs);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("SEPARATION — legacy store, projections, Dynamics untouched", () => {
  it("imports nothing from the legacy event store, projections, or Dynamics", async () => {
    const src = readFileSync(join(process.cwd(), "app/api/canon/observations/route.ts"), "utf-8");
    const imports = src
      .split("\n")
      .filter((l) => l.trimStart().startsWith("import"))
      .join("\n");
    for (const forbidden of [
      "philos-event-store",
      "eventStore",
      "events",
      "projectDynamics",
      "dynamicsView",
      "projectValueGroup",
      "eventCausality",
      "valueGroupLog",
      "nexus",
      "essence",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
    // it does reach canon — and only canon
    expect(imports).toContain("philos/canon/canonEventStoreAccessor");
  });

  it("NO_LEGACY_EVENT_WRITE — the legacy .philos-data log is never created", async () => {
    const dir = mkdtempSync(join(tmpdir(), "canon-route-legacy-"));
    try {
      _setCanonEventStore(new FileSystemCanonEventStore(dir));
      await post({ observation: baseObservation() });
      expect(existsSync(join(dir, "philos-events.jsonl"))).toBe(false);
      expect(existsSync(join(dir, CANON_STORE_FILENAME))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("NO_PROJECTION / NO_DYNAMICS side effect — response carries only the stored event", async () => {
    const res = await post({ observation: baseObservation() });
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["event"]);
    expect(Object.keys(body.event).sort()).toEqual(
      ["canon_event_id", "canon_type", "payload", "recorded_at"].sort(),
    );
  });
});
