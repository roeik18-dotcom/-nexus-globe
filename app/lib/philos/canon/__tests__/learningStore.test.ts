/**
 * LearningStore — mirrors effectStore.test.ts/actionStore.test.ts/
 * needStore.test.ts exactly. Synthetic fixtures only.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Learning } from "../learning";
import type { CellState } from "../cellState";
import {
  checkLearningAppend,
  FileSystemLearningStore,
  InMemoryLearningStore,
  LearningAppendRejectedError,
  LearningLogCorruptError,
  LEARNING_STORE_FILENAME,
  inLearningOrder,
  type LearningRecord,
} from "../learningStore";

const statePrime: CellState = { domain: "E", frame: "I", level: -1, stability: 0.5 };

function statePrimeLearning(overrides: Partial<Learning> = {}): Learning {
  return {
    learning_id: "learning_test_1",
    prior_state_ref: "cellstate_prior_1",
    effect_ref: "effect_test_1",
    outcome_verification_ref: "verification_test_1",
    update_method: "manual_review",
    provenance: "self_reported",
    confidence: 0.8,
    time: "2026-08-15T13:00:00Z",
    context: "evening_session",
    result: { kind: "state_prime", candidate_state_prime: statePrime },
    ...overrides,
  };
}

function noUpdateLearning(overrides: Partial<Learning> = {}): Learning {
  return statePrimeLearning({
    result: { kind: "no_update", reason: "claimed_only" },
    ...overrides,
  });
}

function record(overrides: Partial<LearningRecord> = {}, learningOverrides: Partial<Learning> = {}): LearningRecord {
  return {
    learning: statePrimeLearning(learningOverrides),
    recorded_at: "2026-08-15T13:00:01Z",
    delta: { domain: "E", frame: "I", level_delta: 1, stability_delta: 0.1 },
    ...overrides,
  };
}

describe("checkLearningAppend", () => {
  it("rejects an empty append", () => {
    const check = checkLearningAppend([], []);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("empty_append");
  });

  it("accepts one valid record against an empty store", () => {
    expect(checkLearningAppend([], [record()])).toEqual({ ok: true });
  });

  it("rejects re-appending an already-stored learning_id", () => {
    const r = record();
    const check = checkLearningAppend([r], [record({}, { learning_id: r.learning.learning_id })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("learning_id_already_stored");
  });

  it("rejects a structurally invalid Learning — validateLearning reused verbatim", () => {
    const check = checkLearningAppend([], [record({}, { provenance: "" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const invalid = check.rejections.find((r) => r.code === "invalid_learning");
    expect(invalid?.errors).toContainEqual({ field: "provenance", reason: "empty" });
  });

  it("accepts a no_update Learning with delta: null — a real record, distinct from no Learning at all", () => {
    const check = checkLearningAppend([], [record({ delta: null }, { result: { kind: "no_update", reason: "claimed_only" } })]);
    expect(check.ok).toBe(true);
  });
});

describe("LearningRecord.delta — computed once, not re-derived", () => {
  it("a state_prime Learning carries a real, non-null delta", async () => {
    const store = new InMemoryLearningStore();
    const r = record();
    await store.append([r]);
    const [loaded] = await store.load();
    expect(loaded.learning.result.kind).toBe("state_prime");
    expect(loaded.delta).not.toBeNull();
    expect(loaded.delta?.level_delta).toBe(1);
  });

  it("a no_update Learning carries delta: null, never a fabricated zero", async () => {
    const store = new InMemoryLearningStore();
    const r: LearningRecord = { learning: noUpdateLearning(), recorded_at: "2026-08-15T13:00:01Z", delta: null };
    await store.append([r]);
    const [loaded] = await store.load();
    expect(loaded.learning.result.kind).toBe("no_update");
    expect(loaded.delta).toBeNull();
  });
});

describe("FileSystemLearningStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "learning-store-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("create → persist → retrieve round-trips through a real file", async () => {
    const store = new FileSystemLearningStore(dir);
    const r = record();
    await store.append([r]);
    expect(existsSync(join(dir, LEARNING_STORE_FILENAME))).toBe(true);
    const store2 = new FileSystemLearningStore(dir);
    expect(await store2.load()).toEqual([r]);
  });

  it("writes to learnings.jsonl, a separate file from every other log", () => {
    new FileSystemLearningStore(dir);
    expect(LEARNING_STORE_FILENAME).toBe("learnings.jsonl");
  });

  it("refuses to read a corrupt log rather than silently skip the bad line", async () => {
    writeFileSync(join(dir, LEARNING_STORE_FILENAME), "not json at all\n", "utf-8");
    const store = new FileSystemLearningStore(dir);
    await expect(store.load()).rejects.toBeInstanceOf(LearningLogCorruptError);
  });

  it("rejects appending a duplicate learning_id on disk, same as in-memory", async () => {
    const store = new FileSystemLearningStore(dir);
    const r = record();
    await store.append([r]);
    await expect(store.append([record({}, { learning_id: r.learning.learning_id })])).rejects.toBeInstanceOf(LearningAppendRejectedError);
  });

  it("inLearningOrder is deterministic: recorded_at ascending, tie-broken by learning_id", () => {
    const a = record({ recorded_at: "2026-08-15T13:00:02Z" }, { learning_id: "learning_b" });
    const b = record({ recorded_at: "2026-08-15T13:00:01Z" }, { learning_id: "learning_a" });
    expect(inLearningOrder([a, b]).map((r) => r.learning.learning_id)).toEqual(["learning_a", "learning_b"]);
  });
});
