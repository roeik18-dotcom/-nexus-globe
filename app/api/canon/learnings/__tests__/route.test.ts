import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Learning } from "@/app/lib/philos/canon/learning";
import { InMemoryLearningStore } from "@/app/lib/philos/canon/learningStore";
import { _setLearningStore, learningStore } from "@/app/lib/philos/canon/learningStoreAccessor";

import { GET } from "../route";

const TOKEN = "test-canon-read-token";

function baseLearning(overrides: Partial<Learning> = {}): Learning {
  return {
    learning_id: "learning_api_1",
    prior_state_ref: "cellstate_prior",
    effect_ref: "effect_api_1",
    outcome_verification_ref: "verification_1",
    update_method: "manual_review",
    provenance: "self_reported",
    confidence: 0.8,
    time: "2026-08-15T13:00:00Z",
    context: "evening_session",
    result: { kind: "no_update", reason: "claimed_only" },
    ...overrides,
  };
}

function get(query = ""): Promise<Response> {
  return GET(new Request(`http://localhost/api/canon/learnings${query}`, { headers: { authorization: `Bearer ${TOKEN}` } }));
}

beforeEach(() => {
  process.env.CANON_READ_TOKEN = TOKEN;
  _setLearningStore(new InMemoryLearningStore());
});

afterEach(() => {
  _setLearningStore(null);
  delete process.env.CANON_READ_TOKEN;
});

describe("AUTH (fail closed)", () => {
  it("401s without a token", async () => {
    expect((await GET(new Request("http://localhost/api/canon/learnings"))).status).toBe(401);
  });
});

describe("READ_HAPPY_PATH", () => {
  it("lists every real, stored Learning, delta: null shown honestly for no_update", async () => {
    await learningStore().append([{ learning: baseLearning(), recorded_at: "2026-08-15T13:00:01Z", delta: null }]);
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.learnings).toHaveLength(1);
    expect(body.learnings[0].delta).toBeNull();
  });

  it("filters by ?effect_ref= via the real explicit-link read", async () => {
    await learningStore().append([
      { learning: baseLearning(), recorded_at: "2026-08-15T13:00:01Z", delta: null },
      { learning: baseLearning({ learning_id: "learning_api_2", effect_ref: "effect_api_other" }), recorded_at: "2026-08-15T13:01:01Z", delta: null },
    ]);
    const res = await get("?effect_ref=effect_api_1");
    const body = await res.json();
    expect(body.learnings).toHaveLength(1);
    expect(body.learnings[0].learning.learning_id).toBe("learning_api_1");
  });
});
