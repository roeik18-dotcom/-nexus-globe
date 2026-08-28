import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AppendRejectedError,
  FileSystemAppendOnlyStore,
  LogCorruptError,
} from "../appendOnlyStore";
import type { Decision } from "../decision";
import {
  DECISION_SPEC,
  DECISION_STORE_FILENAME,
  type DecisionRecord,
  inMemoryDecisionReviewStore,
  inMemoryDecisionStore,
} from "../decisionStore";
import type { DecisionReview } from "../decisionReview";

function decision(id: string, overrides: Partial<Decision> = {}): Decision {
  return {
    decision_id: id,
    case_id: "case_1",
    subject: "person_roei",
    statement: "החלטה",
    because: "סיבה",
    decision_logic: "שיקול",
    expected_outcome: "ציפייה",
    alternatives_considered: [],
    observation_refs: [],
    chosen_action: { kind: "no_action_yet", because: "טרם" },
    confidence: 0.5,
    stakes: "low",
    decided_at: "2026-08-01T09:00:00+03:00",
    review_horizon: "2026-08-08T09:00:00+03:00",
    record_origin: "REAL",
    ...overrides,
  };
}

function record(id: string, recorded_at = "2026-08-01T09:00:05+03:00"): DecisionRecord {
  return { decision: decision(id), recorded_at };
}

function reviewRecord(id: string, ref: string) {
  const review: DecisionReview = {
    review_id: id,
    case_id: "case_1",
    decision_ref: ref,
    effect_ref: "eff_1",
    expectation_met: "met",
    causal_relation: "occurred_after",
    alternative_explanations: [],
    intervening_factors: [],
    counterevidence_refs: [],
    reviewed_at: "2026-08-08T10:00:00+03:00",
    reviewed_early: false,
    record_origin: "REAL",
  };
  return { review, recorded_at: "2026-08-08T10:00:02+03:00" };
}

describe("the decision log is append-only", () => {
  it("stores and reads back a record", async () => {
    const store = inMemoryDecisionStore();
    await store.append([record("d1")]);
    const all = await store.load();
    expect(all.map((r) => r.decision.decision_id)).toEqual(["d1"]);
  });

  it("refuses an empty append", async () => {
    await expect(inMemoryDecisionStore().append([])).rejects.toBeInstanceOf(AppendRejectedError);
  });

  it("refuses to re-store an id that is already in the log", async () => {
    const store = inMemoryDecisionStore();
    await store.append([record("d1")]);
    // A revision is a NEW record with a new id, never an edit.
    await expect(store.append([record("d1")])).rejects.toThrow(/append-only/);
  });

  it("refuses the same id twice inside one append", async () => {
    await expect(
      inMemoryDecisionStore().append([record("d1"), record("d1")]),
    ).rejects.toThrow(/appears twice/);
  });

  it("refuses a recorded_at with no explicit timezone offset", async () => {
    await expect(
      inMemoryDecisionStore().append([record("d1", "2026-08-01T09:00:05")]),
    ).rejects.toThrow(/explicit timezone offset/);
  });

  it("refuses a structurally invalid decision", async () => {
    const bad: DecisionRecord = {
      decision: decision("d1", { expected_outcome: "" }),
      recorded_at: "2026-08-01T09:00:05+03:00",
    };
    await expect(inMemoryDecisionStore().append([bad])).rejects.toThrow(/structural validation/);
  });

  it("leaves the log untouched when an append is rejected", async () => {
    const store = inMemoryDecisionStore();
    await store.append([record("d1")]);
    await expect(store.append([record("d2"), record("d1")])).rejects.toBeInstanceOf(
      AppendRejectedError,
    );
    // d2 was in the same rejected batch and must NOT have landed.
    expect((await store.load()).map((r) => r.decision.decision_id)).toEqual(["d1"]);
  });

  it("keeps recorded_at separate from decided_at", async () => {
    const store = inMemoryDecisionStore();
    await store.append([
      {
        decision: decision("d1", { decided_at: "2026-07-30T21:00:00+03:00" }),
        recorded_at: "2026-08-01T09:00:05+03:00",
      },
    ]);
    const [r] = await store.load();
    expect(r.decision.decided_at).not.toBe(r.recorded_at);
  });

  it("orders by recorded_at, tie-broken by id", async () => {
    const store = inMemoryDecisionStore();
    await store.append([
      record("z", "2026-08-01T09:00:00+03:00"),
      record("a", "2026-08-01T09:00:00+03:00"),
      record("m", "2026-08-01T08:00:00+03:00"),
    ]);
    expect((await store.load()).map((r) => r.decision.decision_id)).toEqual(["m", "a", "z"]);
  });
});

describe("the review log", () => {
  it("stores a review whose decision does not exist, rather than rejecting it", async () => {
    // Referential integrity across two append-only logs is not enforced at
    // write time; a dangling reference is visible, not silently dropped.
    const store = inMemoryDecisionReviewStore();
    await store.append([reviewRecord("r1", "no_such_decision")]);
    expect((await store.load())[0].review.decision_ref).toBe("no_such_decision");
  });
});

describe("the file-backed store", () => {
  it("round-trips through JSONL on disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "philos-decision-"));
    const store = new FileSystemAppendOnlyStore(DECISION_SPEC, dir, DECISION_STORE_FILENAME);
    await store.append([record("d1")]);
    await store.append([record("d2")]);

    const lines = readFileSync(join(dir, DECISION_STORE_FILENAME), "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);

    const reopened = new FileSystemAppendOnlyStore(DECISION_SPEC, dir, DECISION_STORE_FILENAME);
    expect((await reopened.load()).map((r) => r.decision.decision_id)).toEqual(["d1", "d2"]);
  });

  it("refuses to read a partially corrupt log rather than returning the good prefix", async () => {
    const dir = mkdtempSync(join(tmpdir(), "philos-decision-"));
    const file = join(dir, DECISION_STORE_FILENAME);
    writeFileSync(file, `${JSON.stringify(record("d1"))}\n{not json\n`, "utf-8");
    const store = new FileSystemAppendOnlyStore(DECISION_SPEC, dir, DECISION_STORE_FILENAME);
    await expect(store.load()).rejects.toBeInstanceOf(LogCorruptError);
  });

  it("enforces append-only across a reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "philos-decision-"));
    await new FileSystemAppendOnlyStore(DECISION_SPEC, dir, DECISION_STORE_FILENAME).append([
      record("d1"),
    ]);
    const second = new FileSystemAppendOnlyStore(DECISION_SPEC, dir, DECISION_STORE_FILENAME);
    await expect(second.append([record("d1")])).rejects.toThrow(/append-only/);
  });
});
