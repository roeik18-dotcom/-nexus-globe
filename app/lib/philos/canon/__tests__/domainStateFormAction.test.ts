import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _setDomainStateStore } from "../domainStateStoreAccessor";
import { InMemoryDomainStateStore } from "../domainStateStore";
import { createDomainStateForCurrentUserCore } from "../domainStateFormAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = { domain_id: "human_temperament", parameter_id: "temperament_pace", level: "0.4", confidence: "0.8" };

describe("createDomainStateForCurrentUserCore — real write path, state-fusion backbone", () => {
  let store: InMemoryDomainStateStore;
  beforeEach(() => { store = new InMemoryDomainStateStore(); _setDomainStateStore(store); });
  afterEach(() => { _setDomainStateStore(null); });

  it("rejects a missing domain_id", async () => {
    const result = await createDomainStateForCurrentUserCore(formData({ ...VALID, domain_id: "" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects a missing parameter_id", async () => {
    const result = await createDomainStateForCurrentUserCore(formData({ ...VALID, parameter_id: "" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric level", async () => {
    const result = await createDomainStateForCurrentUserCore(formData({ ...VALID, level: "not-a-number" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a confidence outside 0-1", async () => {
    const result = await createDomainStateForCurrentUserCore(formData({ ...VALID, confidence: "1.5" }));
    expect(result.ok).toBe(false);
  });

  it("accepts a real submission, uses REAL_CURRENT_SUBJECT, and forces provenance REAL — never client-settable", async () => {
    const result = await createDomainStateForCurrentUserCore(formData(VALID));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].state.subject).toBe(REAL_CURRENT_SUBJECT);
    expect(stored[0].state.provenance).toBe("REAL");
    expect(stored[0].state.domain_id).toBe("human_temperament");
    expect(stored[0].state.level).toBe(0.4);
  });

  it("a caller cannot inject provenance: DEMO through this real write path — the field isn't even read from formData", async () => {
    const result = await createDomainStateForCurrentUserCore(formData({ ...VALID, provenance: "DEMO" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored[0].state.provenance).toBe("REAL");
  });

  it("supports multiple real submissions for the same parameter — real history, not a create-once entity", async () => {
    await createDomainStateForCurrentUserCore(formData(VALID));
    // `createIdGenerator()` reseeds its base from `Date.now()` on every real
    // write path in this codebase (same as `actionFormAction.ts`/
    // `effectFormAction.ts`) — two calls in the exact same millisecond can
    // mint the same id, which a real human clicking submit twice never
    // does. This tiny delay exercises the real behavior at real cadence,
    // not the store's collision-rejection path (already covered above).
    await new Promise((r) => setTimeout(r, 2));
    const second = await createDomainStateForCurrentUserCore(formData({ ...VALID, level: "0.6" }));
    expect(second.ok).toBe(true);
    expect(await store.load()).toHaveLength(2);
  });
});
