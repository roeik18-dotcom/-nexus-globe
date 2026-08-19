/**
 * The FIRST live HTTP caller of deriveCellStateForPersistedObservation — acceptance.
 *
 * Same store-isolation seam as the sibling read route's tests.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { InMemoryCanonEventStore } from "@/app/lib/philos/canon/canonEventStore";
import {
  _setCanonEventStore,
  canonEventStore,
} from "@/app/lib/philos/canon/canonEventStoreAccessor";
import type { CanonEvent } from "@/app/lib/philos/canon/canonEvent";
import type { Observation } from "@/app/lib/philos/canon/observation";

import { GET } from "../route";

const TOKEN = "test-canon-read-token";
const AS_OF = "2026-08-20T00:00:00Z"; // well within the observation's expiry below

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
    canon_event_id: "canon_evt_cs_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-12T20:00:05Z",
    ...overrides,
  };
}

function get(
  id: string,
  { asOf, token = TOKEN }: { asOf?: string | null; token?: string | null } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const qs = asOf === undefined ? `?asOf=${encodeURIComponent(AS_OF)}` : asOf === null ? "" : `?asOf=${encodeURIComponent(asOf)}`;
  return GET(
    new Request(`http://localhost/api/canon/observations/${id}/cell-state${qs}`, { headers }),
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

describe("LIVE_CELL_STATE_READ_REACHABLE", () => {
  it("is a real route module exporting GET", () => {
    expect(typeof GET).toBe("function");
  });
});

describe("AUTH (fail closed)", () => {
  it("401s without a token", async () => {
    expect((await get("canon_evt_cs_001", { token: null })).status).toBe(401);
  });

  it("401s with the wrong token", async () => {
    expect((await get("canon_evt_cs_001", { token: "nope" })).status).toBe(401);
  });

  it("401s when CANON_READ_TOKEN is unconfigured", async () => {
    delete process.env.CANON_READ_TOKEN;
    expect((await get("canon_evt_cs_001")).status).toBe(401);
  });
});

describe("DERIVATION_HAPPY_PATH", () => {
  it("returns a cell_state candidate with provenance for a valid, unexpired, persisted observation", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_cs_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("cell_state");
    expect(body.candidate).toEqual({ domain: "E", frame: "I", level: -0.3, stability: 0.5 });
    expect(body.provenance.source_canon_event_id).toBe("canon_evt_cs_001");
  });

  it("carries the systemicChannel through provenance for an S-frame observation", async () => {
    await canonEventStore().append([
      baseCanonEvent({
        payload: baseObservation({ frame: "S", systemicChannel: "economic" }),
      }),
    ]);
    const res = await get("canon_evt_cs_001");
    const body = await res.json();
    expect(body.provenance.source_observation_systemic_channel).toBe("economic");
  });
});

describe("NO_DERIVATION_OUTCOMES — successful reads, not errors", () => {
  it("200s with kind no_derivation/expired for an expired observation", async () => {
    await canonEventStore().append([
      baseCanonEvent({
        payload: baseObservation({ time: "2026-01-01T00:00:00Z", expiry: "2026-02-01T00:00:00Z" }),
      }),
    ]);
    const res = await get("canon_evt_cs_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ kind: "no_derivation", reason: "expired" });
  });

  it("200s with kind no_derivation/zero_confidence", async () => {
    await canonEventStore().append([
      baseCanonEvent({ payload: baseObservation({ confidence: 0 }) }),
    ]);
    const res = await get("canon_evt_cs_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ kind: "no_derivation", reason: "zero_confidence" });
  });
});

describe("ASOF_VALIDATION", () => {
  it("400s when asOf is missing", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_cs_001", { asOf: null });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_as_of");
  });

  it("400s when asOf has no explicit offset / is unparseable", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_cs_001", { asOf: "not-a-date" });
    expect(res.status).toBe(400);
  });
});

describe("NOT_FOUND", () => {
  it("404s for a canon_event_id that was never persisted", async () => {
    const res = await get("never_appended");
    expect(res.status).toBe(404);
  });
});

describe("SEPARATION — no aggregation, no legacy imports", () => {
  it("imports nothing from the legacy event store, projections, or Dynamics, and imports only cellStateDerivation for its logic", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/api/canon/observations/[canonEventId]/cell-state/route.ts"),
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
      "nexus",
      "essence",
      "/need",
      "/target",
      "/offer",
      "/matching",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
    expect(imports).toContain("cellStateDerivation");
  });
});
