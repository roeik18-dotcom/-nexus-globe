import { describe, expect, it } from "vitest";
import { InMemoryDomainStateStore, checkDomainStateAppend, type DomainStateRecord } from "../domainStateStore";
import type { DomainState } from "../../valueDomain/valueDomainConfig";

function state(overrides: Partial<DomainState> = {}): DomainState {
  return {
    domain_id: "human_temperament",
    parameter_id: "temperament_pace",
    subject: "person_roei",
    level: 0.3,
    confidence: 0.8,
    observed_at: "2026-08-16T10:00:00Z",
    provenance: "REAL",
    ...overrides,
  };
}
function record(overrides: Partial<DomainStateRecord> = {}): DomainStateRecord {
  return { state_id: "dstate_1", state: state(), recorded_at: "2026-08-16T10:00:00Z", ...overrides };
}

describe("DomainStateStore — real, persisted, append-only history", () => {
  it("appends and loads a real record", async () => {
    const store = new InMemoryDomainStateStore();
    await store.append([record()]);
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].state.subject).toBe("person_roei");
  });

  it("allows MULTIPLE real readings for the same (subject, domain_id, parameter_id) — this is a time series, not a create-once entity", async () => {
    const store = new InMemoryDomainStateStore();
    await store.append([record({ state_id: "dstate_1", state: state({ observed_at: "2026-08-16T10:00:00Z", level: 0.3 }) })]);
    await store.append([record({ state_id: "dstate_2", state: state({ observed_at: "2026-08-17T10:00:00Z", level: 0.5 }) })]);
    const loaded = await store.load();
    expect(loaded).toHaveLength(2);
  });

  it("rejects a duplicate state_id — append-only, a correction is a new record", async () => {
    const store = new InMemoryDomainStateStore();
    await store.append([record({ state_id: "dstate_1" })]);
    await expect(store.append([record({ state_id: "dstate_1" })])).rejects.toThrow();
  });

  it("rejects an invalid confidence (out of 0-1 range)", () => {
    const check = checkDomainStateAppend([], [record({ state: state({ confidence: 1.5 }) })]);
    expect(check.ok).toBe(false);
  });

  it("rejects a missing domain_id", () => {
    const check = checkDomainStateAppend([], [record({ state: { ...state(), domain_id: "" } })]);
    expect(check.ok).toBe(false);
  });

  it("loads in chronological order (observed_at ascending)", async () => {
    const store = new InMemoryDomainStateStore();
    await store.append([record({ state_id: "dstate_b", state: state({ observed_at: "2026-08-17T10:00:00Z" }) })]);
    await store.append([record({ state_id: "dstate_a", state: state({ observed_at: "2026-08-16T10:00:00Z" }) })]);
    const loaded = await store.load();
    expect(loaded.map((r) => r.state_id)).toEqual(["dstate_a", "dstate_b"]);
  });
});
