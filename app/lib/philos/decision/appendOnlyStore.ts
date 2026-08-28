/**
 * Philos — a small append-only JSONL store, shared by the two decision
 * record types.
 *
 * **Why this is generic when `canon/` duplicates.** The six stores in
 * `canon/` (`needStore`, `actionStore`, `effectStore`, `learningStore`, …)
 * are hand-duplicated, each about 150 lines, differing only in the record
 * type, the filename and the rejection-code prefix. That duplication is
 * deliberate there and is NOT refactored by this pass: those stores are
 * load-bearing for REAL data, they are individually documented against canon
 * sections, and rewriting six of them to prove a point about DRY is exactly
 * the kind of unrequested core surgery the architecture directive forbids.
 *
 * This module is new code with two new callers, so it starts shared. If a
 * third record type ever needs different append semantics, it gets its own
 * store rather than growing an options bag here.
 *
 * **What is preserved from the canon stores, exactly:** append-only (a
 * correction is a NEW record, never an edit); a pure `check` gate that is
 * total and never throws; duplicate-id rejection both against what is stored
 * and within a single append; an explicit-offset requirement on
 * `recorded_at`; refusal to read a partially-corrupt log rather than
 * silently returning the parseable prefix.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseOffsetInstant } from "../canon/observation";

export const APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_id",
  "id_already_stored",
  "ambiguous_recorded_at",
  "invalid_record",
] as const;

export type AppendRejectionCode = (typeof APPEND_REJECTION_CODES)[number];

export interface AppendRejection {
  code: AppendRejectionCode;
  id?: string;
  message: string;
  errors?: readonly unknown[];
}

export type AppendCheck = { ok: true } | { ok: false; rejections: AppendRejection[] };

/** Everything the store needs to know about one record type. */
export interface RecordSpec<TWrapped> {
  /** Human name, used only in rejection messages. */
  label: string;
  /** The stable identity of a wrapped record. */
  idOf(record: TWrapped): string | undefined;
  /** When it was written. Must be an explicit-offset instant. */
  recordedAtOf(record: TWrapped): string | undefined;
  /** Structural validation of the inner record. */
  validate(record: TWrapped): { valid: boolean; errors: readonly unknown[] };
}

export class AppendRejectedError extends Error {
  readonly rejections: readonly AppendRejection[];
  constructor(label: string, rejections: readonly AppendRejection[]) {
    super(`${label} append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "AppendRejectedError";
    this.rejections = rejections;
  }
}

export class LogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(
      `unparseable record on line ${lineNumber} of ${filePath}; refusing to read a partial log`,
    );
    this.name = "LogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Pure and total: never throws, never mutates its arguments. */
export function checkAppend<T>(
  spec: RecordSpec<T>,
  stored: readonly T[],
  incoming: readonly T[],
): AppendCheck {
  if (incoming.length === 0) {
    return {
      ok: false,
      rejections: [
        { code: "empty_append", message: `an append must carry at least one ${spec.label} record` },
      ],
    };
  }

  const rejections: AppendRejection[] = [];
  const storedIds = new Set(stored.map((r) => spec.idOf(r)));
  const seen = new Set<string>();

  for (const r of incoming) {
    const id = spec.idOf(r);

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "id_already_stored",
        id,
        message: `${id} is already in the ${spec.label} log; the log is append-only — a revision is a NEW record with a new id, never an edit`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_id", id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(spec.recordedAtOf(r)) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        id,
        message: `recorded_at "${String(spec.recordedAtOf(r))}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = spec.validate(r);
    if (!validation.valid) {
      rejections.push({
        code: "invalid_record",
        id,
        message: `${spec.label} failed structural validation`,
        errors: validation.errors,
      });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export interface AppendOnlyStore<T> {
  load(): Promise<T[]>;
  append(records: readonly T[]): Promise<T[]>;
}

/** Deterministic: `recorded_at` ascending, tie-broken by id. */
export function inRecordOrder<T>(spec: RecordSpec<T>, records: readonly T[]): T[] {
  return [...records].sort((a, b) => {
    const at = spec.recordedAtOf(a) ?? "";
    const bt = spec.recordedAtOf(b) ?? "";
    if (at !== bt) return at.localeCompare(bt);
    return (spec.idOf(a) ?? "").localeCompare(spec.idOf(b) ?? "");
  });
}

export class InMemoryAppendOnlyStore<T> implements AppendOnlyStore<T> {
  private records: T[];
  constructor(
    private readonly spec: RecordSpec<T>,
    bootstrap: readonly T[] = [],
  ) {
    this.records = [...bootstrap];
  }
  async load(): Promise<T[]> {
    return inRecordOrder(this.spec, this.records);
  }
  async append(incoming: readonly T[]): Promise<T[]> {
    const check = checkAppend(this.spec, this.records, incoming);
    if (!check.ok) throw new AppendRejectedError(this.spec.label, check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class FileSystemAppendOnlyStore<T> implements AppendOnlyStore<T> {
  private readonly filePath: string;
  constructor(
    private readonly spec: RecordSpec<T>,
    dataDir: string,
    filename: string,
  ) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, filename);
  }

  private readStored(): T[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: T[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as T);
      } catch {
        throw new LogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<T[]> {
    return inRecordOrder(this.spec, this.readStored());
  }

  async append(incoming: readonly T[]): Promise<T[]> {
    const check = checkAppend(this.spec, this.readStored(), incoming);
    if (!check.ok) throw new AppendRejectedError(this.spec.label, check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
