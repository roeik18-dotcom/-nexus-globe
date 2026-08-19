/**
 * ActionStore — mirrors needStore.test.ts exactly. Synthetic fixtures only
 * ("person_test_x" etc.) — no real user data, no real canon writes.
 */
import { existsSync, mkdtempSync, readFileSync as readFileSyncFs, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Action } from "../action";
import {
  checkActionAppend,
  FileSystemActionStore,
  InMemoryActionStore,
  ActionAppendRejectedError,
  ActionLogCorruptError,
  ACTION_STORE_FILENAME,
  inActionOrder,
  type ActionRecord,
} from "../actionStore";

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    action_id: "action_test_1",
    type: "non_transfer",
    owner: "person_test_x",
    mechanism_scope: "self_regulation",
    consent: true,
    inputs: ["need_test_1"],
    reversibility: "reversible",
    time: "2026-08-15T10:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function record(overrides: Partial<ActionRecord> = {}, actionOverrides: Partial<Action> = {}): ActionRecord {
  return {
    action: baseAction(actionOverrides),
    recorded_at: "2026-08-15T10:00:01Z",
    ...overrides,
  };
}

describe("checkActionAppend", () => {
  it("rejects an empty append", () => {
    const check = checkActionAppend([], []);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("empty_append");
  });

  it("accepts one valid record against an empty store", () => {
    expect(checkActionAppend([], [record()])).toEqual({ ok: true });
  });

  it("rejects re-appending an already-stored action_id", () => {
    const r = record();
    const check = checkActionAppend([r], [record({}, { action_id: r.action.action_id })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("action_id_already_stored");
  });

  it("rejects a duplicate action_id within the same append batch", () => {
    const check = checkActionAppend([], [record(), record()]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((r) => r.code === "duplicate_action_id")).toBe(true);
  });

  it("rejects a structurally invalid Action — validateAction reused verbatim", () => {
    const check = checkActionAppend([], [record({}, { owner: "" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const invalid = check.rejections.find((r) => r.code === "invalid_action");
    expect(invalid?.errors).toContainEqual({ field: "owner", reason: "empty" });
  });

  it("rejects consent !== true — a self_regulation Action cannot be gated open by omission", () => {
    const check = checkActionAppend([], [record({}, { consent: false as unknown as true })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const invalid = check.rejections.find((r) => r.code === "invalid_action");
    expect(invalid?.errors).toContainEqual({ field: "consent", reason: "not_true" });
  });

  it("rejects an ambiguous recorded_at (no explicit timezone offset)", () => {
    const check = checkActionAppend([], [record({ recorded_at: "2026-08-15T10:00:01" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((r) => r.code === "ambiguous_recorded_at")).toBe(true);
  });
});

describe("InMemoryActionStore", () => {
  it("create → persist → retrieve round-trips exactly", async () => {
    const store = new InMemoryActionStore();
    const r = record();
    await store.append([r]);
    expect(await store.load()).toEqual([r]);
  });

  it("throws ActionAppendRejectedError on a rejected append, appends nothing", async () => {
    const store = new InMemoryActionStore([record()]);
    await expect(store.append([record()])).rejects.toBeInstanceOf(ActionAppendRejectedError);
    expect(await store.load()).toHaveLength(1);
  });

  it("inActionOrder is deterministic: recorded_at ascending, tie-broken by action_id", () => {
    const a = record({ recorded_at: "2026-08-15T10:00:02Z" }, { action_id: "action_b" });
    const b = record({ recorded_at: "2026-08-15T10:00:01Z" }, { action_id: "action_a" });
    expect(inActionOrder([a, b]).map((r) => r.action.action_id)).toEqual(["action_a", "action_b"]);
  });
});

describe("FileSystemActionStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "action-store-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("create → persist → retrieve round-trips through a real file", async () => {
    const store = new FileSystemActionStore(dir);
    const r = record();
    await store.append([r]);
    expect(existsSync(join(dir, ACTION_STORE_FILENAME))).toBe(true);
    const store2 = new FileSystemActionStore(dir);
    expect(await store2.load()).toEqual([r]);
  });

  it("writes to actions.jsonl, never canon-events.jsonl or needs.jsonl", () => {
    new FileSystemActionStore(dir);
    expect(ACTION_STORE_FILENAME).toBe("actions.jsonl");
  });

  it("refuses to read a corrupt log rather than silently skip the bad line", async () => {
    writeFileSync(join(dir, ACTION_STORE_FILENAME), "not json at all\n", "utf-8");
    const store = new FileSystemActionStore(dir);
    await expect(store.load()).rejects.toBeInstanceOf(ActionLogCorruptError);
  });

  it("rejects appending a duplicate action_id on disk, same as in-memory", async () => {
    const store = new FileSystemActionStore(dir);
    const r = record();
    await store.append([r]);
    await expect(store.append([record({}, { action_id: r.action.action_id })])).rejects.toBeInstanceOf(ActionAppendRejectedError);
    expect(readFileSyncFs(join(dir, ACTION_STORE_FILENAME), "utf-8").trim().split("\n")).toHaveLength(1);
  });
});
