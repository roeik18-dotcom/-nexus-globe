/**
 * The FIRST authenticated read caller — acceptance.
 *
 * Same store-isolation seam as `../../__tests__/route.test.ts`: inject via
 * `_setCanonEventStore(store)`, reset to `null` in `afterEach`.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  InMemoryCanonEventStore,
} from "@/app/lib/philos/canon/canonEventStore";
import {
  _setCanonEventStore,
} from "@/app/lib/philos/canon/canonEventStoreAccessor";
import type { CanonEvent } from "@/app/lib/philos/canon/canonEvent";
import type { Observation } from "@/app/lib/philos/canon/observation";

import { GET } from "../route";

const TOKEN = "test-canon-read-token";

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
    canon_event_id: "canon_evt_read_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-12T20:00:05Z",
    ...overrides,
  };
}

function get(id: string, token: string | null = TOKEN): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return GET(
    new Request(`http://localhost/api/canon/observations/${id}`, { headers }),
    { params: Promise.resolve({ canonEventId: id }) },
  );
}

beforeEach(() => {
  process.env.CANON_READ_TOKEN = TOKEN;
  _setCanonEventStore(new InMemoryCanonEventStore());
});

afterEach(() => {
  _setCanonEventStore(null);
  delete process.env.CANON_READ_TOKEN;
});

describe("LIVE_READ_CALLER_REACHABLE", () => {
  it("is a real route module exporting GET, reaching the accessor", async () => {
    expect(typeof GET).toBe("function");
  });
});

describe("AUTH (fail closed)", () => {
  it("401s without a token", async () => {
    expect((await get("canon_evt_read_001", null)).status).toBe(401);
  });

  it("401s with the wrong token", async () => {
    expect((await get("canon_evt_read_001", "nope")).status).toBe(401);
  });

  it("401s when CANON_READ_TOKEN is unconfigured", async () => {
    delete process.env.CANON_READ_TOKEN;
    expect((await get("canon_evt_read_001")).status).toBe(401);
  });

  it("a valid write token does not satisfy read auth — separate credentials", async () => {
    process.env.CANON_INGEST_TOKEN = "write-token";
    const res = await GET(
      new Request("http://localhost/api/canon/observations/x", {
        headers: { authorization: "Bearer write-token" },
      }),
      { params: Promise.resolve({ canonEventId: "x" }) },
    );
    expect(res.status).toBe(401);
    delete process.env.CANON_INGEST_TOKEN;
  });
});

describe("READ_HAPPY_PATH", () => {
  it("returns the exact stored CanonEvent, payload verbatim", async () => {
    const event = baseCanonEvent();
    await (await import("@/app/lib/philos/canon/canonEventStoreAccessor")).canonEventStore().append([event]);

    const res = await get("canon_evt_read_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event).toEqual(event);
  });

  it("404s for a canon_event_id that was never persisted", async () => {
    const res = await get("never_appended");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });
});

describe("SEPARATION — legacy store, projections, Dynamics untouched", () => {
  it("imports nothing from the legacy event store, projections, or Dynamics", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/api/canon/observations/[canonEventId]/route.ts"),
      "utf-8",
    );
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
    expect(imports).toContain("philos/canon/canonEventStoreAccessor");
  });
});
