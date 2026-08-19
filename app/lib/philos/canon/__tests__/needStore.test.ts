/**
 * NeedStore — the first Need persistence primitive. All data here is
 * synthetic test fixtures only ("person_test_x" etc.) — no real user data,
 * no real canon writes, per this slice's explicit instruction.
 *
 * Verifies: real Need type reused verbatim (validateNeed unmodified),
 * append-only (duplicate need_id rejected, never silently overwritten),
 * corrupt-log detection, deterministic ordering, and that this store shares
 * no file/state with CanonEventStore.
 */
import { existsSync, mkdtempSync, readFileSync as readFileSyncFs, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Need } from "../need";
import {
  checkNeedAppend,
  FileSystemNeedStore,
  InMemoryNeedStore,
  NeedAppendRejectedError,
  NeedLogCorruptError,
  NEED_STORE_FILENAME,
  inNeedOrder,
  type NeedRecord,
} from "../needStore";

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

function record(overrides: Partial<NeedRecord> = {}, needOverrides: Partial<Need> = {}): NeedRecord {
  return {
    need: baseNeed(needOverrides),
    recorded_at: "2026-08-15T10:00:01Z",
    status: "open",
    ...overrides,
  };
}

describe("checkNeedAppend", () => {
  it("rejects an empty append", () => {
    const check = checkNeedAppend([], []);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("empty_append");
  });

  it("accepts one valid record against an empty store", () => {
    expect(checkNeedAppend([], [record()])).toEqual({ ok: true });
  });

  it("rejects re-appending an already-stored need_id — a correction is a new event, not an edit, and this store doesn't yet support that", () => {
    const r = record();
    const check = checkNeedAppend([r], [record({}, { need_id: r.need.need_id })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("need_id_already_stored");
  });

  it("rejects a duplicate need_id within the same append batch", () => {
    const check = checkNeedAppend([], [record(), record()]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((r) => r.code === "duplicate_need_id")).toBe(true);
  });

  it("rejects a structurally invalid Need — validateNeed reused verbatim, not reimplemented", () => {
    const check = checkNeedAppend([], [record({}, { subject: "" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const invalid = check.rejections.find((r) => r.code === "invalid_need");
    expect(invalid?.errors).toContainEqual({ field: "subject", reason: "empty" });
  });

  it("rejects an ambiguous recorded_at (no explicit timezone offset)", () => {
    const check = checkNeedAppend([], [record({ recorded_at: "2026-08-15T10:00:01" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((r) => r.code === "ambiguous_recorded_at")).toBe(true);
  });
});

describe("InMemoryNeedStore", () => {
  it("create → persist → retrieve round-trips exactly", async () => {
    const store = new InMemoryNeedStore();
    const r = record();
    await store.append([r]);
    const loaded = await store.load();
    expect(loaded).toEqual([r]);
  });

  it("throws NeedAppendRejectedError on a rejected append, appends nothing", async () => {
    const store = new InMemoryNeedStore([record()]);
    await expect(store.append([record()])).rejects.toBeInstanceOf(NeedAppendRejectedError);
    expect(await store.load()).toHaveLength(1);
  });

  it("inNeedOrder is deterministic: recorded_at ascending, tie-broken by need_id", () => {
    const a = record({ recorded_at: "2026-08-15T10:00:02Z" }, { need_id: "need_b" });
    const b = record({ recorded_at: "2026-08-15T10:00:01Z" }, { need_id: "need_a" });
    expect(inNeedOrder([a, b]).map((r) => r.need.need_id)).toEqual(["need_a", "need_b"]);
  });
});

describe("FileSystemNeedStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "need-store-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("create → persist → retrieve round-trips through a real file", async () => {
    const store = new FileSystemNeedStore(dir);
    const r = record();
    await store.append([r]);
    expect(existsSync(join(dir, NEED_STORE_FILENAME))).toBe(true);
    const store2 = new FileSystemNeedStore(dir); // fresh instance, same dir — proves it's really durable
    expect(await store2.load()).toEqual([r]);
  });

  it("writes to needs.jsonl, never canon-events.jsonl — separate file, separate log", () => {
    new FileSystemNeedStore(dir);
    expect(NEED_STORE_FILENAME).toBe("needs.jsonl");
    expect(NEED_STORE_FILENAME).not.toBe("canon-events.jsonl");
  });

  it("refuses to read a corrupt log rather than silently skip the bad line", async () => {
    writeFileSync(join(dir, NEED_STORE_FILENAME), "not json at all\n", "utf-8");
    const store = new FileSystemNeedStore(dir);
    await expect(store.load()).rejects.toBeInstanceOf(NeedLogCorruptError);
  });

  it("rejects appending a duplicate need_id on disk, same as in-memory", async () => {
    const store = new FileSystemNeedStore(dir);
    const r = record();
    await store.append([r]);
    await expect(store.append([record({}, { need_id: r.need.need_id })])).rejects.toBeInstanceOf(NeedAppendRejectedError);
    expect(readFileSyncFs(join(dir, NEED_STORE_FILENAME), "utf-8").trim().split("\n")).toHaveLength(1);
  });
});
