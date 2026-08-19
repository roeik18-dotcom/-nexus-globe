/**
 * ingestNeed / findNeedsForSubject — the explicit acceptance/write boundary
 * and the real read path Marketplace uses. Synthetic test fixtures only.
 */
import { describe, expect, it } from "vitest";
import type { Need } from "../need";
import { InMemoryNeedStore, type NeedRecord } from "../needStore";
import { ingestNeed } from "../needIngestion";
import { findNeedsForSubject, _setNeedStore } from "../needStoreAccessor";

function baseNeed(overrides: Partial<Need> = {}): Need {
  return {
    need_id: "need_test_1",
    subject: "person_test_x",
    desired_change: "reduce evening workload",
    scope: { kind: "domain", domain: "E" },
    provenance: "self_reported",
    context: "evening_session",
    time: "2026-08-15T10:00:00Z",
    expiry: "2026-09-15T10:00:00Z",
    consent_scope: "visible_to_matching_engine",
    ...overrides,
  };
}

describe("ingestNeed", () => {
  it("a valid, explicit NeedRecord is accepted and persisted", async () => {
    const store = new InMemoryNeedStore();
    const record: NeedRecord = { need: baseNeed(), recorded_at: "2026-08-15T10:00:01Z", status: "open" };
    const result = await ingestNeed(record, store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.need_id).toBe("need_test_1");
    expect(await store.load()).toEqual([record]);
  });

  it("an invalid Need is rejected BEFORE any store call — zero persistence on failure", async () => {
    const store = new InMemoryNeedStore();
    const record: NeedRecord = { need: baseNeed({ subject: "" }), recorded_at: "2026-08-15T10:00:01Z", status: "open" };
    const result = await ingestNeed(record, store);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("invalid");
    expect(await store.load()).toEqual([]);
  });

  it("re-ingesting the same need_id is rejected, not silently duplicated", async () => {
    const store = new InMemoryNeedStore();
    const record: NeedRecord = { need: baseNeed(), recorded_at: "2026-08-15T10:00:01Z", status: "open" };
    await ingestNeed(record, store);
    const second = await ingestNeed({ ...record, recorded_at: "2026-08-15T11:00:00Z" }, store);
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.reason).toBe("rejected");
    expect(await store.load()).toHaveLength(1);
  });

  it("never mints need_id or recorded_at — both come through verbatim", async () => {
    const store = new InMemoryNeedStore();
    const record: NeedRecord = { need: baseNeed({ need_id: "need_caller_chosen" }), recorded_at: "2026-08-15T10:00:01Z", status: "open" };
    const result = await ingestNeed(record, store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.record.need.need_id).toBe("need_caller_chosen");
    expect(result.record.recorded_at).toBe("2026-08-15T10:00:01Z");
  });
});

describe("findNeedsForSubject (via the real accessor + injected in-memory store)", () => {
  it("an undefined subject returns [] without touching the store", async () => {
    _setNeedStore(new InMemoryNeedStore());
    expect(await findNeedsForSubject(undefined)).toEqual([]);
    _setNeedStore(null);
  });

  it("real exact-subject match: only records for the given subject are returned", async () => {
    const store = new InMemoryNeedStore([
      { need: baseNeed({ need_id: "n1", subject: "person_a" }), recorded_at: "2026-08-15T10:00:01Z", status: "open" },
      { need: baseNeed({ need_id: "n2", subject: "person_b" }), recorded_at: "2026-08-15T10:00:02Z", status: "open" },
    ]);
    _setNeedStore(store);
    const found = await findNeedsForSubject("person_a");
    expect(found).toHaveLength(1);
    expect(found[0].need.need_id).toBe("n1");
    _setNeedStore(null);
  });

  it("a subject with no real Needs returns [] — honest absence, not an error", async () => {
    _setNeedStore(new InMemoryNeedStore());
    expect(await findNeedsForSubject("person_nobody")).toEqual([]);
    _setNeedStore(null);
  });
});
