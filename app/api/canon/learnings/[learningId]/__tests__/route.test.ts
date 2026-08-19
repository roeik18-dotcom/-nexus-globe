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

function get(id: string, token: string | null = TOKEN): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return GET(new Request(`http://localhost/api/canon/learnings/${id}`, { headers }), { params: Promise.resolve({ learningId: id }) });
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
    expect((await get("learning_api_1", null)).status).toBe(401);
  });
});

describe("READ_HAPPY_PATH", () => {
  it("404s for an id that does not exist", async () => {
    expect((await get("nope")).status).toBe(404);
  });

  it("returns the exact stored LearningRecord", async () => {
    await learningStore().append([{ learning: baseLearning(), recorded_at: "2026-08-15T13:00:01Z", delta: null }]);
    const res = await get("learning_api_1");
    expect(res.status).toBe(200);
    expect((await res.json()).learning.learning.learning_id).toBe("learning_api_1");
  });
});
