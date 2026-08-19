import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Effect } from "@/app/lib/philos/canon/effect";
import { InMemoryEffectStore } from "@/app/lib/philos/canon/effectStore";
import { _setEffectStore, effectStore } from "@/app/lib/philos/canon/effectStoreAccessor";

import { GET } from "../route";

const TOKEN = "test-canon-read-token";

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_api_1",
    action_ref: "action_api_1",
    subject: "person_api_x",
    concerns_subject_internal_state: true,
    claimed_outcome: {
      statement: "felt calmer",
      provenance: "self_reported",
      verifier_type: "self",
      confidence: 0.7,
      time: "2026-08-15T12:00:00Z",
      method: "self_report_checkin",
    },
    context: "evening_session",
    time: "2026-08-15T12:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function get(id: string, token: string | null = TOKEN): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return GET(new Request(`http://localhost/api/canon/effects/${id}`, { headers }), { params: Promise.resolve({ effectId: id }) });
}

beforeEach(() => {
  process.env.CANON_READ_TOKEN = TOKEN;
  _setEffectStore(new InMemoryEffectStore());
});

afterEach(() => {
  _setEffectStore(null);
  delete process.env.CANON_READ_TOKEN;
});

describe("AUTH (fail closed)", () => {
  it("401s without a token", async () => {
    expect((await get("effect_api_1", null)).status).toBe(401);
  });
});

describe("READ_HAPPY_PATH", () => {
  it("404s for an id that does not exist", async () => {
    expect((await get("nope")).status).toBe(404);
  });

  it("returns the exact stored EffectRecord", async () => {
    await effectStore().append([{ effect: baseEffect(), recorded_at: "2026-08-15T12:00:01Z" }]);
    const res = await get("effect_api_1");
    expect(res.status).toBe(200);
    expect((await res.json()).effect.effect.effect_id).toBe("effect_api_1");
  });
});
