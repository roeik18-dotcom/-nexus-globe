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

function get(query = ""): Promise<Response> {
  return GET(new Request(`http://localhost/api/canon/effects${query}`, { headers: { authorization: `Bearer ${TOKEN}` } }));
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
    expect((await GET(new Request("http://localhost/api/canon/effects"))).status).toBe(401);
  });
});

describe("READ_HAPPY_PATH", () => {
  it("lists every real, stored Effect", async () => {
    await effectStore().append([{ effect: baseEffect(), recorded_at: "2026-08-15T12:00:01Z" }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).effects).toHaveLength(1);
  });

  it("filters by ?action_ref= via the real explicit-link read", async () => {
    await effectStore().append([
      { effect: baseEffect(), recorded_at: "2026-08-15T12:00:01Z" },
      { effect: baseEffect({ effect_id: "effect_api_2", action_ref: "action_api_other" }), recorded_at: "2026-08-15T12:01:01Z" },
    ]);
    const res = await get("?action_ref=action_api_1");
    const body = await res.json();
    expect(body.effects).toHaveLength(1);
    expect(body.effects[0].effect.effect_id).toBe("effect_api_1");
  });

  it("filters by ?subject= when action_ref is absent", async () => {
    await effectStore().append([{ effect: baseEffect(), recorded_at: "2026-08-15T12:00:01Z" }]);
    const res = await get("?subject=person_api_x");
    expect((await res.json()).effects).toHaveLength(1);
  });
});
