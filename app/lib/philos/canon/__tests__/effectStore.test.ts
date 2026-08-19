/**
 * EffectStore — mirrors actionStore.test.ts/needStore.test.ts exactly.
 * Synthetic fixtures only — no real user data, no real canon writes.
 */
import { existsSync, mkdtempSync, readFileSync as readFileSyncFs, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Effect } from "../effect";
import type { OutcomeVerification } from "../outcomeVerification";
import {
  checkEffectAppend,
  FileSystemEffectStore,
  InMemoryEffectStore,
  EffectAppendRejectedError,
  EffectLogCorruptError,
  EFFECT_STORE_FILENAME,
  inEffectOrder,
  type EffectRecord,
} from "../effectStore";

function verification(overrides: Partial<OutcomeVerification> = {}): OutcomeVerification {
  return {
    statement: "reported feeling less overloaded this evening",
    provenance: "self_reported",
    verifier_type: "self",
    confidence: 0.8,
    time: "2026-08-15T12:00:00Z",
    method: "self_report_checkin",
    ...overrides,
  };
}

function baseEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    effect_id: "effect_test_1",
    action_ref: "action_test_1",
    subject: "person_test_x",
    concerns_subject_internal_state: true,
    claimed_outcome: verification(),
    context: "evening_session",
    time: "2026-08-15T12:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function record(overrides: Partial<EffectRecord> = {}, effectOverrides: Partial<Effect> = {}): EffectRecord {
  return {
    effect: baseEffect(effectOverrides),
    recorded_at: "2026-08-15T12:00:01Z",
    ...overrides,
  };
}

describe("checkEffectAppend", () => {
  it("rejects an empty append", () => {
    const check = checkEffectAppend([], []);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("empty_append");
  });

  it("accepts one valid record against an empty store", () => {
    expect(checkEffectAppend([], [record()])).toEqual({ ok: true });
  });

  it("rejects re-appending an already-stored effect_id — new evidence is a new record", () => {
    const r = record();
    const check = checkEffectAppend([r], [record({}, { effect_id: r.effect.effect_id })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("effect_id_already_stored");
  });

  it("rejects a structurally invalid Effect — validateEffect reused verbatim", () => {
    const check = checkEffectAppend([], [record({}, { subject: "" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const invalid = check.rejections.find((r) => r.code === "invalid_effect");
    expect(invalid?.errors).toContainEqual({ field: "subject", reason: "empty" });
  });

  it("accepts a claimed-only Effect (no verified_outcome) — claimed != verified, both real", () => {
    const check = checkEffectAppend([], [record({}, { verified_outcome: undefined })]);
    expect(check.ok).toBe(true);
  });
});

describe("EffectRecord round-trip preserves claimed vs verified as distinct fields", () => {
  it("a claimed-only record has no verified_outcome", async () => {
    const store = new InMemoryEffectStore();
    const r = record();
    await store.append([r]);
    const [loaded] = await store.load();
    expect(loaded.effect.claimed_outcome).toBeDefined();
    expect(loaded.effect.verified_outcome).toBeUndefined();
  });

  it("a verified record carries both, independently", async () => {
    const store = new InMemoryEffectStore();
    const r = record({}, { verified_outcome: verification({ verifier_type: "self", confidence: 0.9 }) });
    await store.append([r]);
    const [loaded] = await store.load();
    expect(loaded.effect.claimed_outcome.confidence).toBe(0.8);
    expect(loaded.effect.verified_outcome?.confidence).toBe(0.9);
  });
});

describe("FileSystemEffectStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "effect-store-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("create → persist → retrieve round-trips through a real file", async () => {
    const store = new FileSystemEffectStore(dir);
    const r = record();
    await store.append([r]);
    expect(existsSync(join(dir, EFFECT_STORE_FILENAME))).toBe(true);
    const store2 = new FileSystemEffectStore(dir);
    expect(await store2.load()).toEqual([r]);
  });

  it("writes to effects.jsonl, a separate file from actions.jsonl/needs.jsonl/canon-events.jsonl", () => {
    new FileSystemEffectStore(dir);
    expect(EFFECT_STORE_FILENAME).toBe("effects.jsonl");
  });

  it("refuses to read a corrupt log rather than silently skip the bad line", async () => {
    writeFileSync(join(dir, EFFECT_STORE_FILENAME), "not json at all\n", "utf-8");
    const store = new FileSystemEffectStore(dir);
    await expect(store.load()).rejects.toBeInstanceOf(EffectLogCorruptError);
  });

  it("rejects appending a duplicate effect_id on disk, same as in-memory", async () => {
    const store = new FileSystemEffectStore(dir);
    const r = record();
    await store.append([r]);
    await expect(store.append([record({}, { effect_id: r.effect.effect_id })])).rejects.toBeInstanceOf(EffectAppendRejectedError);
    expect(readFileSyncFs(join(dir, EFFECT_STORE_FILENAME), "utf-8").trim().split("\n")).toHaveLength(1);
  });

  it("inEffectOrder is deterministic: recorded_at ascending, tie-broken by effect_id", () => {
    const a = record({ recorded_at: "2026-08-15T12:00:02Z" }, { effect_id: "effect_b" });
    const b = record({ recorded_at: "2026-08-15T12:00:01Z" }, { effect_id: "effect_a" });
    expect(inEffectOrder([a, b]).map((r) => r.effect.effect_id)).toEqual(["effect_a", "effect_b"]);
  });
});
