/**
 * Philos Canon — NeedStore: the first persistence primitive for `Need`
 * (canon §12, `./need.ts`). Real Need persistence, tonight's slice.
 *
 * **Why a separate store, not a second `canon_type` on `CanonEventStore`**:
 * `canonEventStore.ts`'s own header states this exact boundary as already
 * decided — "Scope, exactly as approved: Observation remains the only
 * supported canon_type for live append... No second canon_type" — and
 * `canonEventStoreAccessor.ts` documents the SAME pattern being applied to
 * itself relative to the legacy `philos-event-store.ts`: "without merging
 * the two stores." This file applies that identical, already-proven
 * discipline one level further: `Need` is real, canon-owned data (`need.ts`,
 * unmodified, imported not reimplemented), but it is not an Observation, so
 * it does not go in `canon-events.jsonl` — it gets its OWN file
 * (`needs.jsonl`), its OWN store class, its OWN append-rejection codes,
 * mirroring `CanonEventStore`'s exact architecture (append-only; reject-
 * not-silently-ignore a duplicate id; a pure `checkX` gate separate from the
 * store class; JSONL persistence) rather than inventing a new one.
 *
 * **`need.need_id` is the real identity — no new id scheme.** `Need`
 * (`need.ts`) already carries its own `need_id: string`. Unlike
 * `CanonEvent`/`Observation` (where Observation has no id of its own and the
 * wrapper mints `canon_event_id`), this store's `NeedRecord` wraps a `Need`
 * that already has a real identity — reused verbatim, nothing minted here.
 *
 * **`status`, and why this slice does not implement transitions.** `Need`
 * lifecycle needs a status, so `NeedRecord.status` is real and required —
 * but this store, tonight, only supports CREATE: appending a SECOND record
 * for a `need_id` already stored is REJECTED (`need_id_already_stored`),
 * the exact same "a correction is a new event, never an edit" discipline
 * `checkAppend`/`checkCanonAppend` already apply. A real transition model
 * (open → matched → withdrawn → expired, as new append-only records) is a
 * deliberate next slice, not built here — the field exists and is honest
 * today ("open", set once, at creation), it does not yet change.
 *
 * **Validation reuses `validateNeed` (`need.ts`) verbatim — no parallel
 * Need model.** `checkNeedAppend` runs it as a final gate before
 * persistence, the same "defense in depth" reasoning `checkCanonAppend`
 * already documents for `validateCanonEvent`.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type Need, type NeedError, validateNeed } from "./need";
import { parseOffsetInstant } from "./observation";

export const NEED_STORE_FILENAME = "needs.jsonl";

export type NeedStatus = "open" | "matched" | "withdrawn" | "expired";

/** Wraps the real, unmodified `Need` type. `recorded_at` is when this record
 *  was appended — distinct from `Need.time`, same discipline `CanonEvent`
 *  already applies between `recorded_at` and `payload.time`. */
export interface NeedRecord {
  need: Need;
  recorded_at: string;
  status: NeedStatus;
}

export const NEED_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_need_id",
  "need_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_need",
] as const;

export type NeedAppendRejectionCode = (typeof NEED_APPEND_REJECTION_CODES)[number];

export interface NeedAppendRejection {
  code: NeedAppendRejectionCode;
  need_id?: string;
  message: string;
  errors?: NeedError[];
}

export type NeedAppendCheck = { ok: true } | { ok: false; rejections: NeedAppendRejection[] };

/** Pure and total: never throws, never mutates its arguments — same
 *  contract as `checkCanonAppend`/`checkAppend`. */
export function checkNeedAppend(
  stored: readonly NeedRecord[],
  incoming: readonly NeedRecord[],
): NeedAppendCheck {
  const rejections: NeedAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one Need record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.need?.need_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.need?.need_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "need_id_already_stored",
        need_id: id,
        message: `${id} is already in the need log; the log is append-only, so a status change is a new record, not an edit — not yet supported by this store`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_need_id", need_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(r?.recorded_at) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        need_id: id,
        message: `recorded_at "${String(r?.recorded_at)}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = validateNeed(r?.need as Need);
    if (!validation.valid) {
      rejections.push({ code: "invalid_need", need_id: id, message: "Need failed structural validation", errors: validation.errors });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class NeedAppendRejectedError extends Error {
  readonly rejections: readonly NeedAppendRejection[];
  constructor(rejections: readonly NeedAppendRejection[]) {
    super(`Need append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "NeedAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface NeedStore {
  load(): Promise<NeedRecord[]>;
  /** Appends, or throws `NeedAppendRejectedError`. Returns the records as stored. */
  append(records: readonly NeedRecord[]): Promise<NeedRecord[]>;
}

/** Deterministic order: `recorded_at` ascending, tie-broken by `need_id` —
 *  same shape as `inCanonOrder`/`inOrder`. */
export function inNeedOrder(records: readonly NeedRecord[]): NeedRecord[] {
  return [...records].sort((a, b) =>
    a.recorded_at === b.recorded_at ? a.need.need_id.localeCompare(b.need.need_id) : a.recorded_at.localeCompare(b.recorded_at),
  );
}

export class InMemoryNeedStore implements NeedStore {
  private records: NeedRecord[];
  constructor(bootstrap: readonly NeedRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<NeedRecord[]> {
    return inNeedOrder(this.records);
  }
  async append(incoming: readonly NeedRecord[]): Promise<NeedRecord[]> {
    const check = checkNeedAppend(this.records, incoming);
    if (!check.ok) throw new NeedAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

/** Thrown when the need log on disk cannot be read. Never swallowed — same
 *  "corruption is loud" discipline as `CanonLogCorruptError`. */
export class NeedLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable Need record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "NeedLogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Durable, file-system-backed store — mirrors `FileSystemCanonEventStore`
 *  exactly in shape, at a DIFFERENT file (`needs.jsonl`, never
 *  `canon-events.jsonl`) so the two logs never share a byte of storage. */
export class FileSystemNeedStore implements NeedStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, NEED_STORE_FILENAME);
  }

  private readStored(): NeedRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: NeedRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as NeedRecord);
      } catch {
        throw new NeedLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<NeedRecord[]> {
    return inNeedOrder(this.readStored());
  }

  async append(incoming: readonly NeedRecord[]): Promise<NeedRecord[]> {
    const check = checkNeedAppend(this.readStored(), incoming);
    if (!check.ok) throw new NeedAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
