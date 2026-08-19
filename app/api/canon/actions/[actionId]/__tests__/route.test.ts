import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Action } from "@/app/lib/philos/canon/action";
import { InMemoryActionStore } from "@/app/lib/philos/canon/actionStore";
import { _setActionStore, actionStore } from "@/app/lib/philos/canon/actionStoreAccessor";

import { GET } from "../route";

const TOKEN = "test-canon-read-token";

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_api_1",
    type: "non_transfer",
    owner: "person_api_x",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: ["need_1"],
    reversibility: "reversible",
    time: "2026-08-15T10:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function get(id: string, token: string | null = TOKEN): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return GET(new Request(`http://localhost/api/canon/actions/${id}`, { headers }), { params: Promise.resolve({ actionId: id }) });
}

beforeEach(() => {
  process.env.CANON_READ_TOKEN = TOKEN;
  _setActionStore(new InMemoryActionStore());
});

afterEach(() => {
  _setActionStore(null);
  delete process.env.CANON_READ_TOKEN;
});

describe("AUTH (fail closed)", () => {
  it("401s without a token", async () => {
    expect((await get("action_api_1", null)).status).toBe(401);
  });
});

describe("READ_HAPPY_PATH", () => {
  it("404s for an id that does not exist", async () => {
    expect((await get("nope")).status).toBe(404);
  });

  it("returns the exact stored ActionRecord", async () => {
    await actionStore().append([{ action: baseAction(), recorded_at: "2026-08-15T10:00:01Z" }]);
    const res = await get("action_api_1");
    expect(res.status).toBe(200);
    expect((await res.json()).action.action.action_id).toBe("action_api_1");
  });
});
