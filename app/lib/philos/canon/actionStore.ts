/**
 * Philos Canon — ActionStore: real persistence for `Action` (canon §13,
 * `./action.ts`). Second stage of the real Action/Effect/Learning lifecycle
 * (`ORIENTATION → PROPOSED ACTION → ACTOR → TARGET → RESOURCE → CONSTRAINT →
 * EXECUTION → EXPECTED EFFECT → OBSERVED EFFECT → EVIDENCE → DELTA →
 * LEARNING → UPDATED STATE`).
 *
 * Mirrors `needStore.ts` exactly in shape and discipline — own file
 * (`actions.jsonl`, never `canon-events.jsonl` or `needs.jsonl`), own store
 * class, own append-rejection codes, a pure `checkX` gate separate from the
 * store class, JSONL persistence, append-only (a status/outcome change is a
 * NEW record, never an edit of this one — the same "correction is a new
 * event" discipline already established for Need).
 *
 * `action.action_id` is the real identity — no new id scheme, same reasoning
 * `needStore.ts` already gives for reusing `need.need_id` verbatim.
 *
 * **Recording an Action here does not execute it and does not imply an
 * Effect** — this file is storage only. No function anywhere in this module
 * reads an `Action` and produces, infers, or fabricates an `Effect` — that
 * link is made only by an EffectStore record's own explicit `action_ref`
 * (`effectStore.ts`), checked there, never inferred here from proximity in
 * time or storage order (CHRONOLOGY != CAUSALITY, see `actionLifecycle.ts`).
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type Action, type ActionError, validateAction } from "./action";
import { parseOffsetInstant } from "./observation";

export const ACTION_STORE_FILENAME = "actions.jsonl";

/** Wraps the real, unmodified `Action` type. `recorded_at` is when this
 *  record was appended — distinct from `Action.time`, same discipline
 *  `NeedRecord` already applies between `recorded_at` and `need.time`. */
export interface ActionRecord {
  action: Action;
  recorded_at: string;
}

export const ACTION_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_action_id",
  "action_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_action",
] as const;

export type ActionAppendRejectionCode = (typeof ACTION_APPEND_REJECTION_CODES)[number];

export interface ActionAppendRejection {
  code: ActionAppendRejectionCode;
  action_id?: string;
  message: string;
  errors?: ActionError[];
}

export type ActionAppendCheck = { ok: true } | { ok: false; rejections: ActionAppendRejection[] };

/** Pure and total: never throws, never mutates its arguments — same
 *  contract as `checkNeedAppend`. */
export function checkActionAppend(
  stored: readonly ActionRecord[],
  incoming: readonly ActionRecord[],
): ActionAppendCheck {
  const rejections: ActionAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one Action record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.action?.action_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.action?.action_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "action_id_already_stored",
        action_id: id,
        message: `${id} is already in the action log; the log is append-only, so a status/outcome change is a new record, not an edit — not yet supported by this store`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_action_id", action_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(r?.recorded_at) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        action_id: id,
        message: `recorded_at "${String(r?.recorded_at)}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = validateAction(r?.action as Action);
    if (!validation.valid) {
      rejections.push({ code: "invalid_action", action_id: id, message: "Action failed structural validation", errors: validation.errors });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class ActionAppendRejectedError extends Error {
  readonly rejections: readonly ActionAppendRejection[];
  constructor(rejections: readonly ActionAppendRejection[]) {
    super(`Action append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "ActionAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface ActionStore {
  load(): Promise<ActionRecord[]>;
  /** Appends, or throws `ActionAppendRejectedError`. Returns the records as stored. */
  append(records: readonly ActionRecord[]): Promise<ActionRecord[]>;
}

/** Deterministic order: `recorded_at` ascending, tie-broken by `action_id` —
 *  same shape as `inNeedOrder`. */
export function inActionOrder(records: readonly ActionRecord[]): ActionRecord[] {
  return [...records].sort((a, b) =>
    a.recorded_at === b.recorded_at ? a.action.action_id.localeCompare(b.action.action_id) : a.recorded_at.localeCompare(b.recorded_at),
  );
}

export class InMemoryActionStore implements ActionStore {
  private records: ActionRecord[];
  constructor(bootstrap: readonly ActionRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<ActionRecord[]> {
    return inActionOrder(this.records);
  }
  async append(incoming: readonly ActionRecord[]): Promise<ActionRecord[]> {
    const check = checkActionAppend(this.records, incoming);
    if (!check.ok) throw new ActionAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

/** Thrown when the action log on disk cannot be read. Never swallowed —
 *  same "corruption is loud" discipline as `NeedLogCorruptError`. */
export class ActionLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable Action record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "ActionLogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Durable, file-system-backed store — mirrors `FileSystemNeedStore` exactly
 *  in shape, at a DIFFERENT file (`actions.jsonl`) so the three logs never
 *  share a byte of storage. */
export class FileSystemActionStore implements ActionStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, ACTION_STORE_FILENAME);
  }

  private readStored(): ActionRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: ActionRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as ActionRecord);
      } catch {
        throw new ActionLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<ActionRecord[]> {
    return inActionOrder(this.readStored());
  }

  async append(incoming: readonly ActionRecord[]): Promise<ActionRecord[]> {
    const check = checkActionAppend(this.readStored(), incoming);
    if (!check.ok) throw new ActionAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
