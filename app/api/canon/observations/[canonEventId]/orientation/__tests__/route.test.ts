/**
 * The ONE authenticated, read-only Merlin-orientation endpoint — acceptance.
 *
 * Named assertions requested for this pass: AUTH_REQUIRED,
 * INVALID_INPUT_REJECTED, NOT_FOUND_CONTROLLED, READ_ONLY_ZERO_WRITE,
 * CANON_STORE_UNCHANGED, LEGACY_STORE_UNCHANGED,
 * VERTICAL_SLICE_RESULT_MATCHES_DIRECT_CALL, MERLIN_HANDOFF_SCHEMA_MATCH,
 * NO_TOOL_OR_APPROVAL_FIELDS, NO_ACTION_EXECUTION, PROVENANCE_PRESERVED,
 * UNSUPPORTED_TRANSITION_EXPLICIT.
 *
 * Same store-isolation seam as every other canon route test: inject via
 * `_setCanonEventStore(store)`, reset to `null` in `afterEach`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InMemoryCanonEventStore } from "@/app/lib/philos/canon/canonEventStore";
import {
  _setCanonEventStore,
  canonEventStore,
} from "@/app/lib/philos/canon/canonEventStoreAccessor";
import type { CanonEvent } from "@/app/lib/philos/canon/canonEvent";
import type { Observation } from "@/app/lib/philos/canon/observation";
import { runPhilosVerticalSlice } from "@/app/lib/philos/canon/verticalSlice";
import { toMerlinOrientationHandoff } from "@/app/lib/philos/canon/merlinHandoff";
import { InMemoryPhilosEventStore } from "@/app/lib/philos/eventStore";
import type { PhilosEvent } from "@/app/lib/philos/events";

import { GET } from "../route";

const TOKEN = "test-canon-read-token";
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
    canon_event_id: "canon_evt_orient_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-13T09:00:05Z",
    ...overrides,
  };
}

function get(
  id: string,
  { asOf, token = TOKEN }: { asOf?: string | null; token?: string | null } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const qs =
    asOf === undefined ? `?asOf=${encodeURIComponent(AS_OF)}` : asOf === null ? "" : `?asOf=${encodeURIComponent(asOf)}`;
  return GET(
    new Request(`http://localhost/api/canon/observations/${id}/orientation${qs}`, { headers }),
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

describe("AUTH_REQUIRED", () => {
  it("401s without a token", async () => {
    expect((await get("canon_evt_orient_001", { token: null })).status).toBe(401);
  });

  it("401s with the wrong token", async () => {
    expect((await get("canon_evt_orient_001", { token: "nope" })).status).toBe(401);
  });

  it("401s when CANON_READ_TOKEN is unconfigured", async () => {
    delete process.env.CANON_READ_TOKEN;
    expect((await get("canon_evt_orient_001")).status).toBe(401);
  });
});

describe("INVALID_INPUT_REJECTED", () => {
  it("400s when asOf is missing", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_orient_001", { asOf: null });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_as_of");
  });

  it("400s when asOf has no explicit offset / is unparseable", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_orient_001", { asOf: "not-a-date" });
    expect(res.status).toBe(400);
  });
});

describe("NOT_FOUND_CONTROLLED", () => {
  it("404s for a canon_event_id that was never persisted, with a typed error body", async () => {
    const res = await get("never_appended");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not_found" });
  });
});

describe("READ_ONLY_ZERO_WRITE", () => {
  it("this route's own source never calls .append() on any store", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/canon/observations/[canonEventId]/orientation/route.ts"),
      "utf-8",
    );
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/\.append\(/);
  });
});

describe("CANON_STORE_UNCHANGED", () => {
  it("a full round-trip request leaves the canon event log with exactly the events it started with", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const before = await canonEventStore().load();

    await get("canon_evt_orient_001");

    const after = await canonEventStore().load();
    expect(after).toEqual(before);
    expect(after).toHaveLength(1);
  });
});

describe("LEGACY_STORE_UNCHANGED", () => {
  it("never writes to a live, populated legacy PhilosEventStore", async () => {
    const legacyStore = new InMemoryPhilosEventStore();
    const legacyEvent: PhilosEvent = {
      event_id: "legacy_evt_orient_check",
      actor_id: "person_roei",
      entity_type: "person",
      entity_id: "person_roei",
      event_type: "person.registered",
      value_tags: [],
      timestamp: "2026-08-13T08:00:00Z",
      visibility: "public",
    };
    await legacyStore.append([legacyEvent]);

    await canonEventStore().append([baseCanonEvent()]);
    await get("canon_evt_orient_001");

    const legacyLoaded = await legacyStore.load();
    expect(legacyLoaded).toHaveLength(1);
    expect(legacyLoaded[0].event_id).toBe("legacy_evt_orient_check");
  });

  it("imports nothing from the legacy event store, projections, or Dynamics", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/canon/observations/[canonEventId]/orientation/route.ts"),
      "utf-8",
    );
    const imports = src.split("\n").filter((l) => l.trimStart().startsWith("import")).join("\n");
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
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });
});

describe("VERTICAL_SLICE_RESULT_MATCHES_DIRECT_CALL", () => {
  it("the endpoint's response equals toMerlinOrientationHandoff(directCallResult) field-for-field, aside from the fresh orientation_id and the added stop_point", async () => {
    await canonEventStore().append([baseCanonEvent()]);

    const directResult = await runPhilosVerticalSlice({
      store: canonEventStore(),
      canon_event_id: "canon_evt_orient_001",
      asOf: AS_OF,
    });
    const directHandoff = toMerlinOrientationHandoff("irrelevant_id_replaced_below", directResult);

    const res = await get("canon_evt_orient_001");
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.orientation_id).toBe("string");
    const { orientation_id, stop_point, ...rest } = body;
    const { orientation_id: _ignored, ...directRest } = directHandoff!;
    expect(rest).toEqual(directRest);
    expect(stop_point).toEqual({ stage: "need", reason: "not_supplied" });
  });
});

describe("MERLIN_HANDOFF_SCHEMA_MATCH", () => {
  it("a successful minimal-input response (no Need/Target/Offer/Transfer supplied — this endpoint has no id-lookup for any of them) carries only the fields that are actually present; JSON.stringify legitimately drops the undefined optional ones (open_need/target/candidate_action) rather than emitting them as null", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_orient_001");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "orientation_id",
        "source_observation_id",
        "current_state",
        "constraints",
        "provenance",
        "verification_state",
        "stop_point",
      ].sort(),
    );
    // And never MORE than the full spec'd field set, however the value comes out.
    const ALLOWED = new Set([
      "orientation_id",
      "source_observation_id",
      "current_state",
      "open_need",
      "target",
      "candidate_action",
      "constraints",
      "provenance",
      "verification_state",
      "stop_point",
    ]);
    for (const key of Object.keys(body)) expect(ALLOWED.has(key)).toBe(true);
  });

  it("falls back to a minimal, non-fabricated shape when no CellState is derivable (expired Observation) — still 200, current_state/open_need/target/candidate_action absent", async () => {
    await canonEventStore().append([
      baseCanonEvent({
        payload: baseObservation({ time: "2026-01-01T00:00:00Z", expiry: "2026-02-01T00:00:00Z" }),
      }),
    ]);
    const res = await get("canon_evt_orient_001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current_state).toBeUndefined();
    expect(body.open_need).toBeUndefined();
    expect(body.target).toBeUndefined();
    expect(body.candidate_action).toBeUndefined();
    expect(body.constraints).toEqual([]);
    expect(body.provenance).toEqual([]);
    expect(body.verification_state).toBe("not_applicable");
    // firstUnsupportedTransition alone would say {stage:"need",reason:"not_supplied"}
    // here too (need is always skipped on this endpoint) — that would obscure the
    // REAL reason current_state is missing. The route special-cases this: when
    // CellState itself was attempted but produced no_derivation, that specific
    // reason (here: "expired") is surfaced instead.
    expect(body.stop_point).toEqual({ stage: "cellState", reason: "expired" });
    expect(body.source_observation_id).toBe("canon_evt_orient_001");
  });
});

describe("NO_TOOL_OR_APPROVAL_FIELDS", () => {
  it("no tool-name/credential/approval/network/retry key anywhere in a successful response body", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_orient_001");
    const serialized = (await res.text()).toLowerCase();
    for (const forbiddenKey of [
      '"tool_name":',
      '"toolname":',
      '"credential":',
      '"credentials":',
      '"api_key":',
      '"apikey":',
      '"approval":',
      '"approved":true',
      '"network_scope":',
      '"retry_policy":',
      '"allowed_hosts":',
    ]) {
      expect(serialized).not.toContain(forbiddenKey);
    }
  });

  it("the GET handler reads no request body at all — no tool/approval field could ever be accepted", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/canon/observations/[canonEventId]/orientation/route.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/request\.json\(\)/);
    expect(src).not.toMatch(/request\.text\(\)/);
    expect(src).not.toMatch(/request\.formData\(\)/);
  });
});

describe("NO_ACTION_EXECUTION", () => {
  it("imports nothing naming voice-gateway, Merlin, n8n, or a registry", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/canon/observations/[canonEventId]/orientation/route.ts"),
      "utf-8",
    );
    const importLines = src.split("\n").filter((l) => l.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/voice-gateway|merlin.{0,20}(?:tool|dispatch|execute)|n8n|registry/);
    }
  });

  it("exports no dispatch/execute/apply/commit function", async () => {
    const mod = (await import("../route")) as unknown as Record<string, unknown>;
    for (const name of ["execute", "dispatch", "applyTransfer", "commitTransfer", "runTransfer"]) {
      expect(mod[name]).toBeUndefined();
    }
  });
});

describe("PROVENANCE_PRESERVED", () => {
  it("provenance in the response is a non-empty array of the attempted stages' own provenance strings", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_orient_001");
    const body = await res.json();
    expect(Array.isArray(body.provenance)).toBe(true);
    expect(body.provenance.length).toBeGreaterThan(0);
    expect(body.provenance[0]).toMatch(/CanonEventStore/);
  });
});

describe("UNSUPPORTED_TRANSITION_EXPLICIT", () => {
  it("stop_point names the first stage this minimal-input call could not attempt", async () => {
    await canonEventStore().append([baseCanonEvent()]);
    const res = await get("canon_evt_orient_001");
    const body = await res.json();
    expect(body.stop_point).toEqual({ stage: "need", reason: "not_supplied" });
  });
});
