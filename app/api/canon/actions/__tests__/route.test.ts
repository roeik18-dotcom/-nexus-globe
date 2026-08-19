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

function get(query = ""): Promise<Response> {
  return GET(new Request(`http://localhost/api/canon/actions${query}`, { headers: { authorization: `Bearer ${TOKEN}` } }));
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
    const res = await GET(new Request("http://localhost/api/canon/actions"));
    expect(res.status).toBe(401);
  });

  it("401s when CANON_READ_TOKEN is unconfigured", async () => {
    delete process.env.CANON_READ_TOKEN;
    expect((await get()).status).toBe(401);
  });
});

describe("READ_HAPPY_PATH", () => {
  it("lists every real, stored Action", async () => {
    await actionStore().append([{ action: baseAction(), recorded_at: "2026-08-15T10:00:01Z" }]);

    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].action.action_id).toBe("action_api_1");
  });

  it("filters by ?owner= via the real per-actor read, never a fabricated match", async () => {
    await actionStore().append([
      { action: baseAction(), recorded_at: "2026-08-15T10:00:01Z" },
      { action: baseAction({ action_id: "action_api_2", owner: "person_api_other" }), recorded_at: "2026-08-15T10:01:01Z" },
    ]);

    const res = await get("?owner=person_api_x");
    const body = await res.json();
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].action.owner).toBe("person_api_x");
  });

  it("returns an empty list, not an error, when the store is genuinely empty", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).actions).toEqual([]);
  });
});
