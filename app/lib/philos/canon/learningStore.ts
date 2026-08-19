/**
 * Philos Canon — LearningStore: real persistence for `Learning` (canon §17/
 * §24/§26, `./learning.ts`). Last two stages of the real Action/Effect/
 * Learning lifecycle: LEARNING itself, and — wrapped alongside it, never
 * inside the canon `Learning` type — DELTA and UPDATED STATE.
 *
 * Mirrors `needStore.ts`/`actionStore.ts`/`effectStore.ts` exactly in shape
 * and discipline — own file (`learnings.jsonl`), own store class, own
 * append-rejection codes, a pure `checkX` gate, JSONL persistence,
 * append-only. `learning.learning_id` is the real identity.
 *
 * **`LearningRecord.delta` — why it lives on the store wrapper, not on
 * `Learning` itself:** `learning.ts`'s own header states `deriveLearning`
 * "never computes a candidate `State'`... only GATES one" — DELTA
 * (`stateDelta.ts::computeStateDelta`) is a strictly DESCRIPTIVE function
 * over an ALREADY-ACCEPTED `state_prime` and its prior CellState; it is not
 * itself part of canon's Learning gate. Recording it requires the actual
 * prior `CellState` object, which `Learning.prior_state_ref` (a bare
 * string) does not carry — so it is computed once, at record-creation time
 * (`actionLifecycle.ts::recordLearning`, which has both real CellStates in
 * scope), and stored alongside the `Learning` record here, exactly the same
 * "necessary store-level addition, not a canon-schema change" reasoning
 * `NeedRecord.status`/`ActionRecord.recorded_at` already use.
 *
 * **`delta: null` is a real, meaningful value — not "not computed".** A
 * `no_update` `Learning` (claimed-only, unverified, insufficient evidence,
 * expired, or cell-identity-mismatched) has no accepted `state_prime`, so
 * there is nothing to compute a delta between; `delta` is `null` for every
 * such record, honestly, never a fabricated zero. This is the concrete,
 * persisted form of "NO VERIFIED EFFECT != NO EFFECT" carried one stage
 * further: a `no_update` Learning is still a REAL, STORED record (the
 * Learning was attempted and reasoned about), it simply carries no delta.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type Learning, type LearningError, validateLearning } from "./learning";
import { parseOffsetInstant } from "./observation";
import type { StateDelta } from "./stateDelta";

export const LEARNING_STORE_FILENAME = "learnings.jsonl";

/** Wraps the real, unmodified `Learning` type. See module header for
 *  `delta`'s provenance — computed once at creation, never re-derived from
 *  a stored record's own fields (it has none to re-derive from). */
export interface LearningRecord {
  learning: Learning;
  recorded_at: string;
  delta: StateDelta | null;
}

export const LEARNING_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_learning_id",
  "learning_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_learning",
] as const;

export type LearningAppendRejectionCode = (typeof LEARNING_APPEND_REJECTION_CODES)[number];

export interface LearningAppendRejection {
  code: LearningAppendRejectionCode;
  learning_id?: string;
  message: string;
  errors?: LearningError[];
}

export type LearningAppendCheck = { ok: true } | { ok: false; rejections: LearningAppendRejection[] };

/** Pure and total: never throws, never mutates its arguments. */
export function checkLearningAppend(
  stored: readonly LearningRecord[],
  incoming: readonly LearningRecord[],
): LearningAppendCheck {
  const rejections: LearningAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one Learning record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.learning?.learning_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.learning?.learning_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "learning_id_already_stored",
        learning_id: id,
        message: `${id} is already in the learning log; the log is append-only — a re-evaluation is a NEW record with a new id, never an edit`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_learning_id", learning_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(r?.recorded_at) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        learning_id: id,
        message: `recorded_at "${String(r?.recorded_at)}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = validateLearning(r?.learning as Learning);
    if (!validation.valid) {
      rejections.push({ code: "invalid_learning", learning_id: id, message: "Learning failed structural validation", errors: validation.errors });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class LearningAppendRejectedError extends Error {
  readonly rejections: readonly LearningAppendRejection[];
  constructor(rejections: readonly LearningAppendRejection[]) {
    super(`Learning append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "LearningAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface LearningStore {
  load(): Promise<LearningRecord[]>;
  append(records: readonly LearningRecord[]): Promise<LearningRecord[]>;
}

/** Deterministic order: `recorded_at` ascending, tie-broken by `learning_id`. */
export function inLearningOrder(records: readonly LearningRecord[]): LearningRecord[] {
  return [...records].sort((a, b) =>
    a.recorded_at === b.recorded_at
      ? a.learning.learning_id.localeCompare(b.learning.learning_id)
      : a.recorded_at.localeCompare(b.recorded_at),
  );
}

export class InMemoryLearningStore implements LearningStore {
  private records: LearningRecord[];
  constructor(bootstrap: readonly LearningRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<LearningRecord[]> {
    return inLearningOrder(this.records);
  }
  async append(incoming: readonly LearningRecord[]): Promise<LearningRecord[]> {
    const check = checkLearningAppend(this.records, incoming);
    if (!check.ok) throw new LearningAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class LearningLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable Learning record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "LearningLogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Durable, file-system-backed store — mirrors the other three stores
 *  exactly, at a DIFFERENT file (`learnings.jsonl`). */
export class FileSystemLearningStore implements LearningStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, LEARNING_STORE_FILENAME);
  }

  private readStored(): LearningRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: LearningRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as LearningRecord);
      } catch {
        throw new LearningLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<LearningRecord[]> {
    return inLearningOrder(this.readStored());
  }

  async append(incoming: readonly LearningRecord[]): Promise<LearningRecord[]> {
    const check = checkLearningAppend(this.readStored(), incoming);
    if (!check.ok) throw new LearningAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
